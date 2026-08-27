# Architecture

Zavorth is organized around one rule: every surface should enter the same
governed runtime instead of becoming its own agent.

## Runtime Flow

1. A message arrives from CLI, ZavorthControl, API or a channel.
2. The runtime prepares context and classifies intent.
3. Security policy evaluates the requested action.
4. Approvals are requested for sensitive work.
5. Execution runs through tools, subagents, skills, schedules or perception
   services.
6. Results are returned with receipts, artifacts and observable state.

## Main Planes

### Surface Plane

CLI, ZavorthControl, API and channel adapters collect user intent and render
responses. They should stay thin.

### Gateway Spine

Gateway Spine is the product-facing source of truth for channel and session
state. Web, CLI and channel adapters should render `GatewaySpineSnapshot`
instead of keeping separate copies of sessions, approvals, receipts or
artifacts.

Use `zavorth serve` or `zavorth ui` to open the operator surface. Gateway
state is exposed through the runtime API/projection payload rather than a
separate CLI command.

### Policy Plane

The Policy Broker, approval envelopes, command blockers and egress guards decide
what can happen before action reaches the host.

### Sensitive Action Flow

Sensitive work follows one path:

1. normalize intent;
2. create a preview;
3. classify risk;
4. evaluate Policy Broker;
5. request approval when needed;
6. keep execution read-only, dry-run or executor-ready;
7. emit a visual receipt;
8. prepare rollback receipts before mutation.

Use `zavorth chat "edit src/index.ts"` for the normal CLI entry. ZavorthControl can
render sensitive work as an action card, but it does not execute actions by
itself.

### Execution Plane

The runtime coordinates tasks, tools, subagents, skills, provider calls,
workspace operations and scheduled work.

### Official Zavorth Ensemble

Zavorth Ensemble is the official multi-agent execution surface for large work. It keeps
Zavorth's normal governance path, but adds a stronger team runtime:

- canonical API: `/api/web/gateway/zavorth-ensemble`;
- legacy compatibility alias: `/api/web/experimental/zavorth-ensemble`;
- persistent role library for planner, researcher, implementer, verifier,
  synthesizer, safety reviewer and custom roles;
- batch queue with bounded concurrency and up to 300 planned roles;
- per-role replay events, queue snapshots and parallelism metrics;
- worker isolation metadata, with `temp-worktree` as the safe default cwd
  separation and docker/wsl/external-sandbox profiles for stronger hosts;
- deterministic final synthesis when no LLM synthesis provider is attached.

Use `npm run zavorth-ensemble:check` or the ZavorthControl swarm surface when validating
multi-agent work interactively. Maintainer CI verifies the official Zavorth Ensemble
contract.

### Memory And Artifact Plane

Session state, summaries, artifacts and receipts make work resumable without
turning old content into trusted instructions.

### Capability Plane

Channel Mesh, Provider Mesh, skills, MCPs and perception/device capabilities all
describe what the runtime can do and whether this host is ready to do it.

## Operational Maturity Truth

The current canonical capability matrix is kept in
`config/operational-maturity.json`. The stable public architecture references
these capability IDs so product docs do not drift from runtime truth:

- `browser-mcp`
- `local-voice-dictation`
- `swarm-executor`
- `session-v2-pty`
- `session-recorder-dvr`
- `nexus-surface`
- `echo-edge-layer`

Nexus is not a parallel runtime. It is a surface/API convergence layer for the
central runtime.

Operational check wording: Nexus is not a parallel runtime. It is only a governed
projection and convergence surface over the central runtime.

Echo is an edge interaction layer for quick voice, device and fallback flows. It
is not the primary brain of Zavorth.

The real orchestration brain is the Intelligence Fabric, with the current
runtime kept as the governed execution path and fallback.

## Design Preferences

- one policy path for all surfaces;
- explicit readiness states instead of vague "configured" claims;
- SecretRefs instead of raw secrets;
- dry-run and preview before mutation;
- docs and APIs that distinguish live, preview, blocked and unsupported states.

## Related

- [Overview](/docs/overview.md)
- [Security](/docs/security.md)
- [Executors](/docs/execution.md)
- [Operations](/docs/operations.md)
