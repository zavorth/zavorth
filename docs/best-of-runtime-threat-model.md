# Best-Of Runtime Threat Model

This document covers the native absorption layer inspired by Odysseus, Open
WebUI, AnythingLLM and LibreChat. The goal is not to copy those projects. The
goal is to keep Zavorth's local-first, approval-first runtime while adopting the
best product patterns.

## Assets

- local workspace paths and files;
- provider credentials and model preferences;
- MCP server manifests, tools and audit logs;
- native and imported skill prompts;
- email, calendar and task connector metadata;
- runtime receipts, stream resume tokens and scheduler recovery state.

## Trust Boundaries

- Desktop UI is a client. It reads runtime projections and dispatches commands.
- Runtime state bus is the source of truth for model, effort, workspace,
  permissions, skills, MCP, jobs and stream state.
- Provider setup stores only non-secret metadata in projections.
- Imported skills, web pages, documents, email bodies and MCP descriptions are
  untrusted context.
- Personal connectors are disabled until configured and approved by the owner.

## Threats And Controls

| Threat | Default Control |
| --- | --- |
| UI invents runtime state | Desktop reads bus/capabilities projections only |
| Imported skill bypasses approval | Quarantine, content scan, skill lifecycle receipt |
| MCP exposes unsafe tools | Trust state blocks model exposure until approved |
| SSRF/private-network egress | Private ranges and metadata hosts blocked by default |
| Provider secret leakage | SecretRefs and sanitized projections; no raw values |
| Email/calendar/task side effect | Send/write actions require explicit approval |
| Workspace escape | Folder paths are resolved and checked against allowed roots |
| Receipt spoofing | Runtime generates receipt ids and redacts caller payloads |
| Crash loses state | Runtime bus persists snapshots and replayable receipts |

## Operational Rules

- No hidden live probes from the desktop.
- No marketplace/imported capability becomes native automatically.
- No external send/write action runs from a natural-language request alone.
- No private network exception is valid without an operator receipt.
- Resume tokens are runtime state, not permission to bypass approvals.

## Verification

Run focused checks after changing this layer:

```bash
npx jest tests/services/ZavorthRuntimeStateBusService.test.ts tests/services/ZavorthRuntimeCapabilitiesService.test.ts tests/services/ExperienceCoreRuntimeStateBus.test.ts --runInBand
npm run runtime:check --silent
```
