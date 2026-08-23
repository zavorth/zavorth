# Zavorth Project Memory

## Project Identity

- **Name:** Zavorth
- **Purpose:** a governed AI agent that can act, prove what it did, and stay accountable through receipts, approvals, rollback paths, and evidence.
- **License:** MIT
- **Primary stack:** TypeScript, Node.js, Next.js-style dashboard surfaces, CLI/runtime packages, SQLite-backed runtime state, Jest-based tests.
- **Design posture:** local-first, provider-agnostic, extensible, evidence-backed, and safe-by-default.

## Core Product Principles

- User-facing behavior should adapt to the user's language and surface.
- Internal code, comments, prompts, errors, and documentation should stay in English unless the file is a locale/i18n catalog, a multilingual fixture, or a test that explicitly validates language behavior.
- Free-text intent should be handled semantically by the model/tool layer, not by keyword lists tied to a small set of languages.
- Deterministic code is appropriate for structured commands, IDs, protocols, paths, safety policy, approvals, schemas, and technical parsing.
- Runtime features should be provider-agnostic unless a provider-specific integration is the feature itself.
- Sensitive or mutating actions must remain governed by preview, approval, policy enforcement, execution boundaries, receipts, and rollback where applicable.

## Architecture Overview

Zavorth is organized around a governed runtime:

1. Capture the request and surface context.
2. Normalize structured inputs and preserve user intent.
3. Select capabilities through tools, slash commands, CLI commands, or model-mediated routing.
4. Classify risk and scope.
5. Produce preview or plan when mutation is possible.
6. Require approval when policy demands it.
7. Execute through the appropriate gateway, adapter, provider, tool, or sandbox.
8. Record receipts and evidence.
9. Surface the result in the user's context.

Major planes include:

- **Surface plane:** CLI, dashboard, API, Telegram and other channels.
- **Gateway spine:** cross-surface session state, routing, and continuity.
- **Policy plane:** approvals, guards, trust levels, side-effect gates, and mutation boundaries.
- **Execution plane:** tools, providers, sandboxes, skills, scheduled tasks, and supervised runs.
- **Memory and artifact plane:** receipts, artifacts, user memory, semantic stores, replay learning, and exports.
- **Capability plane:** discovery, capability negotiation, provider catalogs, integrations, and tool exposure policy.

## Current Engineering Direction

- Prefer central registries, typed contracts, and tool metadata over scattered keyword heuristics.
- Prefer canonical JSON or typed objects for internal control flow.
- Let the LLM interpret natural language when the input is human intent.
- Keep technical regex only when it is the clearest and safest tool for a technical format.
- Remove roadmap residue, campaign labels, and internal engineering slogans when they are not part of a runtime contract.
- Keep examples, tests, and fixtures realistic, but avoid fake success paths in runtime code.
- Avoid naming external agents, vendors, or projects in comments/functions unless the integration contract requires the real product name.

## Provider and Search Direction

- Model and search behavior should support any configured provider that satisfies the capability contract.
- Fast search and deep research should be separate tools so routine web lookup does not inherit deep-research token cost.
- Deep research should be LLM-selected, provider-agnostic, multi-step when requested, and backed by real search adapters and real synthesis where credentials/configuration allow it.
- If no synthesis provider is available, tools should return honest raw/structured results rather than simulated conclusions.

## Scheduling Direction

- Natural scheduling must not parse user language with fixed English or Portuguese tokens.
- Human scheduling requests should be resolved by an LLM schedule intent resolver into canonical schedule JSON.
- The deterministic parser should validate canonical objects and compute times; it should not infer natural language.

## Safety and Trust Direction

- Attachments and external content are untrusted evidence by default, not executable instructions.
- Approvals must be scoped to the requested payload and workspace/tool boundary.
- Secrets should stay in SecretRef or governed credential channels.
- Runtime status should distinguish catalog readiness, configured credentials, live proof, and actual execution.

## Memory Usage

This file is curated project memory. It should stay concise, durable, and directly useful to future maintenance. Do not store raw chat transcripts, temporary migration notes, or campaign cleanup logs here.
