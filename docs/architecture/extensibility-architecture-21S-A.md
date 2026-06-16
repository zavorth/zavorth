# Extensibility Architecture - Phase 21S-A

> [!IMPORTANT]
> This is a design-only document for Phase 21S-A. No runtime implementation is performed in this phase.

## Current Tool/Extension Registration Path
Currently, tools in Zavorth are registered statically or loaded through bundled capabilities and plugins. The gateway or runtime discovers tools during process initialization. Each tool maps directly to specific execution commands or hooks, leading to tight coupling with core validation libraries.

## Current Coupling Pain Points
- **Direct Core Reference**: Adding or modifying a tool requires modifying core gatekeepers and risk classifiers, which increases the likelihood of breaking existing contracts.
- **Bespoke Validation**: Each tool maintains custom validation rules instead of utilizing a unified schema enforcement layer.
- **Lack of Namespace Isolation**: Statically loaded tools share a single namespace, creating risks of name collisions and unexpected overrides.

## Safe Extension Boundary
To safely extend Zavorth, we define a strict logical boundary between the runtime and extensions:
- **Sandbox Isolation**: By default, custom tools run inside isolated execution environments (e.g., Docker sandboxes or MicroVMs) rather than on the host system.
- **Zero Direct Imports**: The core engine must never import extension code directly. All communication occurs via structured API boundaries and IPC/RPC protocols.

## Namespace Requirements
- All custom tools must declare a unique namespace using the format `<namespace>.<tool_name>` (e.g., `workspace_cleaner.delete_temp`).
- Namespaces are audited and registered. Collisions will cause runtime loading failures, preventing silent overrides of core tools.

## Tool Descriptor Requirements
Every extension must declare a static manifest descriptor containing:
1. `namespace`: The namespace prefix.
2. `name`: The tool identifier.
3. `description`: Detailed description explaining the tool's purpose.
4. `inputSchema`: A strict JSON Schema / Zod schema defining all input parameters.
5. `capabilities`: Array of system capabilities required (e.g., `read_file`, `network_access`).
6. `fingerprint`: A cryptographic hash of the tool's execution code.

## Input Schema Validation
- The core runtime enforces input schema validation before the request reaches the tool handler.
- If the incoming parameters do not strictly match the declared `inputSchema`, the request is aborted immediately at the gatekeeper level.

## Capability Declaration
- Custom tools must explicitly declare their required capabilities.
- A tool cannot request capabilities outside its namespace unless explicitly approved by the operator.

## Risk Classification
- Tools are evaluated by the central risk classifier based on their requested capabilities.
- Any tool requesting `shell.exec` or system mutations is classified as `high` or `critical` risk.

## Approval Lifecycle
- Registered tools start in a `quarantined` state.
- Before execution, the operator must review the tool descriptor and explicitly transition it to `approved`.
- Temporary approvals (leases) can be granted, but they follow strict expiration policies.

## ToolGatekeeper Enforcement
- The `ToolGatekeeper` serves as the runtime enforcement point.
- It validates the tool's signature, matches the input parameters, verifies the approval state, and enforces capability constraints before dispatching the request.

## Fingerprint Requirements & Drift Detection
- Zavorth computes a SHA-256 hash of the tool's source code (`fingerprint`).
- During startup, the `ProfileManifestService` verifies the tool's fingerprint against the recorded signature.
- If any file modification is detected, the tool's status is reset to `quarantined`, requiring operator re-approval. This prevents silent code modification attacks.

## Audit and Test Requirements
- Every tool invocation, parameter validation result, and execution receipt must be written to the secure `SecurityAuditLogger`.
- Extensions must include isolation tests to verify they cannot access unauthorized resources or escape the sandbox.

## Failure Modes
- **Schema Drift**: Aborted invocation, transition tool to `quarantined`, prompt operator for re-approval.
- **Signature Mismatch**: Load failure, disabled capability, system log warning.
- **Capability Violations**: Immediate termination of the tool's execution process.
