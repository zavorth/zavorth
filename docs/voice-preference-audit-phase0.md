# Voice Preference Audit — Phase 0

**Scope:** Zavorth monorepo inventory of voice/audio entrypoints and hardcoded STT/TTS defaults.
**Date:** 2026-07-13
**Goal:** Map every path that receives user audio, whether it reaches the full agent, where model/provider defaults are baked in, and which preference stores could hold future voice prefs.

---

## 1. Architecture snapshot

There are **three parallel voice stacks**, not one unified preference layer:

| Stack | Role | STT | TTS | Agent hop |
|---|---|---|---|---|
| **Shared cloud STT** (`AudioTranscriptionService`) | Telegram voice, Control attachments, `processVoiceReply` | Cascade: gemini → openai → groq → deepgram → whisper.cpp | N/A (STT only) | Telegram → full conversational; Control → media text + agent; voice_reply → semantic interaction only |
| **Local Whisper pipeline** (`LocalVoiceDictation`, agent `WhisperService`) | CLI `zavorth voice`, Echo hands, agent mic | Local whisper.cpp / Python whisper | Separate local/cloud TTS | CLI: transcript only; agent: Echo API; EchoVoice: hands actions only |
| **Tool / productization backends** (`zavorth_stt`, `zavorth_tts`, `zavorth_voice_mode`, productization packs) | Agent-callable tools & runtime actions | Own defaults (often `whisper-1`) | Own defaults (`local`, edge, Gemini Kore, ElevenLabs) | Tool result only (unless agent chains further) |

**Canonical shared STT path (preferred for surfaces):**

```
audio buffer/file
  → AudioTranscriptionService.transcribe()
      → config.tools.media.audio.sttProviderOrder
      → per-provider models from config (env)
      → whisper.cpp via LocalVoiceDictation last
```

**Canonical Telegram conversational voice path:**

```
Telegram voice/audio message
  → TelegramGatewayHandlerRegistrar.handleVoice
  → TelegramMediaController.handleVoice
  → AudioHandler.transcribeDetailed → AudioTranscriptionService
  → optional processVoiceReply (permission only)
  → dispatchConversational → processTextMessage (full agent)
  → optional EchoOutputStageService (TTS reply when echoMode / explicit voice)
```

---

## 2. Entrypoint inventory

