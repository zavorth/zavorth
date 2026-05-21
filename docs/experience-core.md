# Experience Core

Experience Core is the shared product layer for Zavorth CLI, Command Center and
future companion surfaces.

## Contract

The canonical read model is `ExperienceSnapshot/v1`.

It contains:

- agent state;
- active journey;
- chat messages and suggestions;
- approvals;
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
zavorth ask "por que o runtime esta bloqueado?"
zavorth run "revise esse repo"
zavorth approve <approval-id>
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
