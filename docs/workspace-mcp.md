# Workspace MCP Pack — Architecture, Sandbox & Permissions

The **Workspace MCP Pack** is a specialized, local-only Model Context Protocol (MCP) server designed to run within the Zavorth Desktop application. When a user selects a local folder on their computer, Zavorth initializes a Workspace Session and starts this server, strictly containment-sandboxing the agent's operations within that root directory.

---

## 1. Exposed Tools

All tools are prefixed with `workspace.` and namespaced by the runtime to ensure they are isolated from standard global plugins.

### A. Git Read-Only Tools (`workspace.git.*`)
*   **`workspace.git.status`**: Runs `git status --porcelain` in the workspace root.
*   **`workspace.git.diff`**: Shows differences in the working tree for a specific file. The target path is verified by the `WorkspacePathGuard` and git arguments are injected using `--` to prevent parameter injection.
*   **`workspace.git.log`**: Shows git commit history (`git log --oneline`). Accepts a `limit` parameter (min 1, default 10, max 50) and an optional `file` parameter.
*   **`workspace.git.branch`**: Lists all repository branches (`git branch -a`).

### B. Filesystem Read-Only Tools (`workspace.filesystem.*`)
*   **`workspace.filesystem.read`**: Reads the contents of an existing file.
    *   **Limits**: Restricted to text files under **1MB** in size.
    *   **Binary Safeguard**: Reads the file as a buffer first; if it contains a null byte (`\x00`), the read is aborted and rejected.
*   **`workspace.filesystem.list`**: Lists the contents of a directory.
    *   **Limits**: Returns a maximum of **500 entries** to prevent excessive outputs.
    *   **Pruning**: Automatically filters out heavy development directories (e.g. `node_modules`, `.git`, `dist`, `build`, `.next`, `.cache`, `coverage`).
    *   **Path Sanitization**: Returns workspace-relative paths only, hiding the absolute path of the host machine.
*   **`workspace.filesystem.search`**: Performs recursive file searches.
    *   **No Regex**: Uses case-insensitive substring comparison on filenames and relative paths.
    *   **Limits**: Caps search results at **100 matches**, traversal depth at **20 subdirectories**, and visited entries at **5,000** to safeguard against performance degradation.
    *   **Pruning**: Respects the same directory exclusion list as the list operation.

---

## 2. Security Limits & Sandbox Hardening

### Path Containment (`WorkspacePathGuard`)
Every filesystem read, search, or list operation must resolve through the `WorkspacePathGuard`. The guard uses physical system resolution (`fs.realpathSync`) to perform path containment validation:
1.  **Traversal Protection**: Any path attempting to escape the root directory using absolute paths or parent references (e.g., `../`) is blocked.
2.  **Symlink Hardening**: The guard resolves symlinks to their physical location on the disk (`realpath`) and checks both the apparent path and the resolved realpath. If a symlink points to a file outside the workspace root (e.g., `link.txt` -> `../../etc/passwd`), access is blocked.

### Blocklist
The following sensitive configuration files, keys, and metadata directories are blocked under all circumstances:
*   `.env` and `.env.*` (environment/secret files)
*   `.pem` and `.key` files (cryptographic keys)
*   `id_rsa` and `id_dsa` (SSH private keys)
*   `credentials.json` (API credentials)
*   `.git` contents (Git metadata directory)

### Stdio Isolation & Process Spawning
The workspace server spawns commands (like `git`) using `execFile` with `{ shell: false }`. This disables shell interpreters, removing the risk of shell injection attacks. The output buffer of spawned processes is capped at **50KB** to avoid heap exhaustion, and stdout is strictly reserved for JSON-RPC messages (system logs and audit alerts are written to `stderr` or db storage).

---

## 3. Real-Time Permissions & Policy Gating

The Workspace MCP Pack requires explicit runtime permissions injected in the agent request metadata under `metadata.workspace`. These are evaluated in real-time by the `ToolExposurePolicy`:

| Tool Category | Required Permission | Allowed Tools |
| :--- | :--- | :--- |
| **Git Read-only** | `gitReadOnly: true` | `workspace.git.status`, `workspace.git.diff`, `workspace.git.log`, `workspace.git.branch` |
| **Filesystem Read** | `filesystemRead: true` | `workspace.filesystem.read`, `workspace.filesystem.list`, `workspace.filesystem.search` |
| **Filesystem Write** | `filesystemWrite: true` | None (reserved for future phases) |

If the metadata is missing, or if a permission is set to `false`, the matching tools are blocked and the agent is unable to see or execute them.

### Why Write/Delete do not exist yet
In this phase (Phase 9C), write, edit, delete, and directory creation tools are explicitly **not implemented** nor registered. This ensures the sandbox containment, symlink validations, and audit mechanisms are proven robust in read-only mode before introducing state-mutating actions in subsequent phases.

---

## 4. Desktop Integration Guide

To integrate the Workspace MCP Pack, the Desktop application must follow these steps:

### 1. Spawning the Workspace MCP Server
Start the server process via stdio, providing the workspace root and session ID:
```bash
ZAVORTH_WORKSPACE_ROOT="C:/user/projects/my-workspace" \
ZAVORTH_WORKSPACE_SESSION_ID="session-uuid-1234" \
npx tsx src/mcp/workspace/WorkspaceMcpServer.ts
```

### 2. Injecting Session Metadata in Runtime Requests
When sending a request to the agent runtime, inject the workspace session details in the metadata object:
```json
{
  "requestedTools": [
    "workspace:workspace.filesystem.read",
    "workspace:workspace.filesystem.list",
    "workspace:workspace.git.status"
  ],
  "metadata": {
    "workspace": {
      "workspaceId": "session-uuid-1234",
      "workspacePermissions": {
        "gitReadOnly": true,
        "filesystemRead": true,
        "filesystemWrite": false,
        "notes": false
      }
    }
  }
}
```

This request structure causes `ToolExposurePolicy` to automatically allow read operations and block any unapproved or write operations with structured audit logs.

### 3. Production Audit Logging Requirement (`ZAVORTH_AUDIT_HASH_KEY`)
To ensure privacy and avoid leak of file paths and user identifiers in production system logs, the audit trail performs secure HMAC-SHA256 hashing.
In production environments, the **`ZAVORTH_AUDIT_HASH_KEY`** environment variable must be explicitly defined. If it is missing when running in production (`NODE_ENV=production`), the audit logger will reject the execution and throw an error to prevent unhashed/insecure operations from starting.
