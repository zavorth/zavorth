# Effect Boundary

Effect Boundary is Zavorth's execution safety boundary. It keeps the LLM free to
reason, investigate, compare and draft, while deterministic runtime code governs
real effects.

## Core Rule

The model may think freely. Only effects are governed.

Examples of governed effects:

- workspace writes or deletes;
- shell/process spawn;
- network egress;
- secret or credential access;
- persistence;
- external human-visible sends;
- irreversible actions.

Safe observations, such as reading allowed workspace context or getting the
current time, stay low-friction and auditable.

## Pipeline

```text
ToolCall / proposed action
-> ActionIntent
-> Effect
-> EffectPolicyKernel
-> Capability / Rehearsal
-> CommitPlan + RollbackPlan
-> Approval / host adapter
-> Receipt
```

The LLM does not receive execution authority. It receives tool descriptions,
observations and policy feedback. Host authority lives in typed runtime
contracts.

## Main Contracts

- `src/runtime/effects`: `ActionIntent`, `Effect`, risk, decisions and receipts.
- `src/tools/governance`: tool-call to effect mapping and safe observation
  registry.
- `src/security/EffectPolicyKernel.ts`: pure deterministic policy for effects.
- `src/runtime/rehearsal`: rehearsal envelopes and previews for deferred effects.
- `src/runtime/commit`: commit plans, rollback plans and commit readiness.

## Current Runtime Behavior

The main LLM native tool loop executes only safe observations directly.

Examples:

- `get_datetime` for current time/date questions;
- `read_file` and `list_directory` for safe workspace observation;
- `workspace.read` and `workspace.list` when exposed.

Side effects are not executed directly from the LLM native tool loop. They are
deferred as effect rehearsal envelopes.

Examples:

- `write_file` becomes a workspace mutation effect;
- shell tools become process-spawn effects;
- sends/publishes become external egress effects;
- secret access requires admin policy.

Untrusted content may be context, but it cannot authorize side effects.

## Why This Matters

This boundary avoids two bad extremes:

- over-restrictive prompt filtering that makes the model less intelligent;
- unsafe direct execution where model output becomes host authority.

Zavorth should feel like a capable agent because the LLM can still choose tools,
observe results and reason naturally. The harness serves the LLM by providing
memory, tools, sandboxing, approvals and receipts, while refusing to let text
alone become execution authority.

## Checks

Run the focused invariant check:

```bash
npm run effect-boundary:check
```

Run the TypeScript check:

```bash
npm run runtime:check
```

Focused tests live under:

- `tests/runtime/effects`
- `tests/tools/governance`
- `tests/security/EffectPolicyKernel.test.ts`
- `tests/runtime/agent/EffectBoundaryInvariants.test.ts`
- `tests/runtime/agent/EffectBoundaryRegression.test.ts`
