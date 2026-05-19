# Mnemos Memory OS

This document records the phase 0/1 contract for the Mnemos cognitive memory upgrade.

## Scope

The first slice is intentionally non-destructive:

- define the official four-tier memory contract;
- define context compaction modes;
- add a pure `ContextCompactionService`;
- produce receipts that prove no provider call, durable memory mutation, or tool-authority change happened.

## Four Tiers

| Tier | Role |
| --- | --- |
| Working | Active gateway context and recent turns. |
| Episodic | Run summaries, receipts, failures, and timelines. |
| Semantic | `.zavorth/wiki` synthesized project facts and architecture decisions. |
| Procedural | Governed operator habits, preferences, and policy defaults. |

## Compaction Modes

| Mode | Trigger | Behavior |
| --- | --- | --- |
| Time-based microcompact | Session idle for 60 minutes or more. | Clears stale bulky tool output into small semantic labels. |
| Incremental anchored compaction | Estimated tokens exceed usable context minus reserved buffer. | Replaces older turns with a structured `<zavorth-session-summary>` and keeps recent turns verbatim. |
| Handoff envelope preview | Session/model migration or explicit resume request. | Reserved for phase 2. |

## Guarantees

- Compaction never grants tool authority.
- Compaction never stores raw secrets.
- Microcompaction never mutates durable memory.
- Recent user directives remain verbatim when anchored compaction runs.
- Durable wiki writes are deferred to later phases.

## Next

## Phase 2 Handoff Envelope

Phase 2 promotes the handoff envelope into a first-class preview service.

Command:

```bash
npm run zavorth:handoff-envelope
```

The generated envelope has nine governed sections:

1. Active Mandate
2. Current Architecture Decisions
3. Modified Paths
4. Tool Failure Log
5. Security Approvals Granted
6. Verbatim User Directives
7. Remaining TODO Checklist
8. Simulated State Preview
9. Next Prescribed Action

The envelope is preview-only by default. Persisting it as a real handoff artifact or injecting it into a resumed session requires explicit approval in a later phase.

## Phase 3 Wiki Baseline

Phase 3 initializes the visible semantic memory home:

- `.zavorth/SCHEMA.md`
- `.zavorth/wiki/index.json`
- `.zavorth/wiki/architecture.md`
- `.zavorth/wiki/dependencies.md`
- `.zavorth/wiki/memory.md`
- `.zavorth/wiki/operations.md`
- `.zavorth/wiki/providers.md`
- `.zavorth/wiki/skills.md`
- `.zavorth/raw/.gitkeep`

Command:

```bash
npm run zavorth:mnemos-wiki-baseline
```

This phase does not ingest new documents yet. It only creates the governed,
human-editable wiki structure that later phases will update, query and lint.

## Phase 4 Ingest

Phase 4 adds a governed ingest preview:

```bash
npm run mnemos:ingest
npm run mnemos:ingest -- docs/42-mnemos-memory-os.md
npm run mnemos:ingest -- --apply --approval-id <approval-id> docs/42-mnemos-memory-os.md
```

Default behavior is preview-only. The ingest service reads bounded local sources,
detects impacted wiki pages, and generates append-only source-note patches.
Applying the patches requires `--apply --approval-id <id>`.

Safety guarantees:

- paths are confined to the workspace;
- no provider call;
- no network call;
- source size is bounded;
- secret-like values are redacted;
- writes target `.zavorth/wiki/*.md` only.

## Phase 5 Query

Phase 5 adds local wiki query:

```bash
npm run mnemos:query -- "mnemos memory compaction"
npm run mnemos:query:json -- "provider readiness"
```

The query service ranks wiki pages with a deterministic hybrid strategy:

- keyword match;
- tag match;
- graph-neighbor boost;
- Reciprocal Rank Fusion style scoring.

Returned context is wrapped in `<untrusted_mnemos_wiki>` blocks before LLM use.

Safety guarantees:

- reads `.zavorth/wiki` only;
- top-k only;
- no provider call;
- no network call;
- no durable mutation;
- secret-like values are redacted;
- injected closing tags are escaped.

## Phase 6 Lint

Phase 6 adds local wiki lint:

```bash
npm run mnemos:lint
npm run mnemos:lint:json
```

The lint service checks the semantic wiki before it is trusted by the runtime:

- index integrity;
- page boundary under `.zavorth/wiki`;
- required page sections;
- broken source links;
- stale `updated_at` metadata;
- secret-like values;
- prompt-injection-like text;
- simple contradictory claims.

Safety guarantees:

- no provider call;
- no network call;
- no durable mutation;
- wiki-root-only page validation;
- critical findings require operator decision;
- finding text is redacted before output.

Next: Phase 7 should add procedural memory so approved operator habits,
recurring preferences and policy decisions become explicit, reviewable rules
instead of hidden conversational assumptions.

## Phase 7 Procedural Memory

Phase 7 adds governed procedural rules:

```bash
npm run mnemos:procedural
npm run mnemos:procedural -- preview --text "Prefiro PR preview antes de push"
npm run mnemos:procedural -- apply --approval-id <approval-id> --text "Prefiro PR preview antes de push"
npm run mnemos:procedural -- query "PR preview"
npm run mnemos:procedural -- revoke --id <rule-id> --approval-id <approval-id>
```

Procedural memory stores reviewable operating habits, not secrets:

- approval policy;
- workflow preference;
- provider preference;
- safety boundary;
- communication preference;
- general procedure.

Safety guarantees:

- preview is the default posture;
- durable writes require approval;
- revocation also requires approval;
- raw secret-like values are blocked;
- no provider call;
- no network call;
- every write has a receipt and a stable rule id.

## Phase 8 Memory UX

Phase 8 exposes Mnemos controls across operator surfaces:

```bash
npm run mnemos:ux
npm run mnemos:ux:json
zavorth memory mnemos
zavorth memory procedural list
zavorth memory procedural preview "Prefiro PR preview antes de push"
```

Telegram gets a governed command:

```text
/mnemos
/mnemos procedural
/mnemos query <texto>
/mnemos revoke <rule-id>
```

The dashboard Home shows a compact Mnemos Memory panel with:

- Memory Health;
- Procedural Rules;
- Wiki Query.

Safety guarantees:

- dashboard remains read-only for memory writes;
- CLI writes require approval;
- Telegram writes require approval;
- raw JSON is hidden by default;
- no provider call;
- no network call;
- no durable mutation by the UX snapshot itself.

Next: Phase 9 should add final certification/security for the whole Mnemos
Memory OS: compaction, handoff, wiki, ingest, query, lint, procedural memory
and cross-surface UX in one command.

## Phase 9 Certification

Phase 9 closes the Mnemos Memory OS with one certification command:

```bash
npm run mnemos:certify
npm run mnemos:certify:json
npm run mnemos:certify:check
```

The certification covers:

- context compaction;
- handoff envelope;
- wiki baseline;
- ingest;
- query;
- lint;
- procedural memory;
- Dashboard/CLI/Telegram UX;
- dashboard Home integration;
- secret scan;
- runtime TypeScript check;
- product-native identity hygiene.

Safety guarantees:

- local checks only;
- no provider call;
- no network call;
- no durable mutation;
- secrets scan included;
- identity hygiene checked.

Mnemos Memory OS is considered certified only when every listed gate passes.
