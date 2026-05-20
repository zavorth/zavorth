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
npx zavorth setup
npx zavorth start
```

## Happy Path

Installed CLI:

```bash
zavorth setup
zavorth start
zavorth open
zavorth ready
```

`setup` opens the guided Setup Studio. `start` starts or resumes the local
runtime. `open` opens the Dashboard. `ready` tells you if the machine is usable
for daily work.

## Common Commands

```bash
zavorth setup
zavorth start
zavorth open
zavorth ready
zavorth status
zavorth doctor
zavorth providers
zavorth providers add
zavorth providers switch
zavorth providers test openai
zavorth channels telegram
zavorth channels discord
zavorth skills
zavorth review
zavorth trust
zavorth receipts
zavorth run "review this repo"
```

Compatibility aliases such as `go` and `onboard` may still work, but the public
surface should prefer the commands above.

## JSON Output

Use JSON for automation:

```bash
zavorth status --json
zavorth connectors doctor --json
zavorth doctor --json
zavorth receipts --json
zavorth providers --json
zavorth channels telegram --json
```

## Daily Product Commands

```bash
zavorth ready
zavorth stay-online
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
zavorth providers add
zavorth providers switch --provider gemini --model gemini-2.5-flash
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

`providers add` and `providers switch` open the Provider Wizard. It captures API
keys only through a secret prompt or `--secret-env`, writes `.env` only with
`--apply`, and prints redacted previews by default.

## Channel Wizards

```bash
zavorth channels telegram
zavorth channels telegram --apply --allowed-users <telegram-user-id>
zavorth channels discord
zavorth channels discord --apply --allowed-guilds <guild-id> --allowed-channels <channel-id> --owners <owner-id>
```

`channels` is the human wizard surface for Telegram, Discord, Slack, WhatsApp,
Signal and Email. It prepares tokens, allowlists and channel policy without
starting a bot, sending messages, or printing raw secrets. Use `connectors
doctor` after the wizard when you want the technical channel health report.

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
npm run security:ci
npm run build --silent
```

## Maintainer Checks

```bash
npm run runtime:check
npm run security:ci
npm run daily:certify
```

These commands are for maintainers and CI. Normal users should not need them
for first-run setup, provider configuration, channel setup, or daily operation.

## Dashboard

The CLI should guide users to `/dashboard` instead of asking them to find tokens or
runtime files manually. When access fails, start with:

```bash
zavorth doctor
```

or, in the repo:

```bash
zavorth doctor
```

## Security Posture

- Raw secrets should not be pasted into prompts.
- Credential state should be represented as `SecretRef` metadata.
- Sensitive writes, commands, network calls and live channel sends require
  policy and approval.
- CLI output should stay short for humans and stable under `--json`.

## Related Docs

- [Quickstart](/docs/quickstart.md)
- [Operations](/docs/operations.md)
- [Web Dashboard](/docs/web-dashboard.md)
- [Roadmap](/docs/product-direction.md)
