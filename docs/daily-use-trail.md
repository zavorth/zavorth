# Daily Use Trail

Short path for daily work. Full platform setup is optional after chat works.

Value order: **useful intelligence → daily habit → trust** (approvals/receipts when risk is real).

## Non-developer path (Setup → Desktop → chat)

No CLI required:

1. **Setup app** — install or repair the local runtime (Zavorth Setup / `apps/zavorth-setup`).
2. **Open Desktop** — Zavorth Desktop starts the runtime when needed and opens native chat.
3. **First-run audience** — choose **Personal**, **Developer**, or **Business** (tunes copy and first mission; does not grant hidden authority).
4. **Connect a provider** — one model key or local model; prove it. Catalog presence is not Live.
5. **First ask** — use the suggested safe request, or ask in plain language.
6. **Approve only when Review asks** — risky writes, shell, external sends stay gated.

Operators who prefer CLI can still use `zavorth setup` → `zavorth start` / `zavorth open`. Details: [zavorth-desktop-setup.md](./zavorth-desktop-setup.md).

## First pass (≤4 steps)

Enough for daily chat once a provider is proven:

1. **Open Zavorth**
   Desktop, Control, `zavorth open`, or `zavorth start` (both open the daily work surface via `ops-go` — not guide-only).

2. **Choose your default provider and model**
   You pick the primary (and optional secondary/fallbacks). Zavorth does not invent Gemini or any other vendor.
   Example: `zavorth providers switch` then prove with a live probe when ready.

3. **First useful ask**
   Ask normally. Prefer a read-only first win (explain the project, plan the day).

4. **Approve only when risky**
   Writes, shell, external sends and sensitive memory stay on explicit approval.

That is enough for daily chat. Connecting a channel is optional and uses the channel *you* choose (not Telegram-first).

## Full platform setup

Optional after chat works (the 8-step Control checklist does **not** gate `chatReady`):

1. Choose experience profile (`personal`, `creator`, `developer`, `business`, `power`).
2. Connect a channel (Telegram first when available). Live only after proof.
3. Pick a runtime profile (`minimal`, `chat`, `safe-8gb`, `developer`, `full`).
4. Review learned memory (draft-only learning until you promote).
5. Add tools and skills through preview → smoke → approval when required.
6. Schedule a routine with visible final prompt and scope.
7. Run quality checks (`npm run agent:smartness:check` for agent scoreboard).
8. Promote useful skills and archive unused ones from the same lifecycle surface.

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

- `chatReady` — provider proven; chat can be useful (does **not** require full platform setup)
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
| `start` / `open` | Opens the daily surface (live via `ops-go`) |
| `setup` | Setup Studio (live) |
| `connect` / `learn` / `tools` | Read-only live status surfaces (no silent installs or sends) |
| `health` | Diagnostics |

The projection paths remain approval-bound for mutations. Live sends, file changes, provider changes, scheduled work and sensitive learned memory still use the runtime approval path.
