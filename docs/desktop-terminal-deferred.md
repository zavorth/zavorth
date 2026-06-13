# Deferral of Interactive Terminal and Native Shell Integration

This document formally records the deferral of the interactive terminal and native shell integration within the Zavorth Desktop application, outlining the associated security risks and defining strict guardrails required for any future phase.

## Rationale for Deferral

Integrating a live terminal emulator (such as `InteractiveTerminal.tsx` or a raw shell interface via `HubNativeShell.tsx`) poses critical security challenges that require deep sandboxing, runtime isolation, and user-consent gateways. To ensure the current release of Zavorth maintains a robust security posture, all direct shell execution features are deferred, and terminal hooks have been completely disabled.

---

## Security Risks

Operating a terminal shell within a desktop application introduces severe threat surfaces:

1. **PTY Command Injection**: If the agent is allowed to write directly to a PTY process, malicious inputs or prompt injections can force the agent to run arbitrary system commands under the user's privilege level.
2. **Workspace Escape**: Operating system shells have access to the entire host file system. An unconstrained shell bypasses all path restrictions set by the `WorkspacePathGuard`.
3. **IPC Access and Privilege Escalation**: A shell process spawned inside the electron app might hijack local IPC channels or access Electron internals, allowing complete take-over of the host process.
4. **Credential and Secret Leakage**: Interactive shells inherit environment variables and config files (like SSH keys, git credentials, `.env` files, AWS profiles), which could be read and exfiltrated by a compromised agent.
5. **Background / Persistent Exploitation**: Spawning long-running background tasks (e.g., reverse shells, daemon processes) can compromise the host machine permanently.

---

## Minimum Requirements for Future Integration

Any future phase attempting to integrate terminal or shell capabilities must adhere to the following mandatory guidelines:

### 1. Default-Disabled with Explicit User Opt-In
Terminal capabilities must be off by default. The user must manually and explicitly enable terminal features via a dedicated, secure settings toggle with a clear warning explaining the risks.

### 2. Strict Per-Workspace Sandboxing
The terminal process must be strictly sandboxed. In Unix systems, it should run inside a restricted container, chroot, or jail. In Windows, it should run under a low-privilege AppContainer or inside WSL with restricted network access.

### 3. No Automatic Shell Execution
The system must never launch commands automatically or silently. Every single terminal input line must be clearly displayed to the user first.

### 4. Interactive Command Approval Policy
Every command proposed by the agent or UI must be individually approved by the user before execution. The approval dialog must clearly display the exact command string and all parameters.

### 5. Audit Logging
Every spawned process, command executed, and execution result must be recorded in the security audit logs (`SecurityAuditLogger`) with cryptographic verification to prevent log injection or tampering.

### 6. No Agent-Initiated Background Spawning
The agent is strictly forbidden from spawning detached or background shell execution processes. All terminal commands must run synchronously with a visible indicator in the UI.

### 7. Clear User Interface Boundary
The terminal UI panel must clearly distinguish itself from standard chat views. The UI must render a prominent warning banner when active.

### 8. Strict Import Barriers
Production builds must implement static analysis tests to verify that no production file accidentally imports `InteractiveTerminal`, `node-pty`, or other shell spawning libraries.
