# Voice backend gaps 1–7

## 1. Cancel agent mid-turn (barge-in hard)
- `AbortController` per duplex agent turn
- `bargeIn()` aborts controller + increments `bargeEpoch`
- Late agent/TTS results discarded
- `createExperienceDuplexAgentHandler` races execute vs abort

## 2. TURN / NAT
Env:
```bash
ZAVORTH_WEBRTC_STUN_URLS=stun:stun.l.google.com:19302
ZAVORTH_WEBRTC_TURN_URLS=turn:turn.example.com:3478
ZAVORTH_WEBRTC_TURN_USERNAME=...
ZAVORTH_WEBRTC_TURN_CREDENTIAL=...
```
- TURN only accepted when username+credential set (no open relay by mistake)
- Exposed on `GET /api/experience/voice/media-plane` → `ice`
- Desktop + native server peer use the same ICE list

## 3. Duplex session TTL + max
```bash
ZAVORTH_VOICE_DUPLEX_MAX_SESSIONS=32   # default
ZAVORTH_VOICE_DUPLEX_TTL_MS=1800000    # 30m default
```
- Prune on start + interval
- Fail closed when at capacity

## 4. Persistent metrics
```bash
ZAVORTH_VOICE_METRICS_PERSIST=true
ZAVORTH_VOICE_METRICS_PATH=data/runtime/voice/metrics.jsonl
```
- JSONL append with redaction of tokens/secrets
- In-memory ring still used for live snapshot

## 5. Messaging channel voice
- `MessagingChannelVoiceIngest` (shared)
- Discord reuses it
- `WebhookGateway` auto-ingests audio URLs in WhatsApp/Slack-style payloads

## 6. Partial STT
- While buffering utterances, bus emits `type: 'partial'` with `partialText`
- Desktop sets interim text on `wait_event`

## 7. Authenticated push
- SSE remains management-auth
- `wait_event` requires session exists, caps timeout ≤30s, optional `userId` owner check
- Duplex `start` stores `ownerUserId`

## Limits that were closed further

### LLM abort (beyond Promise race)
- `VoiceAgentAbortRegistry` registers duplex `AbortSignal`
- `ExperienceCoreService` passes `{ signal }` into `agentGateway.handle`
- `AgentRunExecutionSupport` stamps run metadata
- `AgentRunLlmRuntimeExecutor` merges signal into `chatDetailed` options
- `LlmRuntimeService` already forwards `signal` to provider `fetch` → **HTTP abort on barge-in** when provider honors it

### WhatsApp media id + Slack private
- Payload with `audio.id` → Graph `GET /{media-id}` with `WHATSAPP_ACCESS_TOKEN` → download URL → STT
- Slack private URLs use `Authorization: Bearer SLACK_BOT_TOKEN`
- Fail closed with “Type your message instead.” if token/media missing

## Tests
`tests/voice/VoiceBackendGaps.test.ts`, `tests/voice/VoiceLimitsResolved.test.ts` + full `tests/voice`
