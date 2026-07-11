# How to test Zavorth value surfaces

One checklist so you can verify intelligence, daily habit, continuity, memory drafts and killer demos.

## 1) One command (recommended)

```bash
npm run value:test-all
```

Hermetic / unit / catalog suite (no live keys required). Expect steps `pass` or `skipped`.

This suite does **not** claim live agent IQ. `claimsLiveIntelligence` stays false.

With live LLM probe only (Gemini key in `.env`, exact token `ZAVORTH_LIVE_OK` required):

```bash
npm run value:test-all -- --live
```

JSON:

```bash
npm run value:test-all -- --json
```

## 2) Piece by piece

| What | Command |
|------|---------|
| Hermetic agent smartness | `npm run agent:smartness:check` |
| Live smartness (optional) | `npm run agent:smartness:live -- --live` |
| Daily happy path / chatReady | `npm run zavorth:daily-product-experience:check` |
| Memory drafts store | `npm run value:memory-drafts -- --check` |
| List drafts | `npm run value:memory-drafts` |
| Demo extract → drafts | `npm run value:memory-drafts -- extract-demo` |
| Promote draft | `npm run value:memory-drafts -- promote <id>` |
| Forget draft | `npm run value:memory-drafts -- forget <id>` |
| Killer mission prompts | `npm run value:killer` |
| Continuity model | `npm run value:continuity -- --check` |
| Offline Trust Loop demo | `zavorth demo` or open `assets/zavorth-demo/index.html` |
| Live Gemini probe | `npm run dogfood:live:llm` |

## 3) Manual product path (10 minutes)

1. `zavorth setup` — prove one provider  
2. `zavorth start` or open Desktop  
3. First ask (safe): use empty-state suggestion 1 or a killer mission  
4. If approvals appear, resolve in Review  
5. `npm run value:memory-drafts -- extract-demo` then `list` / `promote` / `forget`  
6. Close Desktop, reopen next day (or set clock keys) → Continuity banner  

## 4) Killer missions by audience

```bash
npm run value:killer -- --audience=developer
npm run value:killer -- --audience=personal
npm run value:killer -- --audience=privacy
```

Copy the printed prompt into Desktop chat after provider setup.

## 5) Honest limits

- Hermetic smartness is a **unit scoreboard** (retry, memory honesty, profiles) — not live multi-step IQ.  
- Live multi-step tool-use is **not auto-certified** (stays blocked after probe; use killer missions manually).  
- Live cells fail closed without keys / exact token (not silent pass).  
- Killer missions are **prompt catalogs**, not executed missions.  
- Catalog ≠ Live (honesty readiness still applies).  
- Day-1 banner eligibility uses local open timestamps; calendar launch R2 residual may still be ops-gated.

## Related

- [WAVES-VALUE-INTELLIGENCE-HABIT.md](./WAVES-VALUE-INTELLIGENCE-HABIT.md)
- [demo-scripts.md](./demo-scripts.md)
- [value-baseline.md](./value-baseline.md)
