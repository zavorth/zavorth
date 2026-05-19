---
name: Zavorth Communication Control
description: Draft, route, approve, and audit messages across configured communication channels.
license: Zavorth-Internal
risk: medium
requiredApproval: tool-preview
---

# Zavorth Communication Control

Use this skill for Telegram, Discord, Slack, WhatsApp, Signal, Email, and API surfaces.

## Rules

- Match the channel capabilities.
- Use buttons or rich actions where supported.
- Require approval for outbound sensitive or irreversible messages.
- Redact secrets and preserve receipts.

## Output

Return the message preview, channel, approval status, and receipt plan.
