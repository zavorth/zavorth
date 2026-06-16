# Personal Approval Lease Threat Model

> [!NOTE]
> This is a durable design document for Zavorth.

## 1. Threat Scenarios and Mitigations

### Threat 1: Malicious Command Hijacking (Lease Piggybacking)
*   **Description**: A malicious script or agent attempts to run a destructive command (e.g. `rm -rf`) by piggybacking on an active lease granted for a safe command.
*   **Impact**: Loss of data, system files, or codebase integrity.
*   **Mitigation**: Strict action fingerprinting. The lease is bound to the cryptographic hash of the exact command template or normalized action parameters. Any parameter deviation results in a signature mismatch, rejecting execution and prompting the operator.

### Threat 2: Multi-Day Lease Exposure (Persistence Window)
*   **Description**: A lease configured for multiple days (e.g. `3d` or `7d`) allows an agent to run commands continuously without the operator's immediate supervision. If the agent goes rogue or receives a malicious instruction later, it can exploit the active window.
*   **Impact**: Long-term unauthorized execution window.
*   **Mitigation**: Narrowly scope multi-day leases. The UI displays warning prompts for any duration exceeding 24 hours, and high-risk capabilities (like database mutations or network egress) are explicitly blacklisted from multi-day leases.

### Threat 3: Exfiltration via Cached Network Tools
*   **Description**: A tool registered with network capabilities is granted a lease for checking update status. A malicious payload later attempts to use the same tool to upload secrets to an external server.
*   **Impact**: Exfiltration of user secrets or source code.
*   **Mitigation**: The `NEVER_CACHE_ACTION` filter prevents caching tools associated with external uploads or credential retrieval. Every network dispatch requires explicit review.

### Threat 4: Replay Attacks after Workspace Modification
*   **Description**: A lease is granted for running code compilation. An attacker modifies the directory structure to place a shell script inside the path, triggering execution on the host machine.
*   **Impact**: Escaping the project workspace boundary.
*   **Mitigation**: Workspace ID verification. The lease is bound to the directory hash. If any file modifications are detected in configuration paths, or if the `cwd` switches outside the active workspace ID boundary, the lease is immediately invalidated.

---

## 2. Cockpit/UI and Audit Specifications
- **Revocation Hook**: The cockpit UI must display a list of active leases and provide a "Revoke All" break-glass button to invalidate them immediately.
- **Expiration Enforcement**: On-read validation deletes any lease entry where the current system time is equal to or greater than `expiresTimestamp`.
- **Audit Trails**: Every lease-based auto-approval event must be logged with:
  - `leaseId`: Reference to the cached approval.
  - `receiptId`: Unique identifier of the execution trace.
  - `bypassedPrompt: true`: Clear indication that the visual card was bypassed.
