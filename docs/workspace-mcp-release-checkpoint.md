# Release Checkpoint — Workspace MCP Package (Phases 9B–9F)

This document establishes the release status, configuration state, and security boundaries of the Workspace MCP capabilities implemented across Phases 9B through 9F.

---

## 1. Commits Involved

The complete history of the governance and UI lifecycle for the workspace package consists of the following commits:
*   `816892e` — `test(smoke): add E2E write approvals integration smoke test` (Phase 9F)
*   `2527c6b` — `fix(runtime): fix NamespacedMcpTool metadata declaration` (TS Compatibility Fix)
*   `8f42f4d` — `feat(desktop): add workspace filesystem write approval UI` (Phase 9E)
*   `1168310` — `feat(mcp): add workspace filesystem write approvals` (Phase 9D)
*   `58bba23` — `docs(mcp): document workspace MCP sandbox and permissions` (Documentation)
*   `2f4e3be` — `feat(mcp): add workspace filesystem read sandbox` (Phase 9C)
*   `6015437` — `feat(mcp): add workspace git read-only MCP` (Phase 9B)

---

## 2. Available Tools

The following namespaced tools are now available to the Agent and governed by the `ToolExposurePolicy` (requiring `metadata.workspace.workspacePermissions` activation):

The Agent sees the namespaced MCP tool IDs (`workspace:workspace.git.*` and `workspace:workspace.filesystem.*`), while the underlying remote tool names remain `workspace.git.*` and `workspace.filesystem.*`.

### Git Read-Only (`workspace:workspace.git.*`)
1.  `workspace.git.status` — Returns porcelain status of the repository.
2.  `workspace.git.diff` — Generates file diffs (validated by path guard).
3.  `workspace.git.log` — Returns commit histories (limited to 50 commits).
4.  `workspace.git.branch` — Lists all local and remote branches.

### Filesystem Sandbox (`workspace:workspace.filesystem.*`)
1.  `workspace.filesystem.read` — Reads text files (max 1MB, text-only, no binary).
2.  `workspace.filesystem.list` — Lists directory structures (maximum 500 entries, node_modules/.git prunings).
3.  `workspace.filesystem.search` — Searches filenames and relative paths only; it does not search file contents (max 100 results, visits max 5000 files/20 levels).
4.  `workspace.filesystem.write` — Writes/overwrites files (requires **visual UI approval**).
5.  `workspace.filesystem.mkdir` — Creates directories (requires **visual UI approval**).

---

## 3. Core Security Safeguards

*   **Rigorous Path Guarding (`WorkspacePathGuard`)**: Resolves symlinks and forces all targets to remain within the authorized workspace root. Rejects sensitive folders/files (`.git/`, `.env`, `.pem`, `.key`, `id_rsa`, `credentials.json`).
*   **Visual UI Confirmation (Double-Gated)**: Write/mkdir operations trigger a handshake `WRITE_APPROVAL_REQUIRED` returning an `operationId`. The user must manually inspect the diff and click **Allow** on the React modal overlay before execution.
*   **Transient Parent-Process Cache**: Proposed raw file contents are stored strictly in-memory in the parent process. Content is **never** written to SQLite DB, logs, localStorage, sessionStorage, or temporary files.
*   **Atomicity & Replay Protection**: SQLite entries track only HMAC-SHA256 hashes of paths and request parameters. Approval consumption uses an atomic SQLite transaction (`changes === 1`), preventing replay or execution hijacking.
*   **Secure API Core**: Endpoints `/pending`, `/payload`, and `/resolve` reject unauthenticated requests with `401 Unauthorized`. Diffs/previews are truncated at the backend to a maximum of **100KB** and **1000 lines**.

---

## 4. Verification Commands

To execute test suites and verify workspace capabilities:
```bash
# Compile and build the project
npm run build
npx tsc --noEmit

# Run Unit, Integration, and E2E Tests
npx jest tests/apps/zavorth-desktop/WorkspaceWriteApprovalModal.test.ts \
         tests/services/WorkspaceWriteApprovalService.test.ts \
         tests/mcp/WorkspaceMcpServer.test.ts \
         tests/mcp/WorkspacePathGuard.test.ts \
         --no-coverage

# Run E2E Integration HTTP Smoke Verification
npx tsx scripts/zavorth-e2e-smoke-9f.ts
```

---

## 5. Remaining Risks & Governance Constraints

*   **Transient Payload Volatility**: proposed contents are held only in parent-process memory. If the Desktop backend process restarts, pending approvals lose their preview payload and must be denied, expired, or regenerated.
*   **Host Path Leaks**: Developers must ensure that absolute system paths (e.g. `C:/Users/name/...`) are never returned to the LLM agent via error messages. Only sanitized relative suffixes must be exposed.

---

## 6. What is Explicitly Disallowed

No capabilities have been built or are allowed for the following filesystem and system operations:
*   `workspace.filesystem.delete` / `rm` — Rejection of deletion requests.
*   `workspace.filesystem.rename` — Renaming directories/files.
*   `workspace.filesystem.move` / `mv` — Moving directories/files.
*   `workspace.filesystem.edit` / `applypatch` — Direct partial file editing (updates must rewrite the whole content via `workspace.filesystem.write` under visual approval).
*   `workspace.filesystem.chmod/chown/symlink` — Not available.
*   `workspace.shell / exec / run command` — Not available.
*   `dependency installation or arbitrary process execution` — Not available.
