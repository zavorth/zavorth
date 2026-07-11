# Daily Use Trail

Short path for daily work. Full platform setup is optional after chat works.

## Happy path (chat ready)

1. **Open Zavorth**
   Desktop, Control, `zavorth open`, or `zavorth start`.

2. **Prove one provider**
   Add a model key or local model, then probe. Catalog presence is not Live.

3. **First useful ask**
   Ask normally. Prefer a read-only first win (explain the project, plan the day).

4. **Approve only when risky**
   Writes, shell, external sends and sensitive memory stay on explicit approval.

That is enough for daily chat. Channels, skills, routines and evals can wait.

## Optional platform setup

1. Choose experience profile (`personal`, `creator`, `developer`, `business`, `power`).
2. Connect a channel (Telegram first when available). Live only after proof.
3. Pick a runtime profile (`minimal`, `chat`, `safe-8gb`, `developer`, `full`).
4. Review learned memory (draft-only learning until you promote).
5. Add tools and skills through preview → smoke → approval when required.
6. Schedule a routine with visible final prompt and scope.
7. Run quality checks (`npm run agent:smartness:check` for agent scoreboard).

## Daily loop

- Ask normally in the inbox.
- Let safe, reversible work run quietly.
- Review clear previews for important changes.
- Check receipts and learned memory when something looks surprising.
- Promote useful skills and archive unused ones from the same lifecycle surface.

## Daily product experience

```bash
npm run zavorth:daily-product-experience
npm run zavorth:daily-product-experience:json -- --profile personal
npm run zavorth:daily-product-experience:check
npm run agent:smartness:check
```

Snapshot fields:

- `chatReady` — provider proven; chat can be useful
- `platformSetupComplete` — full optional checklist done
- `happyPath` — short open → provider → first ask → review-if-risky

## Useful commands

```bash
zavorth start
zavorth open
zavorth setup
zavorth connect
zavorth learn
zavorth tools
zavorth health
```

| Command | Behavior |
|---------|----------|
| `start` / `open` | Opens the daily surface (live) |
| `setup` | Setup Studio (live) |
| `connect` / `learn` / `tools` | Read-only live status surfaces (no silent installs or sends) |
| `health` | Diagnostics |

The projection paths remain approval-bound for mutations. Live sends, file changes, provider changes, scheduled work and sensitive learned memory still use the runtime approval path.
