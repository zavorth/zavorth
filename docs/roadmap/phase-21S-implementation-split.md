# Phase 21S Implementation Split

> [!IMPORTANT]
> This is a design-only document for Phase 21S-A. No runtime implementation is performed in this phase.

This document outlines the sequential phases to implement decoupled service architecture, approval leases, and serverless execution boundaries in Zavorth.

---

## Phase Sequence

### 21S-A — Extensibility, Approval Leases & Serverless Architecture Safety Gate
*   **Goal**: Create a design-only safety gate outlining threat models and API contracts.
*   **Scope**: Architecture, security, and roadmap documentation, plus validation tests.
*   **Non-Goals**: Runtime implementation.
*   **Files touched**: `docs/**`, `tests/docs/**`.
*   **Tests required**: Documentation integrity checks.
*   **Approval criteria**: All threat models created, no runtime changes made, tests pass.
*   **Failure criteria**: Modifying production code or leaving gaps in the threat models.
*   **Security risks**: None (documentation only).
*   **Rollback plan**: Discard untracked files.

### 21S-B — Minimal Safe Service Composition Foundation
*   **Goal**: Implement the basic `ServiceRegistry` container.
*   **Scope**: Creation of `ServiceRegistry.ts`, registering core services on boot.
*   **Non-Goals**: Custom approval leases or remote sandboxes.
*   **Files touched**: `src/bootstrap/ServiceRegistry.ts`, `src/bootstrap/bootstrapSurface.ts`.
*   **Tests required**: Unit tests verifying registry lookup, resets, and duplicate registration protection.
*   **Approval criteria**: Successful service wiring, compile-time and runtime validation tests pass.
*   **Failure criteria**: Silent overwrites or memory leaks during test runs.
*   **Security risks**: Unintended exposure of registered handles.
*   **Rollback plan**: Git revert back to tag `zavorth-21s-architecture-safety-gate-*`.

### 21S-C — Personal Approval Lease Safety Design Finalization
*   **Goal**: Finalize the database schema additions for the approval leases.
*   **Scope**: Database migration files and types for cached leases.
*   **Non-Goals**: Automatic bypass runtime code.
*   **Files touched**: `src/storage/schema.ts`, `src/storage/migrations/**`.
*   **Tests required**: Schema verification and migration compatibility tests.
*   **Approval criteria**: Successful migration run without data loss.
*   **Failure criteria**: Breaking backward compatibility with existing databases.
*   **Security risks**: Database locking or credential exposure.
*   **Rollback plan**: Revert migrations.

### 21S-D — Personal Approval Lease MVP
*   **Goal**: Implement the approval lease duration checks and bypass logic.
*   **Scope**: Modifying `ApprovalDecisionCacheService.ts` and `ZavorthTerminalBackendsService.ts` to respect leases for the `personal` profile.
*   **Non-Goals**: Cloud deployment or S3 sync.
*   **Files touched**: `src/services/ApprovalDecisionCacheService.ts`, `src/services/ZavorthTerminalBackendsService.ts`.
*   **Tests required**: Unit tests verifying TTL expirations, warnings for >24h, and blocking of destructive commands.
*   **Approval criteria**: Successful execution of low-risk commands without prompts, proper warnings shown.
*   **Failure criteria**: Allowing high-risk commands or failing to expire leases.
*   **Security risks**: Escalation of privilege through leaked leases.
*   **Rollback plan**: Revert changes via Git.

### 21S-E — Safe Extension Facade MVP
*   **Goal**: Implement the `ZavorthExtensionFacade` class.
*   **Scope**: Designing and implementing the registration boundary for custom tools.
*   **Non-Goals**: Direct system execution without sandboxing.
*   **Files touched**: `src/sdk/ZavorthExtensionFacade.ts`, `src/services/ToolGatekeeper.ts`.
*   **Tests required**: Testing registration lifecycle, drift detection, and schema compliance.
*   **Approval criteria**: Custom tool successfully registered, verified, and executed inside the sandbox.
*   **Failure criteria**: Silent bypass of `ToolGatekeeper` or namespace collision.
*   **Security risks**: Sandbox escape or malicious command injection.
*   **Rollback plan**: Revert changes via Git.

