# Certified live matrix (honesty)

Maps which channel/provider paths are **structurally present** vs **live-certified**.

Update this file when credentialed cells change. Never invent a live pass.

## Structure vs live

| Area | Structural (hermetic) | Live certified |
|------|----------------------|----------------|
| Channel factory (29) | Yes — unit tests / registry | Per-credential only |
| normalizeChannelId | Yes | N/A |
| Telegram / Discord / etc. | Adapter present | Needs tokens; otherwise blocked |
| Email outbox | Configurable | Optional `EMAIL_ENABLED` |
| AI gateway | Port/env local | Needs provider keys for chat |
| Web search tool | Policy present | Needs search provider |
| Agent multi-step tool plan | Hermetic unit scoreboard | See **Recorded live cells** |
| Killer demos (3 audiences) | Prompt catalog | See **Recorded live cells** |

## Recorded live cells (this workspace)

Source of truth after runs: `.zavorth/launch-live-cells.json` (also mirrored under `data/product/` when written).

Record with:

```bash
npm run launch:live-cells -- --live
# or stepwise:
npm run agent:smartness:live -- --live
npm run value:killer -- --execute --live
```

### Last known credentialed results (2026-07-11 dogfood)

Recorded via `npm run agent:smartness:live -- --live` and `npm run value:killer -- --execute --live` earlier in the same residual program. Re-runs may **fail under quota (HTTP 429)**; `launch:live-cells` **keeps prior passes** when a later attempt flakes.

| Cell | Status | Notes |
|------|--------|-------|
| `live.llm.probe` | **pass** (when keys + quota) | User-selected / single-key path; exact `ZAVORTH_LIVE_OK` |
| `live.multi-step.tool-plan` | **pass** (when keys + quota) | Real tool round + finish token; `claimsLiveIntelligence: true` only then |
| `killer.dev.repo-plan` | **pass** (when keys + quota) | Signals plan/risk/approve |
| `killer.personal.day-plan` | **pass** (when keys + quota) | Signals today/action |
| `killer.privacy.memory-review` | **pass** (when keys + quota) | Signals memory/forget/receipt |
| Channel live (Telegram/Discord/…) | **not claimed this release** | No channel tokens exercised in this residual |
| Multi-provider matrix beyond active key | **not claimed this release** | Only the configured/inferred provider was credentialed |

Without keys, cells stay **skipped/blocked** — never greenwashed. Rate-limit failures are **not** silent passes.

## Dogfood mapping

- Hermetic pass: factory, aliases, docs honesty, optional email default-off
- Blocked without credentials: `dogfood.channels.02`–`04`, most `dogfood.chat.*` live turns
- Value live: `npm run value:test-all -- --live` (probe path); multi-step via `agent:smartness:live -- --live`

## Rule

Never mark a live cell green without a real credentialed run recorded in the dogfood log or `launch-live-cells.json`.

## Launch residual link

See [launch-readiness.md](./launch-readiness.md) and `npm run launch:ready:check`.
