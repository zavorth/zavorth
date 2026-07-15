# How to test Zavorth value surfaces

One checklist so you can verify intelligence, daily habit, continuity, memory drafts and killer demos.

## 1) One command (recommended)

```bash
npm run value:test-all
```

Hermetic / unit / catalog suite (no live keys required). Expect steps `pass` or `skipped`.

This suite does **not** claim live agent IQ. `claimsLiveIntelligence` stays false.

With the live user-provider harness (probe + multi-step tool plan; direct cells cover OpenAI, Anthropic, and Gemini, while other configured/compatible providers use the production runtime; exact tokens `ZAVORTH_LIVE_OK` / `ZAVORTH_LIVE_MS_OK`):

```bash
npm run value:test-all -- --live
npm run agent:smartness:live -- --live
```

JSON:

```bash
npm run value:test-all -- --json
```

## 2) Piece by piece

| What                                              | Command                                                                               |
| ------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Hermetic agent smartness                          | `npm run agent:smartness:check`                                                       |
| Live smartness (optional, user provider)          | `npm run agent:smartness:live -- --live`                                              |
| Daily happy path / chatReady                      | `npm run zavorth:daily-product-experience:check`                                      |
| Time-to-first-useful (structural)                 | `npm run value:ttfu -- --check`                                                       |
| Record TTFU measurement                           | `npm run value:ttfu -- --record --started=<iso> --first-useful=<iso> --provider=<id>` |
| Memory drafts store                               | `npm run value:memory-drafts -- --check`                                              |
| List drafts                                       | `npm run value:memory-drafts`                                                         |
| Demo extract → drafts                             | `npm run value:memory-drafts -- extract-demo`                                         |
| Promote draft                                     | `npm run value:memory-drafts -- promote <id>`                                         |
| Forget draft                                      | `npm run value:memory-drafts -- forget <id>`                                          |
| Killer mission prompts                            | `npm run value:killer`                                                                |
| Killer execute (credentialed)                     | `npm run value:killer -- --execute --live --audience=personal`                        |
| Code daily loop                                   | `npm run value:code-loop -- --check`                                                  |
| Continuity model                                  | `npm run value:continuity -- --check`                                                 |
| Learned Knowledge golden path (hermetic)          | `npm run knowledge:golden-path`                                                       |
| Learned Knowledge docs/wiring check               | `npm run knowledge:golden-path:check`                                                 |
| Free-text purity hygiene (Package C)              | `npm run purity:package-c`                                                            |
| Offline Trust Loop demo                           | `zavorth demo` or open `assets/zavorth-demo/index.html`                               |
| Live probe (legacy script; prefer smartness live) | `npm run dogfood:live:llm`                                                            |

## 3) Manual product path (10 minutes)

1. `zavorth setup` — prove one provider
2. `zavorth start` or open Desktop
3. First ask (safe): use empty-state suggestion 1 or a killer mission
4. If approvals appear, resolve in Review
5. `npm run value:memory-drafts -- extract-demo` then `list` / `promote` / `forget`
6. Close Desktop, reopen next day (or set clock keys) → Continuity banner

### 3b) Learned Knowledge path (≤10 minutes)

1. `npm run knowledge:golden-path` — hermetic plane proof
2. `zavorth knowledge status` · `story` · `advanced`
3. Optional: Control/Desktop hub (This week events + Advanced)
4. Optional: `zavorth knowledge pack "…"` after real multi-tool work

Full trail: [learned-knowledge-first-use.md](./learned-knowledge-first-use.md) · demo [Script D](./demo-scripts.md#script-d--learned-knowledge-10-minutes).

## 4) Killer missions by audience

```bash
npm run value:killer -- --audience=developer
npm run value:killer -- --audience=personal
npm run value:killer -- --audience=privacy
```

Copy the printed prompt into Desktop chat after provider setup.

## 5) Honest limits

- Hermetic smartness is a **unit scoreboard** (retry, memory honesty, profiles) — not live multi-step IQ.
- Live multi-step tool-use **can pass** via `agent:smartness:live -- --live` when the user's selected route works and the model completes a real tool round (`claimsLiveIntelligence: true` only then). A successful probe alone is insufficient. Without usable credentials/configuration it stays **blocked**.
- Live cells fail closed without keys / exact tokens (not silent pass). No silent Gemini default.
- TTFU structural check ≠ measured under 3 minutes. Record a real session with `--record` before claiming measured TTFU.
- Killer missions are prompt catalogs by default; use `--execute --live` for real runs (receipts under `data/product/`).
- Catalog ≠ Live (honesty readiness still applies).
- Day-1 banner eligibility uses local open timestamps; calendar launch R2 residual may still be ops-gated.

## Related

- [demo-scripts.md](./demo-scripts.md)
- [value-baseline.md](./value-baseline.md)
- [agent-tool-routing.md](./agent-tool-routing.md)
- [launch-readiness.md](./launch-readiness.md)
