# ADR-0001: Architecture Decision Record for Universal Connection Subsystem

## Status
Accepted

## Date
2026-08-28

## Context
Zavorth required a unified, omnichannel integration mesh allowing users to connect and govern diverse external services (OAuth providers, API keys, local directory vaults, and MCP servers) across chat interfaces, web dashboards, terminal CLI, and central LLM autonomous tool calling.
Previous designs had fragmented connection logic, lacked CSRF defenses, coupled external credentials to LLM model providers, and had no standard for remote token revocation or concurrency locking.

## Decisions

### 1. Inversion of Control & Deterministic Resolution
- **Decision**: Decouple connection resolution via `ConnectionTargetResolver` with strict priority:
  1. Plugin Manifests (`connection?: PluginConnectionDescriptor`)
  2. Built-in OAuth Providers (`github`, `claude`, `codex`, `gemini-cli`, `qwen`, `qoder`, `kimi-coding`, `cline`, `zavorthbridge`)
  3. Built-in Service Integrations (`stripe`, `obsidian`, `notion`)
  4. Model Context Protocol (MCP) servers
- **Rationale**: Guarantees zero vendor lock-in and offline determinism without hardcoding vendor logic in commands.

### 2. Dual-Layer Persistence & AES-256-GCM Vault
- **Decision**: Decouple external service secrets from `provider_config` (which is exclusively for LLM inference models). Store external credentials in a dedicated SQLite vault table `connection_secret_ciphertexts` encrypted with AES-256-GCM and PBKDF2 (100,000 iterations), tracked by `active_connections`.
- **Rationale**: Eliminates foreign key conflicts, isolates secret ciphertexts, and ensures enterprise-grade security.

### 3. Ephemeral Loopback Server with Strict CSRF Defense
- **Decision**: Implement `LocalOAuthCallbackServer` binding only to `127.0.0.1` on OS-assigned dynamic ports, validating a 64-character hexadecimal `state` parameter before processing callbacks, and auto-closing on timeout or completion.
- **Rationale**: Prevents CSRF attacks, eliminates port collisions, and avoids leaking open sockets.

### 4. Hybrid Concurrency Locks & Immediate In-Flight Abort
- **Decision**: Implement `ConnectionLockManager` enforcing a global ceiling (max 5 parallel handshakes) and a per-target SQLite lock (`connection_handshake_locks`). When `/disconnect` is called, any active in-flight handshake for that target is aborted immediately via `AbortController`.
- **Rationale**: Prevents race conditions and duplicate connection attempts while allowing immediate cancellation.

### 5. Proactive Token Refresh with Fail-Safe Health Status
- **Decision**: Implement `ConnectionTokenRefreshService` checking tokens 5 minutes prior to expiry. On failure, update `healthStatus: 'error'` without spamming provider endpoints.
- **Rationale**: Keeps connections alive silently while providing clear user diagnostics when credentials expire.

### 6. Central LLM Integration via `ConnectionManageTool`
- **Decision**: Register `ConnectionManageTool` in `ZavorthEchoOrchestrator` under category `INTERNAL`.
- **Rationale**: Enables the central LLM agent to inspect, explore, connect, and disconnect integrations dynamically from natural language conversations in any language.

## Consequences
- Clean, modular, and fully tested integration subsystem with zero untyped `any` or fragile regex.
- All 30+ supported channels and central agent share the same unified connection contracts and credential vault.
