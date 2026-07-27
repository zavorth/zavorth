# Universal skill install

Install skills from **any** source (path, Git URL, zip, npm, registry) with a
governed pipeline: **preview → consent → apply → receipt**. Brand-agnostic:
no third-party product allowlists are required.

**SkillIR:** every local preview/apply normalizes the pack into a shape-based
intermediate representation (`skill-md-v1` | `readme-tools-v1` | `package-json-skill-v1` |
`opaque-guidance-v1`). Receipts include `skillIrDigest`, `parserId`, and complete
`toolBinds` (`direct` | `aliased` | `gateway` | `unresolved`+`guidanceOnly`).

## Operator CLI

```bash
# Discover (local by default; --remote for network; --llm re-ranks closed results)
zavorth skill search "PR review"
zavorth skill search "PR review" --remote
zavorth skill search "PR review" --llm
zavorth skill discover "https://github.com/org/skill-pack"

# Preview (no disk write)
zavorth skill preview ./path/to/skill
zavorth skill preview https://github.com/org/repo

# Apply only with explicit consent
zavorth skill install ./path/to/skill --consent
zavorth skill install https://github.com/org/repo --only my-skill --consent

# Optional remote skill catalog (HTTPS JSON, SSRF-guarded)
# Schema: config/skill-catalog.example.json — host on any CDN / GitHub raw
export ZAVORTH_SKILL_CATALOG_URL=https://cdn.example.com/zavorth/skill-catalog.json
zavorth skill catalog refresh
zavorth skill catalog list
zavorth skill catalog show <id>
zavorth skill catalog install <id> --consent

# Receipts + trust
zavorth skill receipt
zavorth skill trust
zavorth skill trust add domain github.com/my-org/
```

## Agent tools

With `ZAVORTH_TOOL_EXPOSURE_PROFILE=daily-ops` (recommended):

| Tool                        | Actions                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------ |
| `zavorth_skill_marketplace` | `search` / `discover`, `preview`, `install` (+ `consent=true`), `receipt`, `trust`, `list`             |
| `plugin_suggest`            | Capability miss: prefer `missingTool=<name>`; else intent. Enable vs Recommend-only; never auto-enable |
| `plugin_recommend`          | Same miss loop + explainPluginId; free-text never enables                                              |
| `zavorth_action`            | Governed product operations                                                                            |

Install flow for the model:

1. `action=preview source=<url-or-path>`
2. Show plan to user if needed
3. `action=install source=... consent=true`
4. `action=receipt` if needed

## Trust profiles

Env: `ZAVORTH_SKILL_TRUST_PROFILE=safe|daily|power` (default **daily**).

| Profile | Behavior                                                             |
| ------- | -------------------------------------------------------------------- |
| `safe`  | Prefer local / owner-trusted / Zavorth-owned; reject unknown remotes |
| `daily` | Remote allowed after preview; first-seen domains need consent        |
| `power` | Lower floors for operators; receipts still required                  |

Auto-consent is **evidence-based** (score + policy), never by competitor brand name.

## Skill ↔ executors

After install, declared tool names are bound:

- **direct** — name exists on the tool registry
- **aliased** — e.g. `sandbox_execution` → `run_sandbox_code`
- **gateway** — missing tools map to `zavorth_action` / `plugin_suggest`
- **unresolved** — documented; model must not invent phantoms

See install receipt `toolBinds` and the skill snapshot prompt (resolved names only).

## Hot path

| Env                                         | Default | Effect                                                       |
| ------------------------------------------- | ------- | ------------------------------------------------------------ |
| `ZAVORTH_SKILL_HOT_PATH_CACHE`              | on      | Process-local SkillIR + bind cache; set `0` to disable       |
| `ZAVORTH_TOOL_EXPOSURE_PROFILE`             | `safe`  | `safe` \| `daily-ops` \| `full`                              |
| `ZAVORTH_TOOL_EXPOSURE_INCLUDE_MARKETPLACE` | off     | Re-include bulk marketplace tools on daily-ops always-expose |

Lean **daily-ops** keeps `plugin_suggest` for capability-miss; bulk `zavorth_skill_marketplace` is deferred until miss/suggest or `full` profile / INCLUDE_MARKETPLACE.

Install **digest short-circuit**: re-apply with the same `skillIrDigest` reuses the installed pack (no re-fetch).

## Related

- [Ecosystem extension packs](./ecosystem-extension-packs.md) — SkillIR, binds, search, catalogs, promote, external import
- [Workers mesh](./workers-mesh.md)
- [Agent harness readiness](../agent-harness-readiness.md)
- [Plugin OS marketplace](../plugin-os-marketplace.md)
