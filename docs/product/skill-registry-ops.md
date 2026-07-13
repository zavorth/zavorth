# Skill registry ops (sign · verify · export · publish-plan)

Operator path for local skill package signing, verification, registry index export, and **publish dry-run plans**.
This is the **code + CI skeleton** that production CDN hosting wires to — it does not host a public CDN by itself, and **never auto-pushes** to git remotes.

## What you get

| Capability | CLI | Service / CI / tool |
|------------|-----|---------------------|
| Sign package | `zavorth skill sign <dir>` | `signSkillPackage()` / `SkillRegistryOpsService.sign` / tool `action=sign` |
| Verify | `zavorth skill verify <dir>` | `verify` + package + security scan / tool `action=verify` |
| Export index | `zavorth skill registry-export` | `exportIndex` / `writeIndex` → `index.json` / tool `action=registry_export` |
| Publish plan (dry-run) | `zavorth skill publish-plan` | `planPublish` / `writePublishPlan` → `publish-plan.json` |
| Publish (live) | `zavorth skill publish` | host allowlist preflight; optional `--dry-run` |
| Trusted hosts | `zavorth skill trusted-hosts` | `getTrustedSkillGitDomains()` |
| CI dry-run | — | `.github/workflows/skill-registry-sign.yml` |

## Signature format

- **Preferred:** `SKILL.md.sig` = `hmac-sha256=<hex>` and `AUTHOR_KEY.pub` = key material used for HMAC.
- **Marker:** `AUTHOR_KEY.id` = non-secret fingerprint (`zavorth-skill-key-v1:…`).
- **Legacy:** plain SHA-256 hex of `SKILL.md` (still requires `AUTHOR_KEY.pub`).

Key material is treated as a **secret**. Do not commit real production keys. CI uses repository secret `ZAVORTH_SKILL_SIGNING_KEY` when set; the smoke script falls back to a non-secret fixture key for dry-run only.

## CLI

```bash
# Sign a skill directory (or skills/<name>)
export ZAVORTH_SKILL_SIGNING_KEY='your-operator-key-at-least-16-chars'
zavorth skill sign skills/my-skill
# or:
zavorth skill sign ./path/to/skill --key "$ZAVORTH_SKILL_SIGNING_KEY"

# Verify package + signature + security scan
zavorth skill verify skills/my-skill

# Dry-run publish plan (never pushes) — writes publish-plan.json
zavorth skill publish-plan skills/my-skill
zavorth skill publish-plan skills/my-skill --repo https://github.com/org/skills
zavorth skill publish my-skill --dry-run --repo https://github.com/org/skills

# Live publish (operator; allowlisted host only)
zavorth skill publish my-skill --repo https://github.com/org/skills

# Export registry index (default: data/runtime/skill-registry/index.json)
zavorth skill registry-export
zavorth skill registry-export --out artifacts/skill-registry/index.json
zavorth skill registry-export --base-url https://github.com/org/skills-index

# List trusted git hosts (defaults + env extras)
zavorth skill trusted-hosts
```

### Agent tool (`zavorth_skill_marketplace`)

| action | Notes |
|--------|--------|
| `sign` | Operator-gated (`operator_confirm` or `ZAVORTH_SKILL_OPERATOR_MODE=1`) |
| `verify` | Package + signature + security scan |
| `publish_plan` | Dry-run only; writes artifact |
| `publish` + `dry_run=true` | Same as `publish_plan` |
| `registry_export` | Writes index JSON |
| `trusted_hosts` | Lists allowlist |

### HTTP API (Control + Desktop)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/skill-registry` | Snapshot (skills under `skills/`, stats, trusted hosts, index) |
| `POST` | `/api/skill-registry/actions` | `refresh` · `verify` · `sign` · `export` · `publish_plan` · `trusted_hosts` |

Body fields: `action`, `skillId` / `skillDir`, `repoUrl`, `signingKey`, `operatorConfirm`, `outPath`, `baseUrl`.

**UI**

| Surface | Where |
|---------|--------|
| Desktop | Skills panel → tab **Registry ops** (`SkillRegistryOpsPanel`) |
| Control | Skills sector → **Registry ops** block (`data-skill-registry-ops`, `skill-registry-ops-ui.ts`) |

Sign is operator-gated in the API (`operatorConfirm=true` or `ZAVORTH_SKILL_OPERATOR_MODE=1`). Live git push is **not** exposed on this HTTP surface.

### Fixture skill (CI + demos)

