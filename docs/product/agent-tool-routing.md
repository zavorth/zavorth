# Free text, tools, and commands

| Input                                      | Owner                                                |
| ------------------------------------------ | ---------------------------------------------------- |
| Free text (any language)                   | Agent — the LLM understands intent and chooses tools |
| Slash commands and CLI mirrors             | Deterministic packs                                  |
| Buttons / callbacks                        | Deterministic                                        |
| Approvals, pairing, secrets, risk on tools | Deterministic policy                                 |

## Rules

- Capabilities ship as **tools** and/or **slash/UI**. Free text never routes via keyword dictionaries.
- Multi-agent, swarm, search, shell, skills, etc. run when the **model selects a tool** (or the user runs `/command`), not when free text matches a phrase.
- Deterministic code is for slash, safety, approval, and data quality — not for guessing user intent from words.
- **No pre-run tools from free text.** Example: `web_search` runs only if the model issues a tool call (or a slash/UI path), never because a local router matched “news”, “latest”, or domain keywords.
- Local `IntentClassifier` does not map free-text words to tool categories (non-empty free text is model-owned `full_toolset`).
- Conversational free text uses **lazy tools**: full JSON schema for a small core brain set; other registered tools appear as compact stubs (or by name) and expand on call. Quarantine still hard-blocks untrusted plugins. Firewall categories are hints/telemetry, not capability owners.
- System prompt stays short; slash command catalogs and long domain essays are not dumped every turn.
- Tool results sent back to the model are **budgeted** (long outputs truncated with a re-call note); full results stay in the read-only tool cache when cacheable. Older tool I/O in multi-round turns is **compacted** so sessions do not re-pay full history each round.

## Purity matrix (Package C)

Allowed vs forbidden free-text feature activation, hot-path watchlist, and verification commands:

- [free-text-purity-matrix.md](./free-text-purity-matrix.md)

```bash
npm run purity:hygiene
npm run purity:package-c
```

## Related

- `docs/product/surface-agent-contracts.md`
- `docs/product/telegram-agent-first.md`
- `docs/product/llm-role-routing.md`
- `docs/product/free-text-purity-matrix.md`
