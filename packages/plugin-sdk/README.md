# @zavorth/plugin-sdk

Publishable authoring surface for **Zavorth Plugin OS** packages.

Extension is Zavorth Plugin OS — use this SDK (and `create-zavorth-plugin`) rather
than foreign agent-framework branding.

## Exports

| Export                                       | Role                                                                  |
| -------------------------------------------- | --------------------------------------------------------------------- |
| `definePlugin`                               | Build a `{ register, manifest }` package from tools/hooks/permissions |
| `isDefinedPlugin` / `toPluginRegisterExport` | Type guards / CJS export helpers                                      |
| `permissionPresetForModuleKind`              | Permission presets by `moduleKind`                                    |
| `resolvePluginPermissions`                   | Merge auto presets with extras                                        |
| `inferManifestFromDefinedPlugin`             | Infer / validate manifest from a defined plugin                       |
| `inferManifestFromSource`                    | Infer from source text scan                                           |
| `reconcileManifestWithInference`             | Merge existing manifest with inference                                |

## Install

```bash
npm install @zavorth/plugin-sdk
```

## Usage

```js
const { definePlugin } = require('@zavorth/plugin-sdk');

const plugin = definePlugin({
  id: 'hello-tool',
  kind: 'tool',
  summary: 'Echo tool',
  tools: {
    'main.run': async ({ input }) => ({
      output: { ok: true, input: input || {} },
    }),
  },
  permissions: 'auto',
});

module.exports = { register: plugin.register, manifest: plugin.manifest };
```

### moduleKinds

`kind` accepts every `ZavorthPluginModuleKind`:

`tool | provider | channel | memory | media | voice | search | diagnostics |
bridge | agent | sandbox | qa | workspace | module`

Permission presets follow the same map as `create-zavorth-plugin` and
`permissionPresetForModuleKind` in this package.

## Scaffold + examples

```bash
# Third-party scaffold (standalone CLI)
npx create-zavorth-plugin my-search --kind search

# Reference examples (monorepo)
# plugins/examples/*  — one package per moduleKind family
# packages/zavorth-example-plugins — @zavorth/example-plugins index
```

Host docs: [`docs/plugin-os.md`](../../docs/plugin-os.md).

## Build / publish

```bash
cd packages/plugin-sdk
npm run check            # build + smoke + harness
npm run publish:check    # check + npm publish --dry-run
npm run publish:dry-run  # dry-run only
```

Release checklist: see [RELEASE.md](./RELEASE.md).

Tag format (must match `package.json` version):

```bash
git tag plugin-sdk-v0.3.0
git push origin plugin-sdk-v0.3.0
```

CI:

- `.github/workflows/publish-plugin-sdk.yml` — PR check + tag publish
- `.github/workflows/plugin-os-plugins.yml` — also runs SDK `check` when plugin paths change

`prepublishOnly` runs `build`, which copies standalone `src/*.js` + `src/index.d.ts` into `dist/`.

## Monorepo

Inside the Zavorth monorepo you can also import via:

```ts
import { definePlugin } from 'zavorth/plugin-sdk';
```

The package **does not** depend on monorepo-relative imports such as `../../../src/`.

## CLI (host)

```bash
zavorth plugins scaffold my-plugin --kind tool --yes
zavorth plugins dev ./plugins/my-plugin --watch
zavorth plugins test ./plugins/my-plugin
```

## Soft-fail contract

- Registration helpers may be missing on partial hosts — check `typeof` before bind.
- `permissions: 'auto'` never grants network/spawn unless the moduleKind preset requires it.
- Do not return secret values from handlers; report presence only.
