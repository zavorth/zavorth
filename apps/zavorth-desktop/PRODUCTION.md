# Zavorth Desktop — production path (Phase 7)

Local verification does **not** require real certificates or publishing.
Unsigned installers are OK for smoke; shipping needs signing + GitHub token.

## Quick checks

```bash
# From apps/zavorth-desktop
npm run signing:status
npm run production:readiness
npm run production:readiness:strict

# From monorepo root
npm run desktop:production-readiness
npm run desktop:test:electron-unit
```

## Package scripts

| Script | Purpose |
|--------|---------|
| `package:dir` | Unpackaged dir build (dev inspection) |
| `package:release` | Build installers with `--publish never` (local) |
| `package:publish` | Build + publish to GitHub Releases (`--publish always`) |
| `signing:status` | Report whether code-signing / notarization env is set |
| `production:readiness` | Structural wiring check (no certs required) |

## Shipping env (never commit secrets)

| Variable | Use |
|----------|-----|
| `GH_TOKEN` / `GITHUB_TOKEN` | Publish artifacts to GitHub Releases |
| `CSC_LINK` / `CSC_KEY_PASSWORD` | Code sign (pfx/p12 path or base64) |
| `WIN_CSC_LINK` | Windows-only cert override |
| `APPLE_ID` | macOS notarization Apple ID |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password for notarization |
| `APPLE_TEAM_ID` | Apple team ID |
| `ZAVORTH_UPDATE_FEED_URL` | Optional generic update feed |
| `ZAVORTH_UPDATE_DISABLE_ELECTRON_UPDATER=true` | Force GitHub-manual channel |

## Dry-run package (unsigned, publish never)

```bash
cd apps/zavorth-desktop
# Avoid EPERM locks under the repo on some Windows setups — write under TEMP:
set CSC_IDENTITY_AUTO_DISCOVERY=false
npx electron-builder --publish never --win nsis --config.directories.output=%TEMP%\zavorth-desktop-release-dryrun
```

Successful dry-run produces:

- `Zavorth-<version>-win-x64.exe` (NSIS installer)
- `Zavorth-<version>-win-x64.exe.blockmap` (electron-updater)
- `latest.yml` (update channel metadata)
- `win-unpacked/` (portable unpack for smoke)

`package.json` build.win uses electron-builder **26** shape: signing fields under `win.signtoolOptions` (not top-level `win.signingHashAlgorithms`). Local dry-runs set `signExecutable: false` so missing certs do not fail the build.

## App icons

Installer and shell icons are read from `build/` (electron-builder `directories.buildResources`).

| Path | Role |
|------|------|
| `build/icon.png` | Master PNG (1024 recommended). Top-level / mac / linux / win icon source |
| `build/icon.ico` | Optional Windows multi-size ICO — prefer over PNG when present; set `build.win.icon` to this path after generating |
| `public/icon.png` | Dev + Vite-copied asset; runtime fallback via `resolveAppIcon()` in `electron/main.cjs` |
| `build/icons/*.png` | Optional Linux size set (e.g. `512x512.png`) if you expand the icon pack later |

Runtime window / notification icons resolve in order: packaged `build/` → `dist/` → `public/`, then the same relative to `electron/`.

If `npm run icons:generate` exists, use it to regenerate masters from brand sources; otherwise copy a square PNG into `build/icon.png` (and optionally produce `build/icon.ico` for sharper Windows taskbar/installer icons). Do not commit signing certs or publish secrets when regenerating assets.

## Honesty

- **Local:** `package:release` without certs produces unsigned installers — fine for verifying the pipeline.
- **Ship:** configure `CSC_*` (and Apple notarization on macOS) before users install auto-updating builds.
- In-app updates use `electron-updater` when packaged; unpackaged/dev keeps the GitHub-manual path.
- If packaging fails with `EPERM ... rename win-unpacked.tmp`, build to `%TEMP%` (or close anything locking `apps/zavorth-desktop/release`).
