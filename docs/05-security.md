# Security

Security in Zavorth is a runtime primitive. It decides whether an action can run,
what approval is required and what evidence must be recorded.

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

### Approval Envelopes

Approval is bound to a specific action and arguments. A later action with a
different scope should require a new approval.

### SecretRefs

Secrets are represented by references and diagnostics, not raw values. The user
should know what credential is missing without seeing the credential in chat.

### Command And Egress Guards

Dangerous commands, unsafe network destinations and sensitive provider egress are
blocked or redacted before execution.

### Receipts And Audit

Important decisions produce readable evidence: allowed, denied, redacted,
approved, blocked, expired or rolled back.

## Daily Checks

```bash
npm run security:secrets
npm run runtime:check
```

Use the broader workspace check before release or after wide runtime changes.

## Related

- [Operations](/docs/09-operations.md)
- [Self-Modification](/docs/self-modification.md)
- [Roadmap](/docs/11-roadmap.md)
