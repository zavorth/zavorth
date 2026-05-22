# Experience Core

Experience Core is the shared product layer for Zavorth CLI, Command Center and
future companion surfaces.

## Contract

The canonical read model is `ExperienceSnapshot/v1`.

It contains:

- agent state;
- daily HUD summary;
- active journey;
- chat messages and suggestions;
- approvals;
- cross-channel action cards;
- diff reviews with files and hunks;
- execution graph nodes;
- context recovery choices;
- auto-healing progress;
- safe reasoning summary;
- reasoning timeline;
- receipts;
- memory signals;
- learning candidates;
- Trust Lens;
- next safe actions;
- health warnings.

The write model is `ExperienceCommand/v1`.

It accepts natural language plus surface/session/workspace metadata. The
Natural Command Router turns it into an `ExperiencePlan/v1`, then the
Experience Core either resolves a deterministic command or hands the task to
the governed agent runtime.

Experience commands can also carry governed decisions:

- `actionCardDecision` for a cross-channel action card;
- `diffDecision` for a plan/file/hunk selection;
- `contextRecoveryDecision` for an ambiguous target choice;
- `autonomyMode` as `manual`, `governed` or `speculative`.

These decisions do not bypass policy. Diff selections recompose a mutation
plan and sensitive work still requires approval and receipts before host
changes.

## Public Routes

- `GET /api/experience/home`
- `POST /api/experience/ask`
- `GET /api/experience/runs/:id/timeline`
- `GET /api/experience/approvals`
- `POST /api/experience/approvals/:id/decision`
- `GET /api/experience/learning`
- `POST /api/experience/learning/:id/decision`

These routes are management-auth protected and should be used by product
surfaces instead of rebuilding runtime truth independently.

## CLI

The natural-first entry points are:

```bash
zavorth
zavorth hud
zavorth ask "por que o runtime esta bloqueado?"
zavorth run "revise esse repo"
zavorth approve <approval-id>
zavorth diff
zavorth diff approve <review-id>
zavorth diff reject-hunk <review-id> <hunk-id>
zavorth learn
zavorth learn approve <candidate-id>
zavorth learn reject <candidate-id>
zavorth learn promote <candidate-id>
zavorth learn export --json
zavorth learn reset
```

Advanced commands remain available, but normal users should be guided through
the Experience Core first.

## Safety And Learning

Sensitive work must surface through Trust Lens: risk, sandbox posture,
approval options and receipts. Learning candidates are never promoted into
future behavior until explicitly approved or promoted by the user.

## Telegram And Channels

Telegram consumes the same Experience Snapshot when wired into the runtime. It
renders compact action cards with opaque callback ids and short summaries for
status, blocked work, diff review and learning. It must not serialize full
diffs, logs or secrets into callback payloads.
