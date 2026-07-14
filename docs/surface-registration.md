# Surface registration (F6)

Register a new operator surface without forking the agent core.

## Voice on a new surface

Voice is **capability-shared** (preference STT/TTS + agent), but **not automatic**.

1. Prefer shared stacks:
   - **Messaging attachments/webhooks** → `MessagingChannelVoiceIngest` / `WebhookGateway` audio extract
   - **Desktop/web call** → duplex + experience voice APIs
   - **Telegram-like** → `AudioHandler` + preference
2. Declare capability:
   ```ts
   import { registerVoiceSurface } from '../src/services/voice/VoiceSurfaceCapabilityRegistry.js';
   registerVoiceSurface({
     surfaceId: 'my-channel',
     label: 'My Channel',
     modes: ['messaging-webhook'],
     preferenceStt: true,
     preferenceTts: true,
   });
   ```
3. List: `GET /api/experience/voice/surfaces`

See `docs/voice-surface-coverage.md`.

## 15-minute path

```ts
import {
  registerSurface,
  projectResponseForChannel,
  parseSurfaceInteraction,
} from '../src/domain/surface/application/surface-projection/index.js';
import { buildAgentPermissionApprovalResponse } from '../src/services/permission/AgentPermissionApprovalPresentation.js';

// 1) Register with a preset (defaults are enough for day-1 text UX)
const { profile, projector, certification } = registerSurface({
  id: 'my-channel',
  preset: 'chat-basic', // or chat-interactive | rich-app | cli
  label: 'My Channel',
});

console.log(certification.status); // 'ready' | 'attention' | 'blocked'

// 2) Send an approval (same card everywhere)
const response = buildAgentPermissionApprovalResponse(
  { approvalId: 'task-123', title: 'Approval needed' },
  profile,
);
const out = projectResponseForChannel('my-channel', response);
await ctx.reply(out.text, out.replyOptions ?? undefined);

// 3) Parse user input (button, slash, number, API)
const event = parseSurfaceInteraction({
  surface: 'my-channel',
  raw: userTextOrCallback,
  kindHint: 'auto',
  numberedOptions: (out.replyOptions as any)?.numberedOptions,
  metadata: { approvalId: 'task-123' },
});
// event.choice → once | session | always | deny
```

## Presets

| Preset | When to use |
|--------|-------------|
| `chat-basic` | Text + commands / numbered replies (WhatsApp-like) |
| `chat-interactive` | Inline buttons (Telegram/Discord style) |
| `rich-app` | Desktop/web structured actions + shortcuts |
| `cli` | Dense text + slash/flags |

## Optional custom projector

```ts
registerSurface({
  id: 'my-channel',
  preset: 'chat-interactive',
  projector: {
    channel: 'my-channel',
    project({ response }) {
      // map SurfaceResponse → your native widgets
      return {
        contractVersion: 'surface-projector/v1',
        channel: 'my-channel',
        text: '…',
        replyOptions: { /* native */ },
        rendered: { /* … */ },
        usedNativeButtons: true,
      };
    },
  },
});
```

## Certification (non-blocking on register)

`certifySurface(id)` checks:

- profile defined
- projector resolvable
- critical actions have a delivery path (buttons **or** slash **or** text)
- `voice_reply` is optional (default off)

Warnings do not block registration; fix when polishing UX.

## Related layers

- **F1** affordances / presets — `surface-affordance/`
- **F2** semantic card + projection policy — `surface-projection/`
- **F3** projectors — `surface-projection/projectors/`
- **F4** input normalizer — `surface-projection/interaction/`
- **F5a** lifecycle (clear keyboard, edit receipt) — `surface-projection/lifecycle/`
- **F5e** reactions — `SurfaceReactions.ts` (`✅` once, `❌` deny; high-risk needs confirm)
- **F5f** voice_reply — `VoiceReplyPipeline.ts` (STT adapter → text → same parser; default off)

### Enable reactions (F5e)

On by default for `chat-interactive` / `rich-app`. Parse:

```ts
parseSurfaceInteraction({
  surface: 'telegram',
  raw: '✅',
  kindHint: 'reaction',
  profile,
  metadata: { approvalId: 'task-123' },
  highRisk: false,
});
```

High-risk allow reactions set `requiresConfirmation` — ask user to reply `yes <id> once` first.

### Enable voice (F5f) — uses existing Zavorth STT

`processVoiceReply` defaults to **AudioTranscriptionService** (same provider order / models as Telegram voice: gemini → openai → groq → deepgram → whisper.cpp). No separate speech stack.

```ts
// chat-interactive / rich-app already have voice_reply: true
await processVoiceReply({
  surface: 'telegram',
  profile: resolveSurfaceProfileForChannel('telegram'),
  audio: buffer, // uses createZavorthSpeechToTextAdapter() automatically
  mimeType: 'audio/ogg',
  approvalId: 'task-123',
});
```

Telegram: voice messages STT via `AudioHandler` → if transcript is an approval and a pending task exists for the chat, permission is applied without creating a second STT system.

### Reactions (F5e) live path

Telegram registers `message_reaction` updates. Pending approvals are tracked when the gate sends the SurfaceResponse (`registerPendingSurfaceApproval`). React ✅/❌ on that message to decide.

### Observability (F7)

```ts
import {
  explainSurfaceProjection,
  formatProjectionExplain,
  listSurfaceProjectionTelemetry,
} from '../src/domain/surface/application/surface-projection/index.js';

const out = projectResponseForChannel('signal', response);
console.log(formatProjectionExplain(explainSurfaceProjection({
  channel: 'signal',
  profile,
  projectorOutput: out,
})));
// answers "why no buttons?"
```

### Channel adoption (post F0–F6)

| Channel | How to send | How inbound decides |
|---------|-------------|---------------------|
| **Desktop** | Experience API enriches approvals with `surfaceProjection` (shortcuts/copy/receipt); card keys 1–4 | `resolveApproval(id, choice)` |
| **Discord** | `replyWithDiscordSurfaceResponse(ctx, response, { trackApprovalId })` | Button/select → `parseSurfaceInteraction` → `/approve` pipeline; text numbers via `tryConsumeMessagingPermissionText` |
| **WhatsApp / Signal / Slack** | `replyWithMessagingSurfaceResponse({ channel, chatId, response, send })` or shared reply + pending | WebhookGateway numbered/`/approve` pre-broker consume |
| **Telegram** | `replyWithTelegramSurfaceResponse` (already) | callbacks + reactions + voice STT |
