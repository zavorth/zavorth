# AI Gateway De-Fork Freeze

Status: active

This subtree is under an active Zavorth de-fork freeze.

The goal for this track is simple:

- keep the useful gateway capabilities alive;
- replace inherited substrate with Zavorth-native implementation over time;
- prevent new inherited shapes from becoming canonical again;
- keep this work separate from the larger agent-loop refactor until the planned handoff wave.

## Contribution Rules

- Do not add new files or features here by copying inherited subtree structure.
- Do not introduce new canonical config names, headers, file-system paths, backup labels, or comments that use legacy upstream naming.
- If a legacy compatibility path must remain temporarily, keep it localized, label it as fallback-only, and avoid treating it as the default behavior.
- Preserve operator-facing capabilities while replacing internals.
- Keep convergence with the new agent loop out of this subtree until the planned Wave 5 preparation work.

## Operational Inventory

This inventory is intentionally high-signal for Wave 0 and should be refined as later waves land.

| Path family | State | Direction |
| --- | --- | --- |
| `src/ai-gateway/app/**` | `adapted/forked` | Preserve behavior; rewrite visible surfaces by domain in Waves 1-2. |
| `src/ai-gateway/shared/**` | `forked/adapted` | Quarantine presentation helpers and rework them into Zavorth-native shared UI. |
| `src/ai-gateway/lib/db/**` | `forked/adapted` | Keep storage working now; replace schema and backup canon in Wave 3. |
| `src/ai-gateway/lib/oauth/**` | `adapted` | Preserve flows, then rebuild under a Zavorth auth plane in Wave 3. |
| `src/ai-gateway/mitm/**` | `forked` | Keep proxy utility, but move canon to Zavorth naming and transport contracts. |
| `src/ai-gateway/sse/**` | `forked/adapted` | Treat as high-risk inherited surface and replace in Wave 4. |
| `src/ai-gateway/instrumentation-node.ts` | `adapted` | Preserve background bootstrapping while aligning imports and naming later. |
| `src/ai-gateway/proxy.ts` | `adapted` | Keep operational, revisit after transport de-fork work. |
| `src/ai-gateway/server-init.ts` | `adapted` | Keep operational, revisit during convergence prep. |
| `src/services/ZavorthGateway*.ts` | `native/adapted` | Preserve as Zavorth-native anchors outside the inherited subtree. |
| `src/services/ZavorthBridge*.ts` | `native/adapted` | Preserve and integrate rather than rewrite opportunistically. |

## Wave 0 Guardrails

Wave 0 is limited to:

- ownership and freeze documentation;
- inventory classification;
- explicit textual hygiene;
- removal of dead residual files;
- canonical naming for defaults and compatibility fallbacks that are already in use.

Wave 0 must not:

- redesign dashboard surfaces;
- rewrite auth, storage, proxy, or SSE planes end to end;
- merge this subtree into the new agent runtime;
- expand scope beyond the gateway de-fork track.

## Compatibility Boundary Register

Compatibility is allowed only as fallback-only glue while native Zavorth owners exist or are being introduced. These files may hold temporary bridge behavior, but they must not define canonical product naming, operator copy, route names, headers, storage names, or runtime ownership:

| Boundary file | Allowed role | Canonical owner |
| --- | --- | --- |
| `src/ai-gateway/lib/db/storagePlane.ts` | Migration/table compatibility fallback only. | Zavorth storage plane. |
| `src/ai-gateway/lib/db/jsonBackupAdapters.ts` | Import/export compatibility fallback only. | Zavorth settings backup contract. |
| `src/ai-gateway/lib/oauth/authPlane.ts` | OAuth environment alias fallback only. | Zavorth auth plane. |
| `src/ai-gateway/mitm/proxyPlane.cjs` | Proxy environment alias fallback only. | Zavorth proxy plane. |
| `src/ai-gateway/sse/transportPlane.ts` | Transport/header fallback only. | Zavorth transport plane. |
| `src/ai-gateway/sse/compat/openSseCompat.ts` | Upstream SSE package bridge only. | Zavorth SSE transport. |

Any new compatibility file must be added here before it is treated as intentional. If it is not listed here, it is not part of the Wave 0 freeze boundary.

## Automated Gate

Run this gate before changing the frozen subtree:

```bash
npm run defork:check
```

The gate is implemented in `scripts/defork-wave0-check.mjs` and enforces:

- the freeze document stays active;
- explicit legacy residues stay out of `src/ai-gateway` canonical files;
- dead `.orig` files do not come back;
- compatibility boundaries remain registered instead of becoming implicit canon.
