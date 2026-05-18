# Wave 1 Live Read-Only External Executor Probe

Status: wave-1-live-read-only-external-executor-probe-ready-with-manual-smoke

This record is retained as historical compatibility evidence for the Zavorth-owned external agent boundary.

- Related smoke report: docs/152-wave-1-live-read-only-external-executor-smoke-report.md
- Test design: docs/149-wave-1-real-sidecar-adapter-test-design.md
- Boundary pack: docs/150-wave-1-sidecar-read-only-boundary-pack.md

The `150` boundary pack must pass before any ExternalExecutor live contact is attempted.

Rules:
- read-only only
- Manual smoke is optional and environment-gated.
- It is not part of CI.
- Allowed read-only probes: version, status, health, capabilities
- Do not run setup, install, login, auth, configure, write, send, tool
- real adapter remains blocked
- live event stream remains blocked
- action dispatch remains blocked

