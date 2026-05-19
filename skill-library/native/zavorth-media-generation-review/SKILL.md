---
name: Zavorth Media Generation Review
description: Prepare, validate, and review image, audio, video, and TTS generation requests.
license: Zavorth-Internal
risk: medium
requiredApproval: tool-preview
---

# Zavorth Media Generation Review

Use this skill for governed media generation and inspection.

## Rules

- Select providers by modality and live readiness.
- Do not claim generation worked without artifact proof.
- Sanitize prompts and avoid disallowed or unsafe content.
- Keep provider keys as SecretRefs.

## Output

Return provider choice, modality, safety review, artifact path or reason unavailable.
