# Universal Power Fabric

Power Fabric is Zavorth’s plane for **elastic execution**, **trusted single-user
posture**, **governed learning promotion**, **external harness adapters**, and
**context/cost discipline**.

Live mutation stays off by default. Catalog/config is not live proof.

## Backends (including elastic)

| Backend | Role | Elastic / hibernate |
| --- | --- | --- |
| local | Supervised host shell | no |
| docker / wsl / singularity | Isolated containers / VM | on-demand |
| ssh | Remote shell | no |
| vercel-sandbox | Managed cloud sandbox | yes |
| **modal** | Cloud function exec | **yes** |
| **daytona** | Cloud dev workspace exec | **yes** |

Modal and Daytona are **first-class configurable backends** (not “planned-only”).
They still need credentials, plan preview, approval, live flag, and receipts.

```bash
zavorth power backends
zavorth power plan --backend modal --command "npm test"
zavorth execution-backends --backend modal --command "npm test"
# live still requires approval + ZAVORTH_TERMINAL_BACKENDS_ALLOW_LIVE=true
```

### Env hints

- Modal: `ZAVORTH_MODAL_ENABLED` or `MODAL_TOKEN_ID` + `MODAL_TOKEN_SECRET` / `ZAVORTH_MODAL_TOKEN`
- Daytona: `ZAVORTH_DAYTONA_ENABLED` or `DAYTONA_API_KEY` / `ZAVORTH_DAYTONA_API_KEY` + `ZAVORTH_DAYTONA_WORKSPACE`

## Trusted Operator Mode

Reduces approval noise for **green / read-only** work on a single-user machine.

Does **not**:

- bypass red lane / security-policy changes
- skip receipts
- auto-approve high-risk mutations

```bash
zavorth power trusted on --note "personal workstation"
zavorth power trusted off
zavorth power decide --description "summarize repo" --risk low
zavorth power decide --description "rm -rf build" --mutation --risk high
```

## Learning promote (Yellow one-tap)

Green preferences can auto-persist via Adaptive Learning OS.
Yellow shadow skills / procedures stage for review, then promote with consent:

```bash
zavorth power learn observe "After successful runs, create a skill for PR review"
zavorth power learn list
zavorth power learn promote <id> --consent
```

## External harness adapters

Register any CLI / ACP-compatible / HTTP / stdio executor without product brands:

```bash
zavorth power harness list
zavorth power harness register --label local-runner --command "runner --stdio"
```

Read-only by default. Mutations need a separate approval path.

## Context discipline

```bash
zavorth power context
zavorth power context --tools 40 --skill-bytes 50000
```

Keeps tool schemas and skill bodies budgeted for prompt-cache friendliness.

## CLI surface

```bash
zavorth power
zavorth power backends
zavorth power plan --backend daytona --command "pytest"
zavorth power trusted on
zavorth power learn observe "..."
zavorth power harness register --label ...
zavorth power context
```

## Action Harness

| Action | Purpose |
| --- | --- |
| `power.inventory` | Full power snapshot |
| `power.backend.plan` | Backend plan preview |
| `power.trusted.toggle` | Enable/disable Trusted Operator Mode |
| `power.learn.observe` | Observe + stage yellow candidates |
| `power.learn.promote` | Promote yellow candidate with consent |
| `power.harness.register` | Register external harness |
| `power.context` | Context/tool budget |

## Safety invariants

1. Live mutation off by default.
2. Elastic backends need config + approval + receipts.
3. Trusted mode never bypasses red lane.
4. Learning promotion needs consent.
5. External harness read-only default.
6. Brand-agnostic adapters only.
7. No raw secrets in receipts.

## Related

- [Terminal backends](./terminal-backends.md)
- [Adaptive Learning OS](./adaptive-learning-os.md)
- [Capability Fabric](./capability-fabric.md)
- [Reach Fabric](./reach-fabric.md)
