# demo-showcase (Wave 7)

Lifestyle & demos pack — **single plugin** that exercises as many Wave 0 specialized `register_*` APIs as possible for demos and surface-parity tables.

- Soft-fail everything
- **No real network**
- `moduleKind: diagnostics` → **skips** `registerPlatform` / `bindChannel` (avoids channel moduleKind failure)
- Secret values never returned (presence only for `DEMO_SHOWCASE_SECRET`)

## Capabilities

| Capability | Input | Notes |
|------------|--------|--------|
| `demo.showcase.status` | `{}` | `{ ok, wave:'W7', surface, capabilityCount, message }` |
| `demo.showcase.ping` | `{ message? }` | `{ ok: true, echo, wave: 'W7' }` |
| `demo.showcase.skill` | `{ … }` | Soft skill demo |
| `demo.showcase.cli` | `{ args? }` | Soft CLI demo |
| `demo.showcase.auxiliary` | `{ task? }` | Soft auxiliary task |
| `demo.showcase.web_search` | `{ query }` | Fake search results (no network) |
| `demo.showcase.browser` | `{ url? }` | Soft navigate stub |
| `demo.showcase.image_gen` | `{ prompt? }` | Soft image-gen message |
| `demo.showcase.video_gen` | `{ prompt? }` | Soft video-gen message |
| `demo.showcase.tts` | `{ text? }` | Soft TTS message |
| `demo.showcase.transcription` | `{ audio? }` | Soft transcription message |
| `demo.showcase.secret` | `{}` | Presence of `DEMO_SHOWCASE_SECRET` only |
| `demo.showcase.auth` | `{ token }` | `authenticated` if `token === 'demo'` |
| `demo.showcase.context` | `{ query? }` | Soft context engine stub |
| `demo.showcase.slack_action` | `{ action? }` | Soft Slack action stub |
| `demo.showcase.middleware_note` | `{}` | Documents whether middleware was registered |

**Capability count:** 16

## Specialized registrars attempted (14)

Always `bindCapability` for each capability above. When present on `ctx`, also soft-calls:

1. `registerSkill`
2. `registerCliCommand`
3. `registerAuxiliaryTask`
4. `registerWebSearchProvider`
5. `registerBrowserProvider`
6. `registerImageGenProvider`
7. `registerVideoGenProvider`
8. `registerTtsProvider`
9. `registerTranscriptionProvider`
10. `registerSecretSource`
11. `registerDashboardAuthProvider`
12. `registerContextEngine`
13. `registerSlackActionHandler`
14. `registerMiddleware` → `agent.after_turn` (soft log)

**Skipped:** `registerPlatform`, `bindChannel` (diagnostics moduleKind).

`demo.showcase.status.surface` lists which of the 14 were available at register time.

## Permissions

| Kind | Required | Reason |
|------|----------|--------|
| `secret.read` | optional | Probe presence of `DEMO_SHOWCASE_SECRET` |

No filesystem permission declared.

## Env

| Name | Purpose |
|------|---------|
| `DEMO_SHOWCASE_SECRET` | Optional; presence-only via `demo.showcase.secret` |

## Enable

```bash
zavorth plugins enable demo-showcase --yes
```

## Invoke examples

```bash
zavorth plugins invoke demo-showcase demo.showcase.status
zavorth plugins invoke demo-showcase demo.showcase.ping --input '{"message":"hello"}'
zavorth plugins invoke demo-showcase demo.showcase.web_search --input '{"query":"zavorth"}'
zavorth plugins invoke demo-showcase demo.showcase.auth --input '{"token":"demo"}'
```
