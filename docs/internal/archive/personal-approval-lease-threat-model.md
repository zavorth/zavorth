# Personal Approval Lease Threat Model

> [!NOTE]
> This is a durable design document for Zavorth.

## Threat Analysis

---

### Threat 1: Stale Approval Reuse
*   **Threat**: Stale Approval Reuse
*   **Risk**: High. An attacker attempts to execute an action using an old approval cache entry that should have expired.
*   **Mitigation**: Absolute TTL enforcement. The evaluation service must check the current timestamp against the lease's `expiresAt` property on every lookup.
*   **Future implementation test requirement**: Write a test verifying that lookup fails immediately if system time is >= `expiresAt`.

---

### Threat 2: Tool Schema Drift
*   **Threat**: Tool Schema Drift
*   **Risk**: Medium. An extension modifies its parameter schema to inject dangerous capabilities under a previously approved low-risk parameter shape.
*   **Mitigation**: Include the normalized input schema representation in the fingerprint calculation. Any schema drift will change the fingerprint and invalidate the lease.
*   **Future implementation test requirement**: Test that changing a parameter schema type (e.g. string to object) triggers a fingerprint mismatch and rejects lease lookup.

---

### Threat 3: Extension Tool Drift
*   **Threat**: Extension Tool Drift
*   **Risk**: High. An extension updates its handler code on disk to perform malicious operations while keeping the same interface schema.
*   **Mitigation**: The extension facade calculates a fingerprint hash of the entire tool metadata and source signature. Any code or declaration drift resets the status to `drift_detected` and invalidates the lease.
*   **Future implementation test requirement**: Write a test verifying that registering a tool with a modified descriptor hash invalidates existing lease matching.

---

### Threat 4: Workspace Boundary Confusion
*   **Threat**: Workspace Boundary Confusion
*   **Risk**: High. An agent executes command patterns approved in a safe, isolated directory inside a sensitive system directory.
*   **Mitigation**: Leases must be strictly bound to a specific `workspaceId` / directory path. Looking up a lease from a different directory root must fail.
*   **Future implementation test requirement**: Assert that a lease granted in `/workspace/project-a` fails if queried from `/workspace/project-b`.

---

### Threat 5: Channel Impersonation
*   **Threat**: Channel Impersonation
*   **Risk**: Medium. An action approved via a safe local CLI session is triggered via an untrusted remote Telegram webhook.
*   **Mitigation**: Channel-scoped binding. Leases can optionally specify a allowed channel. If a lease is CLI-only, requests originating from webhook channels are rejected.
*   **Future implementation test requirement**: Test that a lease scoped to `cli` rejects queries originating from `whatsapp` or `telegram`.

---

### Threat 6: Unauthorized Group Users
*   **Threat**: Unauthorized Group Users
*   **Risk**: High. In shared multi-user configurations, an unprivileged user triggers a tool by reusing a lease created by a privileged administrator.
*   **Mitigation**: Leases must contain user identity bounds (`subject`). A lease matches only if the current session operator matches the lease creator.
*   **Future implementation test requirement**: Assert that a lease created by user `admin` rejects execution when queried by user `guest`.

---

### Threat 7: Provider Secret Exposure
*   **Threat**: Provider Secret Exposure
*   **Risk**: High. An attacker uses a lease to bypass confirmation prompts on tools that read or write configuration files containing raw API keys or tokens.
*   **Mitigation**: Hard deny on secret access. Leases must never be matched for any tool requiring `credential` or `configuration` mutation capabilities.
*   **Future implementation test requirement**: Write a test proving that registry lookups for credentials or tokens reject lease cache lookups.

---

### Threat 8: Lease Replay
*   **Threat**: Lease Replay
*   **Risk**: Medium. An attacker captures a lease metadata structure and replays it in a different context or server to bypass confirmation gates.
*   **Mitigation**: UUID lease validation and cryptographically signed audit references. The lease lookup must require validation against the active in-memory lease map.
*   **Future implementation test requirement**: Test that a manually injected lease object without a valid registration record is rejected by the store.

---

### Threat 9: Clock Skew
*   **Threat**: Clock Skew
*   **Risk**: Medium. System clock adjustments or NTP sync skew artificially extends a lease's duration window.
*   **Mitigation**: Monotonic time checking or conservative delta comparisons. Leases should not rely solely on wall-clock time if a reliable monotonic tick counter is available.
*   **Future implementation test requirement**: Verify that artificially setting the system clock backward does not cause an expired lease to become valid again.

---

### Threat 10: Revocation Race
*   **Threat**: Revocation Race
*   **Risk**: High. A user presses the break-glass "Revoke All" button, but concurrent executions already spawned continue to run.
*   **Mitigation**: The `revokedAt` check must occur at the immediate pre-dispatch step in the gatekeeper, minimizing the time window between validation and execution.
*   **Future implementation test requirement**: Test that triggering a revocation flag blocks pending tool invocations in the execution queue.

---

### Threat 11: Audit Tampering
*   **Threat**: Audit Tampering
*   **Risk**: High. An attacker deletes lease creation audit records to cover their tracks.
*   **Mitigation**: Immutable audit correlation IDs. Each lease must reference an unchangeable `auditCorrelationId` that is persisted to the database prior to lease activation.
*   **Future implementation test requirement**: Verify that creating a lease without a corresponding valid audit correlation ID throws an error.

---

### Threat 12: Lease Escalation from Safe to Critical
*   **Threat**: Lease Escalation from Safe to Critical
*   **Risk**: High. A lease granted for a low-risk tool is mapped to trigger a critical command.
*   **Mitigation**: Capability matching and strict risk policy ceilings. Any tool requesting critical capabilities (e.g. unstructured shell executions) is explicitly blocked from lease matching regardless of parameter inputs.
*   **Future implementation test requirement**: Test that a tool requesting the `shell` capability fails to matching a lease even if the lease is marked as `safe`.

---

### Threat 13: Lease Leakage Across Profiles
*   **Threat**: Lease Leakage Across Profiles
*   **Risk**: Medium. A lease created under the `personal` profile is reused when the engine switches to the `business` or `developer` profile.
*   **Mitigation**: Profile scoping. The lease store must isolate lists by profile ID.
*   **Future implementation test requirement**: Assert that a lease created under profile `personal` is completely invisible to profile `business`.

---

### Threat 14: Lease Leakage Across Workspaces
*   **Threat**: Lease Leakage Across Workspaces
*   **Risk**: High. A lease created for editing files inside project A is used to modify files inside project B.
*   **Mitigation**: Enforce exact `workspaceId` matching during lookup.
*   **Future implementation test requirement**: Verify that a lease for workspace `/home/user/a` is rejected when queried for path `/home/user/b`.

---

### Threat 15: HPM/PTY Misuse
*   **Threat**: HPM/PTY Misuse
*   **Risk**: High. An active lease is hijacked by a rogue script running inside a persistent interactive PTY/Host Power Mode session.
*   **Mitigation**: Immediate lease invalidation upon entering PTY or Host Power Mode. Leases must be deactivated or blocked during interactive unstructured terminal shell sessions.
*   **Future implementation test requirement**: Assert that entering HPM automatically suspends lease validation.

---

### Threat 16: Task Mandate Overlap
*   **Threat**: Task Mandate Overlap
*   **Risk**: Medium. A lease granted for a specific background task execution is hijacked by a separate, concurrent Task Mandate context.
*   **Mitigation**: Bound leases to the specific task token or execution mandate ID.
*   **Future implementation test requirement**: Test that a lease created under task mandate `task-100` is rejected when evaluated under task mandate `task-200`.
