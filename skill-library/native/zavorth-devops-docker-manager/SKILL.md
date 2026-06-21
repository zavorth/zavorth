---
name: Docker Container Monitor
description: Control state, execute commands, and fetch diagnostic logs for local Docker containers.
license: Zavorth-Internal
---

# Docker Container Monitor

Use this native skill when:
- The task requires operations in the 'devops' domain.
- Performing actions matching: control state, execute commands, and fetch diagnostic logs for local docker containers.

## Operating Rules

- Obtain explicit approval leases before executing any state-changing actions (start/stop/restart).
- Sanitize all host commands to prevent shell injection.
- Retrieve container logs and filter out sensitive credentials or API keys.

## Output

Return container execution logs, updated container status, and task reports.
