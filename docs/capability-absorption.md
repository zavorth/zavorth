# Zavorth Capability Absorption Map

This document is the Phase 1 bridge between the comparative analysis of Zavorth,
OpenClaw and Zavorth-native Agent and the Zavorth-native implementation plan.

The goal is not to copy another agent blindly. The goal is to absorb useful
capabilities into Zavorth's own surface: Effect Boundary, Policy Broker,
SecretRefs, approvals, receipts, Mnemos, Channel Mesh, Provider Mesh, Command
Center and the CLI.

## Status Vocabulary

- `native`: Zavorth already has a contract, service, script or documented surface.
- `partial`: Zavorth has a real base, but still needs deeper live UX or proof.
- `cataloged`: Zavorth knows about the capability, but it is not a live adapter.
- `requires_credentials`: the feature can only be proven with real user secrets.
- `requires_app`: the feature requires signed desktop/mobile artifacts.
- `missing`: no meaningful Zavorth-native implementation exists yet.

Important: catalog is not live proof. A channel, provider or skill appearing in a
catalog must not be routed as live until credentials, allowlists, policy and
receipt proof exist.

## Phase Plan

### Phase 2 - Channel Deepening

Turn long-tail channels into real Zavorth channels one by one:

- setup;
- doctor;
- pairing or allowlist;
- send/read where the API permits it;
- delivery receipt;
- safe outbox fallback when live transport is unavailable.

### Phase 3 - Learning Loop

Strengthen Mnemos into a governed learning loop:

- auto-skill candidates after successful complex tasks;
- skill improvement candidates;
- session search;
- user model candidates;
- explicit approval before changing future behavior.

Learning cannot modify security policy, sandbox rules, allowlists or approval
rules.

### Phase 4 - ZavorthControl

Upgrade `/control` with Zavorth-native advanced interaction patterns:

- tool call cards;
- subagent cards;
- approval cards;
- token/cost/context meter;
- retry/edit/queue flows;
- streaming and reconnect QA.

### Phase 5 - Browser And Computer Use

Make browser and desktop control first-class Zavorth capabilities:

- CDP/Playwright sidecar;
- screenshot, click, type and extract;
- supervised computer-use actions;
- domain/app policy;
- visible receipts.

### Phase 6 - Execution Backends

Unify local, Docker, SSH, WSL and cloud sandboxes through the same Effect
Boundary:

`intent -> effect -> policy -> rehearsal -> approval -> execution -> receipt`.

### Phase 7 - Satellite Apps

Use Satellite nodes and native companion packs for:

- desktop tray;
- mobile pairing;
- notification;
- voice;
- canvas;
- device permissions.

### Phase 8 - Plugin SDK

Formalize plugins/extensions with:

- manifest;
- permission scope;
- checksum/signature;
- sandbox;
- lifecycle hooks;
- marketplace or local registry;
- per-plugin doctor.

### Phase 9 - Live Product QA

Run a real fresh-user proof:

- install;
- setup provider;
- connect one real channel;
- run one prompt;
- approve one mutation;
- view zavorthControl;
- inspect receipt;
- produce a live proof pack.

## Commands

```bash
npm run zavorth:capability-absorption
npm run zavorth:capability-absorption:json
npm run zavorth:capability-absorption:check
```

The check is intentionally conservative. It passes when the map is present and
honest; it does not require every capability to be complete in Phase 1.
