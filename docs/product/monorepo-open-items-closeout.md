# Monorepo open-items closeout (post mesh + agent-first)

Status of the five residual items after the skill/worker + Telegram hardening trail.

## 1. Repo-wide health (desktop / control / CI)

| Check | How | Status |
|-------|-----|--------|
| Skill/worker mesh QA | `npm run qa:skill-worker-mesh` | **OK** |
| Mesh tools registration | dynamic connectivity suite | **OK** |
| Permission / TOTP / admin | TelegramPermissionController tests | **OK** |
| Runtime typecheck | `npm run runtime:check` (8GB heap) | **OK** (fixed mesh TS errors) |
| Desktop typecheck | `npm run typecheck` in `apps/zavorth-desktop` | **OK** (fixed strict string/process types) |
| Control shell | `apps/zavorth-control-vite-shell` | product path; use package scripts when present |

**Resolved:** runtime + desktop typecheck were fixable with heap + real TS fixes — not “impossible”.

## 2. Residual W0–W10 noise

| Location | Policy |
|----------|--------|
| Product services / tools / guidance | **Cleaned** of “W1/W5/W7…” comment labels |
| `ZavorthSkillWorkerMeshContract` wave IDs | **Kept** as stable gate tokens (`W0`…`W10`) for tests/compat; comments now say “capability gates” |
| Permanent docs (`skill-worker-mesh-waves-closeout.md`) | Historical product record — intentional |

## 3. Agent-first on **all** surfaces (no primary channel)

**Single source of truth:** `isSurfaceAgentFirstEnabled()` / `shouldPassNaturalTextToAgent()` in `SurfaceAgentFirstMode.ts`.
**Product contracts:** `docs/product/surface-agent-contracts.md` (C1 power · C2 high-risk · C3 skill install).

| Env | Effect |
|-----|--------|
| *(default)* | Agent-first **ON** for Telegram, Desktop, Control, CLI, Discord, web, API, … |
| `ZAVORTH_SURFACE_AGENT_FIRST=0` | Agent-first **OFF** globally |
| `ZAVORTH_TELEGRAM_AGENT_FIRST=0` | Agent-first **OFF** on Telegram only |

| When ON (default) | When OFF |
|-------------------|----------|
| Free text → agent (`pass_to_agent`) on every surface | No early pass_to_agent short-circuit |
| Slash / callbacks stay deterministic | Unchanged |

**Does not** restore deleted free-text intent packs. **No surface is product-primary.**

## 4. Broad tests

Recommended package for this trail (run with `ZAVORTH_PLUGIN_OS_RUNTIME=0` to reduce open handles):

```powershell
$env:ZAVORTH_PLUGIN_OS_RUNTIME='0'
npx jest tests/integration/SkillWorkerMeshAgentConnectivity.dynamic.test.ts `
  tests/domain/surface/SurfaceAgentFirstMode.test.ts `
  tests/telegram/controllers/TelegramPermissionController.test.ts `
  tests/contracts/ZavorthSkillWorkerMeshContract.test.ts `
  tests/services/SkillInstallPipelineService.test.ts `
  tests/services/SkillTrustScoreService.test.ts `
  tests/services/WorkerMeshService.test.ts `
  --forceExit --testPathIgnorePatterns=[]
npm run qa:skill-worker-mesh
```

## 5. Publish / ops (remote marketplace)

| Layer | Status |
|-------|--------|
| Local install pipeline (preview/consent/receipt) | **Product-ready** |
| Agent tools + daily-ops exposure | **Connected** |
| Plugin marketplace remote refresh (`ZAVORTH_PLUGIN_MARKETPLACE_URL`) | **Hook exists** (ops/cache) |
| **Local skill package signing** | **Implemented** — CLI `skill sign/verify` + `signSkillPackage()` (hmac-sha256 + AUTHOR_KEY.pub) |
| **Registry index export** | **Implemented** — `skill registry-export` + `SkillRegistryOpsService.writeIndex` |
| **Publish plan (dry-run)** | **Implemented** — CLI `skill publish-plan` / `publish --dry-run`; tool `publish_plan`; artifact `publish-plan.json` |
| **Trusted hosts list** | **Implemented** — defaults + `ZAVORTH_SKILL_TRUSTED_DOMAINS`; CLI `skill trusted-hosts` |
| Git publish host allowlist | **Enforced** on `publishToRepo` / registry URL + preflight on live `publish` |
| Force / trust / auth / sign | **Operator-gated** |
| CI sign/verify/export/plan skeleton | **Wired** — `.github/workflows/skill-registry-sign.yml` + `npm run skill-registry:ops` (+ workflow_dispatch plan inputs) |
| **Control / Desktop Registry ops UI** | **Implemented** — Desktop Skills → Registry ops; Control Skills sector panel; `GET/POST /api/skill-registry*` |
| **Fixture skill in repo** | **Implemented** — `skills/registry-ops-fixture` (signed; CI verifies + exports real index) |
| Hosted CDN + public key distribution | **Still ops/infra** (keys in CI/secrets store, hosting) — code can sign/verify/export/plan; cannot invent a production CDN from the app alone |

**Policy:** agents install with consent; signing is operator-local; CDN distribution remains deployment, not a missing code path.

**Ops docs:** `docs/product/skill-registry-ops.md`

## Env cheat-sheet

```bash
# Product defaults (no env needed for agent-first Telegram)
ZAVORTH_TOOL_EXPOSURE_PROFILE=daily-ops

# Optional kill / ops
ZAVORTH_TELEGRAM_AGENT_FIRST=0
ZAVORTH_PLUGIN_OS_READY_TIMEOUT_MS=15000
ZAVORTH_SKILL_ALLOW_FORCE=1
ZAVORTH_SKILL_OPERATOR_MODE=1
ZAVORTH_WORKER_HEALTH_ALLOW_LOOPBACK=1

# Skill registry ops
ZAVORTH_SKILL_SIGNING_KEY=...           # operator signing (≥16 chars)
ZAVORTH_SKILL_TRUSTED_DOMAINS=host1,host2
ZAVORTH_SKILL_REGISTRY_URL=https://github.com/org/skills
ZAVORTH_SKILL_PUBLISH_REPO=https://github.com/org/skills
ZAVORTH_SKILL_PUBLISH_DRY_RUN=1         # force publish → plan only
```
