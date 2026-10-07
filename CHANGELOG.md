# Changelog

`@xianshu/dsh-second-brain` — 第二大脑载入器 / Second Brain loader for DeepSeek Harness.

> v0.1.0–v0.1.3 的条目依**代码注释与插件自述重建**（该三期未随仓库发布）；
> **v0.1.4 为首次公开发布**，条目为本次实测。

## v0.1.6 — 2026-10-07

### Fixed
- **README 版本徽章改为动态（根治）**。此前是硬编码 `badge/version-0.1.4`，升 0.1.5 时漏改，且它被打进
  npm 0.1.5 的 tarball ⇒ **npm 包页面因此显示 0.1.4**（npm 版本不可覆盖，只能再发一版）。
  今改为 shields.io 的 **npm 动态徽章**（`img.shields.io/npm/v/@xianshu/dsh-second-brain`），
  它读的是 registry 上的当前版本 —— **今后不会再过期**。

  > 这一条本身就是本节反复出现的病根的一个实例：**凡能从源头读的，就不要手写常量。**

### Notes
- **代码零改动**：`lib/index.js` 与 `cordis.patch.yml` 与 0.1.5 逐字节相同。
- 本版仅含：动态徽章（中英 README）+ 版本号。

## v0.1.5 — 2026-10-07

### Added
- **npm 发布**：`@xianshu/dsh-second-brain@0.1.5` 已上架 `registry.npmjs.org`（MIT / public）。
  入口终于**不需要 `git`、也不需要 `github.com`**。在**当初旧入口失败的那台主机**（`git` 不在 `PATH`、
  `github.com:443` 不通）端到端实测走通：
  `pnpm add @xianshu/dsh-second-brain`（npm 官方源 ✅ ／ npmmirror 淘宝源 ✅）
  → 按包名 `import` 成功（`name=second-brain-xianshu`）
  → 对真脑构建注入块 **844 字符**（「以现读为准」边界行与 `state_seq` 指纹均在）
  → 包内 `test/probe-block.mjs` **48/48 PASS**。
- **`test/` 纳入发布包**：此前 `files` 未含 `test/`，而 `scripts.test` 指向 `test/probe-block.mjs`
  ⇒ **装上包的人跑 `npm test` 会直接失败**。今修。tarball 21,392 B / 8 件。

### Changed
- README（中英）安装段改为**四条路按前置条件排序**：npm 居首（不需 git、不需 github.com），
  目录次之，本地克隆再次，`github:` 降为**路线 D** 并写明前置条件；新增「入口是走通的」实测区块。
- 版本号 0.1.4 → 0.1.5，使 **npm 版本 == git tag == main** 三者一致（v0.1.4 时 tag 内还是旧文档）。

### 诚实边界
- **「在 GUI 里点添加插件」这一步未实机执行**——那会改动作者 profile（＝控制面）。已实证的是**其底层
  机制**：`pnpm add <包名>` 的解析与安装、按包名导入、对真脑构建、包内探针，全通过。
- npm 侧另存在一个 `0.0.0-stage` 版本，其自述为 *"Temporary package placeholder for staged
  publishing"* —— 系 **npm 分阶段发布机制自动产生的占位版本**（时间线：占位 00:16:47Z → 0.1.5 于
  00:18:04Z），非人为多发；`dist-tags.latest` 指向 `0.1.5`，安装不受影响。

## v0.1.4 — 2026-10-06

发布前验收探针逮出的**两条"静默出错"缺陷**修复（与 v0.1.1–v0.1.3 同一病根：
出错时不响，只把内容悄悄少给）。

### Fixed
- **末节静默丢弃** — `lib/index.js` → `compressPermanent()` → `pick()`。
  节选取的尾锚旧写作 `\Z`，但 **JS 正则里 `\Z` 不是"串尾"，而是字面量 `Z`**
  （`/\Z/.test('Z') === true`，`RegExp('a[\\s\\S]*?(?=x|\\Z)').exec('abc') === null`）。
  后果：**若「一、我是谁」或「三、我怎么干活」恰是文件最后一节，`pick()` 恒返回空 ⇒
  该节被静默丢弃**，且因为走了"两节皆空"的整体回退分支，连「余下条目见原文件」的注记都没有。
  改用 `(?![\s\S])` —— 真正的串尾断言。
  作者实例未踩到（其 §三 之后还有 §四），但**任何把「怎么干活」放在最后的使用者都会踩到**。
