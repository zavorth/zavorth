# Ecosystem Extension Packs

**Status:** SkillIR install/search/catalog/promote/selfmod/external-import/hot-path packs shipped (open-distribution hub cancelled)

**Goal:** Brand-agnostic skill/plugin/external-agent extensibility that can absorb packs from any URI, path, or user-configured catalog — with optional LLM only when the user asks — without hardcoding third-party product names in runtime code.  
**Non-goals:** npm vanity publish of the SDK as a prerequisite; free-text soft-ranking of product activation; silent remote install without consent.

**Principle (product surface):**

| Allowed                                                                       | Forbidden in product code/strings                   |
| ----------------------------------------------------------------------------- | --------------------------------------------------- |
| Generic sources: path, git, zip, tarball, npm, HTTPS registry JSON            | Named third-party agent brands as first-class enums |
| Shape-based parsers (`SKILL.md`, frontmatter, package layout)                 | `if (source === '<brand>')`                         |
| User-configured catalogs & trusted hosts                                      | Hardcoded hub URLs of other products                |
| LLM only for ranking/summarizing **closed candidate lists** when user opts in | LLM inventing installs or tool names                |

**Related existing systems:**

| Area              | Anchor                                                                            |
| ----------------- | --------------------------------------------------------------------------------- |
| Skill install     | `SkillInstallPipelineService`, `zavorth_skill_marketplace`                        |
| Intake / SKILL.md | `UniversalSkillIntakeService`, `SkillImportService`                               |
| Tool binds        | `SkillExecutorBindingService`                                                     |
| Source detect     | `SkillSourceDetector`                                                             |
| Trust             | `SkillTrustScoreService`, `SkillGitRegistry.assertTrustedGitSource`               |
| Plugin OS         | `PluginOsMarketplaceService`, `PluginUrlInstallService`, `create-zavorth-plugin`  |
| Self-mod          | `SelfModificationService` / command support                                       |
| External agents   | `ZavorthExternalAgentGatewayService`, onboarding CLI                              |
| Learning drafts   | experience skill learning loop (`docs/product/experience-skill-learning-loop.md`) |

Machine index: `config/ecosystem-extension-waves.json`.

---

## Pack map

| Pack id | Name                                  | Depends on  | Outcome                                                |
| ------ | ------------------------------------- | ----------- | ------------------------------------------------------ |
| **P** | Contracts & SkillIR                   | —           | Single intermediate representation + receipt schema    |
| **P** | Deterministic resolve & install binds | W0          | URI/path/query → preview/apply with complete toolBinds |
| **P** | Search & optional LLM rank            | W1          | Local + configured sources; LLM only opt-in            |
| **P** | Capability-miss loop                  | W1–W2       | Missing tool/capability → structured suggest → install |
| **P** | Remote catalogs (skills + plugins)    | W1          | User HTTPS catalogs, cache, signatures                 |
| **P** | Promote draft → skill → plugin        | W0–W1       | Learning loop closes into library/Plugin OS            |
| **P** | Plugin OS authoring & bridges         | W4          | Wizard, skill↔plugin, generic bridges                 |
| **P** | Self-mod multi-file + gates           | W5 optional | Safer powerful self-mod + promote                      |
| **P** | External agent capability import      | W0–W1       | Consent → SkillIR/bridge from declared tools           |
| **P** | Efficiency & hot-path                 | W1–W3       | Retrieval, bind cache, lean tool surface               |

Each wave below: **objective**, **shipped when**, **work items**, **files**, **tests**, **acceptance**, **risks**.

---

## W0 — Contracts & SkillIR (foundation)

### Objective

Define a **canonical intermediate representation** for any ingested pack so later waves never branch on brand names.

### Shipped when

- `SkillIR` (or rename consistent with existing contracts) is the only type installers hand to binders/runtime.
- Install receipts always embed `skillIrDigest`, `toolBinds[]`, `provenance`.
- Docs state brand-agnostic rules (this file + short pointer in `skills-universal-install.md`).

### Work items

1. **Contract** `src/contracts/skill/ZavorthSkillIrContract.ts`
   - Fields: `id`, `title`, `description`, `version?`, `procedureMarkdown`, `declaredTools[]`, `permissions[]`, `entrypoints?`, `files[]`, `provenance { uri, kind, digest, fetchedAt }`, `parserId` (shape id: `skill-md-v1` | `readme-tools-v1` | `package-json-skill-v1` | `opaque-guidance-v1`).
