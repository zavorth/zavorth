# Release Candidate Checkpoint - 2026-06-13

This document records the official Release Candidate (RC) verification and approval details for the Zavorth application, marking the successful closure of the security quarantine.

---

## 1. Repository State

*   `git status --short`: `empty`
*   `git ls-files --others --exclude-standard`: `empty`

The worktree contains no untracked modifications, and all 12 quarantined assets have been physically removed.

---

## 2. Execution Gates & Results

The following release verification gates have been executed successfully:

```bash
npm run surfaces:check
# Result: [surface-syntax] 1097 file(s) of ai-gateway, web components validated.

npm run runtime:check
# Result: tsc --noEmit completed successfully with no errors.

npm --prefix apps/zavorth-desktop run build
# Result: Vite production bundle built successfully.

npx jest tests/apps/zavorth-desktop/DesktopTerminalDeferred.test.ts --no-coverage
# Result: 4 tests passed.

npx jest tests/apps/zavorth-desktop/DesktopReadOnlySettingsMemoryPanels.test.ts tests/apps/zavorth-desktop/DesktopHubWorkspaceViewReadOnly.test.ts tests/apps/zavorth-desktop/DesktopReadOnlyApprovalsPanel.test.ts tests/apps/zavorth-desktop/DesktopReadOnlyFileExplorer.test.ts tests/apps/zavorth-desktop/WorkspaceWriteApprovalModal.test.ts --no-coverage
# Result: 64 tests passed across 5 suites.
```

---

## 3. Relevant Recent Commits

```text
0112b57 docs(security): add quarantine resolution checkpoint
39a1560 docs(desktop): defer terminal integration
019fc0c feat(desktop): add read-only hub workspace view
32c091c feat(desktop): rewrite settings and memory panels as read-only
3582430 feat(desktop): add safe theme skin primitives
262d2d9 feat(runtime): add MCP trust and skill lifecycle services
3947651 feat(desktop): adopt safe read-only desktop panels
8785b37 feat(desktop): add read-only approvals panel
7dc1884 docs(desktop): add shell and file explorer checkpoint
2568bef test(desktop): add real render coverage for read-only FileExplorer
9392676 test(desktop): add read-only FileExplorer integration tests
9ae05bf feat(desktop): integrate FileExplorer panel in contextual preview rail
```

---

## 4. Integrated Features

*   **MCP Drift Protection & CLI Installer**: Implemented strict schema/description drift detection, quarantining, and `zavorth-mcp-install` CLI tooling.
*   **Security Audit Logger**: Crypographically secure logging (HMAC-SHA256 user ID hashes) with log-injection protection.
*   **Workspace Git Read-Only**: Sandboxed, read-only Git commands using `execFile` with no active shell execution.
*   **Workspace Filesystem Read/List/Search**: Strict directory isolation backed by `WorkspacePathGuard` preventing traversal attacks.
*   **Workspace Write/Mkdir with Explicit Approval**: Single-use token handshake verification workflow utilizing transient memory cache.
*   **Desktop Multi-Pane Shell**: Namespaced CSS and DOM layout with strict panel viewport constraints.
*   **FileExplorer Read-Only**: Local-only relative paths display in a tree explorer with callback sanitization.
*   **ApprovalsPanel Read-Only**: Visual tabs showing pending/recent operations without exposing raw inputs.
*   **Safe UI-only Panels**: Non-interactive views forSkills, Channels, and Automations.
*   **SettingsPanel and MemoryPanel Read-Only**: Scrubbed of all mutation callbacks, encryption changes, and runtime control buttons.
*   **HubCommandPalette & Theme Presets**: Safe visual style selectors and palette setups.
*   **HubWorkspaceView Read-Only**: View aggregation container without active prop callback delegation.
*   **Terminal Deferred/Hard-Disabled**: Static imports validation gate to prevent accidental inclusion of interactive terminal.

---

## 5. Explicitly Non-Integrated Features

*   **Terminal PTY**: No interactive terminal process creation or shell emulation.
*   **HubNativeShell**: Excluded from build and source files.
*   **Active Native Shell / Spawning**: Deferred to maintain host containment.
*   **Mutant Provider Setup**: Removed setup controls to prevent active credentials modification.
*   **Deferred Scripts/Benchmarks/Runtime Tests**: Deleted from worktree to keep the release scope secure.

---

## 6. Residual Risks & Design Debt

*   **WorkspaceViewProps Active Handlers**: The global type definitions in `WorkspaceViewProps` still list steering/active callbacks (like `onRuntimeStart`, `onAccessRepair`, `onRuntimeStateAction`). These are classified as **design debt / future cleanup**, as the current visual components do not reference, destructure, or delegate these callbacks to active elements, thus leaving no active runtime execution path open.

---

## 7. Final Verification

**Release Candidate approved for manual tag.**
**Quarantine closed.**
**Worktree clean.**
