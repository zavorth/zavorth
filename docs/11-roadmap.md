# Zavorth Roadmap

This roadmap describes current product direction, not implementation history.

## Current Focus

- Keep the local-first runtime reliable for daily operator use.
- Improve dashboard, CLI, Telegram, and API flows around the same governed gateway.
- Continue hardening approvals, receipts, provider readiness, and memory.
- Keep skill evolution native, scoped, auditable, and approval-based.

## Near-Term Priorities

1. Polish the operator dashboard around readiness, approvals, providers, and memory.
2. Expand provider certification without claiming live support before a real proof exists.
3. Improve Mnemos file understanding and the workspace wiki flow.
4. Keep Swarm execution bounded by budget, isolation policy, and replayable evidence.
5. Make product documentation smaller, clearer, and aligned with real behavior.

## Non-Goals

- No silent execution of sensitive actions.
- No raw secret serialization in prompts, logs, receipts, or screenshots.
- No hidden dependency on external agents or imported skill bodies.
- No product documentation that depends on temporary implementation notes.

## Release Rule

A capability is considered product-ready only when it has:

- a stable command or UI surface;
- a clear readiness status;
- security and identity checks;
- documented approval behavior;
- tests or certification evidence.