2. **Mapper API** `SkillIrNormalizerService`
   - Input: discovered tree (files map).
   - Output: `SkillIR` + warnings.
   - Prefer extracting existing logic from `UniversalSkillIntakeService` / `SkillImportService` rather than duplicating.
3. **Receipt schema bump** — extend `SkillInstallReceipt` / worker-mesh contract with `skillIr` snapshot (or digest + path to artifact).
4. **Golden fixtures** under `tests/fixtures/skill-ir/` for each `parserId` (synthetic files only).

### Primary files

- `src/contracts/skill/ZavorthSkillIrContract.ts` (new)
- `src/skills/SkillIrNormalizerService.ts` (new)
- `src/contracts/skill/ZavorthSkillWorkerMeshContract.ts` (extend)
- `src/services/SkillInstallPipelineService.ts` (emit IR)
- `docs/product/skills-universal-install.md` (link SkillIR)
- `docs/product/ecosystem-extension-waves.md` (this doc)

### Tests

- Unit: each parserId fixture → stable IR (snapshot or field asserts).
- No product string contains third-party agent brand names in new code paths.

### Acceptance

- [x] Installing a local `SKILL.md` pack produces IR with non-empty `declaredTools` when frontmatter lists tools.
- [x] Opaque folder without SKILL.md still yields `parserId: opaque-guidance-v1` guidance-only IR (not a hard fail if policy allows).
- [x] Contract version constant exported and used in receipts.

### Risks

- Over-normalizing breaks existing install tests — keep dual-write IR + legacy fields for one wave.

---

## W1 — Deterministic resolve, install, tool binds

### Objective

**Without LLM:** user/agent supplies source → detect → fetch → normalize → trust → apply → **complete toolBinds** on receipt.

### Shipped when

- Every successful install receipt has `toolBinds` with statuses `direct | aliased | gateway | unresolved` (never phantom names).
- Alias map expanded generically (filesystem/web/memory/browser/shell families).
- CLI + `zavorth_skill_marketplace` share one pipeline (already intended; enforce tests).

### Work items

1. Expand `SKILL_TOOL_ALIASES` / dynamic alias table from declared synonyms in IR (skill may declare `aliases:`).
2. After bind: optional **existence smoke** only for `OBSERVATION_SMOKE_TOOLS`.
3. Install receipt always lists unresolved tools with human-readable “guidance-only” flag.
4. CLI: `zavorth skill install <source> --consent` prints bind summary table.
5. Agent tool: `action=install` returns structured binds in JSON for the model.

### Primary files

- `src/services/SkillExecutorBindingService.ts`
- `src/services/SkillInstallPipelineService.ts`
- `src/tools/ZavorthSkillMarketplaceTool.ts`
- `src/cli/skills/*` (install/preview surface)
- `tests/services/SkillExecutorBindingService*.ts` / install pipeline tests

### Tests

- Pack declaring `search_query` binds to `web_search` (aliased).
- Unknown tool → `unresolved`, not invented registry name.
- Preview does not write; apply writes + receipt file under `data/runtime/skill-install-receipts/`.

### Acceptance

- [x] Bind report allows unresolved as guidance-only; secret-like paths remain risk-flagged.
- [x] Apply with consent materializes + receipt with full toolBinds / skillIrDigest (pipeline tests).

### Risks

- Over-eager aliases map to wrong tools — keep aliases conservative; prefer explicit skill frontmatter maps.

---

## W2 — Search (deterministic) + optional LLM rank

### Objective

Resolve **queries** without brand hubs: local index first; configured sources; LLM only if user opts in.

### Shipped when

- `zavorth skill search "<query>"` hits local library + install receipts + skill-sources paths **without network by default**.
- `--remote` or config-enabled sources use generic GitHub/npm/HTTPS search APIs with **user keywords**, not product topics hardcoded as brands.
- `--llm` / tool flag `useLlm=true` ranks a **closed list** of candidates only.

### Work items

