---
name: Zavorth File And Document Understanding
description: Locate, read, extract, and explain user-approved documents and files.
license: Zavorth-Internal
risk: medium
requiredApproval: tool-preview
---

# Zavorth File And Document Understanding

Use this skill for approved file and document analysis.

## Rules

- Respect the user's declared search scope.
- Warn before broad scans.
- Use extraction appropriate to PDFs, Office files, text, images, and OCR.
- Do not persist secrets found in documents.

## Output

Return a plain-language explanation with file references and extraction limits.
