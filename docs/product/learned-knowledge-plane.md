# Learned Knowledge Plane (Zavorth-native)

Zavorth already has **four memory/learning engines** side by side. This plan
unifies them into one product surface without external brand names and without
throwing away Mnemos, session continuum, or the experience skill loop.

## One sentence

Zavorth remembers **workflows**, **conversations**, **who you are**, and
**project knowledge** — each in the right store, one recall path, one Control
hub.

## Why unify (not rebuild)

| Engine today | Role | Status |
| -------------------------------- | ----------------------------------------- | ---------------------------- |
| Experience skill learning loop | Multi-tool → skill drafts / promote | Ready |
| Session continuum + FTS tools | Chat turn capture / conversation recall | Ready (FTS when state DB on) |
| Mnemos Memory OS (wiki + FTS5) | Project facts, semantic/procedural layers | Ready |
| Mnemos file vault MCP | Optional local file index (Docker) | Ready when scoped |
| USER.md / FirstRun + UserModel\* | Profile / early dialectic services | Partial productization |
| Preference / spine learning | Governed prefs (separate plane) | Keep separate |

The gap is **composition + product UX + inject budget**, not greenfield engines.

## Product pillars (Control cards)

| Pillar | Product name | Backing engine | User question |
| ------ | ----------------------- | --------------------------------------- | -------------------------------------------- |
| **W** | **Workflows** | Experience skill learning loop | “How do we do this multi-step task again?” |
| **C** | **Conversation recall** | Session continuum + operational FTS | “What did we say last week about X?” |
| **Y** | **About you** | Profile + dialectic user model (native) | “Who am I to Zavorth?” |
| **K** | **Knowledge** | Mnemos wiki OS (+ optional file vault) | “What did we decide about the architecture?” |

Optional advanced: **File index** (MCP vault) under Knowledge → Advanced.

## Zavorth-native naming

| Avoid in product UI | Prefer |
| --------------------- | -------------------------------------------------------- |
| Hermes / Honcho | (never on product surface) |
| Dual Mnemos confusion | **Knowledge** (wiki) vs **File index** (MCP) |
| Two chat search tools | One agent tool: `conversation_recall` |
| Scattered CLIs only | Parent CLI: `zavorth knowledge …` _or_ hub under Control |

**Code names (suggested):**

| Component | Suggested id |
| ---------------------- | ---------------------------------------------------------------------------------- |
| Composition service | `LearnedKnowledgePlaneService` |
| Ranked pack for inject | `LearnedKnowledgePack` |
| Control sector | `learned-knowledge` |
| CLI | `zavorth knowledge status\|recall\|workflows\|about\|facts` |
| Agent tools | `use_learned_skill`, `conversation_recall`, `knowledge_recall` (wrap Mnemos query) |

Keep existing service class names where stable; add facades rather than mass renames.

## Architecture

```text
 ┌─────────────────────────────┐
 User / Agent ──► │ LearnedKnowledgePlaneService │
 │ query-all · store-rank · budget · tag │
 └──────────────┬──────────────┘
 ┌───────────┬───────────┼───────────┬───────────┐
 ▼ ▼ ▼ ▼ ▼
 Workflows Conversation About you Knowledge (File index)
 skill loop continuum user model Mnemos wiki MCP vault
 │ │ │ │ │
 └───────────┴───────────┴───────────┴───────────┘
 source-tagged snippets
 never silent auto-promote
```

**Hard rules (all phases):**

1. **Source of truth stays where it is** (drafts dir, continuum store, `.zavorth/wiki`, profile md).
2. **Derived indexes only** for FTS/search (Mnemos pattern).
3. **No silent durable write** without existing gates (preview/approve/receipt where Mnemos already requires it).
4. **Per-user / per-workspace scoping** on every pack entry.
5. **Token budget** on inject (hard cap; drop lowest-ranked first).
6. **Redact secrets** before store and before inject (same bar as learning loop).

---

## Freeze, inventory, naming — **DONE**

**Goal:** one shared language; no more dual-tool / dual-Mnemos confusion in docs.

### Steps

