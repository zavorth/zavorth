# Telegram free-text: agent-first (intent-regex deleted)

> **Surface-agnostic product rule:** agent-first free text is the default on **every** surface (Telegram, Desktop, Control, CLI, …), not only Telegram.
> See `docs/product/surface-agent-contracts.md` (C1/C2/C3).
> Global kill: `ZAVORTH_SURFACE_AGENT_FIRST=0`. Telegram-only kill: `ZAVORTH_TELEGRAM_AGENT_FIRST=0`.

## Product model

| Input | Path |
|-------|------|
| `/approve`, `/reject`, `/undo`, `/help`, … | Deterministic slash (**admin** for approve/reject/undo; same policy as buttons) |
| Inline buttons `task:approve\|reject\|undo:<id>` | Deterministic callbacks (**admin** role) |
| HIGH_RISK approve button | Starts TOTP challenge (force_reply); reply with 6-digit code or `/approve <id> <code>` |
| Free text (any language) | **Agent gateway** (LLM + tools); bare TOTP only if a HIGH_RISK challenge is open |

Shared-surface free-text intent packs (mesh / task-variation / etc.) were **removed from the repo**.

Approvals on free text: **not** via “sim/ok/approve” phrases when agent-first is on — use `/approve`, `/reject`, or buttons. With `ZAVORTH_TELEGRAM_AGENT_FIRST=0`, free-text approval phrases may still resolve pending agent approvals (legacy).

**Under agent-first (default):** priority ops NLU and natural capability free-text interceptors are **skipped** for non-slash text. Slash still uses deterministic handlers. With `ZAVORTH_TELEGRAM_AGENT_FIRST=0`, those NLU layers may run again.

## Defaults

- **Agent-first ON** for Telegram free text (no env required) on shared-surface preDispatch.
- Free-text **approval phrase mutation** disabled under agent-first (default).
- Intent-regex interceptors in shared-surface preDispatch are **gone**.

## Optional kill switch

Canonical helper: `isTelegramAgentFirstFreeTextEnabled()` in `SurfaceAgentFirstMode.ts`.

```bash
export ZAVORTH_TELEGRAM_AGENT_FIRST=0
```

| Effect when OFF | Notes |
|-----------------|--------|
| Shared-surface: no early `pass_to_agent` | Free text is parse-only at preDispatch |
| Priority NLU free-text may run | Slash still works either way |
| Natural capability free-text may run | Automations/research-style phrases |
| Free-text approval phrases may run | “sim/ok” style pending approvals |

Does **not** restore deleted free-text intent packs. There is **no** `ZAVORTH_TELEGRAM_LEGACY_NATURAL`.

## Optional flags

| Env | Effect |
|-----|--------|
| `ZAVORTH_SURFACE_AGENT_FIRST=1` | Free text → agent on all shared-surface platforms |
| `ZAVORTH_TELEGRAM_AGENT_FIRST=0` | Ops kill switch (table above) |

See also: [monorepo-open-items-closeout.md](./monorepo-open-items-closeout.md).

## Multilingual

- Free text: covered by the LLM (not a phrase dictionary).
- System replies / help: use Telegram i18n locales under `src/i18n/locales/*/telegram.yaml`.
- Actions: language-neutral slash ids and `callback_data`.

## Related tools (daily-ops)

- `zavorth_skill_marketplace` — skill search/preview/install
- `agent_manager` — workers / route / invoke
- `zavorth_action` — governed product actions

## Metrics

`getSurfaceAgentFirstMetrics()` / `formatSurfaceAgentFirstMetricsText()`
in `SurfaceAgentFirstMode.ts` (`naturalSkippedForAgent`, `slashDeterministic`).

## Wiring (preDispatch)

`preDispatchSharedSurfaceCommand` takes only:

- `ctx`, `rawText`, `parsed`, `parse`, `discordSurfacePolicyService`

No natural-pack dependencies are assembled for free-text interceptors. Slash packs remain via `dispatchSharedSurfaceCommandPacks` / builtin dispatch.

## Related

- [skills-universal-install.md](./skills-universal-install.md)
- [workers-mesh.md](./workers-mesh.md)
- [skill-worker-mesh-qa-gate.md](./skill-worker-mesh-qa-gate.md)
- [skill-worker-mesh-waves-closeout.md](./skill-worker-mesh-waves-closeout.md)
