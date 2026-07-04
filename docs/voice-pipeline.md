# Voice Pipeline

The Voice Pipeline provides local speech-to-text transcription using Whisper, with built-in privacy consent and device provisioning.

## Architecture

```
VoiceConsentService  -->  VoiceProvisioningService  -->  VoiceStatusService
                                                       |
                                                       v
                                              LocalVoiceDictation (Whisper)
```

## Components

### VoiceConsentService

Manages user privacy consent for voice capture. Consent must be accepted before using any voice features.

```typescript
import { VoiceConsentService } from './src/voice/VoiceConsentService';

const consent = new VoiceConsentService();
consent.accept({ userId: 'user-1' });
consent.ensureConsented('user-1'); // throws if not consented
```

### VoiceProvisioningService

Manages voice device provisioning. At least one device must be provisioned before voice features are available.

```typescript
import { VoiceProvisioningService } from './src/voice/VoiceProvisioningService';

const provisioning = new VoiceProvisioningService();
const device = provisioning.provision({
  deviceName: 'my-microphone',
  platform: 'local',
  modelPath: '/path/to/ggml-tiny.bin',
  binaryPath: '/path/to/whisper-cli',
});
provisioning.ensureProvisioned(); // throws if no device
```

### VoiceStatusService

Tracks the current state of the voice pipeline and notifies listeners of changes.

```typescript
import { VoiceStatusService } from './src/voice/VoiceStatusService';

const status = new VoiceStatusService();
status.subscribe((s) => console.log('Phase:', s.phase));

status.setConsented(true);
status.setHasDevice(true);
status.setRecording(true);
```

### LocalVoiceDictation

Handles actual audio transcription via Whisper CLI. Supports both single-file and continuous microphone recording.

```typescript
import { LocalVoiceDictation } from './src/voice/LocalVoiceDictation';

const dictation = new LocalVoiceDictation({
  modelPath: '/path/to/ggml-tiny.bin',
  binaryPath: '/path/to/whisper-cli',
});

const transcript = await dictation.transcribeBuffer(audioBuffer);
```

## Environment Variables

| Variable | Description |
|---|---|
| `ZAVORTH_WHISPER_MODEL_PATH` | Path to Whisper model file (default: `./models/whisper/ggml-tiny.bin`) |
| `ZAVORTH_WHISPER_LANGUAGE` | Transcription language (default: `pt`) |
| `ZAVORTH_WHISPER_BINARY` | Path to whisper-cli binary |
| `ZAVORTH_WHISPER_TEMP_DIR` | Temporary directory for audio files |
| `ZAVORTH_VOICE_MIC_COMMAND` | External microphone worker command for continuous recording |
| `ZAVORTH_VOICE_MIC_ARGS` | Arguments for the microphone worker |

## Pipeline Flow

1. User grants consent via `VoiceConsentService`
2. A device is provisioned via `VoiceProvisioningService`
3. Status is tracked via `VoiceStatusService`
4. Audio is transcribed via `LocalVoiceDictation`
5. Consent can be revoked at any time, disabling voice features

## Privacy

- All processing is local (no cloud transcription)
- Consent is required before any voice capture
- Consent can be revoked, immediately disabling voice features
- Device provisioning is explicit and tracked