| Entrypoint | File | Next hop | Full agent? | Notes |
|---|---|---|---|---|
| Telegram voice / audio message | `src/gateways/channels/telegram/controllers/TelegramMediaController.ts` (`handleVoice` ~L103) | `AudioHandler.transcribeDetailed` → optional `voicePermissionHandler` / `processVoiceReply` → `dispatchConversational` → `processTextMessage` | **Yes** (unless permission consumed, connectivity/capability short-circuit, or STT rejected) | Optional raw audio as `inlineData` when `forwardRawAudio`. STT limits from `config.tools.media.audio`. |
| Telegram voice registration | `src/gateways/channels/telegram/TelegramGatewayHandlerRegistrar.ts` (~L197) | `mediaController.handleVoice` | Yes (via above) | Wire-up only. |
| Telegram permission voice (F5f) | `src/gateways/channels/telegram/controllers/TelegramPermissionController.ts` (`tryHandleVoicePermissionTranscript` ~L259) | `processVoiceReply({ transcript })` → approval handlers | **No** — media-only / approval path | Uses **precomputed transcript**; does not re-run STT. |
| Surface `processVoiceReply` | `src/domain/surface/application/surface-projection/interaction/VoiceReplyPipeline.ts` (~L105) | STT adapter (default Zavorth bridge) → `parseSurfaceInteraction` | **No** — semantic interaction only; caller executes approvals/agent | Affordance `voice_reply` on chat-interactive / rich-app presets. |
| Zavorth STT bridge (default STT for voice_reply) | `src/domain/surface/application/surface-projection/interaction/ZavorthSpeechToTextBridge.ts` | `AudioTranscriptionService` | Depends on caller | Same cascade/models as Telegram. |
| Control / web audio attachments | `src/services/WebAppConversationService.ts` (`analyzeInlineMediaAttachment` ~L831) | `AudioTranscriptionService.transcribe` → media summary / conversation | **Yes** when conversation continues with transcript/inline media | Also sets `isVoiceInput` when inline audio present (~L1478). |
| Agent local mic (desktop companion) | `agent/src/index.ts` + `agent/src/AgentVoiceFlowService.ts` | `VoiceRecorder` → `WhisperService` → `EchoClientService.processIntent` → Hybrid TTS | **Yes** via Echo/surface HTTP API (`/api/v2/echo` execute), not Telegram `processTextMessage` | Local-first STT; TTS edge → optional cloud Gemini. |
| CLI `zavorth voice listen` | `src/cli/ZavorthCliVoiceCommand.ts` (~L112) | `LocalVoiceDictation.startContinuousMicrophoneRecord` | **No** — prints transcript | Requires `ZAVORTH_VOICE_MIC_COMMAND`. Docs mention agent runtime; current listen path is dictation-only. |
| CLI `zavorth voice speak` | `src/cli/ZavorthCliVoiceCommand.ts` (~L86) | `LocalVoiceTTS.speak` | No | OS-native TTS only. |
| CLI voice arm/disarm/status/doctor | `src/cli/ZavorthCliVoiceCommand.ts`, `src/services/VoiceWakeRuntimeService.ts` | Wake state file / diagnostics | No | Provisioning/status, not STT cascade. |
| Echo hands voice | `src/services/EchoVoiceService.ts` | `LocalVoiceDictation.transcribeBuffer` → regex hands actions | **No** — safe hands only | Not full agent; fixed open_app / browser_search intents. |
| Tool `zavorth_stt` | `src/tools/ZavorthSttTool.ts` | curl backends (whisper/deepgram/gemini/azure/local) | No (tool result) | Instance `defaultBackend = 'whisper'`; OpenAI model default `whisper-1`. |
| Tool `zavorth_tts` | `src/tools/ZavorthTtsTool.ts` | local / azure / elevenlabs / mlx / gemini / deepgram | No | Instance `defaultBackend = 'local'`; lang default `pt-BR`. |
| Tool `zavorth_voice_mode` | `src/tools/ZavorthVoiceModeTool.ts` | session STT/TTS (own curl paths) | No | Defaults: stt `whisper`, tts `local`, lang `pt-BR`, wake `zavorth`; hardcodes `whisper-1` and `gemini-2.0-flash` for STT. |
| Productization TTS action pack | `src/runtime/actions/modules/productizationPacks.ts` | edge / gemini / elevenlabs / minimax / neutts | No | Defaults: edge `pt-BR-FranciscaNeural`, gemini voice `Kore`, ElevenLabs `eleven_multilingual_v2`. |
| Speech contract runtime (dry / live) | `src/services/SpeechRuntimeService.ts` + `src/adapters/speech/SpeechVoiceLiveAdapters.ts` | Injected adapters | No | Dry-run by default; live needs adapters. Used by productization / generic speech. |
| AI Gateway OpenAI-compat audio API | `src/ai-gateway/app/api/v1/audio/transcriptions/route.ts`, `.../speech/route.ts` | Gateway `handleAudioTranscription` / `handleAudioSpeech` | No (HTTP API) | Proxy-style media endpoints; separate from Telegram cascade. |
| Echo TTS HTTP | `src/services/ZavorthControlEchoRouteService.ts` (`/api/v2/echo/audio/speech`) | `EchoSpeechSynthesisService` → `GeminiVoiceService` | No | Gemini TTS; default model `gemini-2.5-flash`, voice often `Kore`. |
| Home Assistant Echo bridge | `src/echo/tools/iot/HomeAssistantBridge.ts` | Echo speech synthesis | No | Uses `DEFAULT_ECHO_GEMINI_TTS_MODEL`. |
| Telegram video/audio extraction | `src/gateways/channels/telegram/video-handler/VideoTranscriptionPipeline.ts` | Gemini video analyzer and/or `AudioHandler` chunks | **Yes** if video message dispatched as conversation | Uses same AudioHandler STT for extracted audio; 25MB limit. |
| Desktop Web Speech dictation | `apps/zavorth-desktop/src/voice/useVoiceDictation.ts` | Browser SpeechRecognition → composer text `onChange` | **Yes only after user sends** text | OS/browser STT; not Zavorth cascade. Lang via `navigator.language` (`pt` → `pt-BR`, else raw / `en-US`). |
| Desktop companion bridge | `apps/zavorth-desktop/src/useDesktopAppState.ts` (voice agent status) | Optional companion process | Companion uses agent path if running | Falls back to desktop dictation. |
| iOS Talk / VoiceWake | `apps/ios/Sources/**` (`VoiceWakeManager`, Talk tab) | Native/realtime gateway path | Surface-dependent | Mobile companion UX; not wired through `AudioTranscriptionService`. |
| Android voice capture / Talk | `apps/android/**` (`TalkModeManager`, Voice E2E) | Gateway events / chat transport | Surface-dependent | Capture mode prefs exist; separate from monorepo STT cascade. |
| Voice-call channel bridge | `src/gateways/channels/simple/VoiceCallGateway.ts` | Bridge URL/script/outbox | Not STT in-process | Telephony relay activation, not transcription. |
| Multimodal selector (legacy tool path) | `src/services/plugins/MultimodalProviderSelector.ts` | curl OpenAI `whisper-1` / Gemini inline | Tool/media helper | Hardcoded `model=whisper-1`. |
| Local voice consent/provision/status | `src/voice/VoiceConsentService.ts`, `VoiceProvisioningService.ts`, `VoiceStatusService.ts` | Gate local pipeline | No | Privacy/device state only. |