| # | Work | Status |
| --- | ------------------------------------------------------- | ---------------------------------------------- |
| 0.1 | Publish this doc; link from learning-loop + mnemos docs | Done |
| 0.2 | Inventory matrix (below) | Done |
| 0.3 | Tool alias debt (below) | Done |
| 0.4 | Glossary in EN | Done (this doc + `zavorth knowledge glossary`) |
| 0.5 | Feature flags | Done (`LearnedKnowledgeFlags`) |

### Inventory — continuum capture (2026-07)

| Surface | Append path | Notes |
| ----------------------------- | ---------------------------------------------------------------------- | ---------------------------- |
| AgentRun / gateway | `bootstrapFoundation` `onRunCompleted` → `sessionContinuum.appendTurn` | Primary structured path |
| ConversationalAgent free text | `captureConversationTurn` after reply | wire |
| CLI `mnemos session-append` | direct `appendMessage` | Manual |
| Telegram | session ledger (separate) + agent path when via gateway | Prefer agent completion path |
| Desktop | via agent/gateway when used | Same as AgentRun when wired |
| Control web chat | depends on AgentRun/ConversationalAgent | Same |

### Tool alias debt

| Tool name | Class | Product role |
| ------------------------- | -------------------------- | ----------------------------------------- |
| **`conversation_recall`** | `ConversationRecallTool` | **Preferred** |
| `session_search` | `SessionSearchFts5Tool` | Alias (modes discover/scroll/read/browse) |
| `session_search_fts5` | catalog id only | Alias debt — not a separate class name |
| `zavorth_session_search` | `ZavorthSessionSearchTool` | Alias / continuum-first |

### Feature flags

| Env | Default | Effect |
| ----------------------------------------- | ------- | ---------------------------- |
| `ZAVORTH_LEARNED_KNOWLEDGE` | on | Knowledge CLI / plane status |
| `ZAVORTH_CONTINUUM_CAPTURE` | on | Capture turns into continuum |
| `ZAVORTH_USER_MODEL` | off | About-you inject |
| `ZAVORTH_LEARNED_KNOWLEDGE_INJECT_TOKENS` | 1200 | Pack inject budget |

### Done when

- Operator can read one page and name the four pillars.
- Gap list (ingest holes, UI stubs) is explicit.

---

## Conversation continuum product path — **DONE**

**Goal:** every governed chat turn can be recalled; one agent-facing tool.

### Steps

| # | Work | Status |
| --- | ----------------------------------------------------------- | --------------------------------------------- |
| 1.1 | Wire ConversationalAgent + keep AgentRun capture | Done (`ConversationContinuumCapture`) |
| 1.2 | Operational DB FTS when `dbPath` set; else JSON store | Done (existing `ZavorthSessionRecallService`) |
| 1.3 | Tool **`conversation_recall`** preferred; aliases kept | Done |
| 1.4 | CLI `zavorth knowledge status\|recall\|glossary\|workflows` | Done (`KnowledgeCli`) |
| 1.5 | Redaction + max snippet | Done |
| 1.6 | Tests under honesty | Done |
| 1.7 | Health provider `conversation-continuum` | Done |

### Operator commands

```bash
zavorth knowledge status
zavorth knowledge recall "provider setup"
zavorth knowledge recall --browse
zavorth knowledge glossary
zavorth knowledge workflows # → zavorth learn
zavorth health # includes Conversation continuum
```

Agent tool: `conversation_recall` with `{ "query": "..." }`.

### Code entry points

| Piece | Path |
| ---------------- | ---------------------------------------------------------------- |
| Flags | `src/services/learned-knowledge/LearnedKnowledgeFlags.ts` |
| Capture / recall | `src/services/learned-knowledge/ConversationContinuumCapture.ts` |
| Tool | `src/tools/ConversationRecallTool.ts` |
| CLI | `src/cli/KnowledgeCli.ts` |
| Agent wire | `ConversationalAgent.chat` end-of-turn capture |
| AgentRun wire | `bootstrapFoundation` `onRunCompleted` |

---

## Knowledge (Mnemos) as first-class recall pillar — **DONE**

**Goal:** project facts stay Mnemos-owned; product surface is “Knowledge”, not a second memory island.

### Steps

