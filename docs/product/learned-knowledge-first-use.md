# Learned Knowledge — first use (≤10 minutes)

Prove that Zavorth **remembers workflows, conversations, who you are, and project knowledge** — without spelunking the monorepo.

**Honesty:** free text is always model + tools (never keyword→feature). Slash/CLI are explicit. Pack ranking is **store scores only**.

## One command (hermetic, no network)

```bash
npm run knowledge:golden-path
```

Aliases:

```bash
npm run qa:zavorth-learned-knowledge-golden-path
npx tsx scripts/learned-knowledge-golden-path.ts
npx tsx scripts/learned-knowledge-golden-path.ts --json
```

Expect `[pass]` for:

| Step              | What it proves                                           |
| ----------------- | -------------------------------------------------------- |
| workflow-draft    | Multi-tool success → skill draft (Workflows)             |
| continuum-capture | Chat turn stored for Conversation recall                 |
| about-you-propose | Operator fact draft (About you)                          |
| wiki-index        | Knowledge pillar ready (wiki index)                      |
| pack-inject       | Multi-pillar pack + untrusted inject + no keyword intent |
| story-timeline    | Cross-pillar “this week” events                          |
| hub-snapshot      | Control/Desktop JSON: events + advanced                  |
| dream-preview     | Consolidate preview + last-run receipt (no promote)      |
| forget-workflow   | Operator can forget a draft by id                        |
| free-text-purity  | UX router does not keyword-route features                |
| vault-metrics     | Advanced file-index counts when vault exists             |

`claimsLiveIntelligence` stays **false** (no live LLM).

## Manual product trail (~10 minutes)

### 1. Status (30s)

```bash
zavorth knowledge status
```

You should see four pillars, a Story summary, and Advanced (vault / dream).

### 2. Multi-tool → Workflow (2–3 min)

Use Desktop/CLI agent with tools (or re-run the golden path). After a successful multi-tool turn:

```bash
zavorth knowledge workflows
# or
zavorth learn list
```

### 3. Conversation recall (1 min)

After real chat with continuum on:

```bash
zavorth knowledge recall "provider mesh"
# or
/knowledge recall provider mesh
```

### 4. Pack (1 min)

```bash
zavorth knowledge pack "how do we run the release checklist?"
```

Check: inject is budgeted, untrusted-tagged, and not free-text keyword gated.

### 5. Story + Advanced (2 min)

```bash
zavorth knowledge story
zavorth knowledge advanced
zavorth knowledge consolidate   # PREVIEW only
```

Open **Control** or **Desktop Settings → Learned knowledge**:

- **This week** — event list (pillar chip + time + snippet)
- **Advanced** — vault metrics, dream last-run, cadence hint

### 6. About you (1 min)

```bash
zavorth knowledge about propose preferred_style=short-technical
zavorth knowledge about
```

### 7. Forget (30s)

```bash
zavorth knowledge forget workflows <draft-id>
# or about:
zavorth knowledge forget about <fact-id>
```

## What “done” looks like

You can answer without reading the monorepo:

1. Name the **four pillars**.
2. Show a **workflow draft** from multi-tool work.
3. Show **story events** for this week.
4. Show **pack** inject is untrusted + budgeted.
5. Show **forget** works for a draft you created.

## Related

- [learned-knowledge-plane.md](./learned-knowledge-plane.md) — architecture phases 0–7 + Package A/B
- [experience-skill-learning-loop.md](./experience-skill-learning-loop.md) — Workflows engine
- [demo-scripts.md](./demo-scripts.md) — Script D (operator demo)
- [HOW-TO-TEST-VALUE.md](./HOW-TO-TEST-VALUE.md) — value surface checklist
- [first-use.md](./start/first-use.md) — general product first chat

## Free-text purity (Package C)

```bash
npm run purity:package-c
```

Matrix: [free-text-purity-matrix.md](./free-text-purity-matrix.md) — free text never keyword→feature; slash/CLI stay deterministic.

## Anti-claims

- Golden path is **hermetic** — not live multi-step IQ.
- Dream consolidate is **preview only** — never silent wiki promote.
- Preference / spine learning is a **separate plane** from Workflows.