---

## 3. Hardcoded model / provider defaults (file:line)

### 3.1 Shared STT cascade (primary surface stack)

| Default | Value | Location |
|---|---|---|
| STT enabled | `true` | `src/config/sections/providerConfig.ts:296` |
| Provider order | `gemini,openai,groq,deepgram,whisper.cpp` | `providerConfig.ts:297–299` |
| Fallback order (if config missing) | same list | `src/services/AudioTranscriptionService.ts:114` |
| STT timeout | `45000` ms | `providerConfig.ts:300` |
| Max bytes | `24 * 1024 * 1024` | `providerConfig.ts:301` |
| Max seconds | `600` | `providerConfig.ts:302` |
| Gemini transcription model | `gemini-2.5-flash` | `providerConfig.ts:203` |
| OpenAI transcription model | **`whisper-1`** | `providerConfig.ts:204` |
| Groq transcription model | `whisper-large-v3-turbo` | `providerConfig.ts:206` |
| Deepgram transcription model | **`nova-2`** (code) | `providerConfig.ts:207` |
| Gemini voice (TTS) model | `gemini-2.5-flash` | `providerConfig.ts:208` |
| Gemini voice name | **`Kore`** | `providerConfig.ts:209` |
| Gemini voice language | `en-US` | `providerConfig.ts:210` |
| Local dictation language (service) | `'auto'` when constructed by STT service | `AudioTranscriptionService.ts:54` |
| Local Whisper model path | `./models/whisper/ggml-tiny.bin` | `src/voice/LocalVoiceDictation.ts:45` |
| Local Whisper language default | **`pt`** | `LocalVoiceDictation.ts:49` |
| OpenAI STT endpoint | `https://api.openai.com/v1/audio/transcriptions` | `AudioTranscriptionService.ts:208` |
| Groq STT endpoint | `https://api.groq.com/openai/v1/audio/transcriptions` | `AudioTranscriptionService.ts:215` |

**Doc drift:** `docs/audio-stt-pipeline.md` lists `OPENAI_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe` and `DEEPGRAM_TRANSCRIPTION_MODEL=nova-3`, but **code defaults** are `whisper-1` and `nova-2`.

### 3.2 Telegram TTS (reply synthesis)

| Default | Value | Location |
|---|---|---|
| Edge TTS primary cascade | `edge-tts` → `gemini` (policy-dependent) | `AudioHandler.ts:563–586` |
| Edge voice (config) | `TTS_VOICE` or **`en-US-JennyNeural`** | `src/config/sections/runtimePathConfig.ts:457` |
| Env schema agent TTS voice | **`pt-BR-AntonioNeural`** | `src/config/env.ts:139` |
| Gemini TTS model/voice | via `config.geminiVoiceModel` / `geminiVoiceName` (`gemini-2.5-flash` / `Kore`) | `GeminiVoiceService.ts:55–56` |
| TTS max chars | `520` | `providerConfig.ts:306` |
| TTS timeout | `18000` ms | `providerConfig.ts:305` |
| TTS cache enabled | `true`, TTL 10 min | `providerConfig.ts:307–308` |

### 3.3 Echo / Control TTS

