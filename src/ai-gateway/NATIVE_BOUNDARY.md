# Zavorth Gateway Boundary

Status: active

This subtree owns the local Zavorth web gateway, dashboard runtime, storage
adapters, auth adapters, proxy helpers and realtime transports.

## Contribution Rules

- Keep operator-facing language Zavorth-native.
- Keep compatibility code localized and fallback-only.
- Do not introduce non-Zavorth canonical route names, headers, storage labels,
  comments or product copy.
- Preserve dashboard, provider, channel and approval behavior while replacing
  internals deliberately.
- Any compatibility path must have a native owner and a bounded role.

## Operational Inventory

| Path family | Role | Owner |
| --- | --- | --- |
| `src/ai-gateway/app/**` | Dashboard and local web app surfaces. | Zavorth dashboard |
| `src/ai-gateway/shared/**` | Shared UI components and presentation helpers. | Zavorth UI system |
| `src/ai-gateway/lib/db/**` | local gateway persistence and backup adapters. | Zavorth storage plane |
| `src/ai-gateway/lib/oauth/**` | local auth profile resolution. | Zavorth auth plane |
| `src/ai-gateway/mitm/**` | local proxy support. | Zavorth proxy plane |
| `src/ai-gateway/sse/**` | Realtime event transport. | Zavorth transport plane |
| `src/ai-gateway/instrumentation-node.ts` | Runtime boot instrumentation. | Zavorth gateway runtime |
| `src/ai-gateway/proxy.ts` | Request proxy entrypoint. | Zavorth gateway runtime |
| `src/ai-gateway/server-init.ts` | Server initialization. | Zavorth gateway runtime |
| `src/services/ZavorthGateway*.ts` | Gateway service anchors. | Zavorth runtime services |
| `src/services/ZavorthBridge*.ts` | Governed bridge services. | Zavorth runtime services |

## Compatibility Boundary Register

Compatibility is allowed only as fallback-only glue while native Zavorth owners
exist. These files may hold temporary bridge behavior, but must not define
canonical product naming, operator copy, route names, headers, storage names or
runtime ownership:

| Boundary file | Allowed role | Canonical owner |
| --- | --- | --- |
| `src/ai-gateway/lib/db/storagePlane.ts` | Migration/table compatibility fallback only. | Zavorth storage plane |
| `src/ai-gateway/lib/db/jsonBackupAdapters.ts` | Import/export compatibility fallback only. | Zavorth settings backup contract |
| `src/ai-gateway/lib/oauth/authPlane.ts` | OAuth environment alias fallback only. | Zavorth auth plane |
| `src/ai-gateway/mitm/proxyPlane.cjs` | Proxy environment alias fallback only. | Zavorth proxy plane |
| `src/ai-gateway/sse/transportPlane.ts` | Transport/header fallback only. | Zavorth transport plane |
| `src/ai-gateway/sse/compat/openSseCompat.ts` | SSE package bridge only. | Zavorth SSE transport |

Any new compatibility file must be added here before it is treated as
intentional.

## Automated Gate

Run this gate before changing the gateway subtree:

```bash
npm run identity:hygiene
```

The gate is implemented in `scripts/zavorth-native-boundary-check.mjs` and
enforces:

- this boundary document stays active;
- forbidden legacy residues stay out of canonical gateway files;
- dead `.orig` files do not come back;
- compatibility boundaries remain registered instead of becoming implicit canon.
