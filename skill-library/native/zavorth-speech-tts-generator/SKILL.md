---
name: Local Speech TTS
description: Generate voice outputs and audio files locally for voice channels.
license: Zavorth-Internal
---

# Local Speech TTS

Use this native skill when:
- The task requires operations in the 'media' domain.
- Performing actions matching: generate voice outputs and audio files locally for voice channels.

## Operating Rules

- Synthesize text responses into speech using local TTS setups.
- Normalize volume and filter artifacts.
- Enforce file lock mechanisms during parallel sound writes.

## Output

Return path to synthesized voice file, voice properties, and runtime stats.
