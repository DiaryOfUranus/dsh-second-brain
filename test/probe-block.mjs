// probe-block.mjs — acceptance probe for @xianshu/dsh-second-brain
//
// Self-contained: builds a throwaway FIXTURE brain in a temp directory, so anyone can
// reproduce the invariants without owning a real brain. No personal data, no network.
//
//   node test/probe-block.mjs
//   SB_BRAIN="$HOME/.dsh/brain" node test/probe-block.mjs   # also probe a real brain
//
// Invariants asserted here are the ones the README promises:
//   bounded (length <= cap) · pointer/boundary lines survive · identity + fingerprint
//   present · missing brain root degrades instead of throwing · maxChars < 300 is
//   refused loudly · the plugin never writes to the brain.
import { mkdtempSync, writeFileSync, rmSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildBlock, apply } from '../lib/index.js';

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: !!ok, detail });
const section = (t) => console.log(`\n=== ${t} ===`);

function makeFixture() {
  const root = mkdtempSync(join(tmpdir(), 'sbx-'));
  writeFileSync(join(root, 'VERSION.json'), JSON.stringify({
    current_version: 'v9.9.9', state_seq: 42, git_backed: true,
    last_export_at: '2026-01-02T03:04:05.000Z',
  }));
  writeFileSync(join(root, 'MEMORY-PERMANENT.md'), [
    '# 永久记忆',
    '',
    '## 一、我是谁',
    '- **名**：样例实例。**位**：测试位。',
    '- **宿主**：DSH。**脑根**：fixture。',
    '- 第三条身份条目。',
    '',
    '## 二、不相关章节',
    '- 这一节不该被注入。',
    '',
    '## 三、我怎么干活',
    '> 这里是给维护者的忠告，不是纪律（压缩时应被丢弃）。',
    '- 先读后写，逐数字回溯。',
    '- 只追加不抹。',
    '- 第三条纪律。',
    '',
  ].join('\n'));
  writeFileSync(join(root, 'ledger.md'),
    '- [ ] 未决一\n- [ ] 未决二\n中间行 - [ ] 不该计\n- [x] 已完成\n');
  return root;
}

const snap = (dir) => readdirSync(dir).sort()
  .map((f) => `${f}:${statSync(join(dir, f)).mtimeMs}`).join('|');

const fixture = makeFixture();
const caps = [1, 50, 300, 400, 600, 1000, 4000];
const boundaryCaps = [300, 400, 600, 1000, 4000];
const MARK = '已按 maxChars 截断';

section('① 内容正确性（fixture 脑，默认上限）');
const base = buildBlock({ brainRoot: fixture });
console.log(base);
check('含标题与"快照"声明', base.includes('第二大脑') && base.includes('快照'));
check('含脑根', base.includes(fixture));
check('含 state_seq 指纹', /state_seq=42\b/.test(base));
check('含 version 指纹（取自 VERSION.json）', base.includes('version=v9.9.9'));
check('含永久记忆时间戳', /永久记忆 @\d{4}-\d{2}-\d{2}T/.test(base));
check('含未决项计数（只数 "- [ ]"，本 fixture 为 2）', base.includes('未决项：2 条'));
check('含身份条目', base.includes('样例实例'));
check('含纪律条目', base.includes('只追加不抹'));
check('丢弃引用块忠告（不挤占预算）', !base.includes('给维护者的忠告'));
check('丢弃无关章节', !base.includes('这一节不该被注入'));

section('② 有界 + 指针/边界行存活（任何上限下都必须成立）');
for (const cap of caps) {
  const out = buildBlock({ brainRoot: fixture, maxChars: cap });
  check(`上限 ${cap}：长度 ${out.length} ≤ 上限`, out.length <= cap);
}
for (const cap of boundaryCaps) {
  const out = buildBlock({ brainRoot: fixture, maxChars: cap });
  check(`上限 ${cap}：边界行存活（以现读为准）`, out.includes('以现读为准'));
  check(`上限 ${cap}：指针行存活`, out.includes('sb.cmd look'));
}
const tight = buildBlock({ brainRoot: fixture, maxChars: 300 });
check('上限 300：未发生静默截断（无截断标记）或仍保住边界',
  !tight.includes(MARK) || tight.includes('以现读为准'));

section('③ 降级：脑根不存在不得抛异常');
let degraded = '';
try {
  degraded = buildBlock({ brainRoot: join(tmpdir(), 'sbx-does-not-exist-' + Date.now()) });
  check('不抛异常', true);
} catch (e) {
  check('不抛异常', false, e.message);
}
check('明示"未找到"而非假装有数据', degraded.includes('未找到'));
check('降级时仍守住边界行', degraded.includes('以现读为准'));

section('④ fail-loud：maxChars 低于下限 300 必须拒绝注册（不得静默 drop）');
{
  const logs = [];
  let registered = false;
  const fakeCtx = {
    logger: { info: () => {}, warn: () => {}, error: (...a) => logs.push(a.join(' ')) },
    systemPrompt: { context: () => { registered = true; } },
  };
  apply(fakeCtx, { maxChars: 120, brainRoot: fixture });
  check('打印 REFUSED', logs.some((l) => l.includes('REFUSED')));
  check('拒绝理由点名后果（静默丢弃/指针）', logs.some((l) => l.includes('静默丢弃') || l.includes('指针')));
  check('拒绝后确实未注册', registered === false);
}

