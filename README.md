# dsh-second-brain

**English** · [中文说明 README.zh-CN.md](README.zh-CN.md)

> Give your DeepSeek Harness agent a memory that survives the session boundary.
> 让 DeepSeek Harness 每次开新会话时，自动带着你的第二大脑画像与状态。
> **记忆 / 工作流 / 本地优先 / 只读 / 零写入。**

[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![version](https://img.shields.io/badge/version-0.1.4-blue.svg)](CHANGELOG.md)
[![dsh-plugin](https://img.shields.io/badge/DeepSeek%20Harness-plugin-4B6EF5.svg)](#install)
[![node](https://img.shields.io/badge/node-%3E%3D18-3c873a.svg)](#install)
[![dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](package.json)
[![read-only](https://img.shields.io/badge/brain-read--only-lightgrey.svg)](#safety-model)

`@xianshu/dsh-second-brain` is a **DeepSeek Harness (DSH) host plugin**. It injects a
**bounded, timestamped snapshot of your local brain** — identity, state fingerprint, open
items count, and pointers — into **every new session's prompt context**.

The goal is simple: a fresh conversation should not start from zero. It should already know
*who this instance is* and *where the real state lives*.

```
【Second Brain · opening snapshot】(read-only; not live state; do not write back)
brain root: C:\Users\you\.dsh\brain
fingerprint: version=v0.1.0  state_seq=120  git_backed=true  last_export=2026-10-06T12:51:29Z
permanent memory @2026-10-06T02:17:54.099Z
open items: 25
## 1. Who I am
- name / seat / host / brain root / generation pointer …
pointers: full state via `sb.cmd look`; open items in ledger.md; failure modes in failures.md.
boundary: this block is a snapshot. If it conflicts with a freshly read file, the file wins.
```

*(above is a real block, reformatted to English labels for readability — the shipped block is Chinese, see [README.zh-CN.md](README.zh-CN.md))*

## The problem

Agent platforms differ in what they give you out of the box:

| Platform | Cross-session memory |
|---|---|
| Some IDEs / agent workbenches | built-in memory directory, seamless |
| **DeepSeek Harness** | **none — every new session starts blank** |

So a brain you maintain on disk stays an *isolated repository*: it only matters if someone
remembers to go read it. This plugin closes that gap at the only place that always runs —
**prompt assembly**.

## What it does

- **Injects on every session.** Hooked at `ctx.systemPrompt.context({ name, order, text })`,
  materialised by the host as a *durable user-role snapshot*.
- **Always fresh.** `text` is a function, so the block is rebuilt at each assembly — when
  `state_seq` changes, the next assembly sees it.
- **Bounded.** Hard `maxChars` cap. The block can never grow without limit into your context
  window (code default `1000`; the bundled patch ships `1300`).
- **Fail-loud.** Below a floor of `300` chars the plugin **refuses to register and prints why**
  instead of silently dropping the pointer/boundary lines.
- **Read-only, zero-write.** It only ever calls `readFileSync`. It never writes your brain.
- **Zero dependencies.** Plain ESM, Node ≥ 18, no install-time scripts.

## Install

### Option A — from GitHub (recommended)

Settings → **Plugins** → **Add plugin**, and give one of:

```
github:DiaryOfUranus/dsh-second-brain
```

or the local clone path:

```
C:\path\to\dsh-second-brain
```

**Restart DSH** afterwards — plugin modules load at boot, editing the repo while the host runs
does not hot-reload it.

### Option B — local directory clone

```bash
git clone https://github.com/DiaryOfUranus/dsh-second-brain.git
```

then point the plugin installer at the cloned folder. The bundle is declared by
`package.json` → `dsh.bundle.patch` → `cordis.patch.yml`, which inserts one profile row:

```yaml
- insert:
    - id: second-brain-xianshu
      name: '@xianshu/dsh-second-brain'
      config:
        brainRoot: !!js process.env.DEEPSEEK_BRAIN
        maxChars: 1300
        order: 200
```

### Verify it works

1. Open a **new** session and ask: *"what Second Brain information did you get at startup?"*
   Answering correctly == injection is live.
2. Or check the DSH log for:
   `[second-brain-xianshu] ✅ 注入已注册：name=xianshu-second-brain order=200 块长=NNN 字符`

## Configuration

| Key | Default | Meaning |
|---|---|---|
| `brainRoot` | `~/.dsh/brain` (or `$DEEPSEEK_BRAIN`) | Where your brain files live |
| `maxChars` | `1000` (patch ships `1300`) | Hard cap of the injected block; floor `300` |
| `order` | `200` | Layer order within the system prompt |
| `inject` | **on** | Set `false` (or env `DSH_SB_INJECT=0`) to disable without uninstalling |

**Installed == ON.** v0.1.0 shipped with the opposite default and it was a foot-gun: the GUI
install action *is* the consent. Turning it off must be explicit.

## Files it reads (read-only)

```
<brainRoot>/VERSION.json           → version, state_seq, git_backed, last_export_at
<brainRoot>/MEMORY-PERMANENT.md    → §"Who I am" + §"How I work", trimmed by item boundary
<brainRoot>/ledger.md              → counts `- [ ]` only (never reads the body)
```

Missing files degrade gracefully: the block says so instead of throwing.

## Safety model

Three explicit guarantees, all defaulting to the tightest setting:

1. **Bounded** — a hard `maxChars` ceiling, because an injected block rides along on *every*
   request. Unbounded injection is a context-window bug waiting to happen.
2. **Read-only** — `open(...,'r')` semantics only. The plugin never writes to your brain.
3. **Honest** — the block self-describes as *a snapshot, not live state*, carries mtime and
   `state_seq` so a new session can judge its own freshness, and states that **a freshly read
   file wins on conflict**.

There is also a **self-reference guard**: the injected block is deliberately not to be read
back by the brain as a source of fact. A system that treats its own output as external input
rots; the timestamp and boundary line are the antidote.

## Verification — run it yourself

```bash
node test/probe-block.mjs
```

The probe builds a throwaway fixture brain in a temp directory and asserts the invariants that
must hold at **any** cap: block length ≤ cap, pointer/boundary lines survive, identity and
fingerprint present, missing brain root degrades instead of throwing, and `maxChars < 300`
is refused loudly. No personal data required.

To probe your own real brain instead of the fixture:

```bash
SB_BRAIN="$HOME/.dsh/brain" node test/probe-block.mjs
```

## Compatibility

- **Host:** DeepSeek Harness desktop (host-side plugin; no client/UI code).
- **Runtime:** Node ≥ 18, ESM. No dependencies, no build step, no postinstall.
- **Contract used:** `ctx.systemPrompt.context({ name, order, text })` and `ctx.logger`.
  It does not inject `agents`/`sessions` — it deliberately stays out of the session lifecycle.

## Known boundaries (honest list)

- The pointer line mentions `sb.cmd look`, the author's brain CLI. It is inert text for
  everyone else; making the pointer configurable is a planned change, not a shipped one.
- Compression picks two sections by their **exact Chinese headings** (`一、我是谁`,
  `三、我怎么干活`). If neither is found — e.g. a brain written in another language — the whole
  file is trimmed by item boundary instead. A configurable section list is on the roadmap.
- The injected block's **own labels are Chinese** (`脑根` / `指纹` / `边界` …). The plugin works
  regardless of your language, but a label map for other locales is not shipped yet.
- Multi-instance concurrency is not stress-tested (the plugin is a pure function with no
  shared state, so it should be safe; it has not been measured).
- Only verified against the DSH 0.2.x host line. Other versions: check that
  `ctx.systemPrompt.context` still exists.

## Changelog

[v0.1.4](CHANGELOG.md) is the first public release. Before shipping it, the acceptance probe
caught two **silent-drop** defects, both now fixed and regression-tested:

- a section was silently dropped when it happened to be the **last** one in the file
  (`\Z` is not an end-of-string anchor in JavaScript — it matches a literal `Z`);
- a **very long brain-root path** at a tight cap could truncate the pointer/boundary lines away.

## Related

- [second-brain-framework](https://github.com/DiaryOfUranus/second-brain-framework) — the
  open-source Second Brain framework and governance toolkit that produces the brain files this
  plugin loads. Framework = the brain's structure; this plugin = the loader.

## License

MIT © 天王星日记 / DiaryOfUranus — see [LICENSE](LICENSE).
