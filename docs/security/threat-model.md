# Threat model (product baseline)

Concise threat model for local-first Zavorth. Related deep-dives live under `docs/security/` and `docs/*threat-model*`.

## Assets

- Operator credentials (provider keys, channel tokens)
- Local workspace files under execution boundary
- Host / gateway control plane (loopback)
- Receipts, memory, and audit logs
- Classic Control mutation surface

## Trust boundaries

| Boundary | Default posture |
|----------|-----------------|
| Loopback Control / host | Local operator; mutation token for writes |
| Tool execution | Workspace + policy allow/deny |
| Channels | Outbound only when configured; unconfigured send fails closed |
| Memory | Privacy redaction + forget paths |
| Supply chain | secret-guard + supply-chain scripts in `security:ci` |

## Primary threats

1. **XSS / injection on classic Control** — mitigated by access service + mutation token + tests.
2. **Path escape via tools** — LocalExecutor + tool security policy tests.
3. **Unconfigured channel send** — factory/outbox honesty; no fake success.
4. **Secret leakage in logs/docs/CI** — secret-guard patterns.
5. **Privilege via ABAC mis-time/zone** — ABAC suite with TZ isolation.
6. **Malicious skill/MCP** — quarantine service path.

## Non-goals (this baseline)

- Full multi-tenant cloud isolation
- Store-signed desktop threat model for every OS store
- External penetration test results (ops/engagement)

## Verification hooks

- `npm run security:ci`
- Dogfood `dogfood.security.*`
- Classic access + ABAC Jest suites
