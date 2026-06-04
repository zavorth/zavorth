# Adaptive Learning OS

Zavorth Adaptive Learning OS turns memory, user modeling, procedural learning and skill evolution into one governed loop. It is designed to keep Zavorth adaptive in daily use while making durable behavior inspectable, reversible and approval-bound.

Internal contracts, lane names and receipts stay in English for runtime consistency. User observations are not assumed to be English: classification normalizes accents, punctuation and common separators, then applies multilingual safety terms for sensitive user-state and policy-changing requests. Unknown or sensitive-looking content should fall toward Yellow or Red rather than being silently learned.

## Governed Learning Layers

Zavorth implements adaptive learning primitives as native, governed surfaces with lane policy and receipts:

- Static/operator i18n: operator-facing Adaptive Learning OS reports render through a catalog with locale fallback. Runtime contracts stay English, while user-visible text can be localized.
- Technical scanner: prompt-injection, secret-like values, security-policy changes and sensitive user-state hints are scanned before semantic learning. Technical blocks cannot be downgraded by a semantic classifier.
- Governed semantic classifier: the default local classifier handles common low-risk preferences and workflow patterns. An LLM-gated semantic provider can be injected for arbitrary languages such as Chinese, Russian, Thai, German, Portuguese, Spanish and others; it receives only redacted text, must return strict JSON, and its output is still constrained by Green, Yellow and Red lanes.
- Multilingual recall: learned preferences are searched through original and expanded query aliases, remain top-k only, and are always marked as untrusted memory on recall.

This is stricter than a pure memory-provider model: semantic learning may explain meaning in any user language, but durable behavior still needs evidence, redaction, reversibility and lane policy.

The LLM gate is optional and disabled unless a caller injects a provider. When enabled, Zavorth calls it only when local classification is uncertain; high-confidence local low-risk preferences stay local. Weak Green Lane responses from the provider are downgraded to Yellow digest review, and malformed or timed-out provider responses fall back to conservative local classification.

## Lanes

- Green Lane: low-risk, reversible learning can run quietly with receipts. This is for normal preferences such as answer style, language, planning depth and recall hints.
- Yellow Lane: drafts and candidates are staged for digest review. This is for procedures, shadow skills, skill improvements, nudges and reusable workflow patterns.
- Red Lane: sensitive or authority-changing learning requires explicit approval. Psychological inferences, security-policy changes, provider/channel changes, secrets, external sends and host mutation never run silently.

## User Model

The user model is evidence-bound. Every claim stores a claim, evidence references, confidence, sensitivity, expiry, allowed use and editable status. Zavorth should not store raw psychological diagnosis as a durable belief. Sensitive user-state inferences stay review-only and safety-scoped unless the user explicitly approves a safer formulation.

## Shadow Skills

Auto skills start as drafts. The loop can synthesize a shadow skill candidate from repeated successful workflows, but installation stays blocked until sandbox validation, preview and approval. A matching procedure draft is also produced so the user can choose a lighter procedural memory instead of a full skill.

Snapshots redact token-shaped and credential-shaped content before returning shadow skill intents, procedure summaries or operator JSON. The native learning loop embeds the Adaptive Learning OS snapshot in preview mode, so existing native-learning surfaces can show lane classification without writing Green Lane memory during inspection.

Technical scanner findings run before semantic classification. Prompt injection, raw secrets and security-policy changes block silent learning. Secret-bearing workflow observations may still produce redacted Yellow Lane drafts, but never raw values or automatic promotion.

## Operator Commands

- `npm run zavorth:adaptive-learning-os`
- `npm run zavorth:adaptive-learning-os:json`
- `npm run zavorth:adaptive-learning-os -- --observe "The user prefers direct Portuguese answers with evidence."`
- `npm run zavorth:adaptive-learning-os:check --silent`

## Invariants

- Local-only learning.
- No external I/O during snapshot or observation ingest.
- No workspace mutation during snapshot or observation ingest.
- Sensitive inferences need approval.
- Security-policy learning is blocked.
- Green Lane is limited to low-risk reversible memory.
- Durable behavior changes require approval.
- Technical scanner is active before semantic learning.
- Semantic classifier is governed by lanes and cannot override technical blocks.
- LLM-gated semantic classification receives redacted input, requires JSON, and downgrades weak Green decisions.
- Multilingual recall is local-only, top-k and untrusted.
- Operator i18n uses deterministic catalogs with English fallback.
