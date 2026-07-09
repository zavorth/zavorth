---
title: "Skills"
description: "Install ready-made skills or teach Zavorth new ones."
---

Skills are reusable abilities stored as readable `SKILL.md` files.

## Installing a skill

Skills are not limited to a fixed storefront. Ask Zavorth to find and absorb a
pack from a local path, archive, or HTTPS URL:

```bash
zavorth absorb skill ./packs/my-skill --preview
zavorth absorb skill ./packs/my-skill --apply --consent
zavorth absorb https://example.com/skill-page --kind skill --preview
zavorth skills install <skill-name>
```

Before installation, Zavorth scans risk, license, provenance and content.
Sensitive capabilities require approval. Quarantine is not the same as live enable.

## Creating a skill

```bash
zavorth skills create
```

The Learning Loop can also suggest skills from repeated workflows. Suggestions never install silently.

## Importing from any workspace home

Import skills (and related identity/memory/config) from **any** local agent or
workspace home using structural fingerprints only — no product-specific profile
is required:

```bash
zavorth import-workspace /path/to/workspace --preview
zavorth import-workspace /path/to/workspace --apply --consent
zavorth migrate /path/to/workspace --preview
```

Imported material lands under governed import/quarantine roots and passes the
same risk scan before enable.

See [Capability Fabric](../../capability-fabric.md).

## Managing skills

```bash
zavorth skills
zavorth skills info github-pr
zavorth skills remove github-pr
```

## Related

- [Memory](/docs/product/concepts/memory)
