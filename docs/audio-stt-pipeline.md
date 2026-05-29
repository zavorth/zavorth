# Zavorth Audio STT Pipeline

Zavorth uses one shared audio transcription pipeline for Control and Telegram.
The dashboard should not expose provider routing to regular users. Provider
attempts, fallback details, and failures are kept in internal logs and diagnostic
objects.

## Provider Order

Set the transcription order with:

```env
ZAVORTH_AUDIO_STT_PROVIDERS=gemini,openai,groq,deepgram,whisper.cpp
```

The runner tries each configured provider until one returns usable transcript
text. Empty text and generic refusal text such as "cannot process audio" are
treated as failures, not success.

## Provider Configuration

```env
GEMINI_TRANSCRIPTION_MODEL=gemini-2.5-flash
OPENAI_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe
GROQ_TRANSCRIPTION_MODEL=whisper-large-v3-turbo
DEEPGRAM_TRANSCRIPTION_MODEL=nova-3
DEEPGRAM_API_KEY=...
ZAVORTH_WHISPER_MODEL_PATH=C:\models\ggml-base.bin
```

OpenAI-compatible providers use multipart transcription requests. OpenAI can
use configured key rotation. Groq and Deepgram are skipped when their keys are
not configured. `whisper.cpp` is the offline fallback path and is only reliable
when the local model and runtime are provisioned.

## Limits And Preflight

```env
ZAVORTH_AUDIO_STT_ENABLED=true
ZAVORTH_AUDIO_STT_TIMEOUT_MS=45000
ZAVORTH_AUDIO_STT_MAX_BYTES=25165824
ZAVORTH_AUDIO_STT_MAX_SECONDS=600
```

Before calling a provider, Zavorth checks:

- empty or very small audio;
- unsupported MIME type;
- obvious MIME/container mismatch;
- WAV duration over the configured limit;
- WAV files that appear silent.

If preflight fails, the user receives a simple actionable error. Provider-level
details stay in logs/diagnostics.

## Surfaces

- Control: file/audio attachments are sent as real inline payloads and routed
  through `AudioTranscriptionService`.
- Telegram: `AudioHandler.transcribeDetailed` delegates STT to the same shared
  service, then adapts the result to the existing Telegram result shape.

