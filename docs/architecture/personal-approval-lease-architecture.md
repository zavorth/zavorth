# Personal Approval Lease Architecture

> [!NOTE]
> This is a durable design document for Zavorth.

## Core Security Principle

> [!IMPORTANT]
> The personal profile may reduce approval friction through scoped approval leases, but it must not downgrade risk classification or disable auditing.
> In addition, risk classification must not be downgraded and audit must not be disabled.

---

## 1. Safety Invariants: Leases vs. Approvals

An **approval lease** is strictly a design mechanism to optimize operator workflows. It is subject to the following structural limitations:
*   **Approval lease is not final approval.**
*   **Approval lease does not execute a tool.**
*   **Approval lease does not expose a tool.**
*   **Approval lease does not bypass ToolGatekeeper.**
*   **Approval lease does not bypass risk classification.**
*   **Approval lease does not bypass channel/workspace policy.**
*   **Approval lease is only a future input into a governed approval decision.**

Even when a valid approval lease exists, any future execution request must still pass through the complete security stack:
1.  **ToolGatekeeper**: Checks input schema constraints and ensures the tool parameter payload is valid.
2.  **Risk Classification**: Analyzes capabilities to establish if the action remains low/medium risk.
3.  **Channel Policy**: Validates if the request origin is authorized to execute the tool category.
4.  **Workspace Policy**: Restricts directory mutation and operations to the active workspace boundaries.
5.  **Tool Fingerprint/Drift Validation**: Re-verifies signature consistency before execution.
6.  **Audit Logging**: Safe logs are persisted to the audit database via the `SecurityAuditLogger`.
7.  **Revocation/Expiration Checks**: Validates TTL limits and break-glass statuses before dispatch.

---

## 2. Fail-Closed Expiration and Revocation Semantics

To ensure absolute safety, approval lease lookup operates under a strict **fail-closed** policy:
*   **Expired lease always fails closed**: Any lease whose expiration timestamp is reached is treated as invalid and immediately ignored.
*   **Revoked lease always fails closed**: If a lease has been revoked, it must never be matched.
*   **Revocation wins over expiration**: A revocation status flag takes precedence over any expiration time window check.
*   **Fingerprint drift invalidates lease**: If the tool's signature hash changes relative to the signature recorded at grant time, the lease is immediately invalidated.
*   **Risk class change invalidates lease**: If the tool's risk classification changes (e.g., from safe/low to high), the lease is immediately invalidated.
*   **Workspace mismatch invalidates lease**: If the active workspace path does not match the workspace bound to the lease, it is rejected.
*   **Profile/user mismatch invalidates lease**: Leases are isolated per profile and user session; cross-profile matches are rejected.
*   **Channel mismatch invalidates lease**: If the lease is bound to a specific channel (e.g. CLI), execution requests from other channels (e.g. Telegram) are rejected.
*   **Clock skew must never extend a lease**: System clock checks must be compared conservatively. Clock skew cannot be exploited to artificially prolong an expiration window.
*   **Missing audit correlation must fail closed**: A lease record must reference a valid audit correlation ID. If missing, the lease is rejected.

---

## 3. Lease Dimension Constraints

### Permitted Dimensions
A lease definition is restricted to the following metadata fields:
*   `leaseId`: Unique UUID string identifying the lease.
*   `subject/user identity`: The operator or identity that authorized the lease.
*   `workspaceId`: Unique ID/path of the active workspace.
*   `optional channel scope`: The specific input channel allowed to bypass (e.g., CLI).
*   `tool qualifiedName`: The qualified `namespace:name` of the custom tool.
*   `tool fingerprint`: The signature hash computed by the extension facade at grant time.
*   `riskClass at grant time`: The risk level evaluated at lease creation.
*   `allowed operations`: Specific subcommand templates or parameter patterns allowed.
*   `createdAt`: ISO timestamp of creation.
*   `expiresAt`: ISO timestamp of expiration.
*   `revokedAt`: ISO timestamp of revocation, if revoked early.
*   `grant reason`: Operator-supplied reason for the lease.
*   `grant source`: The origin of the grant (e.g., user manual command).
*   `audit correlation id`: ID referencing the original audit receipt that created the lease.

### Forbidden Dimensions
Lease records **must never** contain sensitive credentials, data payloads, or code signatures:
*   `raw API keys`
*   `provider credentials`
*   `Authorization/Bearer`
*   `secretRef`
*   `rawKey`
*   `ciphertext`
*   `authTag`
*   `raw user prompts`
*   `raw provider responses`
*   `handler source code`

---

## 4. Proposed Risk Policy Limits

The following boundaries are designed as proposed limits for future policy rules:

| Risk Class | Eligible for Lease | Suggested Max TTL |
| :--- | :--- | :--- |
| **safe/low** | Yes (scoped only) | 24 hours |
| **medium** | Yes (stricter confirmation required) | 2 hours |
| **high** | Default: NO (unless explicitly allowed by future policy) | 15 minutes |
| **critical** | No (always manual verification required) | No lease |
| **unknown** | No (always manual verification required) | No lease |

---

## 5. Integration Boundaries

### ExtensionFacade & ServiceRegistry
*   Future approval lease logic must interact with the `ZavorthExtensionFacade` to fetch the verified tool fingerprints.
*   The lease registry must be registered within the `ServiceRegistry` container to allow core cognitive firewall components to resolve it during pre-execution checks.

### Task Mandates, Host Power Mode (HPM), and PTY Sessions
*   Leases must not override `Task Mandate` boundaries. A task execution sequence must not reuse leases granted to other concurrent user sessions.
*   Under high-risk terminal/PTY sessions or Host Power Mode (HPM) sessions, leases must be invalidated immediately to prevent untrusted script injection.

### Provider Secrets
*   No approval lease can ever grant access to write or expose provider secrets. Credential mutations must always enforce direct, manual console confirmations.

---

## 6. Future Implementation Checklist

> [!NOTE]
> None of the following runtime behaviors are implemented in this design-only phase.

For future implementation phases, the following checklist must be satisfied:
*   [ ] **ApprovalLease Schema**: Define the strict type and validator for lease records.
*   [ ] **ApprovalLeaseStore Interface**: Implement a service contract to get, set, delete, and list active leases.
*   [ ] **In-Memory Store First**: Create an in-memory store implementation to avoid persistence security hazards during early testing.
*   [ ] **No Persistent Leases**: Persistent storage of leases is blocked until the threat model is fully signed off.
*   [ ] **Lease Grant Flow**: Implement the secure workflow to create a lease from an audit receipt.
*   [ ] **Lease Revoke Flow**: Implement a break-glass "Revoke All" API.
*   [ ] **Lease Lookup Flow**: Implement lookup checks matching subject, workspace, fingerprint, and TTL.
*   [ ] **Drift Invalidation**: Ensure any change to the tool fingerprint immediately invalidates active leases.
*   [ ] **Risk Invalidation**: Ensure any change in the tool's classification invalidates matching leases.
*   [ ] **Policy Validation**: Ensure the core engine executes channel and workspace checks even if a lease matches.
*   [ ] **Audit Event Emission**: Ensure every lease bypass or invalidation writes a secure audit record.
*   [ ] **Negative Tests (Critical/Unknown)**: Write automated tests proving that critical or unknown tools never match leases.
*   [ ] **Negative Tests (Leakage)**: Write automated tests proving that leases never leak across different profiles or workspaces.
