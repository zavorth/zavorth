# Plugin OS — Gap closure waves (capability gaps → Zavorth superiority)

**Goal:** close the comparison gaps (API surface, bundled packs, ecosystem)
**without** throwing away Zavorth advantages (trust, sandbox, receipts, desktop,
typed hooks, MCP bridge).

**Principle:** packaging/ecosystem **is** product. Swappable providers, channels,
and media packs make the agent installable, demable, and extensible by third
parties. Waves ship both **API** and **real first-party packages**.

Status file (machine-readable): `config/plugin-os-gap-waves.json`

---

## North star (what "superamos de vez" means)

| Dimension | Market baseline | Zavorth target |
|-----------|-----------------|----------------|
| Registration API | Many specialized `register_*` | **Same specialty +** trust/permission + receipts |
| Bundled packs | ~50 provider/channel/media/… | **First-party packs** for every major agent category that matters to agents + daily ops |
| Security | Basic | Keep **advanced** (signature, sandbox, approval) |
| Hooks | ~8 | Keep **27 typed events** |
| Desktop / observability | Weak | Keep **marketplace + telemetry + receipts** |
| Ecosystem | pip + community atlas | **npm SDK + remote marketplace + forge + recommend** |

"Done" is not a matching directory count. "Done" is: every red row on the old
comparison tables maps to either a **Plugin OS package** or a **documented core
bridge plugin** that is enable/disable/receipt-aware.

---

## Architecture rule (all waves)

```
Specialized register_*  →  typed binding  →  capability handler
                        â†˜  wire plan / metrics / receipts
Core systems (Telegram, OpenAI, …) stay authoritative when present;
plugins wrap or soft-fail — never dual-source secrets.
```

- Soft-fail always.
- No secret values in outputs.
- Optional integrations stay `optionalIds` in onboarding.
- MCP remains the infinite extension bus; packs are **opinionated defaults**.

---

## Wave map

| Wave | Name | Outcome | Depends on |
|------|------|---------|------------|
| **0** | Surface parity | specialized `register_*` on Plugin OS ctx; docs + wave tracker | — **SHIPPED** |
| **1** | Provider pack | First-party LLM provider plugins (OpenAI-compatible, Anthropic, xAI, Gemini soft) | W0 **SHIPPED** |
| **2** | Platform pack | Channel plugins wrapping core Telegram/Discord/WhatsApp + generic webhook | W0 **SHIPPED** |
| **3** | Memory pack | Extra memory backends (mem0 soft, vector-local, file-journal) + Honcho polish | W0 **SHIPPED** |
| **4** | Media pack | image / vision / tts / transcription / video soft providers | W0 **SHIPPED** |
| **5** | Browser & search pack | browserbase/firecrawl-style soft + multi search backends as plugins | W0 **SHIPPED** |
| **6** | Trust fabric pack | secret-source, dashboard-auth, context-engine bridge, middleware patterns | W0 **SHIPPED** |
| **7** | Lifestyle & demos | Spotify soft + showcase skills (optional tier) | W0â€“W4 **SHIPPED** |
| **8** | Ecosystem surpass | Remote signed marketplace defaults, community templates, atlas-style catalog, SDK publish ritual | W0â€“W7 **SHIPPED** |

Daily Ops pack (doctor, task-board, pr-ship, ci-watch, secrets-guardian,
session-recall, notify-outbox) is **already shipped** and stays baseline for all waves.

---

## Wave 0 — Surface parity (foundation)

### Deliverables

1. Extend `ZavorthPluginRegistrationContext` with specialized registrars:
   - `registerPlatform` → channel
   - `registerProvider` alias / ensure parity naming
   - `registerWebSearchProvider`
   - `registerBrowserProvider`
   - `registerImageGenProvider`
   - `registerVideoGenProvider`
   - `registerTtsProvider`
   - `registerTranscriptionProvider`
   - `registerSecretSource`
   - `registerDashboardAuthProvider`
   - `registerContextEngine`
   - `registerMiddleware` (hook faÃ§ade)
   - `registerSkill`
   - `registerCliCommand`
   - `registerAuxiliaryTask`
   - `registerSlackActionHandler`
2. Wire in `PluginLoadService` + normalize helpers.
3. Expand `moduleKind` allowlists so `media` / `voice` / etc. bind cleanly.
4. Track specialized bindings on wire plan / observability.
5. Tests: each registrar binds a declared capability and soft-rejects bad input.
6. This document + `config/plugin-os-gap-waves.json`.

### Exit criteria

- Comparison table row "API de registro" is no longer "specialized-only elsewhere".
- Existing plugins keep working unchanged.
- `qa:plugin-os` green.

---

## Wave 1 — Provider pack

### Packages (first-party, soft-fail)

| id | Role |
|----|------|
| `provider-openai-compatible` | OpenAI / local / OpenRouter-style base URL + key |
| `provider-anthropic` | Anthropic Messages API soft |
| `provider-xai` | xAI/Grok soft |
| `provider-gemini` | Google Gemini soft |
| `provider-status` | Aggregate doctor for all provider plugins |

### Capabilities (pattern)

- `provider.<id>.status` — key presence, never values
- `provider.<id>.complete` — soft HTTP complete when key+network allowed
- `provider.<id>.models` — list or static catalog