| Default | Value | Location |
|---|---|---|
| Echo Gemini TTS model constant | **`gemini-2.5-flash`** | `src/domain/surface/application/EchoSpeechSynthesisService.ts:10` |
| GeminiVoiceService model/voice | `gemini-2.5-flash` / **`Kore`** | `src/providers/GeminiVoiceService.ts:55–56` |
| Productization edge voice | **`pt-BR-FranciscaNeural`** | `productizationPacks.ts:335` |
| Productization Gemini voice | **`Kore`** | `productizationPacks.ts:367` |
| ElevenLabs model | `eleven_multilingual_v2` | `productizationPacks.ts:378`, `env.ts:141` |

### 3.4 Local agent package (`agent/`)

| Default | Value | Location |
|---|---|---|
| Voice language | **`pt`** | `agent/src/index.ts:45` |
| Local edge TTS voice | `ZAVORTH_AGENT_TTS_VOICE` \|\| `TTS_VOICE` \|\| **`en-US-GuyNeural`** | `agent/src/index.ts:46` |
| Cloud TTS model | **`gemini-3.1-flash-tts-preview`** | `agent/src/index.ts:51`, `GatewayCloudTtsService.ts:48` |
| Cloud TTS voice | **`Kore`** | `agent/src/index.ts:52`, `GatewayCloudTtsService.ts:49` |
| Cloud TTS format / timeout | `wav` / `15000` | `agent/src/index.ts:53–54` |
| Whisper language | `pt` | `agent/src/WhisperService.ts:40` |
| Whisper model path | `models/ggml-base.bin` | `agent/src/WhisperService.ts:39` |
| Wake word | `zavorth` | `agent/src/index.ts:43` |
| Hotkey | `B` (Win+B) | `agent/src/index.ts:44` |
| Record max duration | `8000` ms | `agent/src/index.ts:68` |

### 3.5 Tools (agent-callable, separate from surface cascade)

| Default | Value | Location |
|---|---|---|
| `zavorth_stt` default backend | `whisper` | `ZavorthSttTool.ts:73` |
| `zavorth_stt` OpenAI model | **`whisper-1`** | `ZavorthSttTool.ts:288` |
| `zavorth_tts` default backend | `local` | `ZavorthTtsTool.ts:77` |
| `zavorth_tts` language | `pt-BR` (param description) | `ZavorthTtsTool.ts:48` |
| `zavorth_voice_mode` stt/tts | `whisper` / `local` | `ZavorthVoiceModeTool.ts:60–62` |
| `zavorth_voice_mode` OpenAI model | **`whisper-1`** | `ZavorthVoiceModeTool.ts:491` |
| `zavorth_voice_mode` Gemini STT model | **`gemini-2.0-flash`** (stale vs cascade `gemini-2.5-flash`) | `ZavorthVoiceModeTool.ts:535` |
| Azure voice (voice mode) | `pt-BR-AntonioNeural` | `ZavorthVoiceModeTool.ts:453` |
| Multimodal selector Whisper | **`whisper-1`** | `MultimodalProviderSelector.ts:193` |

### 3.6 Desktop / CLI local helpers

| Default | Value | Location |
|---|---|---|
| Desktop dictation lang fallback | `en-US` | `apps/zavorth-desktop/src/voice/voiceDictation.ts:8` |
| Desktop pt mapping | `pt*` → `pt-BR` | `voiceDictation.ts:9` |
| Local OS TTS | platform tool (SAPI / say / espeak) | `src/voice/LocalVoiceTTS.ts` |

---

## 4. Preference stores that could hold voice prefs

