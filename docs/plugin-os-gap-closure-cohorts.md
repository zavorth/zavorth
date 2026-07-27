# Plugin OS capability cohorts

This document describes the release-maturity cohorts tracked by
`config/plugin-os-gap-cohorts.json`. The machine-readable manifest is the
canonical source for cohort membership, package identifiers, status, APIs, and
exit criteria.

The cohort identifiers describe related capability groups. They are not an
implementation sequence and do not change runtime behavior. A package is
considered available only when its own manifest, certification, and runtime
evidence report it as available; membership in a cohort is not proof of a live
integration.

Persisted manifests using the legacy field alias are accepted only by the
explicit compatibility adapter in `scripts/generate-plugin-atlas.mjs`. New
manifests must use `cohorts` and `collectionN` tags.

To regenerate the verified atlas:

```bash
node scripts/generate-plugin-atlas.mjs
```
