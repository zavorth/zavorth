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
- default routing requires live proof (`health` evidence or an explicit `live_probe`);
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

## Live Readiness Matrix

Use the readiness matrix to separate catalog support from live proof:

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

The live matrix adds sanitized evidence to the same contract:

- `live_passed`, `live_failed`, `live_blocked` and `live_not_run` counters;
- `liveReady`, `defaultRouteAllowed`, `readinessProof` and `defaultBlockReason` per provider;
- `catalogReadyButNotLive` and `defaultRouteAllowed` counters for honest selection;
- `target` without query strings or credentials;
- HTTP status, duration, model count when available and an evidence hash;
- no raw API keys, bearer tokens or request bodies in the projection.

Use `--live` only when the operator deliberately wants a real provider call.
Without `--live`, the command remains a catalog/readiness view.
Catalog support is intentionally not live proof. A provider can be configured and
still be blocked from default routing until it has either healthy runtime
evidence or a fresh explicit live probe.

The Dashboard provider cockpit is a projection contract, not a visual
change by itself. It exposes cards, actions, health checks and receipts for
`/dashboard`, but keeps `executionAuthority=false` and
`visualMutationApplied=false` until a concrete dashboard block is approved.

The visual approval pack turns that projection into a reviewable proposal:
target placement, data bindings, interaction model, acceptance criteria and
rollback plan. It still keeps `approved=false`, `userVisible=false` and does
not touch the dashboard layout.

## Dashboard Provider Cockpit

The approved dashboard block is implemented as a narrow right-panel card in
`/dashboard`. It renders only the `providerCockpit` projection published by the
runtime:

- ready/total provider counts;
- live pass/fail/blocked counters;
- top provider cards with readiness, live state and sanitized evidence;
- read/probe command preparation through the chat draft;
- no dashboard-side provider fetches, no raw secrets and no hidden execution.

Live probes remain explicit operator actions. The Dashboard can prepare
the command, but it does not execute provider calls from the browser.