| # | Work | Status |
| --- | ------------------------------------------------------------------- | ------ |
| 2.1 | Tool **`knowledge_recall`** → `ZavorthMnemosQueryService` | Done |
| 2.2 | CLI `zavorth knowledge facts <query>` | Done |
| 2.3 | Consolidate = dream + promotion **preview only** (no silent apply) | Done |
| 2.4 | Control Knowledge card → `/api/knowledge/facts` (+ bridge fallback) | Done |
| 2.5 | Control **Consolidate preview** button | Done |
| 2.6 | Honesty tests + health provider `knowledge-wiki` | Done |

### Operator commands

```bash
zavorth knowledge facts "provider readiness"
zavorth knowledge facts "architecture" --top-k 5 --budget 1200
zavorth knowledge consolidate # PREVIEW ONLY
zavorth knowledge status
```

Agent tool: `knowledge_recall` with `{ "query": "..." }`.

HTTP (loopback/local UI):

- `GET /api/knowledge/facts?query=…&topK=6`
- `GET /api/knowledge/consolidate`

### Code entry points

| Piece | Path |
| ------------ | -------------------------------------------------------- |
| Facts facade | `src/services/learned-knowledge/KnowledgeFactsRecall.ts` |
| Tool | `src/tools/KnowledgeRecallTool.ts` |
| CLI | `src/cli/KnowledgeCli.ts` (`facts`, `consolidate`) |
| API | `WebAppRuntimeStateRouteService` `/api/knowledge/*` |
| Control | `runtime-operations-panels.ts` Knowledge card |

### Mnemos integration rules

- Wiki + FTS remain source of truth for **project knowledge**.
- File vault MCP stays **advanced / consent-gated** (`plan_mnemos_scope` / `enable_mnemos`).
- Do not merge file vault vectors into wiki without explicit promote.
- Lifecycle / dream / promotion gate: **preview default**; apply needs approval id.

---

## About you (native user model) — **DONE**

**Goal:** durable, reviewable “who you are” without third-party branding.

### Steps

| # | Work | Status |
| --- | ------------------------------------------------------------------------ | ----------------------------------------- |
| 3.1 | `AboutYouSnapshot` merges USER.md, dialectic, learning profile, FirstRun | Done |
| 3.2 | Draft → approve / reject / forget (operator store) | Done |
| 3.3 | `propose-learning` from workflow stats (no silent apply) | Done |
| 3.4 | Control **About you** card + API | Done |
| 3.5 | Inject block when `ZAVORTH_USER_MODEL=1` | Done |
| 3.6 | Flag default **off** (multi-tenant safe) | Done |
| 3.7 | Honesty tests | Done |
| 3.8 | No Honcho branding on product surface | Done (plugin remains unused by About you) |

### Operator commands

```bash
zavorth knowledge about
zavorth knowledge about propose timezone=UTC
zavorth knowledge about approve <draft-id>
zavorth knowledge about reject <draft-id>
zavorth knowledge about forget <id|key>
zavorth knowledge about export
zavorth knowledge about propose-learning
```

HTTP: `GET/POST /api/knowledge/about?userId=…&action=…`

Inject: set `ZAVORTH_USER_MODEL=1` (ConversationalAgent appends confidence-tagged block).

### Code entry points

| Piece | Path |
| ------- | --------------------------------------------------- |
| Service | `src/services/learned-knowledge/AboutYouService.ts` |
| Flag | `ZAVORTH_USER_MODEL` in `LearnedKnowledgeFlags.ts` |
| CLI | `KnowledgeCli` `about *` |
| API | `/api/knowledge/about` |
| Control | `mem-node-about` in `runtime-operations-panels.ts` |
| Inject | `ConversationalAgent.appendProductRuntimeContext` |

### Done when

- User can open Control and see/edit what Zavorth believes about them.
- New chat gets a short About-you inject when enabled.

---

## Learned Knowledge composition (inject + rank) — **DONE**

**Goal:** one pack, four sources, hard token budget.

### Free-text purity (hard product rule)

