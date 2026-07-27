# Import & Link

Only two day-path verbs for intake and external-agent coupling.

## Import

```bash
zavorth import
zavorth import <path>
zavorth import home <path> [--smart] [--apply --consent]
zavorth import home --auto
zavorth import pack <path> --consent [--apply --approval-id <id>]
zavorth import skills <link-id> --consent
```

| Command | Role |
|---------|------|
| `import home` | Deep brand-agnostic home migration |
| `import pack` | External-agent migration pack |
| `import skills` | Peer capabilities → SkillIR (`execution.backend=peer:<id>`) |

## Link

```bash
zavorth link
zavorth link find --path <path> --consent
zavorth link add --id <id> --adapter mcp|cli|http|acp --approve --enable-live
zavorth link list
zavorth link open <id> [--live --approve] [--mirror]
zavorth link use <id> <tool> [--args-json {...}] --approve
zavorth link ask <id> "prompt" --approve
zavorth link sync <id> [--mirror] [--consent]
```

| Mode | Role |
|------|------|
| `open` | Catalog peer surface |
| `use` | Direct mediated tool call |
| `ask` | Natural-language peer invoke |
| `sync --mirror` | Refresh + write progressive tool mirrors |

### Mirror / progressive tools

`link sync <id> --mirror` (or `link open --mirror`) writes:

`data/runtime/peer-tool-mirrors/<id>.json`

ConversationalAgent merges those tools into the progressive registry. Live execution from chat requires either:

- explicit `zavorth link use … --approve`, or
- `ZAVORTH_PEER_TOOL_AUTO_APPROVE=1` (process-local; still mediated)

Disable merge with `ZAVORTH_PEER_TOOL_MIRROR=0`.

## Safety

- Preview defaults; consent for intake; approval for live peer use
- Mediated full access (not raw OS takeover)
- Secrets held on import
- Smart home import LLM uses a closed ontology only

## Discovery (humans + LLM)

```bash
zavorth commands              # full day-path catalog
zavorth commands search link  # filter
zavorth commands --onboarding # first-run subset
```

In chat, the assistant should call tool `capability_discovery` with `action: "daypath"` (or search). Entries with `source=product-day-path` are the authoritative CLI verbs.

## Internal scripts

npm scripts under `zavorth:external-agent-*` remain as **implementation entrypoints** used by the hub. Day-path operators should use **only** `import` and `link`.
