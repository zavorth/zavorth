---
title: "Skills"
description: "Install ready-made skills or teach Zavorth new ones."
---

Skills are reusable abilities stored as readable `SKILL.md` files.

## Installing a skill

```bash
zavorth skills install <skill-name>
zavorth skills search web
```

Before installation, Zavorth scans risk, license, provenance and content. Sensitive capabilities require approval.

## Creating a skill

```bash
zavorth skills create
```

The Learning Loop can also suggest skills from repeated workflows. Suggestions never install silently.

## Importing compatible skills

```bash
zavorth migrate --from compatible-runtime --path ~/.agent-runtime --consent
```

Imported skills enter `skill-library/imported/` and pass through the same risk scan.

## Managing skills

```bash
zavorth skills
zavorth skills info github-pr
zavorth skills remove github-pr
```

## Related

- [Memory](/docs/produto/conceitos/memoria)
