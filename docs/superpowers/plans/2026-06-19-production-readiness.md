# Production Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validate and close the remaining channel, audit logging, voice, encryption, and Doctor readiness gaps without replacing existing uncommitted work.

**Architecture:** First establish the actual current behavior with focused tests. Then complete channel-contract coverage and dynamic audit identifiers, retain native channel implementations behind a single registry boundary, extend only genuinely missing voice backends, and add safe Doctor diagnostics. Existing encryption is verified rather than duplicated.

**Tech Stack:** TypeScript, Jest, Node.js, existing Zavorth action/governance services.

---

### Task 1: Establish the current readiness baseline

**Files:**
- Test: `tests/gateways/WebhookGateway.test.ts`
- Test: `tests/cli/doctor/ZavorthDoctorPremiumCommand.test.ts`
- Test: `tests/services/ContextCompactionService.test.ts`

- [ ] Run the focused gateway, Doctor, encryption, and voice test suites before changing source.
- [ ] Record features that already exist and exclude them from duplicate implementation.
- [ ] Run `git diff --check` and preserve all unrelated worktree changes.

### Task 2: Complete channel contract coverage and audit identifiers

**Files:**
- Modify: `src/gateways/ChannelGatewayFactory.ts`
- Modify: `src/services/SecurityAuditLogger.ts`
- Test: `tests/gateways/ChannelGatewayFactory.test.ts`
- Test: `tests/services/SecurityAuditLogger.test.ts`

- [ ] Write a failing parameterized test that each factory-managed gateway is discoverable and has the common lifecycle/send contract.
- [ ] Write a failing test that `SecurityAuditLogger` accepts a registered channel identifier outside the former static union.
- [ ] Implement the smallest shared registry-derived identifier validation needed for those tests.
- [ ] Run the two suites and confirm they pass.

### Task 3: Retire the legacy channel routing fallback safely

**Files:**
- Modify: `src/cli/ZavorthCliLiveNamespaces.ts`
- Modify: `src/gateways/ChannelGatewayFactory.ts`
- Test: `tests/cli/ZavorthCliLiveNamespaces.test.ts`

- [ ] Write failing compatibility tests for each legacy channel route through the registry-facing adapter.
- [ ] Implement adapters without replacing native SDK behavior.
- [ ] Remove legacy routing only after all compatibility tests pass.

### Task 4: Verify encryption and fill only missing operational diagnostics

**Files:**
- Modify: `src/cli/doctor/ZavorthDoctorPremiumCommand.ts`
- Test: `tests/cli/doctor/ZavorthDoctorPremiumCommand.test.ts`
- Test: `tests/services/ZavorthMemoryEncryptionStatusService.test.ts`

- [ ] Write failing tests for non-mutating network, writable-storage, and SQLite-integrity diagnostics.
- [ ] Implement diagnostics with explicit repair plans; do not perform destructive repair automatically.
- [ ] Verify encryption migration, rollback, and secret-redaction behavior already supplied by the existing memory command.

### Task 5: Complete real voice integrations only where no current adapter exists

**Files:**
- Modify: `src/runtime/actions/modules/productizationPacks.ts`
- Test: `tests/runtime/actions/ZavorthProductizationPackActions.test.ts`

- [ ] Write a failing test for the configured ElevenLabs execution path and missing-key failure behavior.
- [ ] Implement a governed HTTP adapter using the configured key and artifact receipt.
- [ ] Keep unsupported providers as explicit unavailable states, never simulated success.

### Task 6: Full verification

**Files:**
- Verify: affected Jest suites and project typecheck/build

- [ ] Run all affected tests, `git diff --check`, and the fastest applicable build/typecheck command.
- [ ] Report exact passing and timed-out/blocked checks; do not claim unrun checks passed.
