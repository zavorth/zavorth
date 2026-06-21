---
name: Netlify Deployer
description: Configure netlify.toml files, manage edge functions, and execute site deployments.
license: Zavorth-Internal
---

# Netlify Deployer

Use this native skill when:
- The task requires operations in the 'devops' domain.
- Performing actions matching: configure netlify.toml files, manage edge functions, and execute site deployments.

## Operating Rules

- Acquire deployment authorization lease before publishing preview builds.
- Validate edge functions routing scopes and compile boundaries.
- Filter local credentials from netlify CLI command variables.

## Output

Return Netlify build output logs, deployment hashes, and hosting URLs.
