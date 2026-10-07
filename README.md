# dsh-second-brain

**English** · [中文说明 README.zh-CN.md](README.zh-CN.md)

> Give your DeepSeek Harness agent a memory that survives the session boundary.
> 让 DeepSeek Harness 每次开新会话时，自动带着你的第二大脑画像与状态。
> **记忆 / 工作流 / 本地优先 / 只读 / 零写入。**

[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/@xianshu/dsh-second-brain.svg)](https://www.npmjs.com/package/@xianshu/dsh-second-brain)
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

Four routes, ordered by **how much they require** — the first needs neither `git` nor `github.com`.

| Route | What you do | Requires |
|---|---|---|
| **A · npm** (recommended) | Settings → **Plugins** → **Add plugin** → `@xianshu/dsh-second-brain` | a reachable npm registry — **no `git`, no `github.com`** |
| **B · Folder** | Download the release `.zip` → extract → Add plugin with the **extracted folder path** | only the download |
| **C · Local clone** | `git clone` this repo → Add plugin with the cloned folder path | `git` |
| **D · GitHub spec** | Add plugin with `github:DiaryOfUranus/dsh-second-brain` | `git` on `PATH`, **and** reachable `github.com:443` + `codeload.github.com` |

**Restart DSH** afterwards — plugin modules load at boot, so editing files while the host is
running does **not** hot-reload them.

### Verified entrances (walked, not assumed)

Route A was walked end to end on a Windows host with **no `git` on `PATH` and `github.com:443`
unreachable** — the very machine where the old entry failed:

```text
$ pnpm add @xianshu/dsh-second-brain                 # official npm registry
+ @xianshu/dsh-second-brain 0.1.5                     ✅
$ pnpm add @xianshu/dsh-second-brain                 # npmmirror (CN mirror) served it too
+ @xianshu/dsh-second-brain 0.1.5                     ✅
$ node -e "import('@xianshu/dsh-second-brain')"
name=second-brain-xianshu  inject=["systemPrompt"]    ✅
$ node node_modules/@xianshu/dsh-second-brain/test/probe-block.mjs
结论: 48/48 PASS                                      ✅
```

Route B was verified separately: `pnpm link:<extracted folder>` resolves the package name,
`cordis.patch.yml` is present, and importing by package name builds a real 844-char block.

### Why route D is listed last (measured, not assumed)

The `github:` form is resolved by the package manager, which shells out to `git`:

```text
$ pnpm add github:DiaryOfUranus/dsh-second-brain
[ERROR] Command failed: git ls-remote "https://github.com/DiaryOfUranus/dsh-second-brain.git" HEAD
'git' is not recognized as an internal or external command
```

Measured on Windows (2026-10-06): with `git` absent from `PATH` it fails immediately; with `git`
present it failed again at `Failed to connect to github.com:443 after 21075 ms`. **Pinning a full
commit SHA does not avoid this** — pnpm still routes every `github:` spec through its git fetcher.
Routes A and B touch none of that.

> **Correction.** The v0.1.4 release notes and the README inside the v0.1.4 asset zip recommended
> the bare `github:` form without stating its prerequisites. **This section supersedes them.**

### Bundle contract

Whichever route you take, the bundle is declared by `package.json` → `dsh.bundle.patch` →
`cordis.patch.yml`, which inserts one profile row:

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