- **盲切吃掉指针/边界行** — `lib/index.js` → `buildBlock()` 的极窄上限分支。
  正文超限时旧实现为 `body.slice(0, max - MARK.length) + MARK`，而**块尾恰是 `tail`**，
  于是「指针」与「以现读为准」边界行会被切掉——与"低于下限即 REFUSED、绝不静默 drop"的
  初衷相背。下限 300 只保证"通常装得下"；**脑根路径很长时（实测 194 字符 + 上限 300）仍会切到 tail**。
  改为**先保 `tail`、再保 `head`、最后才谈正文**，并保留截断标记。

### Added
- `test/probe-block.mjs` — 自建**合成脑 fixture** 的验收探针，**无需任何个人数据**即可复算：
  有界性（任何上限下 `长度 ≤ 上限`）、指针/边界行存活、缺失脑根降级不抛、`maxChars < 300`
  必须 fail-loud 拒绝、开关语义（装 ＝ 开）、只读性（跑完全部用例脑文件 mtime 不变），
  以及上述两条回归。现状 **48/48 PASS**（`node test/probe-block.mjs`，exit 0，**不设** `SB_BRAIN`）；
  若设 `SB_BRAIN` 指向真脑，另加 3 项真脑抽样 ⇒ **51/51 PASS**。

### Notes
- 注入格式、开关语义、`maxChars` 默认值（代码 1000 / 随包 patch 1300）与下限 300 均**未改动**。
- 本机以 `link:` 安装的副本若仍是 0.1.3，须同步文件并**重启 DSH** 才生效
  （插件模块在 boot 时加载，不热重载）。

### Corrected after publication — 2026-10-06

- **安装入口写错了，已更正。** 发布时 README 与 Release 说明推荐的裸写法
  `github:DiaryOfUranus/dsh-second-brain` **当时从未被真正走通一次**；发布后才走，发现它
  **在本机直接失败**：
  ① `git` 不在 `PATH` ⇒ `pnpm` 报 `'git' 不是内部或外部命令`（本机其实装了 PortableGit，
     只是没进 PATH）；
  ② 把 `git` 加回 `PATH` 后**仍失败**于 `Failed to connect to github.com:443 after 21075 ms`
     （Windows 侧到 github.com 间歇性不通；WSL 侧可通）；
  ③ **固定完整 commit SHA 也绕不开**——pnpm 对 `github:` 一律走 git fetcher（实测否定了我原先
     「固定 SHA 即可免 git」的推断）。
  ⇒ README（中英双语）改为：**零前置条件的「下载 zip → 解压 → 添加插件填目录」列为路线 A**，
  `github:` 降为路线 C 并**写明前置条件**；Release 说明同步更正。**代码未改动。**

## v0.1.3 — 2026-10-05
- 压缩时**丢弃引用块（`>`）与标题行**：它们是给维护者的忠告，不是纪律；旧版把它们一起塞进
  注入块 ⇒ **说明文字把真条目挤出预算**（同一病的第二形态）。
- 新增 `MIN_CHARS = 300` 下限 + fail-loud：上限低于下限时**拒绝注册并打印理由**
  （点名会静默丢弃「指针」或边界行），不再静默降级。
- 随包 patch 的 `maxChars` 由 1000 提至 **1300**：首次实活块只装下 2 条纪律，而 §一（身份）
  不可压 ⇒ 上限须同时承载 §三。
- 注册成功时打印块长（`✅ 注入已注册：… 块长=NNN 字符`），使"是否生效"**一眼可判**，不靠猜。

## v0.1.2 — 2026-10-05
- 截断由**硬切字符**改为**按条目边界切**：旧版会切在半句（`- **发件前逐数字…`），且恰恰
  **牺牲掉最该保留的条目**。新版只在完整 `- ` 条目处收尾，并注明「余下条目见原文件」——
  **宁可少给，不给碎句，且明示还有**。

## v0.1.1 — 2026-10-05
- **开关语义反转：装 ＝ 开。** v0.1.0 默认关闭，实测证明本末倒置：桌面版进程不由 shell 派生，
  `DSH_SB_INJECT` 在 shell／用户级注册表**三处皆空** ⇒ 插件永不注入；而 **GUI 的安装动作本身
  即为 consent**。要关须**显式** `inject: false` 或 `DSH_SB_INJECT=0`。
- 删除 `ctx.effect?.(() => dispose)`：`context()` **自身返回 disposer 且框架已按调用上下文自动
  注销**；旧写法既冗余，又因 `ctx.effect` 不存在而**静默无效**。

## v0.1.0 — 2026-10-05
- 首版：以 `ctx.systemPrompt.context({ name, order, text })` 挂载，每个新会话注入一块脑快照
  （身份 ＋ 状态指纹 ＋ 未决项计数 ＋ 指针与边界）；**只读、零依赖**。`text` 取函数形态，
  使每次装配现读脑状态。
