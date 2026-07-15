# Experience skill learning loop

After a **successful multi-tool turn**, Zavorth materializes a **reviewable skill
draft** and may show a short nudge. Drafts are local until you promote them.

This loop is the **Workflows** pillar of the broader
[Learned Knowledge Plane](./learned-knowledge-plane.md) (workflows · conversation
recall · about you · knowledge/Mnemos).

## One sentence

Zavorth saves multi-tool workflows as local skill drafts; you promote when ready.

## Trigger

- Outcome: success (no tool failures on the conversational path)
- Tool activity: ≥ `ZAVORTH_SKILL_LEARN_MIN_TOOLS` (default **5**) tool receipts
- Quality gates: non-trivial goal, ≥2 distinct tools, secrets redacted
  (labels, Bearer/Basic, vendor tokens, PEM private keys, JWTs, `ENV_SECRET=` assignments)
  at store, inject, runSkill, show, promote, and LLM compact paths

## What is stored

Per user under:

`data/runtime/learning/users/<userId>/experience-skill-drafts/<date>_<slug>_<fp>/`

- `SKILL.md` — goal, tools, observed procedure, revisions
- `skill.meta.json` — id, title, tools, surface, useCount, revisions, eventIds

## Reuse

When a similar multi-tool task runs again:

- `useCount` increases
- New tools merge into the draft
- A **Revision** section is appended when tools change
- Provenance events are recorded when the governance bridge is available

## Optional LLM compaction

Set `ZAVORTH_SKILL_LEARN_LLM_COMPACT=1` to rewrite the **Procedure** section into
a short checklist after create/improve (or every 3rd reinforce). Failures leave
the draft unchanged. Prefer a cheap/default model path via `LlmRuntimeService`.

## User surfaces

| Surface     | How                                                                                                                                                                                 |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CLI home    | `zavorth learn` (badge, drafts, promoted, top tools, plane, nudge cooldown, weekly metrics)                                                                                         |
| CLI ops     | `zavorth learning-loop list\|search\|show\|run\|promote\|promote --dry-run\|promote --kind skill\|plugin\|both\|forget` · `--json`                                                  |
| Chat slash  | `/learn` · `/learn list` · `/learn search <query>` · `/learn show <id>` · `/learn run <id>` · `/learn promote <id> [--dry-run] [--kind skill\|plugin\|both]` · `/learn forget <id>` |
| Control     | Badge “N workflows learned” + counts + top tools                                                                                                                                    |
| Desktop     | Badge under LLM roles + `/learn` in composer                                                                                                                                        |
| Agent reply | i18n nudge: created / reused (N times) / improved (rate-limited)                                                                                                                    |

## Narrative

- First multi-tool success → “saved a reusable workflow draft”
- Same workflow again → “reused skill _X_ (N times)” or “improved … with new tools”
- Status surfaces always show the one-liner: multi-tool workflows become local drafts you promote

## Telemetry (no PII)

Structured log lines (via `logger.info`):

- `learning.skill_drafted` — new draft
- `learning.skill_reinforced` / `learning.skill_improved` — reuse
- Payload: reason, toolCount, surface, flags — never user message text

## Context injection

Recent drafts are injected into the conversational system prompt so the agent
can reuse patterns on similar tasks. Ranking and procedure depth follow
**Runtime recall & reuse score** below.

## Runtime recall & reuse score

Promoted and draft skills feed agent behavior on similar next chats, with a
measurable reuse score.

### Score fields

Each draft meta tracks:

| Field          | Meaning                                                               |
| -------------- | --------------------------------------------------------------------- |
| `useCount`     | Times the draft was created/reinforced on successful multi-tool turns |
| `successCount` | Successful reinforces/creates (success-only path)                     |
| `lastUsedAt`   | Last successful reinforce, create, or governed `/learn run`           |
| `successRate`  | Derived: `successCount / max(useCount, 1)` clamped 0..1               |

**Reuse score** (runtime ranking):

```
score = useCount * 0.4 + successRate * 30 + recencyBoost
```

Recency boost from `lastUsedAt`: within **7 days → +20**, within **30 days → +10**, else **0**.

Draft lists and inject blocks sort by score DESC, then `updatedAt`.

### Full procedure inject (runtime recall)

`formatInjectBlock(userId, limit, { userMessage, fullProcedureTopK })`:

1. Score-sort drafts (with headroom)
2. If `userMessage` is provided, compute tool-less **goal similarity** (slug/title)
3. Top-K matching drafts (default **2**) inject the full **Procedure** section
   from `SKILL.md` (between `## Procedure…` and the next `## `, redacted)
4. Remaining slots: title + tools + uses + score only
5. Header notes ranking by reuse score and full procedure only for similar goals

The conversational agent passes the current user message so similar goals recall
the full procedure, not just the title.

### Promote → discovery manifest

On successful SkillLoader install, promote also writes:

`{projectRoot}/.agents/skills/<skillName>/manifest.json`

```json
{
  "name": "<skillName>",
  "version": "1.0.0",
  "description": "<title>",
  "author": "experience-skill-learning-loop",
  "fromDraftId": "<id>",
  "promotedAt": "<iso>"
}
```

Optional user catalog (upsert by skillName):

`data/runtime/learning/users/<userId>/promoted-catalog.json`

