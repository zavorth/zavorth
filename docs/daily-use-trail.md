# Daily Use Trail

This page is the short path for a new operator who wants Zavorth ready for daily work without reading the full architecture first.

## The First Pass

1. **Choose a profile**
   Pick `personal`, `creator`, `developer`, `business` or `power`. The profile changes tone, suggested tools and how much detail Zavorth shows by default.

2. **Test a provider**
   Add one model provider or local model, then run a probe. Zavorth should show whether the route is live, fallback-only or blocked by a missing key.

3. **Connect a channel**
   Start with Telegram when available, then add Slack, WhatsApp, Signal, Email or Discord as needed. A channel is only live after its proof passes; otherwise it stays as outbox or preview.

4. **Pick a runtime profile**
   Choose `minimal`, `chat`, `safe-8gb`, `developer` or `full`. The runtime profile should explain what starts automatically, what stays lazy and which doctor check to run next.

5. **Review learned memory**
   Open learned memory before relying on personalization. Every item should show evidence, confidence, expiry and actions to edit, reject or forget.

6. **Add tools and skills**
   Use the tools catalog for MCP entries, local tools and skills. New executable behavior starts as preview, gets scanned, runs a smoke check and only becomes active after the required approval.

7. **Schedule a routine**
   Create a routine only after the final prompt and scope are visible. Jobs cannot silently expand scope, renew expired approval or bypass the kill switch.

8. **Run evals**
   Run evals for response quality, learned memory safety, tool use, leaks, approval fatigue and recovery from failed tools.

## Daily Loop

- Ask normally in the inbox.
- Let safe, reversible work run quietly.
- Review clear previews for important changes.
- Check receipts and learned memory when something looks surprising.
- Promote useful skills and archive unused ones from the same lifecycle surface.

## Daily Product Experience

The daily product experience is the single projection that joins the first-run
checklist, daily work loop, review center and quality gates. It is meant for
Zavorth Control, CLI and docs surfaces that need to explain what the user should
do next without granting any new execution authority.

```bash
npm run zavorth:daily-product-experience
npm run zavorth:daily-product-experience:json -- --profile personal
npm run zavorth:daily-product-experience:check
```

It keeps the happy path simple:

1. Start guided: choose profile, test provider, connect channel, configure
   runtime, review memory, review tools, schedule one routine and run evals.
2. Work daily: ask, let Zavorth understand readiness and risk, choose a route,
   work, deliver, record history and review what changed.
3. Review later: learned memory, skills, channel readiness, execution readiness,
   quality evals and history are visible from one center.

The projection is read-only. Live sends, file changes, provider changes,
scheduled work and sensitive learned memory still use the runtime approval path.

## Useful Commands

```bash
zavorth start
zavorth setup
zavorth connect
zavorth learn
zavorth tools
zavorth health
```

These commands are guides. They do not change files, send messages or install tools by themselves.