### 21S-F — Headless Runtime Local Mode
*   **Goal**: Implement the `--headless` flag for CLI start.
*   **Scope**: Modifying CLI parser to support headless execution.
*   **Non-Goals**: Remote database or cloud deploy.
*   **Files touched**: `src/zavorth-cli.ts`, `src/services/DashboardCoreRouteService.ts`.
*   **Tests required**: Smoke test running daemon without UI.
*   **Approval criteria**: Daemon starts HTTP port and webhook routes correctly.
*   **Failure criteria**: Electron process starts or port binding fails.
*   **Security risks**: Unauthenticated endpoint exposure.
*   **Rollback plan**: Revert changes.

### 21S-G — Cloud Packaging Dry Run
*   **Goal**: Create and validate container packaging.
*   **Scope**: Writing `deploy/Dockerfile.cloud`.
*   **Non-Goals**: Publishing or running on cloud platform.
*   **Files touched**: `deploy/Dockerfile.cloud`.
*   **Tests required**: Docker build validation.
*   **Approval criteria**: Successful local Docker image build.
*   **Failure criteria**: Build failure or bloated container size (>500MB).
*   **Security risks**: Insecure default root user inside the container.
*   **Rollback plan**: Remove Dockerfile.

### 21S-H — Remote Database Adapter
*   **Goal**: Implement Libsql/Turso HTTP client adapter.
*   **Scope**: Integrating `@libsql/client` into `Database.ts`.
*   **Non-Goals**: Live synchronization of markdown files.
*   **Files touched**: `src/storage/Database.ts`, `src/config/sections/executionHostConfig.ts`.
*   **Tests required**: Mock connection tests verifying query parameters and network failover.
*   **Approval criteria**: Queries execute successfully over HTTP with token redaction in logs.
*   **Failure criteria**: Leaking DB credentials or blocking local-first default database.
*   **Security risks**: DB token exposure.
*   **Rollback plan**: Revert changes.

### 21S-I — Remote Memory Sync Threat Model Approval
*   **Goal**: Approve the encryption protocol and key derivation before implementing sync.
*   **Scope**: Formal review of the encryption mechanisms (AES-GCM key derivation details).
*   **Non-Goals**: Implementation of sync code.
*   **Files touched**: `docs/security/remote-memory-sync-threat-model-21S-A.md` (updates if needed).
*   **Tests required**: None (design/review).
*   **Approval criteria**: Explicit peer sign-off.
*   **Failure criteria**: Security design weaknesses.
*   **Rollback plan**: Re-review design.

### 21S-J — Remote Memory Sync MVP
*   **Goal**: Implement local file encryption and S3 sync helper.
*   **Scope**: Coding `deploy/s3-sync.ts` and wiring memory write triggers.
*   **Non-Goals**: Live cloud deployment of the full container.
*   **Files touched**: `deploy/s3-sync.ts`, `src/services/ZavorthMemoryLearningLoopService.ts`.
*   **Tests required**: Sync tests verifying encryption, uploads, and conflict merges.
*   **Approval criteria**: Markdown files are securely uploaded and downloaded upon session events.
*   **Failure criteria**: Uploading unencrypted user data or data corruption.
*   **Security risks**: Cryptographic errors or S3 bucket exposure.
*   **Rollback plan**: Disable cloud sync env variables.

### 21S-K — Cloud Serverless Deployment Dry Run
*   **Goal**: Perform full end-to-end cloud validation.
*   **Scope**: Deploying to Google Cloud Run and checking scale-to-zero.
*   **Non-Goals**: None.
*   **Files touched**: None (operational phase).
*   **Tests required**: Webhook integration tests.
*   **Approval criteria**: Instance successfully wakes up via Telegram, executes, writes to Turso, and scales down to zero.
*   **Failure criteria**: Timeout during cold start or data loss.
*   **Security risks**: Public endpoint exposure.
*   **Rollback plan**: Delete Cloud Run service.
