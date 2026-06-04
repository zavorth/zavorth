---
title: "Approvals"
description: "Zavorth shows you what it plans to do, waits for your OK, and keeps a record. Here's why that matters."
---

## The idea

Other AI tools just do things. Zavorth shows you what it plans to do first.

Before anything sensitive happens — writing a file, running a command, sending a message, changing a setting — Zavorth creates a preview and waits. You see exactly what it wants to do, you say yes or no, and it proceeds accordingly. Every decision is logged.

This is not a limitation. It is the reason you can trust Zavorth with real work.

## How it works

```
Your message
  → Zavorth builds a plan
  → Checks if any step is sensitive
  → If yes: shows a preview, waits for approval
  → If no: does the work directly
  → Always: logs what happened with a receipt
```

**Sensitive** means anything that changes something, sends something, or could be hard to undo. Reading files, searching the web, and answering questions never need approval.

## Giving approval

You can approve from anywhere you are already talking to Zavorth:

```
# From the chat (any channel)
approve abc123

# From the CLI
zavorth approve abc123

# From the ZavorthControl dashboard
Click the Approve button on the action card
```

Zavorth sends the approval request to wherever you are. If you are on Telegram, it appears there. If you are in the browser dashboard, it shows up there. You do not have to switch tools.

## What a receipt looks like

After every approved action, Zavorth creates a receipt:

```
✓ Project settings updated
  Changed: 3 lines (added timeout configuration)
  Time: 2.1s
  Approval: abc123 (approved by you at 14:32)
  Rollback: available
```

Receipts are stored in `.zavorth/receipts/` and visible in the dashboard. You can look back at anything Zavorth did, when, and why.

## Configuring what needs approval

During setup, you choose what always requires approval. The defaults are conservative:

| Action | Default |
|---|---|
| Writing files | Ask |
| Running shell commands | Ask |
| Sending messages externally | Ask |
| Making network requests | Ask |
| Changing providers | Ask |
| Reading files | Never (safe) |
| Searching the web | Never (safe) |
| Answering questions | Never (safe) |

To change what needs approval:

```bash
zavorth setup --safety
```

Or just tell Zavorth:

```
Always ask before running any shell commands.
You can write to files in this project without asking.
```

## Rollback

Some actions can be undone. When they can, Zavorth shows a rollback option in the receipt:

```bash
zavorth rollback abc123
```

Rollback is not available for everything — sending a message or running a script cannot be un-run. Zavorth is honest about this in the preview, before you approve.

## The audit trail

Everything Zavorth does is logged. You can review:

```bash
zavorth receipts          # recent receipts
zavorth receipts --all    # full history
zavorth receipts --json   # machine-readable output
```

This makes Zavorth safe to use for anything important. You always know what it did and when.

## Related

- [Getting started](/docs/produto/start/getting-started)
- [ZavorthControl dashboard](/docs/produto/interfaces/zavorthcontrol)
- [Security](/docs/produto/conceitos/features)