### Weekly metrics

Per user, tracked for the current ISO week (`weekKey` like `2026-W28`):

| Counter         | When                      |
| --------------- | ------------------------- |
| `draftsCreated` | New draft created         |
| `promotes`      | Successful promote        |
| `reuses`        | Reinforce on similar turn |

Surfaced on status (`buildStatusSnapshot().metrics`) for CLI home, `/learn`,
and Control.

### Governed run (`/learn run`)

`/learn run <id>` and `zavorth learning-loop run <id>` return the draft title
plus full Procedure as **governed guidance**. Exact id only.

- Does **not** execute tools
- Bumps `lastUsedAt` only (not `useCount`)
- Telemetry reason: `skill_run_manual`
- Copy: “Governed procedure only — does not execute tools. Follow with user approval.”

## Policy

Drafts are **never auto-installed** into the live skill runtime. Promote is
explicit and still does not execute the skill automatically.

### Conservative defaults

Power users get the full loop; casual users are not bombarded.

- **No auto-install** — drafts stay local; only explicit `promote` writes to
  SkillLoader under `.agents/skills`.
- **Promote with preview** — `promote <id> --dry-run` (CLI) or
  `/learn promote <id> --dry-run` / `/learn promote-preview <id>` shows audit
  destination, skill name, runtime path, and a SKILL.md content preview
  **without writing**.
- **Nudge rate limit** — at most one user-visible nudge per cooldown window
  (default **15 minutes**). Override with `ZAVORTH_SKILL_LEARN_NUDGE_COOLDOWN_MS`
  (set `0` to disable). Status surfaces show the effective cooldown.
- **Easy forget** — `forget <id>` drops a draft you do not want (CLI + `/learn`).
- **Light plane vs heavy spine** — this loop is the **experience-skill-drafts**
  plane (multi-tool workflow drafts you promote). It is separate from the
  preference / NativeLearningLoop spine plane. Home status copy labels the plane.

### Promote → SkillIR + SkillLoader (+ optional plugin)

`promote <id>` always writes an **audit copy** under
`data/runtime/learning/users/<user>/promoted-skills/...`.

Default `--kind skill` (or omit) then materializes a **SkillIR pack**:

| Path                                             | Role                                           |
| ------------------------------------------------ | ---------------------------------------------- |
| `{projectRoot}/skills/exp-<slug>-<id8>/`         | Local search index (`SkillSearchIndexService`) |
| `{projectRoot}/.agents/skills/exp-<slug>-<id8>/` | SkillLoader / workspace-agents source          |

Each pack includes:

- `SKILL.md` with YAML frontmatter (`name`, `description`, `tools:`)
- `manifest.json`, `ORIGIN.json`, `promoted.meta.json`
- `skill.ir.json` (`skillIr` + `skillIrDigest` + `fromDraftId`)

`--kind plugin` scaffolds a Plugin OS package under
`plugins/promoted/promoted-<slug>-<id8>/` via `PluginScaffoldService`
(`schemaVersion: zavorth.plugin-os.v1`). **Never auto-enables.**

`--kind both` does skill + plugin.

Promote **receipt** (links the chain):

`data/runtime/learning/users/<user>/promote-receipts/promote-…json`

```json
{
  "schemaVersion": "zavorth.skill-promote-receipt.v1",
  "draftId": "<id>",
  "skillId": "exp-…",
  "pluginId": "promoted-…",
  "autoPromote": false
}
```

If the skill/plugin write fails, the audit copy is kept and flags report
`loaderReady` / `pluginReady` accordingly. **No auto-promote** without an
explicit promote command.

### Forget (drafts only)

`forget <id>` removes the draft directory under `experience-skill-drafts` only
(exact id; path containment checked). It does **not** delete promoted-skills or
`.agents/skills`.

## Feature flag

| Env                                     | Default           | Effect                                                                                       |
| --------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------- |
| `ZAVORTH_SKILL_LEARN_LOOP`              | on                | Set `0` / `false` / `off` to disable drafts, nudges, and prompt inject without removing code |
| `ZAVORTH_SKILL_LEARN_MIN_TOOLS`         | `5`               | Minimum tool receipts to trigger                                                             |
| `ZAVORTH_SKILL_LEARN_LLM_COMPACT`       | off               | Set `1` to compact Procedure via LLM                                                         |
| `ZAVORTH_SKILL_LEARN_NUDGE_COOLDOWN_MS` | `900000` (15 min) | Min ms between user-visible nudges per user; `0` = no limit                                  |

## Isolation (fast iteration)

- Core module: `src/services/ExperienceSkillLearningLoopService.ts`
- Barrel: `src/services/experience-skill-learning/index.ts`
- CLI: `src/cli/LearningLoopCli.ts`
- Slash: `/learn` in `SharedSurfaceSlashEnhancementCommandPack`
- Smoke: `npx tsx scripts/live-learning-loop-smoke.ts`
- Tests: `npx jest tests/services/ExperienceSkillLearningLoopService.test.ts`

Does **not** require NativeLearningLoop spine or skill marketplace to function.

## Changelog note template

```
learning-loop: <one-line change>
```

Example: `learning-loop: add disable flag ZAVORTH_SKILL_LEARN_LOOP=0`
