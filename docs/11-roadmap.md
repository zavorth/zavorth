# Roadmap

This roadmap keeps only near-term work that strengthens daily use without
bringing back old implementation diaries or external-runtime baggage.

## Current Product Line

Zavorth is a local-first governed agent runtime. The public roadmap should
improve what users already touch every day:

- Dashboard and CLI operation;
- channels and provider readiness;
- approvals, SecretRefs and receipts;
- skills, subagents, scheduled tasks and perception tools;
- public docs that match the current repo.

## Next Investments

### Channel Transport Discovery

Goal: make Channel Mesh explain what each channel can actually do on this host.

Planned outcome:

- channel status includes configured transport, required credentials, webhook
  state, send mode, receive mode and safe fallback;
- Telegram, Discord, WhatsApp, Slack, Signal and iMessage expose equivalent
  readiness signals even when their native capabilities differ;
- channels with no live connector are clearly labeled as unavailable or
  outbox-only, not "ready".

### Live Readiness By Channel And Provider

Goal: separate "contract exists" from "this host can use it right now".

Planned outcome:

- a live readiness certificate for each provider and channel;
- checks distinguish mock-safe, dry-run, configured, live-ready, degraded and
  blocked states;
- Dashboard and CLI show the same readiness model.

### Better SecretRef UX

Goal: keep secrets out of prompts and logs while making setup easier.

Planned outcome:

- users see which credential is missing without seeing or pasting raw secrets
  into chat;
- approvals and doctors explain what a SecretRef unlocks;
- common setup flows validate presence, scope and expiry safely.

### Public Documentation Refresh

Goal: keep the repo clean, readable and honest.

Planned outcome:

- README, quickstart, CLI, operations, security and architecture docs stay small
  and current;
- old planning reports, private audits and implementation diaries stay out of the
  public surface;
- docs say when something is live, dry-run, governed preview or future work.

## Non-Goals

- importing raw SQLite history from old runtimes by default;
- making an external executor the Zavorth kernel;
- copying another project identity into Zavorth;
- publishing private audits as user-facing docs;
- adding live side effects without Policy Broker, approval, receipts and
  rollback posture.
