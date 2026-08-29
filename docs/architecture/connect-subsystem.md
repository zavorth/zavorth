# Universal Connection Subsystem Architecture

## 1. Overview & Core Philosophy
The Universal Connection Subsystem (`/connect <target>`, `/disconnect <target>`, and `/connections [list|catalog|status]`) provides an omnichannel, zero-friction, modular integration mesh across all Zavorth surfaces (Desktop, Web, Terminal, Discord, Telegram, WhatsApp) and inside the central agent tool loop.

### Key Tenets
- **Omnichannel Surface Adaptability**: Seamlessly renders interactive card descriptors on Web/Desktop and one-touch authorization deep-links / guided prompts on headless chat and CLI channels.
- **English-First & Clean Code**: 100% English codebase with explicit boundary types, zero regex heuristics, zero `any`, and full i18n support.
- **Provider-Agnostic Extensibility**: Inversion of control via modular ports (`ConnectionPluginRegistryPort`, `ConnectionMcpClientPort`, `ConnectionOAuthCatalogPort`).
- **Cryptographic Security Vault**: AES-256-GCM encrypted persistence with PBKDF2 (100,000 iterations), ephemeral loopback servers on `127.0.0.1`, RFC 7636 PKCE S256 challenge generation, and strict CSRF state parameters.
- **Central LLM Intelligence**: Native `connection_manage` Echo tool enabling the central AI agent to autonomously explore catalogs, check active connections, connect API services, or disconnect targets from natural user speech in any natural language.

---

## 2. Component Hierarchy & Layering

```
┌────────────────────────────────────────────────────────┐
│               User Interaction Surfaces                 │
│  - Chat Surfaces (Telegram, Discord, Terminal CLI)     │
│  - Web / Desktop UI (ConnectionCards)                  │
│  - Central LLM Agent (Natural Language / Tool Calls)   │
└──────────────────────────┬─────────────────────────────┘
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
┌─────────────────────────┐ ┌─────────────────────────┐
│ SharedSurfaceConnectPack│ │   ConnectionManageTool  │
│ (/connect, /disconnect) │ │   (Echo Tool Runtime)   │
└────────────┬────────────┘ └────────────┬────────────┘
             │                           │
             └─────────────┬─────────────┘
                           ▼
┌────────────────────────────────────────────────────────┐
│                   Domain Core                          │
│                                                        │
│  1. Target Resolver (ConnectionTargetResolver)         │
│     - Plugin Manifests -> Built-in OAuth -> MCP        │
│                                                        │
│  2. Lock & Concurrency Manager (ConnectionLockManager) │
│     - In-memory global ceiling (max 5)                 │
│     - SQLite table 'connection_handshake_locks'        │
│     - Instant in-flight handshake abort                │
│                                                        │
│  3. OAuth Handshake (ConnectionOAuthHandshakeService)  │
│     - RFC 7636 PKCE S256 Challenge                     │
│     - RFC 8628 Device Code Grant                       │
│     - LocalOAuthCallbackServer (ephemeral loopback)    │
│                                                        │
│  4. Verification Engine (ConnectionVerificationService)│
│     - Non-destructive API key & path pings             │
│     - RFC 7009 Token Revocation with Fail-Open B       │
│                                                        │
│  5. Credential Vault & State (ConnectionStateStore)    │
│     - 'active_connections' (SQLite table)              │
│     - 'connection_secret_ciphertexts' (AES-256-GCM)    │
│                                                        │
│  6. Proactive Refresh (ConnectionTokenRefreshService)  │
│     - 5-minute lead time automatic OAuth renewal       │
│     - Health tracking: healthy | expiring | error      │
│                                                        │
│  7. Semantic Introspection (IntrospectionService)      │
│     - Governed fallback guidance for unknown targets   │
└────────────────────────────────────────────────────────┘
```

---

## 3. Handshake Execution Flows

### A. Authorization Code Grant with PKCE (e.g. Claude, Codex, Gemini)
1. User enters `/connect claude` (or asks the agent to connect Claude).
2. `ConnectionLockManager` acquires an exclusive lock for `(userId, "claude")`.
3. `LocalOAuthCallbackServer` spawns on `127.0.0.1` on a dynamic port assigned by the OS.
4. `ConnectionOAuthHandshakeService` computes:
   - `code_verifier` (43-char base64url random string).
   - `code_challenge` (`BASE64URL(SHA256(verifier))`).
   - Cryptographic `state` (64-char hex string).
5. User is presented with the authorization URL.
6. The user authorizes in their browser, which redirects to `http://127.0.0.1:<port>/oauth/callback`.
7. `LocalOAuthCallbackServer` validates `state === expectedState`. If mismatched, returns HTTP 403. If valid, renders confirmation HTML and initiates auto-close.
8. The authorization code is exchanged at `tokenUrl` with `code_verifier`.
9. The resulting `access_token` and `refresh_token` are encrypted with AES-256-GCM into the vault.
10. `ConnectionLockManager` releases the lock.

### B. Device Authorization Grant (RFC 8628, e.g. GitHub, Qwen)
1. User enters `/connect github`.
2. System calls `initiateDeviceCodeFlow()` against provider `deviceCodeUrl`.
3. Returns `userCode` and `verificationUri` (`https://github.com/login/device`).
4. System instructions direct the user to enter their pairing code.
5. In the background, `pollDeviceToken()` polls `tokenUrl` with exponential backoff and `slow_down` handling until tokens are issued.

### C. API Key & Local Path Integrations (e.g. Stripe, Obsidian, Notion)
1. User enters `/connect stripe sk_live_...` or `/connect obsidian /path/to/vault`.
2. `ConnectionVerificationService` runs a non-destructive ping (HTTP ping for API keys, filesystem marker verification for directories).
3. On verification success, credentials are encrypted and stored in `active_connections`.

---

## 4. Security Invariants
1. **Zero Plaintext Secrets**: All sensitive API keys and tokens reside in `connection_secret_ciphertexts` encrypted via AES-256-GCM with distinct IVs (12 bytes) and auth tags (16 bytes).
2. **Strict CSRF Defense**: Ephemeral callback servers immediately reject any request where `state` does not match the active session.
3. **Loopback Isolation**: Local HTTP servers bind exclusively to `127.0.0.1`, rejecting public interfaces.
4. **Auto-Close & Teardown**: Ephemeral servers close immediately on callback or on 120s timeout, freeing socket handles.
