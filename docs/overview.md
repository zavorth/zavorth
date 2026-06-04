# Overview

Zavorth is a local-first governed agent runtime. It receives natural-language
requests, routes work through policy, asks for approval when an action is
sensitive, records receipts and keeps operational memory for continuity.

## What This Repository Contains

- the agent runtime;
- the official CLI;
- Zavorth Control at `/control`;
- channel, provider, skill, subagent and scheduler contracts;
- security policy, approvals, receipts and operational checks;
- user and integrator documentation.

## Main Surfaces

### Zavorth Control

`/control` is the primary web surface for runtime state, approvals, sessions,
artifacts, channel status and next safe actions.

### CLI

The CLI is the fastest local path for setup, status, doctor output, one-shot
requests and automation-friendly JSON.

### Runtime API

The runtime API is the integration boundary for clients and adapters.

### Channels

Telegram, Discord, WhatsApp, Slack, Signal, iMessage and other adapters are
optional surfaces over the same Channel Mesh contract.

## How Work Flows

1. A request enters through CLI, Zavorth Control, API or a channel.
2. Zavorth builds context and classifies risk.
3. Policy evaluates tools, workspace, network, provider, channel and mutation boundaries.
4. The runtime asks for approval when needed.
5. Work runs through governed tools, subagents, skills or scheduled flows.
6. Results return as text, artifacts, receipts and replayable state.

## Read Next

- [Quickstart](/docs/quickstart.md)
- [Zavorth Control](/docs/web-zavorthControl.md)
- [CLI](/docs/zavorth-cli.md)
- [Operations](/docs/operations.md)
- [Security](/docs/security.md)
- [Channel Mesh](/docs/channel-mesh.md)
