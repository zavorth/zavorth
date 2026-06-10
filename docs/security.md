# Security

Security in Zavorth is a runtime primitive. It decides whether an action can run,
what approval is required and what receipt must be recorded.

## Core Rules

- untrusted content is not allowed to instruct the agent directly;
- raw secrets should not be exposed to prompts, logs or public docs;
- commands, file writes, network access and live sends pass through policy;
- approvals are tied to scope and should expire;
- receipts explain what happened and why.

## Main Controls

### Policy Broker

Central decision point for tools, providers, workspace access, web fetches,
desktop/device automation, skills, plugins, MCPs and writes.

### Effect Boundary

LLM cognition is separate from host effects. The model can reason, choose tools
and draft actions, but real writes, shell, network egress, secrets, persistence
and external sends are converted into typed effects before policy, rehearsal,
approval and receipts. Safe observations such as current time and allowed
workspace reads stay low-friction and auditable.

### Approval Envelopes

Approval is bound to a specific action and arguments. A later action with a
different scope should require a new approval.

### SecretRefs

Secrets are represented by references and diagnostics, not raw values. The user
should know what credential is missing without seeing the credential in chat.

### Local Access And Trusted Devices

The desktop runtime keeps one owner token for local control and can derive
separate trusted-device grants for future companion, mobile or remote surfaces.
Each device grant has its own token, explicit scopes, expiry, revocation state
and redacted receipts. Raw device tokens and pairing codes are never persisted;
only hashed secret material is stored locally.

Owner authentication is required to create, approve, list or revoke trusted
devices. A trusted device cannot approve another trusted device. Broad dashboard
access requires the `runtime:control` scope; narrower grants can be checked by
the runtime for specific tasks such as approvals or read-only chat.

### Command And Egress Guards

Dangerous commands, unsafe network destinations and sensitive provider egress are
blocked or redacted before execution.

### Receipts And Audit

Important decisions produce readable receipts: allowed, denied, redacted,
approved, blocked, expired or rolled back.

## Daily Checks

```bash
npm run security:secrets
npm run runtime:check
npm run effect-boundary:check
```

Use the broader workspace check before release or after wide runtime changes.

## Related

- [Operations](/docs/operations.md)
- [Effect Boundary](/docs/effect-boundary.md)
- [Self-Modification](/docs/self-modification.md)
- [Product Principles](/docs/product-direction.md)
