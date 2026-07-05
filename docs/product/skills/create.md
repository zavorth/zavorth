---
title: "Creating skills"
description: "Build your own skill — from scratch, from a workflow, or by teaching Zavorth on the fly."
---

Skills are plain Markdown files, but every new skill enters a governed preview first. Creating one starts with writing what you want it to do, then reviewing scanner results, provenance, and the approval receipt before it can run.

## The fastest way — teach Zavorth while you work

Tell Zavorth to watch what you do:

```
I'm going to deploy the app. Watch what I do and create a skill for it.
```

Do the task. Zavorth drafts a skill based on the steps you took and asks:

```
Here's the skill I drafted:

  Name: deploy-app
  What it does: runs npm build, syncs to server, restarts the service
  Triggers: "deploy", "push to production", "release"

  Save this skill? [yes / edit / skip]
```

Approve it to create a governed draft. Runtime activation still requires scanner clearance, an explicit approval path, and a receipt.

## From the wizard

```bash
zavorth skills create
```

The wizard asks:
1. What should this skill do? (plain English)
2. What phrases should trigger it?
3. What steps does it take?
4. Does it need file access, the web, shell commands?

It generates the `SKILL.md` and shows you a preview before saving.

## Writing a skill manually

A skill is a `SKILL.md` file. Minimal example:

```markdown
---
name: daily-standup
description: Summarizes what I worked on today from git history and open tasks.
triggers:
  - standup
  - daily summary
  - what did I do today
risk: read-only
---

# Daily Standup

Summarizes the day's work.

## Steps

1. Run `git log --since="8 hours ago" --oneline` to get today's commits
2. Read any open tasks from the task list
3. Write a 3-bullet standup summary:
   - What was done
   - What is next
   - Any blockers
```

Save this file in a governed skill source, then run the preview/import flow so Zavorth can inspect it before runtime use.

## The SKILL.md format

| Field | Required | Description |
|---|---|---|
| `name` | Yes | Unique identifier (lowercase, hyphens) |
| `description` | Yes | What the skill does in one sentence |
| `triggers` | Yes | Phrases that should activate this skill |
| `risk` | No | `read-only`, `low`, `medium`, `high` |
| `requires` | No | Tools this skill needs (shell, browser, files, network) |

The body can be in any format — bullet points, numbered steps, prose. Zavorth reads and interprets it.

## Auto-skill from repeated patterns

If you do the same task multiple times across sessions, Zavorth notices and suggests a skill:

```
I noticed you've run "npm test && npm run runtime:check" 4 times this week.
Would you like me to create a skill for this? [yes / edit / skip]
```

Review it with:

```bash
zavorth learn
```

Approve or reject candidates:

```bash
zavorth learn approve <id>
zavorth learn reject <id>
```

## Risk levels and what they unlock

| Risk level | What the skill can do |
|---|---|
| `read-only` | Read files, search memory, answer questions |
| `low` | Read and write files within the project |
| `medium` | Shell commands, web requests |
| `high` | External services, credentials, sensitive mutations |

Higher risk skills always prompt for approval before running.

## Testing a skill

```bash
zavorth run "trigger phrase for my skill"
```

Zavorth matches the trigger, shows which skill it selected, and runs it — with the normal approval flow for anything sensitive.

## Related

- [Installing skills](/docs/product/skills/install)
- [Skills overview](/docs/product/skills)
- [Memory](/docs/product/concepts/memory)