1. **Local FTS index** (sqlite or existing FTS pattern) over installed skills + drafts: title, description, tools, tags.
2. **Source registry**: extend `config/skill-sources.json` schema for optional remote search adapters by **kind** (`github-topic`, `npm-keyword`, `https-catalog`) — values are user/config, not code constants of competitors.
3. Remove or relegate default topic/keyword that only finds `zavorth-skill` to “first-party bootstrap”; default empty remote = local only (honest).
4. **LlmSkillRankService**: prompt = candidates JSON + query; output ordered ids; soft-fail to deterministic order.
5. Marketplace tool actions: `search`, `search_remote`, `rank` (llm).

### Primary files

- `src/skills/marketplace/SkillBrowserService.ts`
- `src/skills/marketplace/SkillLocalRegistry.ts`
- `src/skills/SkillCatalogService.ts`
- `config/skill-sources.json`
- New: `src/services/SkillSearchIndexService.ts`, `src/services/LlmSkillRankService.ts`

### Tests

- Local search finds fixture skill by tool name without network.
- LLM rank mock returns reordered ids; disabled path never calls LLM.
- No new source of brand product names in source.

### Acceptance

- [x] Default search is offline-capable.
- [x] Optional `--llm` / `use_llm` re-ranks closed candidate ids only.
- [x] Remote is opt-in (`--remote`); GitHub query uses user keywords (no product hubs).

---

## W3 — Capability-miss loop

### Objective

When a run lacks a tool/capability, offer a **structured** path to install skill/plugin — never free-text product activation.

### Shipped when

- Structured miss signal (tool name missing / capability id / `plugin_suggest` empty exact-id) can produce an **InstallSuggestion** receipt.
- Agent tools: suggest → preview → (user consent) install.
- Desktop/CLI can show the same suggestion card.

### Work items

1. **CapabilityMissService**: input `{ missingTool?, missingCapability?, intentHint? }` → candidates from search index + plugin marketplace list (exact / IR tools / plugin capabilities).
2. Wire **hot-path guidance** in `AgentToolModelGuidance` / tool error paths: return suggestion payload, not only “tool not found”.
3. Integration with `PluginRecommendTool` / `plugin_suggest`: free-text intent uses **LLM or exact id only** (already purity rule); miss loop prefers **structured missingTool**.
4. Optional auto-preview (never auto-install).

### Primary files

- New: `src/services/CapabilityMissService.ts`
- `src/tools/PluginRecommendTool.ts`, plugin suggest path
- `src/services/AgentToolModelGuidance.ts`
- Runtime tool execution error enrichment (AgentRun tool loop)

### Tests

- Missing `web_search` with web-search plugin/skill installed candidate → suggestion points to enable/install, not silent fail.
- Free-text alone does not enable plugins (purity).

### Acceptance

- [x] Suggestion always includes `previewCommand` / tool action payload.
- [x] Install still requires consent.

**Shipped:** `CapabilityMissService` + `plugin_suggest` / `plugin_recommend` `missingTool` path + guidance.

---

## W4 — Remote catalogs (skills + plugins)

### Objective

User-configured HTTPS JSON catalogs for skills and Plugin OS packs — generic, cacheable, optional signatures.

### Shipped when

- `ZAVORTH_SKILL_CATALOG_URL` / skill-sources remote + existing `ZAVORTH_PLUGIN_MARKETPLACE_URL` work end-to-end with refresh + SSRF guards.
- Example catalog fixtures in-repo (not third-party brand hubs).
- Desktop/CLI can refresh and list.

### Work items

1. **Skill catalog schema** v1: `{ schemaVersion, entries: [{ id, name, summary, source, version, tags, digest? }] }`.
2. Reuse SSRF / HTTPS-only patterns from `PluginOsMarketplaceService`.
3. Cache under `.zavorth/cache/`.
4. `zavorth skill catalog refresh|list|show|install <id>`.
5. Document how to host a static JSON on any CDN/GitHub raw (generic).

### Primary files

- `config/plugin-os-marketplace.json` (align)
- New: `config/skill-catalog.example.json`
- `src/services/PluginOsMarketplaceService.ts`
- New: `src/services/SkillRemoteCatalogService.ts`
- `docs/plugin-os-marketplace.md`, `docs/product/skills-universal-install.md`

### Tests

- Mock HTTP catalog → list/install via `source` field.
- Reject localhost/private IPs.

### Acceptance

- [x] Fresh clone with no remote still works (local only).
- [x] With example catalog URL (fixture server in test), install works with consent.

**Shipped:** `SkillRemoteCatalogService`, `config/skill-catalog.example.json`, CLI `zavorth skill catalog *`, SSRF tests.

