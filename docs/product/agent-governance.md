# Agent Governance

Zavorth keeps autonomous work bounded, reviewable, and reversible. The runtime
uses the same governance building blocks across CLI, Control, Desktop, API, and
connected channels — and now enforces them on the main agent paths listed below.

## Mission contracts

Every governed mission can declare:

- its objective and expected outcome;
- observable completion criteria;
- workspace, file, service, network, and time boundaries;
- approvals required before sensitive work;
- independent verification requirements;
- stop conditions and rollback instructions.

Completion is verified from runtime, policy, test, file, process, service, or
artifact evidence. A statement from the executor is recorded as a claim and is
never sufficient evidence by itself. If required evidence is missing, the
result is `inconclusive`, not `completed`.

### Runtime enforcement

- `verifyZavorthMission` / `gateMissionCompletion` reject executor-only claims.
- `AgentRunCorePipeline.finalize` demotes `completed` → `failed` when a run
  carries `missionDefinition` and independent evidence is missing.
- Productization missions expose `completeMissionWithVerification(...)` so a
  mission is only marked completed after verification.

Use `zavorth missions --json` to inspect the current mission contract.

## Autonomy budgets

Budgeted missions are enforced before new usage is accepted. Limits cover
actions, mutations, cost, duration, network calls, filesystem writes, external
deliveries, repeated failures, expiry, and risk. Concurrent requests reserve
their accepted usage so they cannot reuse a stale counter. A denied request
pauses the mission and reports the exceeded limit.

### Runtime enforcement

- Autonomous partner missions use `AgentRuntimeBudgetEnforcementService`.
- Free-text / tool loops use `authorizeHotPathToolCall` inside
  `ConversationalAgent` before each tool execution (limits via
  `ZAVORTH_HOTPATH_MAX_*` env vars; safe defaults when unset).

## Onboarding confirmation

Conversational onboarding creates a local preview first. Extracted answers do
not change the local profile until the user confirms through a structured UI
action. Confirmation tokens are random, session-bound, single-use, stored only
as hashes, and expire after 24 hours.

The interface follows the explicit user or device locale. English is the
fallback when a translation is unavailable. Setup remains usable without a
configured model provider.

## Memory provenance

Governed memory records include their kind, confidence, source runtime,
session, source events, references, validity, and optional expiry. Records are
workspace-scoped and can be contested or forgotten. Missing provenance blocks
the write.

### Runtime enforcement

- `MemoryService.autoExtract(persist)` and draft promotion dual-write to
  `AgentProvenanceMemoryService` via `AgentProvenanceMemoryBridge`.

## Health

`zavorth health` aggregates diagnostic providers. Missing or failed providers
remain visible as attention items instead of being treated as healthy. JSON
output includes the workspace-scoped diagnostic snapshot.

Providers include local install checks, **LLM usability**, **LLM roles store**,
**channel credentials**, and **governance module presence**.
