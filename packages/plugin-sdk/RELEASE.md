# Publishing `@zavorth/plugin-sdk`

## Prerequisites

1. npm account with publish rights to `@zavorth/plugin-sdk`
2. GitHub secrets: `NPM_TOKEN` or `NODE_AUTH_TOKEN` on the `npm` environment
3. Clean git tree on `main`

## Local dry-run (Wave 8 ritual)

```bash
cd packages/plugin-sdk
npm run publish:check
# = build + test + harness + npm publish --dry-run
```

## Version bump

1. Edit `package.json` `version` (semver)
2. Update `CHANGELOG.md`
3. Commit: `chore(plugin-sdk): release vX.Y.Z`

## Tag + publish

Tag **must** match package version:

```bash
# example for 0.2.0
git tag plugin-sdk-v0.2.0
git push origin plugin-sdk-v0.2.0
```

The workflow `.github/workflows/publish-plugin-sdk.yml`:

1. Builds + tests + harness on PRs and main
2. On tag `plugin-sdk-v*`, verifies tag version vs `package.json`, then `npm publish --access public`

## Manual workflow

GitHub → Actions → **Publish Plugin SDK** → Run workflow (build only unless you push a tag).

## After publish

```bash
npm view @zavorth/plugin-sdk version
```
