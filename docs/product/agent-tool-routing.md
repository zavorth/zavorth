# Free text, tools, and commands

| Input | Owner |
|-------|--------|
| Free text (any language) | Agent — the LLM understands intent and chooses tools |
| Slash commands and CLI mirrors | Deterministic packs |
| Buttons / callbacks | Deterministic |
| Approvals, pairing, secrets, risk on tools | Deterministic policy |

## Rules

- Capabilities ship as **tools** and/or **slash/UI**. Free text never routes via keyword dictionaries.
- Multi-agent, swarm, search, shell, skills, etc. run when the **model selects a tool** (or the user runs `/command`), not when free text matches a phrase.
- Deterministic code is for slash, safety, approval, and data quality — not for guessing user intent from words.
- **No pre-run tools from free text.** Example: `web_search` runs only if the model issues a tool call (or a slash/UI path), never because a local router matched “news”, “latest”, or domain keywords.
- Local `IntentClassifier` only flags trivial chat for cheap-model selection. Non-trivial free text is `full_toolset`; it does not map words to tool categories.
- Conversational free text exposes the full tool catalog (minus quarantine). Firewall/gatekeeper categories are hints and telemetry, not capability owners.

## Related

- `docs/product/surface-agent-contracts.md`
- `docs/product/telegram-agent-first.md`
