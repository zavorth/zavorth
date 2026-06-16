# Serverless Cloud Threat Model

> [!NOTE]
> This is a durable design document for Zavorth.

## 1. Threat Scenarios and Mitigations

### Threat 1: Webhook Spoofing (Request Tampering)
*   **Description**: An attacker discovers the webhook endpoint url (e.g. `/api/webhook/telegram-bot`) and posts fake message payloads to execute arbitrary agent commands.
*   **Impact**: Compromise of the agent loop, unauthorized remote control, or data exfiltration.
*   **Mitigation**: Mandatory request signature verification. All webhook handlers must validate headers (such as Telegram's `X-Telegram-Bot-Api-Secret-Token` or Slack's `X-Slack-Signature`) against the configured credentials before digesting the payload.

### Threat 2: Secret Leakage via Container Logs
*   **Description**: During system boot or tool execution failure, the stack trace or error log prints active API keys (e.g. OpenAI or Turso tokens) to stdout, which are collected by centralized log aggregators (e.g. Google Cloud Logging).
*   **Impact**: Theft of API credentials and billing abuse.
*   **Mitigation**: The `SecurityAuditLogger` uses `redactSecrets(...)` to scan and redact patterns of known keys from all log envelopes. Production logging configurations will disable verbose stack-trace outputs.

### Threat 3: Ephemeral Filesystem Data Volatility
*   **Description**: The container shuts down due to scale-to-zero inactivity. The local `state.db` database and markdown memories are wiped, losing all context and user preferences for subsequent chats.
*   **Impact**: Loss of agent continuity and session history.
*   **Mitigation**: Externalize state. The SQLite engine must connect to a remote database adapter (like Turso), and local filesystem files (`IDENTITY.md`, `USER.md`) must be synchronized to remote S3 buckets during startup and memory commit phases.

### Threat 4: Unauthorized Access to Headless API Port
*   **Description**: The container exposes port `8080` publicly. An attacker scans the IP and calls internal endpoints (like `/control` or `/api/ready`) without a session token.
*   **Impact**: Session hijacking or configuration tampering.
*   **Mitigation**: Strict authentication middleware. The API server rejects any request lacking a valid token (`Authorization: Bearer <token>`) in the header, returning `401 Unauthorized` immediately.
