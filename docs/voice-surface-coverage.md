# Voice surface coverage

## Principle

Same **preference + STT + agent + TTS policy** everywhere.
Each surface **opts in** via adapter (not magic inheritance).

## Current matrix

| Surface                    | Path                 | Notes                                 |
| -------------------------- | -------------------- | ------------------------------------- |
| Desktop                    | call + dictation     | Phone + Mic                           |
| Web / Experience           | duplex APIs          | Same preference                       |
| Telegram                   | native voice         | AudioHandler                          |
| Discord                    | attachments          | MessagingChannelVoiceIngest           |
| WhatsApp                   | webhook media id/URL | Needs access token for media id       |
| Slack                      | webhook files        | Bot token for private URLs            |
| Signal / Teams / Instagram | webhook extract      | When payload has audio URL            |
| Email                      | none by default      | Opt-in later via registerVoiceSurface |

## Future surface checklist

1. Use preference STT (`AudioTranscriptionService` / messaging ingest)
2. Wire inbound audio → text → broker/agent
3. `registerVoiceSurface({ ... })`
4. Smoke: send voice note / start call on that surface

## Residual (not product gaps)

- Provider SDK that ignores `AbortSignal` (rare with fetch)
- Multi-region Redis for duplex (file durable metadata is local-process)
- Full provider-streaming STT (partials already progressive from utterance buffer)
