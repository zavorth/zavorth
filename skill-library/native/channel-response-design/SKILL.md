---
name: Channel Response Design
description: Shape dense, consistent responses for Telegram, WhatsApp, Signal, Discord, iMessage, CLI, and dashboard surfaces.
license: Zavorth-Internal
---

# Channel Response Design

Use this native skill when a response must work across channels.

## Operating Rules

- Keep Telegram, WhatsApp, Signal, Discord, iMessage, CLI, and dashboard equivalent.
- Use rich controls only when the channel supports them.
- Provide compact textual fallback.
- Do not privilege one channel as the main runtime.

## Output

Return a channel-neutral response structure and per-channel rendering notes.
