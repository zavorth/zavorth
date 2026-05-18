# Operator Experience Release Certification

Date: 2026-05-18

This certification closes the operator polish pass for Echo, Stay Online, Nexus,
Agent Review, Swarm v2 and the dashboard surface.

## What Changed

- Stay Online is quiet by default: unchanged healthy checks are suppressed,
  repeated warning notifications require explicit opt-in, and critical alerts
  still notify.
- Dashboard/Nexus exposes operator state as direct cards instead of raw logs.
- Agent Review now has a visual review board with severity lanes, suggested
  actions and approval-gated patch mode.
- Swarm v2 exposes replay insights for timeline, roles, bottlenecks and
  synthesis confidence.
- Command Center visual QA now targets `/dashboard`, tolerates live realtime
  connections and captures unlocked screenshots.
- The Docker sandbox runtime is configured honestly for this host as `runc`.
  gVisor remains dormant until `runsc` is actually installed and registered.

## Evidence

- Build: `npm run build`
- Typecheck: `npm run runtime:check`
- Dashboard preview: `npm run qa:command-center-browser-preview`
- Dashboard real flow: `npm run qa:command-center-real`
- Dashboard live visual: `npm run qa:command-center-live-visual`
- Sandbox doctor: `npm run sandbox:doctor:smoke`
- Sandbox opt-in smoke: set `ZAVORTH_SANDBOX_SMOKE_OPT_IN=true`, then run `npm run sandbox:optin:smoke`
- Stay Online: `npm run zavorth:stay-online:json`
- Agent Review: `npm run zavorth:agent-review:check`
- Swarm v2: `npm run swarm-v2:check` and `npm run swarm-v2:benchmark:check`
- Security: `npm run security:secrets`

## Result

The current operator experience is considered release-ready when all commands
above pass in the local environment. Live external delivery still depends on
the user's configured credentials and channels; the runtime must never invent
or bypass those credentials.