---

## W5 — Promote: draft → skill → plugin

### Objective

Close the learning loop: multi-tool success becomes reusable skill; optional Plugin OS pack.

### Shipped when

- `zavorth learn promote <id>` (or existing promote) writes a proper skill pack under `skills/` or library with SkillIR.
- `zavorth learn promote <id> --kind plugin` (or `plugins promote-from-skill`) scaffolds plugin via `create-zavorth-plugin` templates + capability from tools used.
- Receipts link draft id → skill id → plugin id.

### Work items

1. Map experience skill draft schema → SkillIR.
2. Promote CLI/tool actions.
3. Plugin scaffold from tool list (moduleKind inference: many tools → `tool`; network → permissions).
4. Desktop: button on learning / skills panel (if low cost).

### Primary files

- Experience skill learning services (under `src/services/` learning / skill drafts)
- `src/cli/LearningLoopCli.ts`
- `packages/create-zavorth-plugin` / `PluginScaffoldService`
- `docs/product/experience-skill-learning-loop.md`

### Tests

- Synthetic draft → promote → install path loads skill.
- Plugin promote creates valid `zavorth.plugin-os.v1` manifest.

### Acceptance

- [x] Promoted skill appears in local search (W2).
- [x] No auto-promote without user action.

**Shipped:** `SkillPromoteService` + `zavorth learn promote --kind skill|plugin|both`; receipts `draftId → skillId → pluginId`; SkillIR under `skills/` + plugin scaffold under `plugins/promoted/`.

---

## W6 — Plugin OS authoring & bridges

### Objective

Fastest path from zero to enabled capability; generic bridges for external tool surfaces.

### Shipped when

- One-shot: `zavorth plugins new <id> --kind <k> --enable --smoke` (scaffold + install + enable + harness).
- `moduleKind: bridge` template exposes generic HTTP/CLI/MCP invoke with permissions.
- Skill pack that declares missing capability can open plugin suggest (W3).

### Work items

1. CLI wizard end-to-end.
2. Bridge plugin template + docs (no brand names).
3. Align create-zavorth-plugin kinds with `PluginManifestContract`.
4. Optional: skill→plugin promote from W5 polished.

### Primary files

- `src/cli/plugins/*`
- `packages/create-zavorth-plugin`
- `plugins/examples/*`
- `docs/plugin-os.md`

### Tests

- Scaffold dry-run all kinds; harness register smoke.
- Bridge example soft-fails without endpoint.

### Acceptance

- [x] New contributor creates and enables a tool plugin in &lt; 5 CLI steps documented.
- [x] CI workflow `plugin-os-plugins.yml` still green (same harness path as `plugins new --smoke`).

**Shipped:** `plugins new --enable --smoke`, generic bridge template (HTTP/CLI/MCP soft-fail), `plugins promote-from-skill`, example-bridge + create-zavorth-plugin `--kind bridge`.

---

## W7 — Self-modification multi-file + gates

### Objective

Powerful self-mod without reckless free-text writes.

### Shipped when

- Multi-file preview under one `preview_id` with atomic rollback plan.
- Optional test gate: apply blocked unless configured check passes.
- Default allow paths: `skills/`, `plugins/`, `config/*sources*`, `docs/`; core `src/` requires BUILD + owner (policy config).
- Successful apply can offer promote to skill (W5).

### Work items

1. Extend `SelfModification*` plan model for multi-hunk multi-file.
2. Policy config file `config/selfmod-path-policy.json`.
3. Hook optional `validationCommands[]` on apply.
4. Receipt + diff storage.

### Primary files

- `src/services/SelfModificationService.ts`
- `src/services/selfmod-command/*`
- `docs/self-modification.md`

### Tests

- Multi-file preview apply rollback.
- Path outside policy blocked.
- Free-text chat does not apply without structured command.

### Acceptance

- [x] Documented golden path for “add skill pack files via selfmod”.
- [x] All applies leave receipts.

**Shipped:** `config/selfmod-path-policy.json`, `SelfModificationPathPolicyService`, multi-file `createMultiFilePreview` + atomic rollback, optional `validationCommands` apply gate, promote hint on skill/plugin paths.

---

## W8 — External agent capability import

### Objective

After consent, import **declared** tools/skills from an external runtime profile into SkillIR / bridge plugins — adapters by transport, not product name.

