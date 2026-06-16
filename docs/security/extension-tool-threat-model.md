# Extension Tool Threat Model

> [!NOTE]
> This is a durable design document for Zavorth.

## 1. Threat Scenarios and Mitigations

### Threat 1: Malicious Code Update (Silent Code Drift)
*   **Description**: An attacker modifies the parameter schema, capabilities, or metadata of an approved custom tool to bypass previous approval restrictions.
*   **Impact**: Data theft, capability escalation, or illegal command execution.
*   **Mitigation**: The runtime calculates a stable SHA-256 fingerprint based on the tool's descriptor properties (name, namespace, input schema, capabilities, risk class). If the fingerprint changes compared to the registered signature, the tool's status transitions to `drift_detected` or `pending_approval`, blocking execution until the operator manually re-audits the tool.

### Threat 2: Namespace Collision / Hijacking
*   **Description**: A third-party tool attempts to overwrite or masquerade as a core system tool (e.g., registering as `core:shell` or `admin:cleanup`).
*   **Impact**: Bypassing the core security policies by running under a trusted system namespace.
*   **Mitigation**: Strict namespace verification. All custom tools must run under their unique namespace prefix, and registration under reserved prefixes (`core`, `system`, `zavorth`, `admin`) is blocked at registration time.

### Threat 3: Secret Leakage in Metadata
*   **Description**: A third-party extension contains raw API keys, bearer tokens, or database secrets hardcoded in its descriptor metadata.
*   **Impact**: Leakage of credentials via system logs, telemetry, or security audit logs.
*   **Mitigation**: Pre-registration recursive secret scanning. The validation service recursively scans all keys and values in the descriptor metadata for secret-bearing patterns and rejects registration immediately if any obvious keys or tokens are detected.

### Threat 4: Capability Escalation (Scope Creep)
*   **Description**: A tool declares a set of safe capabilities during audit, but dynamically requests a sensitive capability (e.g., `network`) at runtime.
*   **Impact**: Exfiltration of user secrets or unauthorized network connections.
*   **Mitigation**: Statically declared capabilities are validated. The runtime intercepts all calls and denies any access requests not explicitly listed in the tool's validated descriptor.

### Threat 5: Input Injection (Schema Abuse)
*   **Description**: An attacker feeds malformed or injection payloads into the tool parameters to exploit parser vulnerabilities inside the handler.
*   **Impact**: Remote code execution or logic bypass inside the sandbox.
*   **Mitigation**: Pre-dispatch input schema validation. The runtime automatically rejects the payload before dispatching it to the tool handler if it deviates from the validated JSON Schema.

---

## 2. Strict Security Boundaries
The extensibility system enforces the following boundaries:
*   **Automatic Trust**: No tool is trusted by default. All newly added tools start in a quarantined/pending state.
*   **Hidden Approval Bypass**: There are no backdoor flags to bypass the validation or the approval gates.
*   **Unreviewed Critical Tools**: Any tool requiring system mutations or shell execution requires manual operator audit and risk classification.
*   **Unknown Tool Execution**: Execution is rejected if the tool is not registered in the system index.
*   **Schema Drift without Re-approval**: Any change to parameter constraints requires resetting the tool's approval state.
*   **Channel Exposure**: Extensions cannot expose endpoints to external message channels (e.g., Telegram) without matching routing policies.
