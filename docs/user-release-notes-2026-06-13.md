# Zavorth User Release Notes (RC 2026-06-13)

Welcome to the **Zavorth Release Candidate (zavorth-rc-2026-06-13)**. This release is a private technical beta candidate focused on establishing a hardened, secure, and transparent local operating system for AI agents.

> [!IMPORTANT]
> **Technical Beta Notice**  
> This build is intended solely for internal verification and technical beta testing. It is not signed for public distribution and has deferred capabilities to ensure containment.

---

## What is Zavorth?
Zavorth is a local runtime and dashboard designed to run AI agents safely on your machine. Instead of granting agents unrestricted access to your files and shell, Zavorth acts as a gatekeeper—providing transparent previews of all actions, filtering sensitive outputs, and requesting explicit permission before executing risky operations.

---

## What's New in this Release

### 1. Workspace Write Approvals
When an agent attempts to create a directory or write to a file in your workspace, Zavorth intercepts the request and displays a top-level overlay modal.
* **Side-by-Side Diff View**: Inspect exactly what code or content the agent is proposing to add or modify.
* **Transient Memory Validation**: Proposed content is kept securely in transient memory and is cleared immediately upon approval, rejection, or token expiration. It is never stored in SQLite databases or plaintext logs.

### 2. Hardened Read-Only Dashboard Panels
To prevent unauthorized setting changes or credential leaks, key dashboard interfaces have been converted to a visual-only, read-only layout:
* **Settings & Memory Panels**: All mutation triggers, credential modifications, and encryption adjustments are scrubbed.
* **Skills, Channels, and Automations**: Read-only directory maps of active connectors and capabilities.

### 3. Read-Only Workspace File Explorer
Inspect your active workspace directory structure safely.
* Localized path translation ensures only files relative to the workspace root are displayed.
* Mutation callbacks and file execution actions are disabled.

### 4. Advanced MCP Exposure Policy
Model Context Protocol (MCP) tool bindings are strictly governed by a local gatekeeper:
* **Drift Protection**: If a tool schema or description shifts, the tool is automatically deactivated and queued as `pending_approval`.
* **Narrowing**: Untrusted users or group environments receive restricted access to safe tool sub-selections.

---

## Explicitly Excluded Features in this Build
* **Interactive Terminal (PTY)**: Direct terminal shell spawning and command-line execution are deactivated in this release candidate to prevent sandbox escapes.
* **HubNativeShell**: Spawning interactive client shells is not supported.
* **Active Provider Setup**: Mutation of active credentials or models must be handled via secure local configuration files rather than the web-facing dashboard.

---

## Known Limitations
* **Visual steering handlers**: Some buttons or inputs may still display UI skeletons but will not perform mutations since their backing controller handlers are disabled.
* **SQLite Database Initialization**: SQLite initializes local schemas in WAL mode but doesn't persist raw files or proposed code payloads during execution logs.

---

## How to Report Issues
If you encounter bugs, security anomalies, or unexpected agent behaviors:
1. Open a ticket in the internal tracker.
2. Provide sanitized logs from `data/logs/` (ensure no private credentials or paths are included).
