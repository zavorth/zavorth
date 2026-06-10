# Zavorth Native Curated Shortlist

This directory intentionally contains owner-curated Zavorth-native skill prompts.
Bulk third-party imports must not be committed here. Stage raw imports in a review-only area,
keep them disabled, and promote only small audited skills into this folder.

Runtime policy:

- Source: `zavorth-native`
- Trust: `review`
- Enabled by default: `false`
- Allowlist mode: `none`

Curation rules:

- Keep one `SKILL.md` plus optional small metadata per skill.
- Do not commit assets, fixtures, baselines, vendored docs, dependency folders, or generated bulk files.
- Do not commit real credentials or secrets. Examples must use placeholders or environment variables.
- Do not keep duplicate suffix variants such as `-1`, `-2`, or `-3`; merge or reject duplicates.
- Keep every skill product-owned, small, readable, and explicit about approval boundaries.

Current Zavorth-native promoted skills:

- `agent-orchestrator`: Choose and sequence skills or registered subagents.
- `channel-response-design`: Shape channel-aware responses and fallbacks.
- `code-review`: Review code for regressions, tests, behavior, and maintainability.
- `dashboard-ops`: Translate runtime state into dense dashboard surfaces.
- `document-analysis`: Extract evidence, structure, risks, and actions from documents.
- `incident-triage`: Triage degraded behavior, incidents, alerts, and recovery steps.
- `large-skill-absorption`: Safely absorb oversized or untrusted skill libraries.
- `memory-curator`: Decide what to remember, redact, retain, or forget.
- `prompt-injection-defense`: Isolate untrusted instructions and defend prompt surfaces.
- `provider-doctor`: Diagnose provider, model, credential, rate-limit, and routing readiness.
- `repo-map`: Map repository structure, entrypoints, ownership, and risk areas.
- `security-audit`: Review runtime, policies, prompts, channels, tools, and code for risk.
- `task-planning`: Break goals into plans, acceptance criteria, and checkpoints.
- `user-onboarding`: Guide first-run setup, safe defaults, and recovery paths.
- `web-research-governed`: Plan and synthesize web research safely with attribution.
- `zavorth-browser-operator`: Browser and local UI verification.
- `zavorth-communication-control`: Controlled drafting, routing, and channel communication.
- `zavorth-conversation-review`: Turn approved user feedback and chat history into improvements.
- `zavorth-data-analysis`: Reproducible analysis for structured data, logs, and metrics.
- `zavorth-dev-workbench`: Code inspection, patching, testing, and developer workflow.
- `zavorth-file-document-understanding`: Safe reading and explanation of approved files and documents.
- `zavorth-media-generation-review`: Review and safety checks for media generation requests.
- `zavorth-model-routing`: Connect model/provider selection and effort to real runtime policy.
- `zavorth-ops-runtime`: Runtime, provider, service, and local readiness diagnostics.
- `zavorth-research-synthesis`: Evidence-backed research summaries with uncertainty.
- `zavorth-security-review`: Security review for code, configs, skills, and agent surfaces.
- `zavorth-subagent-development`: Coordinate registered subagents with staged review.
- `zavorth-taskflow`: Coordinate durable, resumable jobs with waits and receipts.
- `zavorth-transaction-safe-finance`: Approval-gated previews and simulations for transactional finance workflows.
- `zavorth-workspace-scope`: Enforce selected project folder or chat-only scope.
