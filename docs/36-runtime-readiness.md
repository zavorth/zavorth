# 36 - Runtime Readiness

Date: 2026-05-16
Status: runtime-readiness-command-ready

Runtime Readiness turns the certification sweep into one daily operator check.

## Command

```text
zavorth ready
zavorth ready --offline
zavorth stay-online
zavorth stay-online --watch
zavorth stay-online --watch --notify-telegram
zavorth ready --json
zavorth readiness
zavorth readiness fixes
zavorth readiness fix provider --live-proof --provider <id>
zavorth readiness --json
zavorth readiness --technical
npm run zavorth:runtime-readiness
npm run zavorth:ready-to-go
npm run zavorth:stay-online
npm run zavorth:runtime-guided-fixes
npm run zavorth:runtime-readiness:check
```

`zavorth ready` is the Zavorth Ready To Go launch guard. It is the one command
to run before leaving the PC. It checks the daily runtime, active provider,
configured provider fallbacks, Dashboard, Telegram, approvals, memory, skills
and transaction safety. Because the operator is explicitly asking for a launch
guard, the default command may run safe provider live probes against configured
providers. It never sends prompts, executes tools, approves actions, imports
skills or performs transactions. Use `zavorth ready --offline` to use only
stored evidence.

`zavorth stay-online` is the companion watchdog for after Ready To Go. It reads
the same launch guard plus the supervised keepalive snapshot, writes
`data/runtime/zavorth-stay-online.json`, and reports either "continua tudo ok"
or the first concrete alert. `--watch` repeats the check. `--notify-telegram`
uses `TELEGRAM_BOT_TOKEN` plus `ZAVORTH_STAY_ONLINE_NOTIFY_CHAT_IDS` or
`TELEGRAM_ALLOWED_USER_IDS` to send status changes and active alerts without
serializing the bot token.

Default output is operator UX: `Pronto`, `Atencao` or `Bloqueado`, plus the
next safe action. `--technical` keeps the old diagnostic report for debugging.
`--json` includes the source readiness snapshot and `operatorUx` for dashboard
or automation consumers.

## What It Verifies

- natural-first text enters the gateway
- risky text becomes preview/approval
- provider mesh can report configured routes without hidden live probes
- `/dashboard` exists as the daily-use projection-only surface
- Telegram remote approval is configured or clearly marked as an optional setup gap
- approvals remain gateway-mediated and do not execute target actions
- transaction plane is ready-held, not live-executing
- external skill imports remain explicit, reviewed and pinned
- memory continuity can produce a snapshot without hidden writes

## Daily Meaning

`status=ready` means the whole operator path is green.

`status=attention` means Zavorth is usable, but something optional or degraded needs setup, usually Telegram or provider credentials.

`status=blocked` means at least one required daily safety contract failed and Zavorth should not be used unattended until that check is repaired.

## Safety Contract

Runtime Readiness is read-only. It does not start live provider probes, approve actions, execute tools, import skills, write memory, or move money.

The command only reports readiness and the next safe action.

Stay Online is also observation-first. Its self-heal path only proposes safe
commands such as `zavorth readiness fixes` or `npm run ops:remote:keepalive`;
it does not run target actions, bypass approvals or execute live transactions.

Guided Fixes are also projection-first. They turn each `Atencao` or `Bloqueado`
card into a safe next step for CLI, Dashboard or Telegram. If a fix needs a
real provider probe, it is shown as an explicit operator command:
`zavorth readiness fix provider --live-proof --provider <id>`.

Provider live proof is stored as sanitized health evidence in
`data/runtime/provider-live-proof.json`. It stores provider id, target, status,
timestamps and evidence hash, never raw API keys. Normal readiness can then
trust fresh proof without running hidden network calls on every render.

## Operator Surfaces

- CLI: `zavorth readiness` prints the operator summary by default.
- Dashboard: `/api/runtime/readiness` exposes `runtimeReadinessUx` for the
  `/dashboard` readiness strip.
- Dashboard fixes: `/api/runtime/readiness/fixes` exposes guided next steps,
  but still cannot execute target actions or hidden live probes.
- Dashboard stay-online: `/api/runtime/stay-online` exposes the watchdog
  snapshot for status strips and external operator views.
- Telegram: `/readiness` returns the same summary with safe callback buttons
  for Dashboard, Status, Providers and Approvals.
- Telegram stay-online: `/stayonline` returns the latest watchdog verdict with
  safe buttons for Ready, Readiness, Fixes and Dashboard.
- Telegram fixes: `/fixes` returns the same guided next steps with read-only
  callbacks.

These surfaces are projection-only. Buttons route to existing governed views or
commands; they do not execute target actions.
