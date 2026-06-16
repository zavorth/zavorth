# Extension Tool Threat Model - Phase 21S-A

> [!IMPORTANT]
> This is a design-only document for Phase 21S-A. No runtime implementation is performed in this phase.

## 1. Threat Scenarios and Mitigations

### Threat 1: Malicious Code Update (Silent Code Drift)
*   **Description**: An attacker modifies the source code of an approved custom tool on the filesystem to execute malicious logic.
*   **Impact**: Compromise of the local machine, data theft, or illegal command execution.
*   **Mitigation**: The runtime calculates a SHA-256 fingerprint of the tool's source files. If the fingerprint does not match the registered signature upon startup, the tool is reset to `quarantined` status, and execution is blocked until the operator manually audits and re-approves the drift.

### Threat 2: Namespace Collision / Hijacking
*   **Description**: A third-party tool attempts to overwrite or masquerade as a core system tool (e.g., registering as `core.shell` or `filesystem.write`).
*   **Impact**: Bypassing the core security policies by running as a trusted system capability.
*   **Mitigation**: Strict namespace registration is enforced. All custom tools must run under their unique namespace prefix, and registration of core system prefixes by third-party extensions is blocked during the boot phase.

### Threat 3: Capability Escalation (Scope Creep)
*   **Description**: A tool declares a set of safe capabilities during audit, but dynamically requests a sensitive capability (e.g., `network.public`) at runtime.
*   **Impact**: Exfiltration of user secrets or unauthorized network connections.
*   **Mitigation**: Tools must statically declare all required capabilities. The `ToolGatekeeper` intercepts all calls and denies any access requests not explicitly listed in the tool's signed descriptor.

### Threat 4: Input Injection (Schema Abuse)
*   **Description**: An attacker feeds malformed or injection payloads into the tool parameters to exploit parser vulnerabilities inside the handler.
*   **Impact**: Remote code execution or logic bypass inside the sandbox.
*   **Mitigation**: Pre-dispatch input schema validation. The runtime automatically rejects the payload before dispatching it to the tool handler if it deviates from the declared JSON Schema.

---

## 2. Strict Security Boundaries
The future extensibility system must strictly prohibit the following behaviors:
- **Automatic Trust**: No tool is trusted by default. All newly added tools start in a quarantined state.
- **Hidden Approval Bypass**: There are no backdoor flags to bypass the `ToolGatekeeper` or the approval gates.
- **Unreviewed Critical Tools**: Any tool requiring system mutations or shell execution requires manual operator audit.
- **Unknown Tool Execution**: Execution is rejected if the tool is not registered in the system index.
- **Schema Drift without Re-approval**: Any change to parameter constraints requires resetting the tool's approval state.
- **Channel Exposure**: Extensions cannot expose endpoints to external message channels (e.g., Telegram) without matching routing policies.
