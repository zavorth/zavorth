---
title: "ZavorthControl"
description: "ZavorthControl is the browser dashboard where you chat, approve tasks, review receipts, and see what Zavorth is doing."
---

ZavorthControl is Zavorth's browser dashboard. It is the main visual interface — where you see everything that is happening, approve tasks, review history, and manage settings.

## Opening it

```bash
zavorth start   # starts the runtime
zavorth open    # opens ZavorthControl in your browser
```

Default address: [http://localhost:3000/control](http://localhost:3000/control)

## What you see

### Inbox

All incoming messages from your channels — Telegram, Discord, WhatsApp, Slack — appear here in one place. You can reply directly from the dashboard without switching apps.

### Tasks and approvals

When Zavorth needs your approval before doing something, it appears as an **approval card** with:
- What it wants to do
- Why
- A diff if it is changing a file
- Approve / Reject buttons

You can also type `approve <id>` in any chat to approve from your phone.

### Receipts

Every action Zavorth took — approved or automatic — shows a receipt: what ran, what changed, how long it took, what model was used. Receipts are permanent and searchable.

### Runtime status

A live readout of:
- Provider status (which model is active)
- Channel status (which are connected and live)
- Pending approvals count
- Memory state
- Active tasks

### Sessions

Each conversation context is a session. You can browse past sessions, continue them, or search their history.

## Chat

You can chat with Zavorth directly in the dashboard. This is the same runtime as any other channel — the same Zavorth, same approvals, same receipts.

Type naturally:

```
What did we work on last week?
Review the latest pull request.
Check if the server is still running.
```

## ZavorthControl CLI commands

```bash
zavorth open            # open in browser
zavorth start           # start the runtime (required first)
zavorth status          # check if it's running
zavorth hud             # terminal-based dashboard alternative
zavorth pulse           # quick summary in terminal
```

## Remote access

By default, ZavorthControl is only accessible from your local machine. To access it remotely:

**Tailscale (recommended):**
```bash
tailscale serve --bg http://localhost:3000
```

**SSH port forwarding:**
```bash
ssh -L 3000:localhost:3000 user@your-server
```

Do not expose ZavorthControl to the public internet without authentication.

## Mobile access

ZavorthControl is a responsive web app — it works in a mobile browser. Open it from your phone via remote access or your local network.

For a more native mobile experience, Zavorth's **Satellite PWA** (in development) pairs to ZavorthControl and surfaces approvals and quick chat from your home screen.

## Related

- [Getting started](/docs/produto/start/getting-started)
- [Approvals](/docs/produto/conceitos/aprovacoes)
- [CLI](/docs/produto/interfaces/cli)
