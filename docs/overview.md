# Overview

Zavorth is a local-first governed agent runtime. It receives natural-language
requests, routes work through policy, asks for approval when an action is
sensitive, records receipts and keeps enough operational memory to continue
later.

## What This Repository Contains

- the agent runtime;
- the official CLI entry points;
- the Dashboard web surface at `/dashboard`;
- channel, provider, skill, subagent, scheduler and perception contracts;
- security policy, approvals, receipts and operational checks;
- docs for daily use and development.

The repository should not read like an implementation diary. Private audits,
temporary planning notes and old external-runtime plans are intentionally not
part of the public surface.

## Main Surfaces

### Dashboard

`/dashboard` is the primary web gateway. It is where users see runtime state,
approvals, sessions, artifacts, channel status and the next safe action.

### CLI

The CLI is the fastest local path for setup, status, doctor output, one-shot
requests and automation-friendly JSON.

### Runtime API

The runtime API is the integration boundary for clients and adapters. It should
surface the same governed state as the CLI and Dashboard.

### Channels

Telegram, Discord, WhatsApp, Slack, Signal, iMessage and other adapters are
optional surfaces. They should share the same Channel Mesh contract rather than
become separate products.

## Current Operating Model

1. A request enters through CLI, Dashboard, API or a channel.
2. Zavorth builds context and classifies risk.
3. Policy Broker evaluates tools, workspace, network, provider, channel and
   mutation boundaries.
4. The runtime asks for approval when needed.
5. Work runs through governed tools, subagents, skills or scheduled flows.
6. Results return as text, artifacts, receipts and replayable state.

## Roadmap

The public roadmap is intentionally small:

- transport discovery inside Channel Mesh;
- live readiness by channel and provider;
- simpler `SecretRef` setup and approval UX;
- public docs that stay current.

See [Roadmap](/docs/product-direction.md).

## Read Next

- [Quickstart](/docs/quickstart.md)
- [Dashboard](/docs/web-dashboard.md)
- [CLI](/docs/zavorth-cli.md)
- [Operations](/docs/operations.md)
- [Security](/docs/security.md)
- [Channel Mesh](/docs/channel-mesh.md)
