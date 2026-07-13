# Voice dictation — Phase 2

## Principle (Claude Code model)

Voice is **only** a way to produce the same text the agent would get if you typed.

```
audio → STT (user-chosen provider) → normalize transcript
  → optional 📝 preview
  → processTextMessage / agent gateway  (same tools, skills, approvals)
```

No media placeholder (`[Audio enviado para analise direta]`).
No parallel “voice brain”.

## Components

| Piece | Role |
|-------|------|
| `VoiceDictationIngress` | Policy: mode, agentText, showTranscript, ttsReplyDesired |
| `TelegramMediaController.handleVoice` | Uses ingress before `dispatchConversational` |
| `VoicePreference.mode` | `off` \| `dictation` \| `conversation` |

## Behaviour

| Mode | STT | Show transcript | Agent input | TTS reply |
|------|-----|-----------------|-------------|-----------|
| `off` | blocked (unless only STT env) | no | no | no |
| `dictation` | required | yes | clean text | no |
| `conversation` | required | yes | clean text | if `tts.enabled` |

## Enable

```bash
npx tsx scripts/zavorth-voice-pref.ts set \
  --stt-provider openai \
  --stt-model whisper-1 \
  --mode dictation
```

## Phase 3

Conversation + TTS under preference: `docs/voice-conversation-phase3.md`.

## Out of scope (later)

- Desktop UI voice settings
- Push-to-talk mic in desktop composer (browser Web Speech already fills text)
