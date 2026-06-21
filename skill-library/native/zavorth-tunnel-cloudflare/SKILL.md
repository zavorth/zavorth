---
name: Cloudflare Tunnel Agent
description: Expose local preview environments securely using ephemeral Cloudflare tunnels.
license: Zavorth-Internal
---

# Cloudflare Tunnel Agent

Use this native skill when:
- The task requires operations in the 'devops' domain.
- Performing actions matching: expose local preview environments securely using ephemeral cloudflare tunnels.

## Operating Rules

- Spin up short-lived Cloudflare tunnels for secure preview sharing.
- Block access to local subnets outside the shared application port.
- Log connection events and enforce policy timeouts.

## Output

Return tunnel urls, active connection logs, and network status details.
