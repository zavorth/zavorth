# Quarantine Resolution Checkpoint

This document records the final decision and resolution of the quarantined assets within the Zavorth repository, ensuring a clean and audited codebase posture for release.

---

## Integrated Phases & Milestones (Fases 1 to 15)

The repository has been structured through sequential security and codebase hardening phases:
*   **Fase 13A**: Integrated the 5 safe, read-only panel components (`ApprovalsPanel`, `AutomationsPanel`, `ChannelsPanel`, `PersonalizationPanel`, `SkillsPanel`).
*   **Fase 13B**: Integrated the backend trust and skill lifecycle control layers (`ZavorthMcpTrustExposureService`, `ZavorthSkillLifecycleService`).
*   **Fase 14**: Integrated safe visual presets and theme/skin palette triggers (`themePresets.ts`, `HubCommandPalette.tsx`).
*   **Fase 14A**: Rewrote and integrated `SettingsPanel.tsx` and `MemoryPanel.tsx` to be strictly read-only, scrubbing all active/mutant callbacks and buttons.
*   **Fase 14B**: Integrated `HubWorkspaceView.tsx` with callback protection, removing prop delegation of mutation actions to sub-panels.
*   **Fase 15**: Established formal terminal deferral policy, implementing static analysis tests (`DesktopTerminalDeferred.test.ts`) that verify that no production file imports terminal/PTY spawning libraries.

---

## Quarantine Deletion Registry (12 Files Removed)

The following 12 untracked files have been physically removed from the local worktree:

### 1. Deferred Shell & UI Panels (DELETE_FROM_WORKTREE)
*   `apps/zavorth-desktop/src/hub-skin/HubNativeShell.tsx`
*   `apps/zavorth-desktop/src/shell/InteractiveTerminal.tsx`
*   `tests/apps/zavorth-desktop/DesktopHubSkinMigration.test.ts`
*   `tests/apps/zavorth-desktop/DesktopPremiumUpgradeRegression.test.ts`

**Rationale**: Spawning an interactive shell/PTY emulator exposes the host system to command injection, directory traversal, and host process takeover. Since terminal features were deferred, these assets are removed to prevent accidental inclusion or build integration.

### 2. Deferred Runtime Tests, CLI & Benchmarks (DEFER_OR_DELETE)
*   `scripts/zavorth-desktop-release-readiness-check.mjs`
*   `scripts/zavorth-skill-hub-benchmark-check.mjs`
*   `tests/runtime/agent/AgentRunAutomaticSkillInvocationHeuristics.test.ts`
*   `tests/runtime/agent/AgentRunLlmRequestBuilderMcpTrustExposure.test.ts`
*   `tests/runtime/agent/AgentRunLlmRequestBuilderWorkspaceKnowledge.test.ts`
*   `tests/scripts/ZavorthSkillHubBenchmarkCheck.test.ts`
*   `tests/services/ZavorthPersonalOpsProductionSurface.test.ts`
*   `tests/services/ZavorthProviderSetupServiceProductSurface.test.ts`

**Rationale**: These scripts and tests refer to active provider setup, automated skill benchmarks, and runtime agent steering behaviors that are not integrated or supported in the current visual/read-only build.

---

## Restoring & Reopening Deferred Features in the Future

If any of these deferred capabilities (terminal execution, active provider setup, or active agent steering) are slated to be reintegrated in a future release cycle, they must adhere to the following strict transition rules:

### Reintegration Rules & Hard Gates
1. **Isolated Phase & Branching**: Active components must be developed in a dedicated, isolated phase/branch. They must never be slipped into general visual or style changes.
2. **Terminal Sandboxing**: The terminal capability must run inside a sandbox (AppContainer, WSL boundary, chroot, or Docker) with zero access to the host's direct files or environment unless explicitly approved.
3. **Opt-In Gate**: Any active execution panel (terminal or setup configuration) must require explicit, authenticated user opt-in before spawning any background runtime process.
4. **Dedicated Verification Gates**: Reintegration must include complete Jest E2E tests proving command rejection limits, token expiration, log audits, and containment checks.
5. **Static Code Validation**: The static tests (`DesktopTerminalDeferred.test.ts`) must be updated to explicitly whitelist approved files rather than outright blocking them.
