# dsh-second-brain（第二大脑载入器）

[English README](README.md) · **中文说明**

> **让 DeepSeek Harness 每次开新会话时，自动带着你的第二大脑画像与当前状态。**
> 只读 · 零写入 · 有硬上限 · 零依赖。
> **标签：记忆 · 工作流 · 本地优先 · 隐私优先 · DSH 插件。**

[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/@xianshu/dsh-second-brain.svg)](https://www.npmjs.com/package/@xianshu/dsh-second-brain)
[![dsh-plugin](https://img.shields.io/badge/DeepSeek%20Harness-plugin-4B6EF5.svg)](#安装)
[![node](https://img.shields.io/badge/node-%3E%3D18-3c873a.svg)](#安装)
[![dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](package.json)
[![read-only](https://img.shields.io/badge/%E8%84%91-%E5%8F%AA%E8%AF%BB-lightgrey.svg)](#安全姿态三重)

`@xianshu/dsh-second-brain` 是一个 **DeepSeek Harness（DSH）宿主插件**。它在**每一次会话装配提示词**时，
把一个**有硬上限、带时间戳的第二大脑快照**（身份 ＋ 状态指纹 ＋ 未决项计数 ＋ 指针与边界）注入进去。

一句话：**新会话不该从零开始**——它开局就该知道「本实例是谁」，以及「真状态在哪」。

```text
【第二大脑 · 弦枢 · 开局注入块】（只读快照，非现况；勿回写本块）
脑根：C:\Users\you\.dsh\brain
指纹：version=v0.1.0  state_seq=120  git_backed=true  last_export=2026-10-06T20:51:29+08:00
永久记忆 @2026-10-06T10:17:54.099Z
未决项：25 条
## 一、我是谁
- **名**：…（身份、岗位、脑根、代际指针）
指针：完整状态跑 `sb.cmd look`；未决项见 ledger.md；失败模式见 failures.md。
边界：本块为快照。若与现读文件冲突，以现读为准。
```

（以上为作者实例的**真实产出**，仅作格式示例；`弦枢` 是作者 DSH 实例的代号，脑根路径已改为通用写法。）

## 它解决什么问题

不同 agent 平台的「跨会话记忆」供给并不一样：

| 平台 | 跨会话记忆 |
|---|---|
| 部分 AI 工作台 / IDE | 平台自带记忆目录，切换对话无缝 |
| **DeepSeek Harness** | **没有该机制 —— 每个新会话开局都是一张白纸** |

于是你精心维护的第二大脑在磁盘上只是一个**孤立仓库**：只有"谁记得去读它"才有用。
本插件补的正是这一环，而且补在**唯一每次都会跑的地方**——提示词装配。

★ 顺带一个设计立场：**每个实例的记忆本就该不同**。本插件注入的是「你自己的」画像，
不是一份人人相同的公共文本——若各实例记忆相同，则毋须多实例。

## 它做什么

- **每个新会话都注入。** 挂点：`ctx.systemPrompt.context({ name, order, text })`，
  宿主将该贡献物化为 **durable user-role snapshot**。
- **永远新鲜。** `text` 取**函数**形态 ⇒ 每次装配现读脑状态；`state_seq` 变了，下一次装配就能看到。
- **有硬上限。** `maxChars` 是硬顶，注入块不可能无界膨胀进你的上下文窗口
  （**代码默认 1000**；**随包 patch 装的是 1300**）。
- **Fail-loud。** 上限低于 `300`（页眉＋页脚都装不下）时，插件**拒绝注册并打印理由**，
  而不是静默丢掉「指针」或「以现读为准」边界行。
- **只读、零写入。** 全程 `readFileSync`，**永不写脑**。
- **零依赖。** 纯 ESM，Node ≥ 18，无构建步骤、无 postinstall 脚本。

## 安装

四条路，按**前置条件从少到多**排列——第一条既不需要 `git`，也不需要 `github.com`。

| 路线 | 怎么做 | 需要什么 |
|---|---|---|
| **A · npm**（推荐） | 设置 → **插件** → **添加插件** → `@xianshu/dsh-second-brain` | 能连上 npm registry —— **不需 `git`、不需 `github.com`** |
| **B · 目录** | 下载 Release 的 `.zip` → 解压 → 添加插件填**解压后的文件夹路径** | 只需能下载这个 zip |
| **C · 本地克隆** | `git clone` 本仓 → 添加插件时填克隆出的文件夹路径 | `git` |
| **D · GitHub 源** | 添加插件时填 `github:DiaryOfUranus/dsh-second-brain` | `git` 在 `PATH` 里，**且** `github.com:443` 与 `codeload.github.com` 可通 |

★ **装完须重启 DSH**——插件模块在 boot 时加载；宿主运行中改文件**不会**热重载（实测）。

### 入口是走通的（实测，不是宣称）

路线 A 在**一台 `git` 不在 `PATH`、且 `github.com:443` 不通**的 Windows 主机上端到端走通——
也就是当初旧入口失败的那台机器：

```text
$ pnpm add @xianshu/dsh-second-brain            # npm 官方源
+ @xianshu/dsh-second-brain 0.1.5                ✅
$ pnpm add @xianshu/dsh-second-brain            # npmmirror 淘宝源也供得上
+ @xianshu/dsh-second-brain 0.1.5                ✅
$ node -e "import('@xianshu/dsh-second-brain')"
name=second-brain-xianshu  inject=["systemPrompt"]  ✅
$ node node_modules/@xianshu/dsh-second-brain/test/probe-block.mjs
结论: 48/48 PASS                                 ✅
```

路线 B 另测：`pnpm link:<解压目录>` 能正确解析包名、`cordis.patch.yml` 在、按包名导入并对真脑
构建出 844 字符的注入块。

### 为什么 D 排在最后（实测，不是推测）

`github:` 这种写法由包管理器解析，而它会去调 `git`：

```text
$ pnpm add github:DiaryOfUranus/dsh-second-brain
[ERROR] Command failed: git ls-remote "https://github.com/DiaryOfUranus/dsh-second-brain.git" HEAD
'git' 不是内部或外部命令，也不是可运行的程序或批处理文件
```

Windows 实测（2026-10-06）：`git` 不在 `PATH` 时**立刻失败**；把 `git` 加回 `PATH` 后**仍失败**于
`Failed to connect to github.com:443 after 21075 ms`。**固定完整 commit SHA 也绕不开**——pnpm 对
`github:` 一律走 git fetcher。而 A、B 两条路完全不碰这些。

> **更正说明**：v0.1.4 的 Release 说明、以及 v0.1.4 附件包内的 README，曾推荐裸 `github:` 写法且
> 未写明前置条件。**以本节为准。**

### bundle 契约

无论走哪条路，bundle 都由 `package.json` → `dsh.bundle.patch` → `cordis.patch.yml` 声明，插入一行：

```yaml
- insert:
    - id: second-brain-xianshu
      name: '@xianshu/dsh-second-brain'
      config:
        brainRoot: !!js process.env.DEEPSEEK_BRAIN
        maxChars: 1300
        order: 200
```

### 验证是否生效（两路，任选）

1. 开一个**新会话**，问它：**「你开局收到什么第二大脑信息？」**——**答得出即为注入生效**。
2. 或看 DSH 日志是否有：
   `[second-brain-xianshu] ✅ 注入已注册：name=xianshu-second-brain order=200 块长=NNN 字符`

## 配置项

| 键 | 默认 | 含义 |
|---|---|---|
| `brainRoot` | `~/.dsh/brain`（或 `$DEEPSEEK_BRAIN`） | 脑根目录 |
| `maxChars` | `1000`（随包 patch 为 `1300`） | 注入块硬上限；下限 `300` |
| `order` | `200` | 在系统提示词中的层序 |
| `inject` | **开** | 置 `false`（或环境变量 `DSH_SB_INJECT=0`）可关而不卸 |

**装 ＝ 开。** v0.1.0 曾默认**关**，实测已证本末倒置：**GUI 的安装动作本身即为 consent**；
「装了却默认不生效」属多此一举。要关，必须**显式**关。

## 它读哪些文件（只读）

```text
<脑根>/VERSION.json          → version、state_seq、git_backed、last_export_at（指纹）
<脑根>/MEMORY-PERMANENT.md   → 取「一、我是谁」「三、我怎么干活」两节，按条目边界裁剪
<脑根>/ledger.md             → 只数 `- [ ]` 条数，不读正文（控体积）
```

文件缺失则**优雅降级**：块里写明"未找到"，而不是抛异常。

## 安全姿态（三重）

三条明确保证，默认全部取最紧：

1. **有界**——`maxChars` 硬顶。注入块会跟着**每一次请求**走，无界注入就是一个迟早爆的上下文 bug。
2. **只读**——只读打开，**永不写脑**；插件不碰会话生命周期（不 inject `agents`/`sessions`）。
3. **诚实**——块自己声明"**这是快照，非现况**"，自带 mtime 与 `state_seq` 供新会话判断新鲜度，
   并明写"**若与现读文件冲突，以现读为准**"。

另有一道**自指腐化防线**：注入块**不得**被脑读回当作事实来源。一个系统若把自己的产出当外部输入，
就会腐烂；时间戳与边界行就是解药。

## 事故留痕（v0.1.0 → v0.1.1，实测）

**症状**：作者装好并重启后开新会话 ⇒ **开局无任何第二大脑内容**。

**诊断（实测）**：`DSH_SB_INJECT` 在 shell／用户级注册表三处**皆为空** ⇒ `inject` 恒 `false`
⇒ 插件**按设计拒绝注入**；且桌面版进程不由 shell 派生，**由插件自己设其环境变量这条路实际不可达**。

**根因（设计之误）**：把"**装不装**"（作者在 GUI 已决定）与"**装了是否生效**"混成一道开关。

**修法**：**装 ＝ 开**，关须显式。并补两处：
① 删掉 `ctx.effect?.(() => dispose)`——`context()` **自身返回 disposer 且框架已按调用上下文自动注销**，
旧写法既冗余、又因 `ctx.effect` 不存在而**静默无效**；
② 注册成功时**打印块长**，让"是否生效"**一眼可判**，不靠猜。

**三态实测**：①默认 ⇒ 注册 ✅ ②`inject:false` ⇒ 不注册 ✅ ③`maxChars:120` ⇒ REFUSED ✅。

## 可复算验收 —— 自己跑一遍

```bash
node test/probe-block.mjs
```

探针在临时目录里自建一个**合成脑**（fixture），断言**任何上限下都必须成立**的不变式：
块长 ≤ 上限、指针行与边界行存活、身份与指纹在场、脑根不存在时降级不抛、
`maxChars < 300` 必须**大声拒绝**。**不需要任何个人数据。**

想直接探你自己的真脑：

```bash
SB_BRAIN="$HOME/.dsh/brain" node test/probe-block.mjs
```

## 兼容性

- **宿主**：DeepSeek Harness 桌面版（宿主侧插件，无客户端/UI 代码）。
- **运行时**：Node ≥ 18，ESM。**零依赖、无构建、无 postinstall**。
- **用到的契约**：`ctx.systemPrompt.context({ name, order, text })` 与 `ctx.logger`。

## 已知边界（如实列）

- 指针行里的 `sb.cmd look` 是作者本机脑 CLI 的名字，**对别人只是惰性文本**；
  把指针做成可配置项是**计划**，不是已发版的能力。
- 压缩按**精确的中文标题**取两节（`一、我是谁`、`三、我怎么干活`）；两节都没找到时（例如脑文件用
  其他语言写），退化为**整文件按条目边界裁剪**。可配置的节名列表在计划中。
- 注入块**自身的标签是中文**（`脑根`／`指纹`／`边界`…）；插件与你的语言无关，但其他语种的标签映射
  尚未发布。
- 多实例并发**未压测**（本插件是纯函数、无共享状态，理论上无碍，但未实测）。
- 仅在 DSH 0.2.x 宿主线上验证过；其他版本请先确认 `ctx.systemPrompt.context` 仍存在。

## 变更记录

[v0.1.4](CHANGELOG.md) 是首次公开发布。发布前的验收探针逮出**两条"静默丢内容"缺陷**，均已修复并
带回回归用例：

- 目标节恰是文件**最后一节**时被**静默丢弃**——旧版尾锚写作 `\Z`，而 **JS 正则里 `\Z` 不是"串尾"，
  而是字面量 `Z`**；
- **脑根路径极长**遇上很紧的上限时，会把「指针」与「以现读为准」边界行**切掉**。

## 相关仓库

- [second-brain-framework](https://github.com/DiaryOfUranus/second-brain-framework) —— 开源第二大脑
  **框架与治理工具集**，负责造出本插件要加载的那些脑文件。
  **框架 ＝ 脑的结构；本插件 ＝ 载入器。**

## 许可

MIT © 天王星日记 / DiaryOfUranus —— 见 [LICENSE](LICENSE)。