### Shipped when

- Adapters: `cli | http | acp | mcp` (extend as needed) expose `listCapabilities()` after registration approval.
- Import produces SkillIR guidance and/or bridge plugin stubs with permissions.
- Live invoke still per-call approval (existing gateway rules).

### Work items

1. Capability descriptor contract (generic).
2. `external-agent import-capabilities --id <profile> --consent`.
3. Map tools → SkillIR declaredTools + unresolved/gateway binds.
4. Desktop/control surface optional.

### Primary files

- `src/services/ZavorthExternalAgentGatewayService.ts` (and related)
- External agent CLI namespace
- `docs/external-agent-gateway.md`, `docs/external-agent-onboarding.md`

### Tests

- Mock adapter lists tools → import creates skill pack under library.
- No import without consent.
- No process execution during onboarding (existing invariant).

### Acceptance

- [x] Imported capabilities appear in skill search.
- [x] Invoke path unchanged: approval-gated.

**Shipped:** `ExternalAgentCapabilityImportService`, contract descriptors, CLI `list-capabilities` / `import-capabilities --consent`, SkillIR under `skills/external-*`, offline list (no process).

---

## W9 — Efficiency & hot-path

### Objective

Make skill/plugin extensibility **cheap at runtime**.

### Shipped when

- Installed SkillIR index loaded once per process (or invalidation on install).
- Bind results cached on receipt; hot path reads cache.
- Default tool exposure profile excludes bulk marketplace tools until miss/suggest.
- Background install job optional (preview sync / apply async) with notifications.

### Work items

1. Process-local SkillIR cache + file watch or install bus event.
2. Tighten `ToolExposurePolicy` / daily-ops profile defaults.
3. Metrics: install latency, bind unresolved rate, search latency.
4. Avoid re-clone when digest matches.

### Primary files

- Tool exposure / agent run factory
- Skill catalog/index services
- Observability hooks

### Tests

- Second search/install preview of same digest does not re-fetch (mock).
- Hot-path tool count reduced under daily-ops profile (assert max or exclusion list).

### Acceptance

- [x] Documented env flags for profiles.
- [x] No regression on purity (no free-text auto-enable).

**Shipped:** `SkillHotPathCacheService` (SkillIR + bind cache + digest short-circuit), leaner `daily-ops` (max 18, marketplace deferred → `plugin_suggest`), metrics counters.

---

## Cross-cutting rules (all waves)

1. **Purity:** free-text does not enable plugins/skills; structured consent / slash / tool args do.
2. **Brand-agnostic:** parsers by file shape; config by user URLs; no competitor enums.
3. **Receipts:** every install/import/apply/import-capabilities writes a receipt.
4. **Tests:** each pack adds unit + at least one integration/pipeline test; update ecosystem pack status in `config/ecosystem-extension-waves.json`.
5. **i18n:** new user-facing strings EN primary + existing locale fallback patterns.
6. **Security:** SSRF guards, secret scan on packs, trust profiles `safe|daily|power`.

---

## Suggested implementation order (teams)

```text
W0 → W1 → W2 → W3 → W4
              ↘ W5 → W6
W1 → W7 (can parallel after W0)
W0 → W8 (after W1 binds)
W3 + W1 → W9
```

**MVP for “open ecosystem consumer”:** W0 + W1 + W2 + W3 + W4.  
**MVP for “community author growth”:** MVP + W5 + W6.  
**MVP for “attach any local agent”:** MVP + W8.

---

## Definition of Done (program)

- [ ] User can install a skill from path, git HTTPS, zip, and catalog id with consent and full toolBinds.
- [ ] Search works offline; optional LLM rank is explicit.
- [ ] Capability miss suggests install without free-text product activation.
- [ ] Draft promote creates searchable skill.
- [ ] External profile can import capabilities into library after consent.
- [ ] No new hard-coded third-party agent product names in runtime.
- [ ] Wave status file updated to `shipped` per wave with date.

---

## Tracking

| Field                 | Location                                                       |
| --------------------- | -------------------------------------------------------------- |
| Pack status JSON      | `config/ecosystem-extension-waves.json`                        |
| This plan             | `docs/product/ecosystem-extension-waves.md`                    |
| Prior Plugin OS waves | `config/plugin-os-gap-waves.json` (orthogonal; do not regress) |
