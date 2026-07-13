# @zavorth/plugin-sdk changelog

## 0.3.0

- Wave 8 ecosystem: aligned with gap-closure W0–W7 specialized surface + first-party packs.
- Documented third-party path: `create-zavorth-plugin`, signed packs, Plugin Atlas.
- Publish ritual: `npm run publish:check` (build + harness + dry-run gate script).

## 0.2.0

- Hardened publish path: harness check, dry-run gate, version/tag alignment docs.
- `npm run check` = build + smoke test + harness.
- Documented release steps in `RELEASE.md`.

## 0.1.0

- Initial publishable Plugin OS authoring surface.
- Exports `definePlugin`, permission presets, and manifest inference helpers.
- CommonJS package with `dist/` build via `npm run build`.
- CI publish workflow on tags `plugin-sdk-v*`.