| Store | Path / type | Today stores | Voice-ready? |
|---|---|---|---|
| **ZavorthBridgePreferenceStore** | `data/runtime/bridge/users/<userId>/preferences.json` (+ legacy host file) | `preferredModel`, **`echoMode`**, `updatedAt` | **Partial** — `echoMode` already gates TTS replies (`EchoOutputStageService`). Natural place for per-user `sttProvider` / `ttsVoice` / `ttsProvider`. |
| **Provider selection preferences** | `data/runtime/provider-selection-preferences.json` | `providerId`, `modelId`, family/route, secondary model | Chat/LLM selection only; not STT/TTS. Could extend with media routes. |
| **Config env + sections** | `.env` / `providerConfig` / `runtimePathConfig` | Global STT order, models, TTS voices | Host-global only; no per-user surface prefs. |
| **WorkspaceProfileService** | workspace profile JSON under workspace data | Commands, hooks, routing style, etc. | **No voice fields found** — candidate for workspace-default voice policy. |
| **Tool instance state** | in-memory `defaultBackend` on STT/TTS tools | Session default only | Resets on restart; comments already note need to persist. |
| **VoiceConsent / Provisioning / Status** | in-memory (service instances) | consent, devices, recording phase | Privacy/device, not model preference. |
| **Voice wake state** | `data/runtime/voice-wake-state.json` | arm/disarm TTL | Wake session only. |
| **Desktop local UI state** | React/desktop state | listening, companion status | Not persisted STT/TTS model choice. |
| **Android prefs** | app prefs (`voiceMicEnabled`, capture mode) | mic enable / capture mode | Mobile-local; not monorepo cascade. |
| **AGENTS.md / SOUL.md / MULTI-MODAL.md** | markdown operator docs | Soft guidance (when to use voice) | Human preference, not machine config. |

**Existing voice-related preference behavior:**

- `echoMode` on bridge prefs → when active, Echo output stage synthesizes voice replies (unless interactive controls / long text).
- Explicit user phrasing (“reply in voice”) can force TTS without echoMode.
- No store currently selects STT provider order or Gemini/OpenAI/Deepgram model per user/workspace.

---

## 5. Full agent vs media-only (decision map)

```
User audio
├─ Telegram voice ──STT──► transcript
│     ├─ connectivity / capability checks ──► canned reply (media-only)
│     ├─ permission intent (processVoiceReply) ──► approve/deny (media-only)
│     └─ else ──► processTextMessage / agent run (FULL)
├─ Control audio attach ──STT──► transcript into composer/conversation (FULL if user message runs)
├─ processVoiceReply alone ──► SemanticInteractionEvent (NOT full agent)
├─ Agent mic ──Whisper──► Echo execute API (FULL surface agent)
├─ EchoVoiceService ──Whisper──► hands actions (NOT full agent)
├─ Desktop dictation ──browser STT──► composer text (FULL only on send)
├─ Tools stt/tts/voice_mode ──► tool payload (agent may continue)
└─ CLI voice listen/speak ──► local I/O (NOT full agent)
```

---

## 6. Recommended Phase 1 touch points

Prioritize **one preference shape** and wire the **shared cascade** first; leave tool/agent stacks as adapters that read the same prefs later.

### P1.1 Preference model (source of truth)

1. **Extend `ZavorthBridgePreferenceStore`** (or a sibling `VoicePreferenceStore` next to it) with optional fields, e.g.:
   - `sttProviderOrder?: string[]`
   - `sttLanguage?: string | 'auto'`
   - `ttsProviderOrder?: Array<'edge-tts' | 'gemini' | ...>`
   - `ttsVoiceEdge?: string`
   - `ttsVoiceGemini?: string` (e.g. Kore)
   - `ttsLanguageCode?: string`
   - keep existing `echoMode`
2. Optionally mirror workspace defaults on **WorkspaceProfile** for team defaults, with user prefs winning.

### P1.2 Read path (must consume prefs)

| Priority | Touch point | Why |
|---|---|---|
| 1 | `src/config/sections/providerConfig.ts` (`tools.media.audio` + transcription/voice models) | Single cascade definition for Telegram + Control + voice_reply |
| 2 | `src/services/AudioTranscriptionService.ts` | Actual STT execution; resolve order/models from prefs before env defaults |
| 3 | `src/gateways/channels/telegram/AudioHandler.ts` | TTS provider order + edge voice resolution |
| 4 | `src/services/EchoOutputStageService.ts` | Already uses preferenceStore for echoMode; extend for voice identity |
| 5 | `src/providers/GeminiVoiceService.ts` + `EchoSpeechSynthesisService.ts` | Kore / gemini-2.5-flash defaults |
| 6 | `src/domain/surface/.../ZavorthSpeechToTextBridge.ts` | Ensure voice_reply inherits same prefs (no second stack) |

### P1.3 Entrypoints to plumb userId/session

| Touch point | Pass-through |
|---|---|
| `TelegramMediaController.handleVoice` | userId → prefs for STT + later TTS |
| `WebAppConversationService.analyzeInlineMediaAttachment` | session/web user → prefs |
| `processVoiceReply` / surface projection | actorId → prefs when STT runs |
| Agent `EchoClientService` / cloud TTS | optional API headers or query for voice profile |