| Path | Behavior |
| ----------------------------- | ------------------------------------------------------------------------------------- |
| Free text in chat | **Model + tools** own capability choice. Never keyword→feature. |
| Slash / CLI | Explicit and deterministic (`/knowledge pack`, `zavorth knowledge …`). |
| Pack pillar selection | **Always query all four pillars.** No phrase gates. |
| Pack hit ranking | **Store-native scores only** (draft reuse, continuum FTS, fact confidence, wiki RRF). |
| `scoreLearnedKnowledgeIntent` | Deprecated shim → `equalPillarWeights()` (equal 1s). Does **not** inspect free text. |
| Safety flag | `pack.safety.noKeywordIntentRouting === true` |

Keyword dictionaries for product features are **forbidden**. Retrieval may still use FTS/similarity inside each store (that is search, not feature routing).

### Steps

| # | Work | Status |
| --- | ------------------------------------------------------------ | ------ |
| 4.1 | `LearnedKnowledgePlaneService.buildPack` | Done |
| 4.2 | Equal pillar weights; no free-text keyword intent | Done |
| 4.3 | Hits: `{ pillar, sourceId, title, snippet, score, trust }` | Done |
| 4.4 | ConversationalAgent uses pack inject first (legacy fallback) | Done |
| 4.5 | `ZAVORTH_LEARNED_KNOWLEDGE_INJECT_TOKENS` (default 1200) | Done |
| 4.6 | Honesty tests for equal weights + pack + budget | Done |

### Operator commands

```bash
zavorth knowledge pack "what did we discuss about providers?"
zavorth knowledge pack "architecture decisions" --budget 800 --json
```

HTTP: `GET /api/knowledge/pack?query=…&userId=control&budget=1200`

Agent inject: automatic when `ZAVORTH_LEARNED_KNOWLEDGE=1` (default).

### Code entry points

| Piece | Path |
| -------------------- | ---------------------------------------------------------------------- |
| Pack service | `src/services/learned-knowledge/LearnedKnowledgePlaneService.ts` |
| Equal pillar weights | `equalPillarWeights` (deprecated alias: `scoreLearnedKnowledgeIntent`) |
| Inject helper | `buildLearnedKnowledgeInject` |
| Agent wire | `ConversationalAgent.appendProductRuntimeContext` |
| CLI | `zavorth knowledge pack` |

### Done when

- Similar multi-tool goal still gets workflow procedure (phase-6 loop behavior preserved).
- Chat history questions hit continuum snippets in the same pack.
- Token use stays under budget.
- Free-text phrasing never skews which pillars are queried.

---

## Control hub + CLI parent — **DONE**

**Goal:** one place to see everything Zavorth learned.

### Steps

| # | Work | Status |
| --- | ------------------------------------------------ | ---------------------------------------- |
| 5.1 | Control hub four cards (W/C/Y/K) | Done (`learned-knowledge-hub.ts`) |
| 5.2 | Hub supersedes orphan learning-loop badge | Done (legacy card hidden when hub loads) |
| 5.3 | CLI `zavorth knowledge status` uses hub snapshot | Done |
| 5.4 | Slash `/knowledge` (+ `/lk`) full verbs | Done |
| 5.5 | Desktop settings: four-card hub | Done |
| 5.6 | i18n EN + pt-BR hub strings | Done |

### Surfaces

| Surface | Entry |
| ------- | -------------------------------------------------------------- |
| Control | `#learned-knowledge-hub` · `GET /api/knowledge/hub` |
| Desktop | Settings → Learned knowledge cards |
| Chat | `/knowledge` · `/knowledge recall <q>` · `/knowledge pack <q>` |
| CLI | `zavorth knowledge status` |

### Done when

- New user finds all four pillars in &lt; 10 minutes without monorepo spelunking.

---

## Safety, multi-tenant, observability — **DONE**

**Goal:** ship-ready under real users.

### Steps

| # | Work | Status |
| --- | --------------------------------------------------------------- | ------ | ------ | ------------------- | ---- |
| 6.1 | Tenant path matrix (`resolveTenantPathMatrix` / `tenant`) | Done |
| 6.2 | Pillar-aware forget (`about` / `workflows`; chat/wiki governed) | Done |
| 6.3 | Health providers (workflows, continuum, about-you, knowledge) | Done |
| 6.4 | Telemetry `knowledge.hub | pack | inject | forget` without PII | Done |
| 6.5 | Inject wrap `<untrusted-learned-knowledge>` | Done |
| 6.6 | This security section + CLI runbook | Done |

