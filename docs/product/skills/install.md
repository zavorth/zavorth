---
title: "Installing skills"
description: "Install and manage auditable skills."
---

Skills are plain Markdown files stored locally.

## Find and install

```bash
zavorth skills search "code review"
zavorth skills install <skill-name>
zavorth skills install --file ./my-skill/SKILL.md
zavorth skills install --url https://example.com/my-skill/SKILL.md
```

Before installation, Zavorth shows a plain-language summary, risk score, license and provenance. Downloads are scanned before install.

## Storage

```text
skill-library/
  native/
  imported/
    compatible-runtime/
    file/
    url/
```

## Inspect and update

```bash
zavorth skills info github-pr-review
zavorth skills update github-pr-review
```
