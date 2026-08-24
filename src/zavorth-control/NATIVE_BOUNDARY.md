# zavorth-control native boundary

Status: active

This subtree is the frozen zavorthControl compatibility surface. The gateway
implementation it once hosted now lives in `src/ai-gateway/`; this directory
keeps only surface routes, static assets, and the compatibility boundary
modules registered below. New product logic must not be added here.

## Contribution Rules

- Do not add new runtime modules to `src/zavorth-control/` beyond the
  registered compatibility boundaries and API route support files.
- Compatibility boundary files may only re-export their canonical
  `src/ai-gateway/` counterpart; they must not fork behavior.
- Every change here is scanned by
  `scripts/zavorth-native-boundary-check.mjs`, which fails on forbidden legacy
  residue, dead `.orig` files, or a missing register entry.
- Execution through these surfaces stays fallback-only: the canonical gateway
  owns behavior and this subtree delegates.

## Operational Inventory

- `app/api/developer-workspace/`: developer workspace API route support.
- `lib/api/wizardSettings.ts`: wizard settings helpers kept for route imports.
- `public/zavorth-control-vite-shell/`: generated static control shell assets
  (rebuilt via `npm run zavorth-control-vite:build`).
- Compatibility boundary modules: see the register below.

## Compatibility Boundary Register

Legacy import paths preserved after the dashboard-to-zavorthControl migration.
Each module is a thin re-export shim over its canonical AI gateway plane:

- `src/zavorth-control/lib/db/storagePlane.ts`
- `src/zavorth-control/lib/db/jsonBackupAdapters.ts`
- `src/zavorth-control/lib/oauth/authPlane.ts`
- `src/zavorth-control/mitm/proxyPlane.cjs`
- `src/zavorth-control/sse/transportPlane.ts`
- `src/zavorth-control/sse/compat/openSseCompat.ts`