### Tenant model

| Store | Scope |
| -------------------------- | ------------------------------------------------------------ |
| Workflow drafts / promoted | per `userId` under `data/runtime/learning/users/<id>/` |
| About you facts | per `userId` under `data/runtime/about-you/<id>/` |
| Conversation continuum | **workspace** file `data/runtime/mnemos-session-recall.json` |
| Knowledge wiki | **workspace** `.zavorth/wiki` |

### Forget matrix

```bash
zavorth knowledge forget about <id|key>
zavorth knowledge forget workflows <draft-id>
# conversation / knowledge: refused with governed alternatives
zavorth knowledge tenant
```

### Threat notes

- Recalled content is **untrusted**: pack inject is wrapped; tools document no tool authority.
- Secrets redacted on capture/recall/facts paths.
- Never silent-promote wiki or auto-install skills.
- Network-exposed Control APIs require session or loopback (existing gates).

### Done when

- Isolation tests green; health shows all four; forget works per pillar.

---

## Polish & optional advances — **DONE**

**Goal:** surface advanced Knowledge options + a cross-pillar “this week” story without new engines.

### Free-text purity + pack ranking (reaffirmed)

| Rule | Status |
| ------------------------------------------ | ------------------------------------------------------ |
| Free text never keyword-routes features | Enforced |
| Pack always queries all four pillars | Enforced |
| Hit ranking = **store-native scores only** | Enforced |
| Preference / spine learning | **Separate plane** — noted on Advanced + learning loop |

### Steps

| # | Work | Status |
| --- | --------------------------------------------------------------------------------- | ---------------------------- |
| 7.1 | Hub JSON `storyPreview` (cross-pillar this-week summary) | Done (`LearnedKnowledgeHub`) |
| 7.2 | Hub JSON `advanced` (file index · dream cycle · preference note) | Done |
| 7.3 | Control + Desktop hub render story + Advanced when present | Done |
| 7.4 | CLI `zavorth knowledge story` · `advanced` (+ status sections) | Done |
| 7.5 | Slash `/knowledge story` · `/knowledge advanced` | Done |
| 7.6 | File index remains Docker / consent-gated (`plan_mnemos_scope` → `enable_mnemos`) | Done (surface only) |
| 7.7 | Dream cycle from Knowledge: product preview + npm scheduler entry | Done (CLI paths) |
| 7.8 | Preference spine stays separate (note only) | Done |

### story timeline — UX completeness (Control / Desktop) — **DONE**

| # | Work | Status |
| --- | -------------------------------------------------------------- | --------------------------------------------------------------- |
| A.1 | Hub `storyPreview.events[]` full timeline (not summary-only) | Done |
| A.2 | Control + Desktop list events with pillar chip + time | Done |
| A.3 | Vault metrics: file/dir counts, lastModified, capped scan | Done |
| A.4 | Dream last-run receipt after consolidate preview | Done (`data/runtime/learned-knowledge/dream-last-preview.json`) |
| A.5 | Advanced UI: vault metrics + last run + 24h cadence hint | Done |
| A.6 | Knowledge story may include recent wiki page titles from index | Done |

### Package B — Demo ship (golden path + first-use) — **DONE**

| # | Work | Status |
| --- | ---------------------------------------------------------------------------- | ---------------------------------------------------- |
| B.1 | Hermetic golden path script (workflow → pack → story → hub → dream → forget) | Done |
| B.2 | npm `knowledge:golden-path` · `qa:zavorth-learned-knowledge-golden-path` | Done |
| B.3 | Structural check `knowledge:golden-path:check` | Done |
| B.4 | First-use doc ≤10 minutes | Done (`docs/product/learned-knowledge-first-use.md`) |
| B.5 | Demo Script D + HOW-TO-TEST-VALUE + first-use link | Done |

```bash
npm run knowledge:golden-path
npm run knowledge:golden-path:check
```

### Package C — Hardening purity — **DONE**

