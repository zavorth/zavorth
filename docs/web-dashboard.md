# Command Center

The official web surface is the Command Center at `/control`.

`/control` should consume `ExperienceSnapshot/v1` from the Experience Core
when available. That snapshot is the shared truth for chat-first state,
approvals, Trust Lens, timeline, receipts, memory and learning candidates.

## What It Is For

The Command Center is the operator gateway for:

- chatting with the runtime;
- asking natural-language commands through the same Experience Core used by
  the CLI;
- seeing sessions, approvals and artifacts;
- reviewing Trust Lens risk, sandbox posture and approval choices;
- reviewing learning candidates before they change future behavior;
- checking channel and provider readiness;
- reviewing blocked or pending actions;
- continuing work without losing context.

## Premium Command Center Blocks

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
Dashboard and Telegram see the same profile projection.

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

## Compatibility

`/dashboard` is kept as a compatibility redirect for older bookmarks. New
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
- [Roadmap](/docs/product-direction.md)
