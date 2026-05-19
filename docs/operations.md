# Operations

Operate Zavorth as a governed local runtime: start it predictably, check health,
read clear readiness states and approve sensitive work deliberately.

## Daily Operator Loop

```bash
npm run setup
npm run go
npm run status
npm run doctor
npm run zavorth:productization-protected-runtime
```

For installed CLI users:

```bash
zavorth onboard
zavorth go
zavorth status
zavorth doctor --simple
zavorth templates
zavorth missions
zavorth receipts
```

## Core Checks

```bash
npm run runtime:check
npm run security:secrets
npm run zavorth:productization-protected-runtime:check
npm run workspace:check
```

Use `workspace:check` before publishing or after broad runtime changes. It is
intentionally larger than the daily loop.

## Capability Checks

These checks are useful when validating specific areas:

```bash
npm run zavorth:live-host:check
npm run zavorth:provider-live-canary:check
npm run zavorth:subagents:check
npm run zavorth:universal-skill-intake:check
```

They separate contract readiness from live host readiness. A capability can be
implemented and still need credentials, device pairing, sidecar setup or user
approval before it is live on this machine.

## Readiness Language

- `ready`: usable now on this host;
- `needs_setup`: configuration is missing;
- `needs_approval`: user approval is required before the next action;
- `dry_run`: safe preview only;
- `outbox_only`: message is staged locally, not sent live;
- `blocked`: policy or missing dependency prevents use;
- `unsupported`: no current adapter or supported path exists.

## Missions And Receipts

Daily work should be visible as a mission: request, risk, approvals, artifacts,
timeline and final receipt. CLI and Dashboard consume the same projection.

```bash
zavorth templates
zavorth missions --template=dev-repo-review
zavorth receipts
```

If a strong sandbox is not ready, read-only and preview flows continue, while
mutating work stays in dry-run until Docker/gVisor/Firecracker readiness is
confirmed and the user approves the exact scope.

## Sandbox Default

Zavorth treats sandbox readiness as a daily-use safety gate:

- local fallback can support read-only inspection, preview, doctor output and
  receipts;
- live workspace writes, host commands, network writes, channel sends and live
  skill apply require a strong sandbox plus scoped approval;
- strong sandbox means Docker, gVisor or Firecracker reported as ready by the
  sandbox doctor;
- if the strong tier is missing, Zavorth must say so and keep mutable work in
  dry-run.

Use:

```bash
npm run sandbox:doctor
npm run sandbox:doctor:json
npm run sandbox:doctor:smoke
zavorth doctor --advanced
```

## Channels And Providers

Channel Mesh should tell the operator whether a channel is live, partial,
outbox-only or unavailable. Provider checks should do the same for model,
search, media, speech and other provider-backed capabilities.

The next roadmap item is stronger transport discovery per channel and live
readiness per provider. See [Roadmap](/docs/product-direction.md).

## Secrets

Secrets should move through `SecretRef` metadata, not raw prompt text or public
docs. Doctors and approvals should explain what is missing without printing the
secret value.

## Troubleshooting

Start small:

```bash
npm run status
npm run doctor
npm run security:secrets
npm run runtime:check
```

Then validate the specific area:

- channels: run the channel capability awareness check script;
- providers: `npm run zavorth:provider-live-canary:check`;
- subagents: `npm run zavorth:subagents:check`;
- skills: `npm run zavorth:universal-skill-intake:check`;
- perception/device: run the perception certification check script.

## Publishing Hygiene

Before presenting the repo publicly:

```bash
npm run security:secrets
npm run runtime:check
```

Public docs should describe the current product, not old implementation notes.
