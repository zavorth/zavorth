# Zavorth Control

The official web surface is Zavorth Control at `/control`.

`/control` should consume `ExperienceSnapshot/v1` from the Experience Core
when available. That snapshot is the shared truth for chat-first state,
approvals, Trust Lens, timeline, receipts, memory and learning candidates.

## What It Is For

Zavorth Control is the operator gateway for:

- chatting with the runtime;
- asking natural-language commands through the same Experience Core used by
  the CLI;
- seeing sessions, approvals and artifacts;
- reviewing Trust Lens risk, sandbox posture and approval choices;
- reviewing learning candidates before they change future behavior;
- checking channel and provider readiness;
- reviewing blocked or pending actions;
- continuing work without losing context.

## Setup Checklist

Zavorth Control can project a setup checklist for the three daily-use foundations:

- connect a channel;
- test a model provider;
- configure an execution backend.

The checklist is projection-only. It shows state, proof and next commands, but sensitive sends, live probes and terminal mutation remain approval-bound in the runtime.

```bash
npm run zavorth:dashboard-setup-checklist
npm run zavorth:dashboard-setup-checklist:json
```

## Daily Product Experience

Zavorth Control can also consume the `daily-product-experience` projection. It
combines the first-run checklist, daily loop, review center and quality gates so
the first screen can answer:

- what should I set up first?
- what happens when I ask for work?
- what did Zavorth learn or change?
- what still needs proof before it can be live?

```bash
npm run zavorth:daily-product-experience
npm run zavorth:daily-product-experience:json
```

This projection renders at `/control` with `renderMode:
daily-product-experience`. It is read-only: opening a card can draft a prompt or
show a checklist, but it must not send messages, mutate files, install tools,
promote learned memory or change providers by itself.

## Premium Control Blocks

The first `/control` screen should stay chat-first, but it now also renders the
daily control plane around the chat:

- `AgentPulse` for live agent, model, provider and health state;
- `ZavorthPulse` for the headline, best next action, pending decisions,
  highlights and risks;
- `ResponseProfile` for `short`, `dev`, `executive` and `mentor` answer
  styles;
- `LiveActionGraph` for the prompt -> router -> sandbox -> receipt path;
- `InteractiveDiffReview` for file and hunk decisions without applying
  partial changes directly to the host. Hunk buttons call the governed
  `/api/experience/ask` decision path directly, then refresh the shared
  Experience Snapshot;
- `TrustLens` and action cards for risk, sandbox posture and approvals;
- `AutoHealingProgress` for validation attempts, budget and cancellation;
- `ReasoningSummaryTimeline` for safe explainability. Raw chain-of-thought
  remains private; the UI shows only the operational reasoning summary.

The response profile selector drafts a natural command instead of creating a
separate UI-only preference. The request flows through Experience Core so CLI,
Zavorth Control and Telegram see the same profile projection.

## How To Open It

From an installed CLI:

```bash
zavorth open
```

From a cloned repo:

```bash
npx zavorth open
```

Use the URL printed by the command. Local access and tokens should be handled by
the runtime and doctor flow rather than by asking users to inspect secrets
manually.

## What It Should Show Honestly

- ready capabilities;
- missing setup;
- approvals waiting for the user;
- dry-run previews;
- outbox-only channel state;
- blocked actions and the reason;
- artifacts and receipts.

## Proof OS language (Control shell)

The browser Control Vite shell keeps the same Proof OS language as Desktop:

- **Proof list** — recent receipt/run projections (`data-proof-os-list`), not a second agent timeline;
- **Risk budget** — mode + counters chip (`data-risk-budget-chip`); frozen budgets stay visible;
- **Honesty badges** — readiness states are `live` | `catalog` | `needs_setup` | `blocked` | `unknown`.

Catalog readiness must never render as live. Labels stay explicit: "Live", "Catalog only", "Needs setup", "Blocked". Optional client cache key: `zavorth.control.proof-os.v1`. Satellite remains a thin companion and must not grow into a second Control/agent surface.

## Compatibility

`/control` is kept only as a compatibility redirect for older bookmarks. New
user-facing product work should target `/control` or the Runtime API.
Maintenance shells are not final-user product surfaces and should not appear in
normal onboarding. Maintenance shells are not final-user surfaces.

## Mobile Companion

`/satellite` is the optional mobile/PWA companion surface. It should stay thin:
show chat, approval cards, receipts and safe runtime status from the same
contracts used by `/control`. It must not become a separate agent or bypass
the Policy Broker.

Use `zavorth satellite-approvals` to inspect the projection that powers the
mobile approval inbox. The PWA sends governed `capability.result` decisions back
to the runtime; the browser never executes the target action directly.

## Related

- [Quickstart](/docs/quickstart.md)
- [CLI](/docs/zavorth-cli.md)
- [Experience Core](/docs/experience-core.md)
- [Security](/docs/security.md)
- [Product Principles](/docs/product-direction.md)
