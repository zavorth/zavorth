# Executors

Executors are the concrete routes Zavorth can use to turn intent into work.
Most users do not need to choose one manually; the runtime should route ordinary
requests through policy and capability checks.

## Common Routes

- local runtime for workspace operations;
- provider runtime for model calls;
- subagents for delegated analysis or parallel work;
- skills for governed instructions and reusable procedures;
- scheduled tasks for recurring work;
- perception tools for browser, computer and device inspection;
- channel adapters for Telegram, Discord, WhatsApp, Slack and related surfaces.

## How Routing Should Work

1. Understand the request.
2. Determine whether the action is read-only, mutating, networked or sensitive.
3. Pick the safest capable route.
4. Ask approval if the route can change files, run commands, send messages or
   touch sensitive data.
5. Return a clear result, artifact or blocked reason.

## Readiness Matters

A route can exist in code and still be unavailable on the current host. For
example, a phone bridge may need ADB authorization, a provider may need a
SecretRef, and a channel may be outbox-only until credentials are configured.

This distinction is why the roadmap keeps live readiness and transport
discovery as first-class work.

## Related

- [Architecture](/docs/architecture.md)
- [Operations](/docs/operations.md)
- [Product Principles](/docs/product-direction.md)