### Exit criteria

- Onboarding profile `providers` enables the pack.
- Agent can recommend "which provider plugin" via router tags.
- Table row "Provider plugins embutidos" flips to âœ… (with honesty: core may still own default routing).

---

## Wave 2 — Platform pack

### Packages

| id | Role |
|----|------|
| `platform-telegram` | Bridge status/send via core gateway soft |
| `platform-discord` | Same |
| `platform-whatsapp` | Same |
| `platform-webhook` | Generic inbound/outbound webhook channel |
| `platform-matrix` (stretch) | Soft Matrix client |

Reuse `notify-outbox` for outbound team alerts.

### Exit criteria

- "Platform plugins embutidos" âœ… as Plugin OS packages (core remains runtime).
- Desktop marketplace shows channel pack with trust badges.

---

## Wave 3 — Memory pack

### Packages

| id | Role |
|----|------|
| `memory-local` | Already shipped — polish |
| `memory-honcho` | Already shipped — deepen soft status |
| `memory-file-journal` | Append-only JSONL journal |
| `memory-vector-local` | Optional local embeddings soft (no deps crash) |
| `memory-mem0` | Soft HTTP to mem0 if configured |

### Exit criteria

- ≥4 memory first-party backends.
- `session-recall` indexes all of them.

---

## Wave 4 — Media pack

### Packages

| id | Role |
|----|------|
| `media-image-gen` | Soft OpenAI/xAI/local image gen |
| `media-vision` | Describe image via provider soft |
| `media-tts` | TTS soft |
| `media-transcription` | STT soft |
| `media-video-gen` | Soft stub + setup tips (optional tier) |

### Exit criteria

- Multimodal agent paths no longer dead-end with "no tool".
- Optional by default (heavy keys / cost).

---

## Wave 5 — Browser & search pack

### Packages

| id | Role |
|----|------|
| `web-search` | Already shipped — multi-backend polish |
| `browser-playwright` | Already shipped — polish |
| `browser-cdp` | Soft CDP attach |
| `search-exa` | Dedicated Exa package (or keep under web-search) |
| `search-firecrawl` | Extract/crawl soft |

### Exit criteria

- Browser/search comparison rows âœ… with multiple backends.

---

## Wave 6 — Trust fabric pack

### Packages

| id | Role |
|----|------|
| `secret-source-env` | Read allowlisted env names only |
| `secret-source-file` | Workspace secret file with permission |
| `dashboard-auth-basic` | Local basic-auth provider for control plane |
| `dashboard-auth-token` | Bearer token provider |
| `context-engine-bridge` | Expose core context engine ops as capabilities |
| `middleware-rate-limit` | Hook-based soft rate limit example |

### Exit criteria

- Dashboard auth / secret source / context engine rows âœ… as plugins.
- Still stricter than typical agent platforms (permissions + receipts).

---

## Wave 7 — Lifestyle & demos (optional tier)

| id | Role |
|----|------|
| `spotify-soft` | Soft Spotify Web API status/playback if token |
| `demo-showcase` | Single plugin exercising all register_* APIs |

Not required for coding-agent superiority; required for **literal** table wipe.

---

## Wave 8 — Ecosystem surpass

1. Default remote marketplace URL + signed pack format.
2. `create-zavorth-plugin` templates per moduleKind.
3. Public "Atlas" page generated from curated JSON (ids, tags, trust).
4. SDK version bump + publish checklist automation.
5. Agent tools: `plugin_suggest` knows every wave pack + install CTA.
6. Onboarding profiles: `daily-ops`, `providers`, `platforms`, `media`, `full`.

### Exit criteria

- Ecosystem row no longer "Novo / 6 exemplos".
- Third-party can ship a signed provider plugin without monorepo access.

---

## Execution order (recommended calendar)

| Sprint | Waves | Focus |
|--------|-------|-------|
| S0 | W0 | API + tracker (this change) |
| S1 | W1 | Provider pack |
| S2 | W2 + W3 | Platforms + memory |
| S3 | W4 + W5 | Media + browser/search polish |
| S4 | W6 | Trust fabric |
| S5 | W7 optional + W8 | Demos + ecosystem surpass |

Parallelism: W1 âˆ¥ early W3 after W0; W4 after provider soft-complete patterns exist.

---

## Acceptance checklist (global)

- [ ] Old image #1 specialties all green on Zavorth column (or super-set)
- [ ] Old image #2 rows either âœ… plugin or âœ… documented core-bridge plugin
- [ ] Old image #3 "plugins reais" count ≥ major agent categories covered, not "6 examples"
- [ ] Security/DX/Desktop/Observability advantages retained
- [ ] `npm run qa:plugin-os` green
- [ ] No competitor-named comments in product surface

---

## Anti-goals

- Do not delete core Telegram/Discord/OpenAI and replace only with plugins on day one — **bridge first**.
- Do not ship 50 empty stub folders without capabilities.
- Do not weaken sandbox to chase directory count.

---

## Related docs

- [plugin-os.md](./plugin-os.md)
- [plugin-os-daily-ops-pack.md](./plugin-os-daily-ops-pack.md)
- Config: `config/plugin-os-gap-waves.json`, `config/plugin-marketplace-curated.json`
