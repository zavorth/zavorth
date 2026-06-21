---
name: Webhook Router Listener
description: Listen, verify, and route external webhooks to target automation queues.
license: Zavorth-Internal
---

# Webhook Router Listener

Use this native skill when:
- The task requires operations in the 'devops' domain.
- Performing actions matching: listen, verify, and route external webhooks to target automation queues.

## Operating Rules

- Handle incoming HTTP webhooks and route them to target queues.
- Verify payload signatures to prevent unauthenticated injection.
- Log request history for debugging purposes.

## Output

Return routing confirmation logs, action dispatch triggers, and delivery status codes.
