# Changelog

All notable changes to Zavorth will be documented in this file.

## [Unreleased]

### learned-knowledge

- Learned Knowledge Plane flags, glossary, continuum inventory
- Conversation continuum capture on ConversationalAgent + AgentRun; tool `conversation_recall`
- CLI `zavorth knowledge status|recall|glossary|workflows`; health provider `conversation-continuum`
- Aliases `session_search` / `zavorth_session_search` retained; prefer `conversation_recall`
- Knowledge pillar — tool `knowledge_recall`, CLI `facts`/`consolidate` (preview-only), `/api/knowledge/*`, Control Knowledge card
- Health provider `knowledge-wiki`; promotion gate never silent-applies
- About you — `AboutYouService` snapshot, draft→approve store, CLI/API/Control, inject via `ZAVORTH_USER_MODEL=1`
- `LearnedKnowledgePlaneService` ranked pack + budgeted inject; CLI `knowledge pack`; API `/api/knowledge/pack`
- Learned Knowledge hub (4 cards) Control + Desktop; slash `/knowledge`; API `/api/knowledge/hub`; pt-BR i18n
- tenant path matrix, pillar forget, untrusted inject wrap, no-PII telemetry (`knowledge.*`)

### learning-loop

- Experience skill learning loop: multi-tool success → local skill drafts, reuse improves drafts, optional LLM procedure compact
- Feature flag `ZAVORTH_SKILL_LEARN_LOOP=0` disables drafts/nudges/inject without removing code
- CLI `zavorth learn` / `zavorth learning-loop`; chat `/learn`; smoke `npm run learning-loop:smoke`
- Isolated entry `src/services/experience-skill-learning/` for fast PR iteration
- learning-loop: i18n nudges (en/pt), reuse “N times” copy, rich status (promoted/top tools/last trigger), telemetry events, UI badge “N workflows learned”
- learning-loop: conservative defaults — no auto-install; `promote --dry-run` / `previewPromote` show destinations + SKILL.md preview without writing
- learning-loop: nudge cooldown on status (`ZAVORTH_SKILL_LEARN_NUDGE_COOLDOWN_MS`, default 15 min); home/status separates experience skill drafts (light plane) from preference/spine learning
- learning-loop: CLI/slash help + tips for forget, dry-run promote, and light-plane UX
- learning-loop: runtime recall — reuse score (`useCount`, `successCount`, `lastUsedAt`), score-sorted inject, full Procedure for similar goals
- learning-loop: promote writes `manifest.json` + optional `promoted-catalog.json` for SkillLoader discovery
- learning-loop: weekly metrics (draftsCreated / promotes / reuses) on status; `/learn run <id>` and CLI `run` surface governed procedure without tool execution
- learning-loop: cross-draft `search` (token FTS over title/tools/body) + light `buildUserLearningProfile` for agent inject

## [2.0.0] - 2026-06-22

### Added — Agent Configuration (P0-P12)

- **Knowledge Injection** (`KNOWLEDGE.md` + `KnowledgeInjectionService`) — attach reference materials to agent context
- **Behavioral Rules** (`RULES.md` + `BehavioralRulesService`) — pattern-matched rules with severity levels (strict/prefer/suggest)
- **Tool Usage Policies** (`TOOL-POLICY.md` + `ToolPolicyService`) — fine-grained permissions (allow/ask/deny)
- **Domain Specialization** (`DOMAIN.md` + `DomainSpecializationService`) — 11 domains with intent-based resolution
- **Proactivity Policies** (`PROACTIVITY.md` + `ProactivityPolicyService`) — proactive behavior with quiet hours and severity
- **Error Handling Strategies** (`ERROR-HANDLING.md` + `ErrorHandlingService`) — per-category error recovery
- **Output Format Preferences** (`OUTPUT-FORMAT.md` + `OutputFormatService`) — response formatting per context
- **Workflow Templates** (`WORKFLOWS.md` + `WorkflowTemplateService`) — recurring task templates
- **Multi-Modal Preferences** (`MULTI-MODAL.md` + `MultiModalPreferencesService`) — modality usage preferences
- **Team Context** (`TEAM-CONTEXT.md` + `TeamContextService`) — team collaboration settings
- **Learning Style** (`LEARNING-STYLE.md` + `LearningStyleService`) — learning and explanation preferences
- **Time/Automation** (`TIME-AUTOMATION.md` + `TimeAutomationService`) — working hours and schedule

### Added — Setup Flow Improvements

- 4 new conditional setup questions (domain, learning-style, timezone, weekend-policy)
- Questions visibility-gated by experience profile (personal/creator see 8, developer sees 11, business/power see 12)
- CLI flags: `--domain`, `--learning-style`, `--timezone`, `--weekend-policy`

### Added — Trajectory Generation

- `ZavorthTrajectoryCaptureService` — real-time turn capture with tool stats and reasoning coverage
- `ZavorthBatchRunnerService` — parallel prompt processing with configurable concurrency
- Enhanced `ZavorthTrajectoryExportContract` with capture types
- CLI: `scripts/zavorth-trajectory.ts` with `--format`, `--batch`, `--stats`, `--export-path`
- Supports jsonl, sharegpt, alpaca formats with secret redaction

### Added — Skill Marketplace

- `ZavorthSkillMarketplaceService` — search, install, rate skills from `skill-library/native/`
- `config/marketplace-index.json` — 8 categories (dev, research, productivity, media, security, devops, communication, data)
- CLI: `scripts/zavorth-marketplace.ts` with list/search/install/info/rate/stats commands
- 6 tests passing

### Added — Brand

- Mascot "Kael" the fox — named, personality defined, brand guide created
- `docs/brand-guide.md` — visual identity, voice, colors, logo usage
- README rewritten with accessible language, comparison table, daily flow diagram

### Fixed

- PT→EN string assertions in 5 agent runtime tests (AgentRunServiceTrustSlider, AgentRunServiceUniversalIntentTrust, CoreMessageToolReconciliation, RunBudgetPolicy, ToolExposurePolicy)
- 10 pre-existing test failures (StateMachine, IntentRouter, GovernedReview, FabricCanary, SharedSurface x5, WebAppSurfaceRoute, SharedSurface.access)
- Race condition in `ZavorthBatchRunnerService` concurrent worker cursor
- Security: `persistToProjectDir` now requires approvalId
- Removed dead `escapeRegExp` functions from trajectory services

### Changed

- License: Proprietary → MIT
- Version: 1.1.0 → 2.0.0
- README: Technical manual → Accessible product page

## [1.1.0] - 2026-06-19

### Added

- Telegram controllers PT→EN migration with LLM intent classifier (Gemini)
- SQLCipher key rotation and unified coverage reports
