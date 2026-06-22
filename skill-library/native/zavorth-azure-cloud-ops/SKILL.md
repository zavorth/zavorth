---
name: Azure Cloud Ops
description: Azure services management (VMs, Blob, Functions, SQL)
license: Zavorth-Internal
---

# Azure Cloud Ops

Use this native skill when:
- The task requires operations in the 'cloud' domain.
- Performing actions matching: Azure services management (VMs, Blob, Functions, SQL).

## Operating Rules

- Use managed identities for authentication where possible.
- Apply resource locks on production resources to prevent accidental deletion.
- Use ARM templates or Bicep for infrastructure as code.
- Enable Azure Monitor and diagnostics for all critical resources.
- Validate subscription and resource group before executing commands.

## Output

- ARM templates, resource inventories, cost reports, and deployment logs.
