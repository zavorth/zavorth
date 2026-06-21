---
name: IoT Device Controller
description: Send commands to connected smart switches, IoT lights, or speaker bridges.
license: Zavorth-Internal
---

# IoT Device Controller

Use this native skill when:
- The task requires operations in the 'smart-home' domain.
- Performing actions matching: send commands to connected smart switches, iot lights, or speaker bridges.

## Operating Rules

- Send commands to local smart home bridges.
- Fallback gracefully if devices are unreachable.
- Ensure commands do not block execution loops.

## Output

Return updated IoT device state variables and network connectivity health.
