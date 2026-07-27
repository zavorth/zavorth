# Native Autonomy Spine

The Native Autonomy Spine is the daily runtime path that connects learning,
skills, dynamic missions, memory consolidation, channel proof and execution
backend proof into one reviewable flow.

It exists to make the product feel organic without making it reckless:

```text
turn completed -> pre-turn recall -> post-turn learning -> Skill Forge
-> Dynamic Mission Harness -> Mnemos Dream Cycle -> Channel live certification
-> Execution backend provider -> Review center
```

## What It Adds

- **Experience Learning Daemon** runs after successful turns, redacts secrets
  before classification and turns useful low-risk preferences into reversible
  Green Lane candidates.
- **Skill Forge** turns repeated or complex workflows into drafts. It never
  writes skill files directly and keeps executable support files behind scan,
  smoke and approval.
- **Dynamic Mission Harness** turns complex requests into declarative mission
  previews with classify, fanout, adversarial, tournament and loop patterns.
  It produces checkpoints and resumable worker tasks, can materialize approved
  previews into pending `WorkflowRunService` phases, and never executes an
  arbitrary generated script by itself.
- **Mnemos Dream Cycle** consolidates memory while idle or on request. It reads
  source sessions immutably, writes a separate candidate memory store, redacts
  secrets, quarantines sensitive user-model and policy records, and only
  applies candidates through review with rollback receipts.
- **Channel live certification** requires handshake, inbound, outbound,
  progress, stop, approval-card, file-send and receipt proof before a channel
  can become a default route.
- **Execution backend provider** requires doctor, workspace, run, stream,
  file sync, snapshot, hibernate/resume, cleanup and cost proof before live
  execution. Unproven backends stay dry-run.
- **Review center** keeps learn approve, learn reject, learn forget, skill
  draft review, channel proof review and backend proof review in one surface.

## Safety Rules

- raw secrets are redacted before classification, memory candidates, receipts
  and snapshots;
- sensitive user-model records and policy changes never enter Green Lane;
- Yellow Lane creates a quiet review candidate, not a behavior change;
- dynamic mission plans are preview-only until an approved runtime claims them;
- dream cycles never mutate the source memory store directly;
- live channel routing requires current proof;
- live mutation requires backend proof and explicit approval when risk demands
  it;
- skill creation is preview-first and rollback-backed.

## Runtime Wire

The web experience API creates the `ZavorthAgentGateway` with
`ZavorthNativeAutonomySpineService` and gives the same run store to
`ZavorthLearningPlaneService`. A successful chat turn can therefore become a
reviewable Learning OS candidate without a separate snapshot script.

The learning projection is conservative:

- Green Lane preference candidates are reversible and receipt-backed;
- Yellow Lane skill/procedure candidates stay as drafts;
- Red Lane policy or sensitive user-model candidates stay quarantined;
- Skill Forge previews never serialize the generated skill body into the
  learning plane.

Channel and backend readiness can assimilate existing native snapshots:

- `certifyFromChannelMesh(...)` uses Channel Mesh live proof, controls,
  approvals, attachments and receipts;
- catalog, configuration-only and outbox states never become a live default
  route;
- `certifyFromTerminalBackendSnapshot(...)` uses Terminal Backends descriptors
  and execution receipts;
- strong cloud/serverless certification still requires explicit smoke proof,
  and unproven backends stay dry-run.

## Commands

```bash
npm run zavorth:native-autonomy-spine --silent
npm run zavorth:native-autonomy-spine:json --silent
npm run zavorth:native-autonomy-spine:check --silent
npm run zavorth:dynamic-mission-harness --silent
npm run mnemos:dream-cycle --silent
```

This layer is intentionally Zavorth-native. It uses the existing learning,
skill, channel and backend concepts as internal product primitives with native
readiness measurements.