| # | Work | Status |
| --- | ------------------------------------------------------------------------- | ------------------------------------------------ |
| C.1 | Allowed/forbidden free-text purity matrix doc | Done (`docs/product/free-text-purity-matrix.md`) |
| C.2 | Static hygiene test (hot-path forbidden markers + invariants) | Done |
| C.3 | Runtime residuals honesty expanded (UX, pack, team, approvals) | Done |
| C.4 | Critical EN pass on free-text/approval product strings | Done |
| C.5 | npm `purity:hygiene` · `purity:package-c` · `qa:zavorth-free-text-purity` | Done |

```bash
npm run purity:package-c
```

### Operator commands

```bash
zavorth knowledge status # pillars + this week + advanced
zavorth knowledge story # cross-pillar summary
zavorth knowledge advanced # file index · dream · prefs note
zavorth knowledge consolidate # dream+promotion PREVIEW only
npm run mnemos:dream-cycle --silent # governed scheduler / cycle entry
```

Chat:

```text
/knowledge story
/knowledge advanced
/knowledge consolidate
```

HTTP (loopback/local UI):

- `GET /api/knowledge/hub?userId=…` → includes `storyPreview` + `advanced` when available
- `GET /api/knowledge/story?userId=…&days=7` → full cross-pillar timeline
- `GET /api/knowledge/advanced` → file index + dream cycle status

Agent tools (file index, consent path — not auto-enabled):

- `plan_mnemos_scope` → user confirm → `enable_mnemos`

### Code entry points

| Piece | Path |
| --------------- | ---------------------------------------------------------------- |
| Story service | `src/services/learned-knowledge/LearnedKnowledgeStoryService.ts` |
| Advanced status | `src/services/learned-knowledge/LearnedKnowledgeAdvanced.ts` |
| Hub fields | `src/services/learned-knowledge/LearnedKnowledgeHub.ts` |
| Control UI | `apps/zavorth-control-vite-shell/src/learned-knowledge-hub.ts` |
| Desktop UI | `apps/zavorth-desktop/src/panels/LlmRolesPanel.tsx` |
| CLI | `src/cli/KnowledgeCli.ts` (`story`, `advanced`) |
| Slash | `SharedSurfaceSlashEnhancementCommandPack` |
| APIs | `GET /api/knowledge/hub` · `/story` · `/advanced` |

### Done when

- Operator sees **This week** + **Advanced** under the hub without monorepo spelunking.
- Preference spine is never folded into Workflows or About you.
- File index remains opt-in; dream apply remains approval-gated.

---

## Recommended execution order

```text
[x] Experience skill loop (Workflows) — already shipped (phases 0–6 of that loop)
[x] milestone Freeze / glossary / flags
[x] milestone Conversation continuum product path
[x] milestone Knowledge (Mnemos) product path
[x] milestone About you
[x] milestone Composition pack + inject
[x] milestone Control hub + CLI parent
[x] milestone Safety / multi-tenant / observability
[x] milestone Polish (story + advanced surfaces)
```

Product plane 0–7 is implementable end-to-end.

---

## Victory criteria (product)

Mark the Learned Knowledge Plane “complete” only when **all** are true:

1. User can name the four pillars from the UI.
2. Multi-tool success still becomes a **Workflow** draft (existing loop).
3. “What did we discuss about X?” hits **Conversation recall** with real turns.
4. “What did we decide about X?” hits **Knowledge** (Mnemos wiki/FTS).
5. “What do you know about me?” hits **About you** with editable facts.
6. Inject is budgeted, redacted, source-tagged, and never auto-executes tools.
7. No third-party memory brand on product surfaces.

---

## Relation to previous “another product” discussion

| Idea | Maps to phase |
| ------------------------- | ---------------------------------------- |
| FTS5 / cross-session chat | ** ** (+ composition 4) |
| Dialectic user model | ** ** |
| Mnemos integration | ** ** (core) + file vault advanced |
| Unified hub | ** ** |
| Experience skills | **Already done** (Workflows pillar) |

---

## Changelog note template

```
learned-knowledge: <one-line change>
```

Example: `learned-knowledge: add LearnedKnowledgePlaneService pack inject`

---

## Next step when implementing

Learned knowledge plane capabilities are shipped. Follow-ups (optional): richer story event sources, live vault index metrics in Advanced, scheduler UI for dream cadence — still no free-text keyword routing and no preference-spine merge.
