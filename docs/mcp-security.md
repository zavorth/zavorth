# MCP Security, Drift Protection & Channel Policy

This document explains the security architecture of Zavorth's Model Context Protocol (MCP) tool integration, the drift protection mechanism, and how it connects to channel-level policies (specifically WhatsApp groups).

---

## 1. MCP Tool Security & Drift Protection

Zavorth implements a strict **two-phase drift protection** mechanism to ensure that the AI model only executes verified and expected tools.

### Key Concepts

*   **Namespaced Identifiers**: All discovered MCP tools are registered as `serverId:toolName` (e.g., `serverA:read_file`). This prevents conflicts when multiple servers expose tools with the same name.
*   **The `pending_approval` State**: When a new tool is discovered, or if a tool's input schema changes, it is marked as `pending_approval` in `config/mcp-tool-policy.json` and blocked from execution.
*   **Schema Drift**: Zavorth computes a SHA-256 fingerprint of `serverId`, `toolName`, and `inputSchema` using a deterministically sorted (canonical) JSON stringify. If the fingerprint of an already approved tool changes:
    *   The tool is demoted back to `pending_approval` status.
    *   The tool is immediately blocked from the runtime.
    *   A critical warning is logged.
*   **Description Drift**: If only the description changes, but the input schema remains identical:
    *   A warning is logged.
    *   The tool remains `approved` (and registered).
    *   The policy file updates `lastSeenDescription` and `lastSeenAt` without losing the approved description.

### `tools[id].status` vs `allowlist`

For a tool to be exposed to the model, it must satisfy **both** conditions:
1.  **Approved status**: The tool must be registered in the `tools` map of `config/mcp-tool-policy.json` with `"status": "approved"`.
2.  **Allowed by global policy**: The tool must be allowed by the global profile (e.g., `dangerous`, `trusted`) or explicitly listed in the global `allowlist`.

> [!NOTE]
> Even if a tool is in the `allowlist`, it will be blocked if its status is `pending_approval` or `blocked` in the `tools` map.

---

## 2. CLI Operations (`zavorth-mcp-install`)

The CLI tool allows operators to manage MCP servers and policy entries.

### Examples of Usage

*   **List all servers and tools status**:
    ```bash
    npm run zavorth:mcp-install list
    ```
    To get a JSON-formatted output containing `effectiveAllowed` (which calculates the final allowance based on status and global policy):
    ```bash
    npm run zavorth:mcp-install list --json
    ```

*   **Add a new MCP server to the manifest**:
    ```bash
    npm run zavorth:mcp-install add my-server --command node --args index.js --allowed-env PATH,GEMINI_API_KEY
    ```
    *Note: Environment variables passed via `--env` will reject direct writing of secrets unless the `--persist-env-values` flag is explicitly supplied. Using `--allowed-env` is recommended to inherit host values.*

*   **Remove an MCP server**:
    ```bash
    npm run zavorth:mcp-install remove my-server
    ```

*   **Enable/Disable an MCP server**:
    ```bash
    npm run zavorth:mcp-install disable my-server
    ```

*   **Approve a pending tool**:
    ```bash
    npm run zavorth:mcp-install approve my-server:my_tool
    ```
    *If the tool has never been seen by the runtime, you must provide its fingerprint:*
    ```bash
    npm run zavorth:mcp-install approve my-server:my_tool --fingerprint <sha256-hash> --description "A description"
    ```
    *If you wish to force-override a fingerprint mismatch:*
    ```bash
    npm run zavorth:mcp-install approve my-server:my_tool --fingerprint <new-sha256> --force-fingerprint
    ```

*   **Block a tool**:
    ```bash
    npm run zavorth:mcp-install block my-server:my_tool
    ```

*   **Forget a tool** (removes from both `tools` map and `allowlist` to avoid orphans):
    ```bash
    npm run zavorth:mcp-install forget my-server:my_tool
    ```

---

## 3. WhatsApp Group & Channel Security

Zavorth protects interactions in group channels (like WhatsApp) through structured policy checks.

### `allowedUsers` vs `allowedGroups`

*   **`allowedUsers`**: List of phone numbers (or platform user IDs) authorized to interact with the agent.
*   **`allowedGroups`**: List of Group JIDs (WhatsApp groups) allowed to host the agent.

### `channelUserIdAllowed`

When a message is received in an authorized group, the channel adapter verifies if the sender's phone number is in `allowedUsers`.
*   If the sender is authorized, the metadata is flagged with `channelUserIdAllowed: true` (or omitted, preserving current behavior).
*   If the sender is **untrusted** (i.e. not in `allowedUsers` but present in an authorized group), the request runs under **`channelUserIdAllowed: false`**.

### Group Interaction Filters

To prevent spam and accidental triggers, the agent only responds in group chats when:
1.  **Wake Word**: The message contains the wake word (e.g. `zavorth`).
2.  **Direct Mention**: The agent is explicitly mentioned (`@agent`).
3.  **Reply**: The user replies to a message previously sent by the agent.

### Effect on `ToolExposurePolicy`

If `channelUserIdAllowed === false`, the runtime applies a **narrowing-only restrictive layer** in `ToolExposurePolicy`.
*   This layer **never** adds new tools.
*   It filters out dangerous, attention-level, or unknown tools unless the active group policy explicitly whitelists them in `safe-only` or `allowlist` mode.
*   Tools with `unknown` risk are blocked by default.
*   Blocked tools output a clear reason such as `unauthorized-user-in-group`.

---

## 4. Documented Smoke E2E Walkthrough

Below is the verification flow for confirming the security policies end-to-end.

### Scenario A: Untrusted User in Authorized Group (Narrowing)

1.  **Trigger**: An untrusted user (not in `allowedUsers`) sends a wake word message in an authorized group.
2.  **Metadata Injection**: The channel adapter injects `channelUserIdAllowed: false` into `UniversalAgentRequest.metadata`.
3.  **Narrowing Check**: The `ToolExposurePolicy` inspects the tools list:
    *   `read_file` (attention risk) is filtered out and blocked with reason `unauthorized-user-in-group`.
    *   `zavorth_action` (safe risk) is allowed.
4.  **LlmRequestBuilder**: The final prompt visible tools list contains only the narrowed set.

### Scenario B: MCP Tool Approval Lifecycle

1.  **New Tool Discovery**: A new MCP tool `serverA:new_tool` is registered in `config/mcp-servers.json`. On boot, the runtime discovers it, computes its fingerprint, and inserts:
    ```json
    "serverA:new_tool": {
      "status": "pending_approval",
      "fingerprint": "a1b2c3d4...",
      "pendingReason": "new_tool"
    }
    ```
2.  **Runtime Check**: The runtime starts, reads the pending state, and **does not** register `serverA:new_tool` in the global `ToolRegistry`.
3.  **CLI Approval**: The operator approves the tool:
    ```bash
    npm run zavorth:mcp-install approve serverA:new_tool
    ```
    This sets `status` to `"approved"` and adds `"serverA:new_tool"` to the `allowlist`.
4.  **Runtime Reload**: On reload/restart, the runtime sees the approved status and registers the namespaced tool in the `ToolRegistry`, making it available to the model.
5.  **CLI Blocking**: The operator blocks the tool:
    ```bash
    npm run zavorth:mcp-install block serverA:new_tool
    ```
    This sets status to `"blocked"` and removes it from `allowlist`. On next reload, the tool is immediately removed from the active registry.