section('⑤ 开关语义与注册契约（装 ＝ 开；关须显式）');
{
  const calls = [];
  const mk = () => ({
    logger: { info: () => {}, warn: () => {}, error: () => {} },
    systemPrompt: { context: (arg) => calls.push(arg) },
  });
  apply(mk(), { brainRoot: fixture });
  check('默认（无 config）⇒ 注册一次', calls.length === 1);
  check('注册名正确', calls[0]?.name === 'xianshu-second-brain');
  check('默认 order = 200', calls[0]?.order === 200);
  check('text 为函数形态（每次装配现读）', typeof calls[0]?.text === 'function');
  check('text() 产出有界块', (() => {
    const t = calls[0].text();
    return typeof t === 'string' && t.length > 0 && t.includes('以现读为准');
  })());
  calls.length = 0;
  apply(mk(), { inject: false, brainRoot: fixture });
  check('inject:false ⇒ 不注册', calls.length === 0);
  calls.length = 0;
  const env = process.env.DSH_SB_INJECT;
  process.env.DSH_SB_INJECT = '0';
  apply(mk(), { brainRoot: fixture });
  check('DSH_SB_INJECT=0 ⇒ 不注册', calls.length === 0);
  if (env === undefined) delete process.env.DSH_SB_INJECT; else process.env.DSH_SB_INJECT = env;
}

section('⑥ 只读：跑完全部用例后脑文件不得被改写');
{
  const before = snap(fixture);
  buildBlock({ brainRoot: fixture });
  buildBlock({ brainRoot: fixture, maxChars: 400 });
  apply({ logger: {}, systemPrompt: { context: () => {} } }, { brainRoot: fixture });
  const after = snap(fixture);
  check('fixture 脑内容与 mtime 均未变', before === after);
}

section('⑦ 末节与极长脑根（v0.1.4 两条回归）');
{
  // 回归 1：目标节恰是文件最后一节。
  //   旧版尾锚写作 `\Z` —— JS 正则里那不是"串尾"而是字面量 `Z` ⇒ pick() 恒空 ⇒ 该节静默丢弃。
  //   本 fixture 的 MEMORY-PERMANENT.md 正是「§三 在最后」，故 ① 的「含纪律条目」即本条回归。
  check('回归·末节可被拾取（§三 为最后一节）', base.includes('只追加不抹'));

  // 回归 1b：整份文件只有一节，且那一节即末节。
  const solo = mkdtempSync(join(tmpdir(), 'sbx-solo-'));
  writeFileSync(join(solo, 'MEMORY-PERMANENT.md'), '## 一、我是谁\n\n- **名**：独节实例。\n');
  const soloOut = buildBlock({ brainRoot: solo });
  check('回归·单节文件（§一 即末节）仍拾取到身份', soloOut.includes('独节实例'));
  rmSync(solo, { recursive: true, force: true });

  // 回归 2：脑根极长 + 上限 300。旧版盲切 body ⇒ 尾部 tail（指针/边界行）被吃掉。
  const longRoot = 'C:\\' + 'x'.repeat(180) + '\\.dsh\\brain';
  const out = buildBlock({ brainRoot: longRoot, maxChars: 300 });
  const kept = out.includes('以现读为准');
  const ptr = out.includes('sb.cmd look');
  console.log(`  脑根 ${longRoot.length} 字符 + 上限 300 ⇒ 长度 ${out.length}，边界行${kept ? '存活' : '被截断'}，指针行${ptr ? '存活' : '被截断'}`);
  check('回归·脑根极长时仍不超上限', out.length <= 300);
  check('回归·脑根极长时边界行存活', kept);
  check('回归·脑根极长时指针行存活', ptr);
  check('回归·截断处有明确标记（不假装完整）', out.includes(MARK));
}

const real = process.env.SB_BRAIN;
if (real) {
  section('⑧ 真脑抽样（SB_BRAIN 指定，仅结构性检查）');
  try {
    const out = buildBlock({ brainRoot: real });
    check(`真脑：能构建且不超默认上限`, out.length <= 1000);
    check('真脑：含指纹 state_seq', /state_seq=\d+/.test(out));
    check('真脑：边界行存活', out.includes('以现读为准'));
    console.log(`  真脑块长 ${out.length} 字符`);
  } catch (e) {
    check('真脑：构建不抛异常', false, e.message);
  }
}

rmSync(fixture, { recursive: true, force: true });

console.log('');
let ok = 0;
for (const r of results) {
  console.log(`  ${r.ok ? '✅' : '✗'} ${r.name}${r.detail ? `  [${r.detail}]` : ''}`);
  if (r.ok) ok++;
}
const pass = ok === results.length;
console.log(`\n结论: ${ok}/${results.length} ${pass ? 'PASS' : 'FAIL'}`);
process.exit(pass ? 0 : 1);