`skills/registry-ops-fixture/` — signed package committed with **fixture-only** key:

```
zavorth-ci-smoke-signing-key-32b
```

- CI verifies signature, exports `artifacts/skill-registry/index.json`, writes fixture publish-plan.
- **Never** reuse the fixture key in production.

## Environment

| Variable | Purpose |
|----------|---------|
| `ZAVORTH_SKILL_SIGNING_KEY` | Operator signing key (≥ 16 chars) |
| `ZAVORTH_SKILL_TRUSTED_DOMAINS` | Comma/space list of extra git hosts (merged with defaults) |
| `ZAVORTH_SKILL_REGISTRY_URL` | Optional registry base URL for index export (must be trusted host) |
| `ZAVORTH_SKILL_PUBLISH_REPO` | Default `--repo` for publish-plan when omitted |
| `ZAVORTH_SKILL_PUBLISH_DRY_RUN=1` | Force publish → plan path (CLI + tool) |

Default trusted hosts include `github.com`, `gitlab.com`, `bitbucket.org`, `npmjs.org`, `npmjs.com`.

## Registry index schema

`schemaVersion`: `zavorth.skill-registry-index/v1`

```json
{
  "schemaVersion": "zavorth.skill-registry-index/v1",
  "generatedAt": "2026-07-13T20:00:00.000Z",
  "registryBaseUrl": null,
  "trustedGitDomains": ["github.com", "..."],
  "skills": [
    {
      "id": "my-skill",
      "name": "my-skill",
      "version": "1.0.0",
      "description": "...",
      "relativePath": "my-skill",
      "signed": true,
      "signatureMode": "hmac-sha256",
      "riskLevel": "low",
      "checksumSha256": "..."
    }
  ]
}
```

## Publish plan schema

`schemaVersion`: `zavorth.skill-publish-plan/v1`

Dry-run only (`dryRun: true`). `wouldPush` is true only when `--repo` is present **and** allowlisted. Live push is never performed by this document.

```json
{
  "schemaVersion": "zavorth.skill-publish-plan/v1",
  "generatedAt": "2026-07-13T20:00:00.000Z",
  "dryRun": true,
  "wouldPush": true,
  "ok": true,
  "skillDir": "/path/to/skills/my-skill",
  "skillId": "my-skill",
  "signed": true,
  "signatureMode": "hmac-sha256",
  "packageValid": true,
  "packageErrors": [],
  "riskLevel": "low",
  "repoUrl": "https://github.com/org/skills",
  "repoAllowed": true,
  "trustedGitDomains": ["github.com", "..."],
  "messages": ["..."],
  "nextSteps": ["Operator publish (live push): zavorth skill publish ..."]
}
```

## npm / CI

```bash
# Unit tests
npx jest tests/services/SkillRegistryOpsService.test.ts --forceExit --testPathIgnorePatterns=[] --runInBand
# or:
npm run skill-registry:ops:test

# Local smoke (sign → verify → export → publish-plan, no network)
npm run skill-registry:ops
# alias:
npm run ops:skill-registry
```

GitHub Actions workflow: `.github/workflows/skill-registry-sign.yml`

- Runs unit test + smoke on changes under skills/marketplace/ops/CLI/tool/tests/workflow.
- Optionally exports `artifacts/skill-registry/index.json` when `skills/**/SKILL.md` exists.
- **workflow_dispatch** accepts `skill_path` + `repo_url` and writes `artifacts/skill-registry/publish-plan.json` (plan only).
- Uploads `skill-registry-ops` artifact.
- **Does not** push to git remotes or live CDNs. Publish remains operator-gated (`zavorth skill publish … --repo` with host allowlist).

## Production CDN (still ops/infra)

| Done in repo | Still needs hosting/secrets |
|--------------|-----------------------------|
| Sign / verify / publish-plan code path | Production key distribution |
| Trusted host allowlist + env extras | Public registry URL + TLS hosting |
| Index + publish-plan artifacts | CDN deploy pipeline / cache invalidation |
| CI dry-run + artifact upload | Live publish secrets + approval gates |

**Policy:** agents install with consent; signing is operator-local; CDN distribution is deployment work, not a missing application feature.

## Related docs

- `docs/product/skills-universal-install.md` — install / preview / consent
- `docs/product/monorepo-open-items-closeout.md` — residual ops vs product status
- `docs/plugin-os-marketplace-hosting.md` — plugin marketplace remote hosting (adjacent plane)