### P1.4 Align / quarantine hardcodes

| Action | Files |
|---|---|
| Fix doc defaults to match code (`whisper-1`, `nova-2`) or flip code intentionally | `docs/audio-stt-pipeline.md` vs `providerConfig.ts` |
| Unify Gemini STT model in tools (`gemini-2.0-flash` → shared config) | `ZavorthVoiceModeTool.ts` |
| Unify OpenAI model constant | `ZavorthSttTool`, `ZavorthVoiceModeTool`, `MultimodalProviderSelector` |
| Document agent cloud TTS model split (`gemini-3.1-flash-tts-preview` vs Echo `gemini-2.5-flash`) | `agent/src/index.ts` vs `EchoSpeechSynthesisService` |
| Persist tool `set_default` to preference store | `ZavorthSttTool` / `ZavorthTtsTool` |

### P1.5 Out of scope for Phase 1 (document only)

- Browser Web Speech (desktop dictation) — OS-owned STT.
- iOS/Android Talk stacks — native; later map to same preference API if server-side STT is added.
- AI Gateway `/v1/audio/*` provider catalogs — multi-tenant gateway config, separate product surface.
- Voice-call telephony bridge — transport, not STT.

### P1.6 Suggested acceptance criteria

- [ ] Single voice preference record readable by STT + TTS paths.
- [ ] Telegram voice + Control attachment + `processVoiceReply` all honor the same STT order/models.
- [ ] Echo TTS reply honors preferred Gemini/edge voice without code change per surface.
- [ ] Hardcoded Kore / whisper-1 / provider order remain as **fallback only** after prefs + env.
- [ ] Inventory table in this doc stays accurate (update on any new entrypoint).

---

## 7. Key file index (quick open list)

```
src/services/AudioTranscriptionService.ts
src/config/sections/providerConfig.ts
src/config/sections/runtimePathConfig.ts
src/config/env.ts
src/voice/LocalVoiceDictation.ts
src/voice/LocalVoiceTTS.ts
src/gateways/channels/telegram/AudioHandler.ts
src/gateways/channels/telegram/controllers/TelegramMediaController.ts
src/gateways/channels/telegram/controllers/TelegramPermissionController.ts
src/domain/surface/application/surface-projection/interaction/VoiceReplyPipeline.ts
src/domain/surface/application/surface-projection/interaction/ZavorthSpeechToTextBridge.ts
src/domain/surface/application/EchoSpeechSynthesisService.ts
src/providers/GeminiVoiceService.ts
src/services/EchoOutputStageService.ts
src/services/EchoVoiceService.ts
src/services/WebAppConversationService.ts
src/services/ZavorthControlEchoRouteService.ts
src/agents/ZavorthBridgePreferenceStore.ts
src/tools/ZavorthSttTool.ts
src/tools/ZavorthTtsTool.ts
src/tools/ZavorthVoiceModeTool.ts
src/cli/ZavorthCliVoiceCommand.ts
src/runtime/actions/modules/productizationPacks.ts
agent/src/index.ts
agent/src/AgentVoiceFlowService.ts
agent/src/WhisperService.ts
agent/src/GatewayCloudTtsService.ts
apps/zavorth-desktop/src/voice/useVoiceDictation.ts
docs/audio-stt-pipeline.md
docs/voice-pipeline.md
docs/surface-registration.md
```

---

## 8. Summary

- **Primary production STT** is `AudioTranscriptionService` with env-driven cascade defaults (`gemini-2.5-flash`, `whisper-1`, `whisper-large-v3-turbo`, `nova-2`, local whisper).
- **Primary production TTS** for chat replies is Telegram `AudioHandler` (edge-tts → Gemini) + Echo Gemini path (`Kore` / `gemini-2.5-flash`); agent uses a **different** cloud default (`gemini-3.1-flash-tts-preview`).
- **Full agent** is reached for Telegram conversational voice and Control conversation with audio; **not** for pure permission voice_reply parsing, Echo hands, CLI listen, or tool-only STT/TTS.
- **Only durable “voice” preference today** is bridge `echoMode` (+ global env). No per-user STT/TTS model store exists yet — Phase 1 should add one and wire it into the shared cascade first.
