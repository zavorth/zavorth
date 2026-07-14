# Voice priorities 4–5: native barge-in + clear status UI

## 4. Native barge-in

When the server media plane (`native_wrtc`) detects sustained user speech while the duplex session is `speaking` or `processing`:

1. `VoiceNativeRtpBridge.tryNativeBargeIn` → `duplex.bargeIn()`
2. Session `bargeEpoch++`, phase → `listening`, `lastTtsAudio` cleared
3. Event bus publishes **`barge_in`**
4. Desktop `useDuplexCall` cancels local TTS playback immediately
5. In-flight TTS synthesis result is discarded if `bargeEpoch` changed

Also works on HTTP media path: client already barge-ins when new speech arrives during playback.

## 5. Status UI

`resolveVoiceCallStatus` maps phases to labels:

| Internal | UI label |
|---|---|
| connecting | Connecting |
| listening (quiet) | Listening |
| listening (rms high) | Hearing you |
| processing | Thinking |
| speaking | Speaking |
| error | Error (+ honest detail) |
| ended | Ended |

Rendered by `VoiceCallStatusBanner` in chat thread and Settings → Voice.
Phone button tooltip shows the live status label.
