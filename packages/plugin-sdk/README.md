# @zavorth/plugin-sdk

Publishable authoring surface for Zavorth Plugin OS packages.

## Exports

- `definePlugin` / `isDefinedPlugin` / `toPluginRegisterExport`
- `permissionPresetForModuleKind` / `resolvePluginPermissions`
- `inferManifestFromDefinedPlugin` / `inferManifestFromSource` / `reconcileManifestWithInference`

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
  tools: {
    'main.run': async ({ input }) => ({
      output: { ok: true, input: input || {} },
    }),
  },
  permissions: 'auto',
});

module.exports = { register: plugin.register, manifest: plugin.manifest };
```

## Build / publish

```bash
cd packages/plugin-sdk
npm run check          # build + smoke + harness
npm run publish:dry-run
```

Release checklist: see [RELEASE.md](./RELEASE.md).

Tag format (must match `package.json` version):

```bash
git tag plugin-sdk-v0.2.0
git push origin plugin-sdk-v0.2.0
```

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
