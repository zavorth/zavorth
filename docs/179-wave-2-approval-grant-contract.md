# 179 - Wave 2 Approval Grant Contract

Status: approval-grant-contract-ready

This contract defines the side-effect-free approval grant/reject/revoke/expire model used by external-agent controlled actions before any future mutation gate can run.

## Contract Rule

The approval grant contract may move a modeled action plan from `awaiting-approval` to `approved-executable`, `rejected`, `revoked`, `expired`, or `policy-invalidated`, but it must never execute the real mutation.

Every transition requires:

- exact scope match against the approval request
- approver metadata with redacted identity
- TTL and expiration handling
- policy recheck before approved-executable
- idempotency key for replay safety
- audit receipt proving `mutationActuallyPerformed: false`

## Execution Boundary

Do not execute real mutation in this gate.

This gate is allowed to model approval state only. It must not send messages, call provider mutation APIs, execute commands, invoke gateway mutation adapters, copy source modules, or grant source authority.

The output is a redacted audit receipt plus a future plan state. A later controlled mutation dispatch gate may consume `approved-executable`, but only after its own policy checks, idempotency validation, and runtime approval guardrails.

## Security Notes

Secrets must remain outside the document and outside serialized receipts. Local tokens, provider keys, gateway tokens, bearer values, and raw approver secrets are represented only by redacted references.
