# Provider Mesh

Provider Mesh is the model and provider readiness layer for Zavorth.

## Purpose

It answers three questions:

1. Which provider routes are known?
2. Which models or capabilities can they expose?
3. Is this host ready to use them now?

## Readiness States

- `ready`: configured enough for provider selection, but not necessarily live-proven;
- `missing_auth`: credential or SecretRef is missing;
- `missing_base_url`: local or custom compatible endpoint URL is missing;
- `needs_probe`: a live check is required;
- `degraded`: configured but not healthy;
- `unsupported`: known but not supported by this runtime;
- `blocked`: policy prevents use.

## What Should Be Clear To Users

- provider family and concrete route are different concepts;
- a model can appear in a catalog while the host still lacks credentials;
- live readiness is stronger than manifest readiness;
- default routing requires live readiness (`health` status or an explicit `live_probe`);
- fallbacks should be explained when selected.

## Daily Model Choice

Zavorth should not expose provider choice as a flat wall of models. The product-facing
projection groups providers by intent:

- Fast and budget: Gemini Flash, GPT mini-class routes, Groq, Mistral, DeepSeek and OpenRouter.
- Highest intelligence: OpenAI, Claude, Gemini Pro-class routes, xAI and OpenRouter.
- Local and private: Ollama, LM Studio, vLLM, AIGateway and custom OpenAI-compatible endpoints.
- OpenAI-compatible: custom endpoints, AIGateway, OpenRouter, Azure OpenAI, Vercel AI Gateway and LiteLLM.

Use `zavorth providers`, `zavorth providers add` and `zavorth providers switch`
for the product-facing model choice flow.

This layer keeps broad provider coverage while preserving Zavorth's advantage:
provider choice, credentials, fallback and external effects remain policy-governed and receipt-backed.

## Provider Connection Playbook

The Provider Connection Playbook turns provider readiness into a first-run setup path:

- choose provider;
- add required credential keys as local secrets;
- configure base URL for compatible/local providers;
- confirm the default model;
- run a safe probe;
- run explicit live probe only when requested;
- allow default route only after live proof.

Catalog support is not live provider readiness. The playbook exposes key names and status, never raw secret values.

```bash
npm run zavorth:provider-connection-playbook -- --provider openai
npm run zavorth:provider-connection-playbook:json -- --provider ollama
npm run zavorth:provider-connection-playbook:check
```

## Live Readiness Matrix

Use the readiness matrix to separate catalog support from live readiness:

```bash
zavorth providers
zavorth providers --json
zavorth providers test openai
zavorth providers test openai --live
zavorth providers live --provider openai
zavorth providers cockpit --provider openai
zavorth providers visual-approval --provider openai
```

Normal rendering does not make hidden network calls or serialize provider
secrets. Test buttons should come from the same projection and trigger an
explicit operator action.

The live matrix adds sanitized readiness details to the same contract:

- `live_passed`, `live_failed`, `live_blocked` and `live_not_run` counters;
- `liveReady`, `defaultRouteAllowed`, `readinessSource` and `defaultBlockReason` per provider;
- `catalogReadyButNotLive` and `defaultRouteAllowed` counters for honest selection;
- `target` without query strings or credentials;
- HTTP status, duration, model count when available and a receipt hash;
- no raw API keys, bearer tokens or request bodies in the projection.

Use `--live` only when the operator deliberately wants a real provider call.
Without `--live`, the command remains a catalog/readiness view.
Catalog support is intentionally not live readiness. A provider can be configured and
still be blocked from default routing until it has either healthy runtime
status or a fresh explicit live probe.

The ZavorthControl provider cockpit is a projection contract, not a visual
change by itself. It exposes cards, actions, health checks and receipts for
`/control`, but keeps `executionAuthority=false` and
`visualMutationApplied=false` until a concrete zavorthControl block is approved.

The visual approval pack turns that projection into a reviewable proposal:
target placement, data bindings, interaction model, acceptance criteria and
rollback plan. It still keeps `approved=false`, `userVisible=false` and does
not touch the zavorthControl layout.

## ZavorthControl Provider Cockpit

The ZavorthControl provider cockpit renders only the `providerCockpit`
projection published by the runtime:

- ready/total provider counts;
- live pass/fail/blocked counters;
- top provider cards with readiness, live state and sanitized receipt details;
- read/probe command preparation through the chat draft;
- no zavorthControl-side provider fetches, no raw secrets and no hidden execution.

Live probes remain explicit operator actions. The ZavorthControl can prepare
the command, but it does not execute provider calls from the browser.
