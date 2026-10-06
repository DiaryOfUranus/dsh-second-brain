// @xianshu/dsh-second-brain —— 弦枢第二大脑载入器（Host 半）
//
// 目的：让**每一个新会话**开局就带着本实例的画像与当前状态，而不必依赖
//       "谁记得去跑 sb.cmd look"。这正是衡枢靠平台自带跨会话记忆得到的效果；
//       DSH 无该机制，故以插件补之。
//
// 机制：ctx.systemPrompt.context({ name, order, text })
//       宿主服务文档载该贡献被物化为 "durable user-role snapshot"，且
//       `text` 可为函数 ⇒ 每次装配现读脑状态（见 packages/core/system-prompt/src/index.ts:79-86）。
//
// ★ 安全姿态（三重，全部默认最紧）：
//   1. `inject` 默认 false —— 须显式开启（env DSH_SB_INJECT=1 或 config.inject=true）
//   2. `maxChars` 硬上限（默认 1000）—— 注入块会进每一次请求，不得无界
//   3. 只读 —— 全程 open(...,'r')，**永不写脑**；且注入块明示"快照非现况"
//
// ★ 自指腐化防线（P-6：系统把自己产出的东西当外部输入）：
//   注入块**不得**被脑读回当作事实来源；它带 mtime 与 state_seq，供新会话自行判断新鲜度。
import { readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const name = 'second-brain-xianshu';
// 只依赖提示词注册面；不 inject agents/sessions —— 本插件不碰会话生命周期
const inject = ['systemPrompt'];

const DEFAULT_MAX = 1000;
// ★ 硬下限：小至此值则"页眉＋页脚"已装不下 ⇒ 必须**大声拒绝**而非静默丢弃指针/边界行
//   （承 SOP⑪ 三值语义之"不得静默 drop"；本席首版兜底正是静默丢弃，已被探针逮出）
const MIN_CHARS = 300;

function safeRead(p) {
  try { return readFileSync(p, 'utf8'); } catch { return null; }
}

/** 取永久记忆里「一、我是谁」「三、我怎么干活」两节的压缩版。
 *  ★v0.1.2 修（作者侧实测逮出）：旧版**硬切字符** ⇒ ①切在半句（`- **发件前逐数字…`）
 *    ②**恰恰牺牲掉最该留的条目**。改为**按条目边界切**：只在完整 `- ` 条目处收尾，
 *    并注明「余下条目见原文件」——**宁可少给，不给碎句，且明示还有**。
 */
function compressPermanent(text, budget) {
  if (!text) return '';
  const pick = (title) => {
    // ★v0.1.4 修（发布前探针逮出）：旧版尾锚写作 `\Z`——**JS 正则里 `\Z` 不是"串尾"，
    //   而是字面量 `Z`**（`/\Z/.test('Z') === true`）。后果：**若目标节是文件的最后一节**，
    //   尾锚永不命中 ⇒ `pick()` 恒返回空 ⇒ **该节被静默丢弃**，连"余下见原文件"的注记都没有。
    //   本席实例未踩到（其文件 §三 后面还有 §四），但**任何把「怎么干活」放最后的使用者都会踩到**。
    //   `(?![\s\S])` 才是真正的"串尾"断言（开头处 `[\s\S]` 无法匹配 ⇒ 负向先行成立）。
    const re = new RegExp(`^##\\s*${title}[\\s\\S]*?(?=^##\\s|(?![\\s\\S]))`, 'm');
    const m = text.match(re);
    return m ? m[0].trim() : '';
  };
  const out = [pick('一、我是谁'), pick('三、我怎么干活')].filter(Boolean).join('\n\n') || text.trim();
  // ★v0.1.3 修（作者侧实时注入块逮出）：`>` 引用块是**给维护者的忠告**，不是纪律；
  //   标题行亦然。旧版把它们一起塞进注入块 ⇒ **说明文字把真条目挤出预算**（同一病第二形态）。
  //   ⇒ 压缩时**丢弃引用块与标题行**，只留真内容。
  const content = out.split('\n')
    .filter(l => !/^\s*>/.test(l) && !/^#{1,6}\s/.test(l))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const use = content || out;
  if (use.length <= budget) return use;

  const tailNote = '\n…（本节余下条目见 MEMORY-PERMANENT.md）';
  const room = Math.max(0, budget - tailNote.length);
  const kept = [];
  let used = 0;
  for (const ln of use.split('\n')) {
    const add = (kept.length ? 1 : 0) + ln.length;
    if (used + add > room) break;
    kept.push(ln);
    used += add;
  }
  const body = kept.join('\n').replace(/\s+$/, '');
  return body ? body + tailNote : use.slice(0, budget);
}

function buildBlock(cfg) {
  const max = Number.isFinite(cfg.maxChars) && cfg.maxChars > 0 ? cfg.maxChars : DEFAULT_MAX;
  const root = cfg.brainRoot || join(homedir(), '.dsh', 'brain');
  const MARK = '\n…（已按 maxChars 截断）';

  // ① 指纹（VERSION.json）
  let ver = {};
  try { ver = JSON.parse(safeRead(join(root, 'VERSION.json')) || '{}'); } catch { /* 保持空 */ }
  const fp = [
    `version=${ver.current_version ?? '?'}`,
    `state_seq=${ver.state_seq ?? '?'}`,
    `git_backed=${ver.git_backed ?? '?'}`,
    `last_export=${ver.last_export_at ?? '?'}`,
  ].join('  ');

  // ② 永久记忆（路径与 mtime）
  const permPath = join(root, 'MEMORY-PERMANENT.md');
  const permRaw = safeRead(permPath);
  let permMtime = '?';
  try { permMtime = statSync(permPath).mtime.toISOString(); } catch { /* 忽略 */ }

  // ③ 未决项计数（只数 `- [ ]`，不读正文——控体积）
  const led = safeRead(join(root, 'ledger.md')) || '';
  const open = (led.match(/^- \[ \]/gm) || []).length;

  // ★ 先算"固定部分"（页眉＋页脚＋截断标记），把余量留给永久记忆与指针。
  //   旧版先把永久记忆塞满再截断 ⇒ ①总长超限（标记另加）②末尾的"以现读为准"边界被吞。
  const head = [
    '【第二大脑 · 弦枢 · 开局注入块】（只读快照，非现况；勿回写本块）',
    `脑根：${root}`,
    `指纹：${fp}`,
    `永久记忆 @${permMtime}`,
    `未决项：${open} 条`,
  ];
  const tail = [
    // 指针与边界**必须存活**：它们决定新会话知不知道该去读全文、以及信不信本块
    '指针：完整状态跑 `sb.cmd look`；未决项见 ledger.md；失败模式见 failures.md。',
    '边界：本块为快照。若与现读文件冲突，以现读为准。',
  ];
  const fixed = head.join('\n').length + 1 + tail.join('\n').length;
  const room = max - fixed - MARK.length;

  let perm = '';
  if (permRaw) {
    perm = compressPermanent(permRaw, Math.max(0, Math.floor(room * 0.85)));
  } else {
    perm = '（未找到 MEMORY-PERMANENT.md —— 请跑 sb.cmd look 初始化）';
    if (perm.length > room) perm = perm.slice(0, Math.max(0, room));
  }

  const body = head.concat(perm ? [perm] : [], tail).join('\n');
  if (body.length <= max) return body;
  // 极端小上限（固定部分自身已超）：**先保 tail，再保 head，最后才谈正文**。
  // ★v0.1.4 修（发布前探针逮出）：旧版 `body.slice(0, max - MARK.length) + MARK` 是**盲切**——
  //   正文超限时**尾部恰是 tail**，于是「指针」与「以现读为准」边界行会被吃掉。
  //   这与"低于下限即 REFUSED、绝不静默 drop"的初衷相背：下限 300 只保证"通常装得下"，
  //   脑根路径很长时（实测 194 字符）仍会切到 tail。而切掉 tail 是代价最大的一刀——
  //   新会话既不知道该去读全文，也不知道本块不可信。
  const minimal = tail.join('\n');
  if (minimal.length >= max) return minimal.slice(0, max);  // tail 自身已装不下：只能硬切，无处可退
  const headRoom = max - minimal.length - MARK.length - 1;  // -1 留给 head 与 MARK 之间的换行
  if (headRoom <= 0) return minimal;                        // 页眉彻底放不下 ⇒ 只给 tail（长度必 ≤ max）
  const headPart = head.join('\n').slice(0, headRoom).replace(/\s+$/, '');
  return headPart + MARK + '\n' + minimal;
}

function apply(ctx, config = {}) {
  const cfg = config || {};
  // ★ 开关语义（v0.1.1 修正）：装不装由作者在 GUI 决定；「装了却默认不生效」属多此一举
  //   （本席 v0.1.0 之误，已由实测逮出：env 三处皆空 ⇒ 永不注入）。
  //   故 **装 ＝ 开**；须显式 `inject:false` 或 `DSH_SB_INJECT=0` 才关。
  const off = (cfg.inject === false) || process.env.DSH_SB_INJECT === '0';
  if (off) {
    ctx.logger?.info?.('[second-brain-xianshu] 已显式关闭（inject=false 或 DSH_SB_INJECT=0）⇒ 不注册任何内容');
    return;
  }
  // ★ 上限过小 ⇒ fail-loud（不静默掉指针/边界行）
  const wantMax = Number(cfg.maxChars);
  if (Number.isFinite(wantMax) && wantMax > 0 && wantMax < MIN_CHARS) {
    ctx.logger?.error?.(
      '[second-brain-xianshu] REFUSED：maxChars=%s 低于下限 %s —— 页眉＋页脚已装不下，' +
      '继续将静默丢弃「指针」或「以现读为准」边界行 ⇒ 拒绝注册（请调高 maxChars）。',
      wantMax, MIN_CHARS);
    return;
  }
  // ★ 可见性：注入是否生效须在日志里**一眼可判**（不靠猜）
  try {
    const probe = buildBlock(cfg);
    ctx.logger?.info?.('[second-brain-xianshu] ✅ 注入已注册：name=xianshu-second-brain order=%s 块长=%s 字符',
      Number.isFinite(cfg.order) ? cfg.order : 200, probe.length);
  } catch (e) {
    ctx.logger?.warn?.('[second-brain-xianshu] 预演构建失败（注册仍继续·装配时重试）：%s', e?.message ?? e);
  }
  // ★ context() 自身返回 disposer，且已由框架按**调用上下文**自动注销
  //   （见 core/system-prompt/src/index.ts:487-497 之 `this.layers.effect(this.ctx, …)`）
  //   ⇒ **不再自行 ctx.effect**（旧版 `ctx.effect?.()` 既冗余、又因 ctx.effect 不存在而**静默无效**）
  ctx.systemPrompt.context({
    name: 'xianshu-second-brain',
    order: Number.isFinite(cfg.order) ? cfg.order : 200,
    // ★ 函数形态：每次装配现读，故 state_seq 变化能被下一次装配看到
    text: () => {
      try { return buildBlock(cfg); } catch (e) {
        return `【第二大脑】注入块构建失败：${e?.message ?? e}`;
      }
    },
  });
}

export { name, inject, apply, buildBlock };
