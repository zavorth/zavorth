# Personal Approval Lease Architecture

> [!NOTE]
> This is a durable design document for Zavorth.

## Core Security Principle
> [!IMPORTANT]
> The personal profile may reduce approval friction through scoped approval leases, but it must not downgrade risk classification or disable auditing.
> In addition, risk classification must not be downgraded and audit must not be disabled.

---

## Profile Manifest Reading
- The active profile is determined during runtime initialization by reading `config/profile-manifests/personal.json`.
- The manifest configures `runtime.approvalMode: "minimal"` and `runtime.trustMode: "trusted-local"`.

## Policy Decisions under "Minimal" Approval Mode
- Under `approvalMode: "minimal"`, the system defaults to skipping prompt gates for commands classified as `low` or `medium` risk, provided they match active approval leases.
- Under `trustMode: "trusted-local"`, all automatic actions are strictly constrained to the registered workspace directories. No files can be mutated or read outside the resolved workspace root without manual prompts.

## Safety Boundaries: Leases vs. Bypass
An **approval lease** is NOT a security bypass:
- A bypass completely skips checking permissions.
- A lease is a temporary, cryptographically traceable grant that is automatically validated against explicit scope constraints (workspace, code fingerprint, command template).
- **Risk Classification**: As noted above, risk classification must not be downgraded; the cache simply allows executing approved patterns within the TTL window.
- **Audit Logging**: We must never disable auditing or otherwise bypass the secure `SecurityAuditLogger`.

---

## Lease Duration and Constraints
The system supports customizable lease durations, such as `10m`, `30m`, `2h`, or `3d`. However, strict safety constraints apply:

1.  **Max TTL**: The maximum lease duration must be explicitly defined (e.g., maximum 7 days).
2.  **Safety Warnings**: Setting a lease longer than 24 hours must trigger a prominent warning card in the terminal or cockpit UI: `caching approval for more than 24 hours reduces security`.
3.  **Strict Blocking Invariants**: The following actions **must never** be lease-approved (they will always block for manual operator confirmation):
    - high/critical/destructive/shell:true/unknown tools must not be lease-approved
    - High or critical risk actions.
    - Destructive actions (e.g., file deletion, database resets, git branch deletion).
    - Shell executions with `shell:true` (unstructured execution).
    - Unknown or quarantined tools.
    - Operations outside the active workspace directory.
    - Network upload/data exfiltration requests.
    - multi-day leases must be narrowly scoped and warned.
    - Note that multi-day leases must be narrowly scoped.

---

## Required Lease Scope Fields
An approval lease record must contain the following fields:
1.  `profile`: The active profile identifier (`personal`).
2.  `workspaceId`: Unique ID/path of the active workspace.
3.  `toolFingerprint`: Cryptographic hash of the executing tool.
4.  `actionFingerprint`: Cryptographic hash of the command payload or template.
5.  `riskClass`: The calculated risk class (`low` or `medium`).
6.  `commandTemplate`: The normalized action template.
7.  `cwd`: The directory where execution occurs.
8.  `createdTimestamp`: ISO timestamp of creation.
9.  `expiresTimestamp`: ISO timestamp of expiration.
10. `revocationStatus`: Boolean flag indicating whether the lease was revoked early.
11. `auditReceiptId`: Reference to the audit entry that established the lease.

---

## Never-Cache Actions & Advanced Fingerprinting
Zavorth uses an inline regex guard `NEVER_CACHE_ACTION` as a safety net:
```typescript
const NEVER_CACHE_ACTION = /\b(delete|remove|rm|drop|reset|push|publish|deploy|secret|credential|token|payment|trade|shell|bash|powershell)\b/i;
```
However, keyword matching alone is insufficient. The final lease verification must combine keyword checks with structural risk classification, command template fingerprinting, and strict directory checks.

### Examples of Allowed Candidates
- Running `npm test` inside the trusted project root for a duration of `2h`.
- Modifying a specific `.ts` file inside `src/` matching the code structure fingerprint for a duration of `30m`.

### Examples of Prohibited Candidates
- Running arbitrary bash/powershell scripts for `7d`.
- Running `rm -rf` or file delete commands.
- Reading system environment variables or SSH credentials.
- Uploading code repositories to external URLs.
