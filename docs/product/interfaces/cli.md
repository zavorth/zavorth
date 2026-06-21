---
title: "CLI"
description: "Use the Zavorth CLI to run tasks, approve actions, check status, and manage everything from the terminal."
---

The Zavorth CLI is the fastest way to interact locally. Everything available in ZavorthControl is also available from the terminal — and some things are faster here.

## Everyday commands

```bash
zavorth                         # open the interactive home
zavorth ask "what should I do next?"   # quick question
zavorth run "review this repo"         # run a task
```

## Status and health

```bash
zavorth ready               # is everything set up and working?
zavorth status              # current runtime state
zavorth doctor              # diagnose any issues
zavorth doctor --simple     # quick human-readable summary
zavorth pulse               # fast daily briefing: pending tasks, approvals, highlights
```

`ready` is the daily launch check — run it before leaving your computer for an answer like `Pronto`, `Attention`, or `Blocked`, plus the next action.

## The HUD

```bash
zavorth hud
```

A full terminal dashboard showing:
- Active task and timeline
- Pending approval cards
- Recent receipts
- Trust Lens (risk context)
- Provider and channel status

Keyboard shortcuts in the HUD:
- `Y` — approve the top action card
- `N` — reject it
- `D` — open diff review
- `L` — open Learning review
- `O` — open ZavorthControl in browser

## Approvals and receipts

```bash
zavorth approve <id>                  # approve a pending action
zavorth diff                          # review pending file changes
zavorth diff approve <review-id>      # approve a diff
zavorth diff reject-hunk <id> <hunk>  # reject a specific change
zavorth receipts                      # see what Zavorth did
zavorth receipts --all                # full history
zavorth rollback <receipt-id>         # undo a reversible action
```

## Providers

```bash
zavorth providers                          # list all providers and status
zavorth providers add                      # add a new provider
zavorth providers switch                   # pick a different model
zavorth providers switch --provider gemini --model gemini-2.5-flash
zavorth providers test openai              # check configuration
zavorth providers test openai --live       # ping the API
```

## Channels

```bash
zavorth channels telegram           # setup or check Telegram
zavorth channels discord            # setup or check Discord
zavorth channels slack              # setup or check Slack
zavorth connectors doctor telegram  # detailed channel health check
```

## Skills and learning

```bash
zavorth skills              # list installed skills
zavorth skills search <q>  # search for a skill
zavorth skills install <name>  # install a skill
zavorth learn               # review auto-skill candidates
zavorth learn approve <id>  # approve a learned skill
zavorth learn reject <id>   # reject it
```

## Memory

```bash
zavorth memory query "your question"   # search memory
zavorth memory ingest                  # index new documents
zavorth memory lint                    # check for stale entries
```

## Setup and configuration

```bash
zavorth setup                  # first-run wizard (or re-run it)
zavorth setup --identity       # update name and role
zavorth setup --personality    # update tone and style
zavorth setup --safety         # update approval rules
zavorth recalibrate --voice    # re-run voice/tone config
zavorth recalibrate --user     # re-run user preferences
```

## Runtime management

```bash
zavorth start              # start the runtime
zavorth start --dry-run    # preview what start would do
zavorth open               # open ZavorthControl in browser
zavorth stay-online        # watchdog — alerts if runtime drops
zavorth stay-online --watch --notify-telegram
```

## Response styles

Switch how Zavorth communicates temporarily:

```bash
zavorth ask "use short style"       # brief answers
zavorth ask "use dev style"         # technical, compact
zavorth ask "use mentor style"      # patient, explains reasoning
zavorth ask "use executive style"   # structured, decision-first
```

These are temporary — your configured style is always the default.

## JSON output (for automation)

Any command can output machine-readable JSON:

```bash
zavorth status --json
zavorth providers --json
zavorth receipts --json
zavorth doctor --json
```

## One-shot mode (headless)

Run without interactive mode — useful for scripts:

```bash
zavorth -p "review src/"
zavorth -p "fix the failing tests" --approval-mode governed
zavorth -p "summarize git log" --json
```

## Related

- [ZavorthControl](/docs/product/interfaces/zavorthcontrol)
- [Approvals](/docs/product/concepts/approvals)
- [Troubleshooting](/docs/product/help/troubleshooting)
