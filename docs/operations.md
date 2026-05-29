# Operations

Operate Zavorth as a governed local runtime: start it predictably, check health,
read clear readiness states and approve sensitive work deliberately.

## Daily Operator Loop

```bash
zavorth setup
zavorth start
zavorth open
zavorth ready
zavorth status
zavorth doctor
zavorth receipts
```

## Core Checks

```bash
npm run runtime:check
npm run security:ci
npm run build --silent
```

Use these before publishing or after broad runtime changes. They are maintainer
checks, not first-run user commands.

## Capability Checks

These checks are useful when validating specific areas:

```bash
zavorth providers test <provider>
zavorth connectors doctor <channel>
zavorth skills
zavorth review
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
timeline and final receipt. CLI and ZavorthControl consume the same projection.

```bash
zavorth review
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
zavorth execution-backends
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
zavorth status
zavorth doctor
zavorth ready
```

Then validate the specific area:

- providers: `zavorth providers test <provider>`;
- channels: `zavorth connectors doctor <channel>`;
- skills: `zavorth skills`;
- review/runtime: `zavorth review` and `zavorth doctor`.

## Publishing Hygiene

Before presenting the repo publicly:

```bash
npm run runtime:check
npm run security:ci
```

Public docs should describe the current product, not old implementation notes.
