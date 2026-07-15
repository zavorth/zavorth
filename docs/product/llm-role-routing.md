# LLM roles (default / strong / background)

## Roles

| Role         | Purpose                                                       |
| ------------ | ------------------------------------------------------------- |
| `default`    | Daily free-text and normal tool loops                         |
| `strong`     | Harder turns: `/strong`, high effort, or task-specific strong |
| `background` | Side work (optional; falls back to default)                   |

One provider can fill two roles (e.g. Gemini Flash + Gemini Pro), or two providers can split them.

## Persistence

Stored under operational memory: `data/operational-memory/llm-roles/<scope>.json`.

Scope is **user-centric** (`user:<id>`). The same person keeps roles across **every** surface that reaches `ConversationalAgent` — Telegram, Discord, WhatsApp, Desktop, Control, CLI, ACP, web, and **any future surface** that passes `userId` + `surface`. Surface is **not** a whitelist: it only labels _where_ the setup question is shown.

Anonymous turns (no user id) fall back to `surface:<normalized-surface>`.

## Multi-surface behavior (core rule)

There is **no** “roles only on Telegram/Desktop/Dashboard” path. Any surface that calls:

```ts
convAgent.chat(message, inlineData, { userId, surface: '<this-surface>' });
```

gets:

1. **Setup intercept** — if the user scope is awaiting setup/confirmation, free text is handled as a natural-language role reply **on that surface**.
2. **Smart prompt** — after a calm successful answer, if triggers fire, the setup question is **appended on the same surface** the user is using right now (`lastPromptSurface` records which one).
3. **Shared forceStrong** — stored in the role file for the user scope, not a single channel session.

Shared helpers:

- `resolveLlmRoleScopeId` / `normalizeRoleSurface` — scope + open surface ids
- `LlmRoleSurfaceCommands` — deterministic `/model` / `/strong` text for **any** gateway
- `LlmRoleRoutingService.buildSurfaceSetupPrompt(scope, surface, …)` — prompt text labeled for the active surface

Control UI is one more surface: `GET/POST /api/llm-roles?userId=&surface=` (+ `#llm-roles-status` on the model preference panel). It uses the same store.

## Commands

Slash packs (e.g. Telegram) and any future slash host can use `LlmRoleSurfaceCommands`:

- `/model` — status (+ health + telemetry + surface/scope)
- `/model setup` — natural-language setup prompt on the current surface
- `/model default <provider|model>`
- `/model strong <provider|model>`
- `/model background <provider|model>`
- `/model fallback on|off` — use strong if default fails (opt-in)
- `/strong` / `/strong off` — force strong for upcoming turns

Natural-language setup replies are interpreted by the LLM (any language). Model ids are validated against a static + **live** catalog (Gemini/OpenAI when keys exist); nearest matches require confirmation.

## Runtime

`resolveWorkspaceLlmStrategy` applies roles. `ConversationalAgent` accepts `forceStrong`, `effortHigh`, `llmRole`, `roleScopeId`, and open `surface` strings. High effort may select strong when configured. Optional strong-on-default-failure after rate-limit style errors.

## Health / metrics

- `healthCheck(scope)` warns if configured models disappear from the usable catalog.
- Telemetry counters: turns per role, setup prompts shown/completed/deferred, nearest confirmations.
- Status includes `lastPromptSurface` and force-strong window.

## Surfaces wired

| Surface                            | How                                                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Shared slash (`/model`, `/strong`) | `SharedSurfaceSlashEnhancementCommandPack` — Discord, WhatsApp, web, desktop runtime, any shared-surface host |
| Telegram                           | Same shared pack + TelegramProviderController                                                                 |
| CLI                                | `zavorth roles …`, `zavorth model setup\|status`, `zavorth strong on\|off`                                    |
| Control UI                         | `GET/POST /api/llm-roles` + model preference card                                                             |
| Desktop                            | `LlmRolesPanel` in provider settings + `/model` `/strong` slash                                               |
| ACP                                | `/model` `/strong` + free-text via `ConversationalAgent` (`surface: acp`)                                     |
| Future                             | Pass `{ userId, surface }` into `ConversationalAgent.chat`                                                    |

## Live catalog

`LlmRoleCatalogService.refreshLiveModels` pulls live ids when keys exist: Gemini, OpenAI, Anthropic, xAI, DeepSeek (static catalog remains fallback).

## Smoke

```bash
npx tsx scripts/live-llm-roles-smoke-runner.ts
# or
node scripts/live-llm-roles-smoke.mjs
```
