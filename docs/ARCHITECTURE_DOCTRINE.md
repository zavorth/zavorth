# Zavorth Architecture & Engineering Doctrine

This document establishes the permanent architectural principles, subsystem designs, and engineering invariants for the Zavorth Autonomous Agent Platform.

---

## 1. Core Philosophy & Invariants

1. **Clean-Code & Zero Dead Code**:
   - 100% English-First codebase (types, variables, functions, documentation, and commit messages).
   - Zero `any` policy with strict TypeScript interfaces and discriminated unions.
   - Zero silent catches: every exception is explicitly typed, contextualized, and logged via `logger.warn`/`logger.error`.
   - Zero dead code or orphaned test files in production paths.

2. **Provider-Agnostic Inversion of Control (SOLID)**:
   - Core agent runtimes and business logic are decoupled from any single proprietary LLM vendor.
   - All AI models interface through pluggable `ILlmProvider` adapters (Gemini, Anthropic, OpenAI, Ollama, Novita, Replicate).

3. **Local-First & Zero-Trust Governance**:
   - System prioritizes local execution and data privacy.
   - Every tool call and plugin execution is gated by the Cognitive Firewall and `AgentToolSecurityCatalog`.

---

## 2. Platform Subsystems

### 2.1 Provider-Agnostic AI Gateway & Model Routing
- **Location**: `src/adapters/llm/`, `src/runtime/agent/`
- **Capabilities**:
  - Dynamic model discovery with fallbacks and circuit breakers.
  - Granular cost estimation across input, output, and cache read/write tokens.
  - Multi-tier prompt compression and dense context encoding.

### 2.2 Agent Client Protocol (ACP) & Multi-Channel Gateway
- **Location**: `src/acp/`, `src/gateway/channels/`
- **Capabilities**:
  - Full JSON-RPC 2.0 implementation over STDIO and Server-Sent Events (SSE).
  - Universal session continuity across Telegram, Discord, Slack, Web Console, and Desktop interfaces.
  - Real-time token streaming and Just-in-Time (JIT) tool approval requests.

### 2.3 Persistent & Resilient Scheduler Engine
- **Location**: `src/scheduler/`, `src/tools/ZavorthSchedulerTool.ts`
- **Capabilities**:
  - Durable JSON/SQLite storage for jobs, runs, and delivery statuses.
  - Restart Catchup Recovery with *at-most-one* execution policy to prevent duplicate triggers after system sleep/reboot.
  - Deterministic SHA-256 Jitter Stagger to distribute top-of-hour CPU burst loads.
  - Isolated subagent execution lanes with timeout guards and OS power wake-locks.
  - Multi-channel completion and failure dispatch (Desktop, Webhook, Chat).

### 2.4 Formal Plugin SDK (OpenClaw-Grade)
- **Location**: `src/plugin-sdk/`, `src/tools/ZavorthPluginSdkTool.ts`
- **Capabilities**:
  - Declarative manifests with SemVer validation and granular permission scopes (`filesystem.read/write`, `network.http`, `shell.exec`, etc.).
  - Zero-Trust permission sandbox preventing Server-Side Request Forgery (SSRF) and unauthorized access.
  - MCP-as-Plugin bridging: dynamically projects any Model Context Protocol server as a typed `ZavorthPlugin` with dynamic `BaseTool` instances.
  - Remote package installer with **Ed25519** cryptographic signature verification and SHA-256 package checksums.
  - Live Hot-Reload: file watchers with 150ms debouncing enabling code updates without restarting the agent process.

### 2.5 Subagents in Isolated Git Worktrees (Hermes-Grade)
- **Location**: `src/agents/worktree/`, `src/tools/ZavorthWorktreeTool.ts`
- **Capabilities**:
  - Generates isolated working trees at `.zavorth/worktrees/<taskId>` bound to dedicated ephemeral branches (`agent/worktree-<id>`).
  - Guarantees zero pollution or merge conflicts on the developer's working tree.
  - Intent-to-add diff extraction (`git add -N .`) capturing new files in atomic change receipts.
  - Atomic isolated commits and clean workspace pruning.

---

## 3. End-to-End Testing & Verification Doctrine

- Every subsystem is verified via automated unit and E2E integration suites (`tests/e2e/`, `tests/scheduler/`, `tests/plugin-sdk/`, `tests/agents/worktree/`).
- The `MockChannelGateway` and `ZavorthE2EHarness` allow automated multi-turn conversation and tool execution testing without external API dependencies.
- Mandatory pre-completion gate: compilation (`npm run build:cli`) and test suites must pass with 100% success before any deployment or release.
