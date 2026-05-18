# Zavorth CLI

The Zavorth CLI is the official terminal entry point for onboarding, local
operation, diagnostics, guided missions, receipts and automation-friendly
output.

## Install

```bash
npm install -g zavorth@latest
```

For a cloned repository:

```bash
npm install
npm run zavorth:start
```

## Happy Path

Installed CLI:

```bash
zavorth start
zavorth go
zavorth connectors doctor
zavorth demo browser
```

Local repo:

```bash
npm run zavorth:start
npm run go
npm run zavorth:connectors
npm run zavorth:demo:check
```

`go` opens or prints the Dashboard URL at `/dashboard`.
`start` is the single product entrypoint: it shows setup preview, Home,
connector doctor and optional visual demo.
`connectors doctor` checks GitHub, Telegram and Discord with real per-channel setup commands.
`onboard` is a friendly alias for `setup`; `onboard journey` keeps the older
read-only onboarding overview available when you need it.

## Common Commands

```bash
zavorth onboard
zavorth onboard doctor
zavorth onboard templates
zavorth onboard first-mission
zavorth setup
zavorth start
zavorth go
zavorth demo
zavorth demo browser
zavorth connectors doctor
zavorth connectors setup telegram --apply --allowed-user=<id>
zavorth connectors setup discord --apply --guild=<id> --channel=<id> --owner=<id>
zavorth ready
zavorth stay-online
zavorth readiness
zavorth status
zavorth doctor
zavorth templates
zavorth missions
zavorth receipts
zavorth providers
zavorth providers test openai
zavorth run "review this repo"
```

If a command is not available in the installed package yet, use the local
script shown by `package.json` or run the equivalent package script from the
repository.

`zavorth onboard` is the unified, read-only first-run journey. It brings
setup, go, doctor, templates, sandbox readiness, provider readiness and the
first safe mission into one view. Use `zavorth onboard apply` or
`zavorth setup` when you deliberately want the setup flow.

## JSON Output

Use JSON for automation:

```bash
zavorth status --json
zavorth connectors doctor --json
zavorth demo --json
zavorth onboard --json
zavorth onboard doctor --json
zavorth doctor --json
zavorth templates --json
zavorth missions --json
zavorth receipts --json
zavorth providers --json
zavorth readiness --json
```

## Daily Product Commands

```bash
zavorth ready
zavorth stay-online
zavorth readiness
zavorth templates
zavorth missions --template=dev-repo-review
zavorth receipts --advanced
zavorth doctor --simple
zavorth doctor --advanced
```

These commands expose the same protected runtime projection that the Dashboard
can consume: product mode, first-run journey, mission status, sandbox fallback,
approval posture and visual receipts. They do not execute Dashboard actions
by themselves.

## Runtime Readiness

```bash
zavorth ready
zavorth ready --offline
zavorth stay-online
zavorth stay-online --watch
zavorth stay-online --watch --notify-telegram
zavorth readiness
zavorth readiness --json
zavorth readiness --technical
npm run zavorth:runtime-readiness
npm run zavorth:runtime-readiness:check
```

`ready` is Zavorth Ready To Go: the launch guard before leaving the PC. It is
provider-agnostic, validates the active provider plus configured fallbacks, and
returns one verdict for remote use. By default it may run explicit safe provider
probes; `--offline` uses stored evidence only.

`readiness` is the daily operator gate. It checks the natural-first runtime,
provider mesh, Dashboard, Telegram, approvals, transaction plane, skill imports
and memory continuity in one read-only report. `attention` means Zavorth can be
usable with a setup gap; `blocked` means a required safety contract failed.
The default view is human-first (`Pronto`, `Atencao`, `Bloqueado`) with a next
safe action. Use `--technical` for the diagnostic form with check ids and
evidence markers.

`stay-online` is the watchdog after `ready`: it keeps checking Ready To Go plus
the supervised keepalive snapshot. `--watch` keeps it running; add
`--notify-telegram` when Telegram env vars are configured and you want remote
alerts while away from the PC.

## Provider Readiness

```bash
zavorth providers
zavorth providers test openai
zavorth providers test openai --live
zavorth providers live --provider openai
zavorth providers cockpit --provider openai
zavorth providers visual-approval --provider openai
```

`providers` shows whether each model route is ready, missing credentials,
missing a base URL, waiting for an explicit probe, degraded, unsupported or
blocked. Test commands produce an explicit probe packet; they do not make hidden
network calls or print raw secrets unless the operator explicitly passes
`--live`.

`--live` runs a real provider probe using a safe models/readiness endpoint and
returns only sanitized evidence: target without query strings, HTTP status,
duration, model count and evidence hash. It must never print the API key or
provider token.

`providers cockpit` projects the same provider data for the Dashboard. It
creates provider cards/actions/receipts as JSON or text, but it does not mutate
the dashboard and it cannot execute provider calls from the web surface.

`providers visual-approval` creates the owner-review package for future
Dashboard UI work. It lists proposed blocks, placements, data bindings,
acceptance criteria and rollback plan while keeping the actual dashboard
unchanged.

For local repo checks:

```bash
npm run runtime:check
npm run security:secrets
npm run workspace:check
```

## Capability Checks

```bash
npm run zavorth:subagents:check
npm run zavorth:universal-skill-intake:check
npm run zavorth:provider-live-canary:check
node scripts/zavorth-channel-capability-awareness-check.mjs
node scripts/zavorth-perception-certification-check.mjs
```

These checks are intentionally explicit: they make it clear whether a feature is
live on this host, dry-run only, blocked by policy, or waiting for credentials.

## Dashboard

The CLI should guide users to `/dashboard` instead of asking them to find tokens or
runtime files manually. When access fails, start with:

```bash
zavorth doctor
```

or, in the repo:

```bash
npm run doctor
```

## Security Posture

- Raw secrets should not be pasted into prompts.
- Credential state should be represented as `SecretRef` metadata.
- Sensitive writes, commands, network calls and live channel sends require
  policy and approval.
- CLI output should stay short for humans and stable under `--json`.

## Related Docs

- [Quickstart](/docs/02-quickstart.md)
- [Operations](/docs/09-operations.md)
- [Web Dashboard](/docs/07-web.md)
- [Roadmap](/docs/11-roadmap.md)
