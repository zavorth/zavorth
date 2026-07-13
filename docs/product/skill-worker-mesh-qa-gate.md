# Skill + Worker mesh QA gate (W8 → W9)

This gate certifies that skill install + worker mesh are solid enough to consider
**Telegram agent-first (W9)**. W9 must not start until this pack is green.

## How to run

```bash
npm run qa:skill-worker-mesh
```

What it runs:

1. Focused Jest suite (W0–W8 unit + hermetic J1/J2 demo)
2. Brand denylist on product surface files
3. Hermetic demo script (delegates to Jest demo)

## Pass criteria

| Check | Pass when |
|-------|-----------|
| Jest pack | All tests green |
| Brand denylist | Zero hits in curated product files |
| J1 skill | preview → consent install → `read_file` direct bind |
| J2 worker | `internal:*` list → route → dry-run invoke + untrusted merge |
| Exposure | `daily-ops` prefers `zavorth_skill_marketplace` + `agent_manager` |

## Soft-fail / timeouts (reviewed)

| Path | Behavior |
|------|----------|
| Skill remote preview | No network on preview; full scan on apply |
| Worker CLI health | `--version` timeout ~3–4s; degraded if missing |
| Worker HTTP health | Async probe ~4s; sync health may return `unknown` until probe |
| Worker live invoke | Requires approval; dry-run default |
| Trust deny band | Apply blocked without `force` |
| Install without consent | Receipt `blocked` (or auto-consent only when policy allows) |

## W9 decision

After `npm run qa:skill-worker-mesh` succeeds, pick one:

| Decision | Meaning |
|----------|---------|
| **liberado para W9** | Start Telegram agent-first (natural text → LLM; slash only for `/commands`) |
| **adiar W9** | Keep regex natural language; fix residual issues first |

W9 product path: **agent-first free text by default** on Telegram; free-text intent-regex **hard-deleted**.
Optional: `ZAVORTH_TELEGRAM_AGENT_FIRST=0` disables agent-first only (still no regex). See [telegram-agent-first.md](./telegram-agent-first.md).

Record the decision in release notes or this file’s footer when you ship.

### Gate status template

```
Date:
qa:skill-worker-mesh: PASS | FAIL
Brand denylist: PASS | FAIL
Decision: liberado para W9 | adiar W9
Notes:
```

## Related

- [skills-universal-install.md](./skills-universal-install.md)
- [workers-mesh.md](./workers-mesh.md)
- [agent-harness-readiness.md](../agent-harness-readiness.md)
