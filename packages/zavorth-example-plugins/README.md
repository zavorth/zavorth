# @zavorth/example-plugins

Reference pack for **Zavorth Plugin OS** example plugins.

This package indexes the monorepo examples under `plugins/examples/*` so third
parties can clone patterns without guessing module kinds or capability ids.
Source trees stay in `plugins/examples` so first-party discovery (`bundled://`)
keeps working.

**Extension is Zavorth Plugin OS** — not third-party agent brands.

## Install (docs / meta)

```bash
npm install @zavorth/example-plugins
```

```js
const {
  EXAMPLES,
  getExampleByKind,
  EXAMPLES_ROOT,
} = require('@zavorth/example-plugins');

console.log(EXAMPLES.map((e) => e.id));
// hello-world, example-channel, ...

const media = getExampleByKind('media');
// { id: 'example-media', relativePath: 'plugins/examples/example-media', ... }
```

When developing inside the Zavorth monorepo, open the `relativePath` folders
directly — each contains `manifest.json`, soft-fail `index.js`, and `README.md`.

## Example catalog

| Id | moduleKind | Capability | Path |
|----|------------|------------|------|
| `hello-world` | tool | `main.run` | `plugins/examples/hello-world` |
| `example-channel` | channel | `channel.send` | `plugins/examples/example-channel` |
| `example-provider` | provider | `provider.complete` | `plugins/examples/example-provider` |
| `example-memory` | memory | `memory.read` | `plugins/examples/example-memory` |
| `example-hook` | agent | `agent.ping` | `plugins/examples/example-hook` |
| `example-auxiliary` | diagnostics | `ephemera.status` | `plugins/examples/example-auxiliary` |
| `example-media` | media | `media.run` | `plugins/examples/example-media` |
| `example-voice` | voice | `voice.run` | `plugins/examples/example-voice` |
| `example-search` | search | `search.query` | `plugins/examples/example-search` |
| `example-bridge` | bridge | `bridge.forward` | `plugins/examples/example-bridge` |
| `example-sandbox` | sandbox | `sandbox.run` | `plugins/examples/example-sandbox` |
| `example-qa` | qa | `qa.check` | `plugins/examples/example-qa` |
| `example-workspace` | workspace | `workspace.info` | `plugins/examples/example-workspace` |

## How third parties clone patterns

1. **Scaffold** a new package (recommended for greenfield):

   ```bash
   npx create-zavorth-plugin my-search --kind search --dir ./my-search
   ```

2. **Copy** an example that matches your `moduleKind` from the monorepo:

   ```bash
   cp -r plugins/examples/example-search ./my-search
   # edit id / capability handlers in manifest.json + index.js
   ```

3. **Author with the SDK**:

   ```js
   const { definePlugin } = require('@zavorth/plugin-sdk');
   module.exports = {
     register: definePlugin({
       id: 'my-tool',
       kind: 'tool',
       tools: {
         'main.run': async ({ input }) => ({ output: { ok: true, input } }),
       },
       permissions: 'auto',
     }).register,
   };
   ```

4. **Install into a Zavorth workspace**:

   ```bash
   zavorth plugins install ./my-search --yes
   zavorth plugins enable my-search --yes
   zavorth plugins test ./my-search
   ```

## Soft-fail contract

Examples use soft-fail `register(ctx)`:

- Call `bindCapability` only when present.
- Specialized binders (`bindChannel`, `bindProvider`, `bindMemoryBackend`,
  `registerHook`) wrap failures so a missing helper never crashes load.
- No secret values in handler output; presence-only for credentials.

## Related

| Package / path | Role |
|----------------|------|
| `create-zavorth-plugin` | Standalone scaffold CLI |
| `@zavorth/plugin-sdk` | `definePlugin`, permission presets, inference |
| `docs/plugin-os.md` | Plugin OS design + authoring guide |
| `packages/plugin-sdk/RELEASE.md` | SDK publish ritual |

## License

MIT
