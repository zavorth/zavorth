---
name: Video Editor
description: Video editing automation and effects processing
license: Zavorth-Internal
---

# Video Editor

Use this native skill when:
- The task requires operations in the 'media' domain.
- Performing actions matching: Video editing automation, cuts, transitions, effects.

## Operating Rules

- Use FFmpeg for programmatic video editing operations (cuts, concatenation, format conversion).
- Apply transitions, filters, and effects using FFmpeg filter graphs or MoviePy scripting.
- Handle multi-track audio/video synchronization with proper codec and container management.
- Implement batch processing for repetitive editing tasks across multiple video files.
- Support subtitle generation, overlay, and burn-in for accessibility compliance.

## Output

- Edited video files, FFmpeg command scripts, and processing automation pipelines.
