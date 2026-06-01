# Zavorth DDD Boundary Policy

Zavorth uses a DDD-inspired modular architecture under `src/domain`.

The enterprise rule is:

- `domain/**/domain` holds contracts, domain types, and pure rules.
- `domain/**/application` coordinates use cases through ports.
- `domain/**/infrastructure` adapts concrete runtime, services, config, files, network, and provider APIs.
- `domain/**/presentation` adapts HTTP, web, dashboard, CLI, and rendering surfaces.
- top-level facades expose bounded-context snapshots and depend on domain ports, not concrete services.

The repository still carries legacy boundary exceptions while the migration is drained. They are recorded in `ddd-boundary-baseline.json`.

Run `npm run architecture:ddd:check` before merging architecture changes. The check blocks new imports from guarded domain files into concrete roots such as `src/services`, `src/runtime`, `src/api`, `src/config`, `src/tools`, and `src/observability`.
