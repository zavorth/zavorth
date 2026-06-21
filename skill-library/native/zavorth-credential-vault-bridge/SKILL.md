---
name: Password Vault Bridge
description: Retrieve keys and credentials from local 1Password/KeePass under lease policies.
license: Zavorth-Internal
---

# Password Vault Bridge

Use this native skill when:
- The task requires operations in the 'security' domain.
- Performing actions matching: retrieve keys and credentials from local 1password/keepass under lease policies.

## Operating Rules

- Retrieve API keys or tokens under explicit approval leases.
- Ensure retrieved secrets never leak into log files.
- Enforce quick cache expirations for in-memory credentials.

## Output

Return decrypted credential data, lease expiry timings, and permission audits.
