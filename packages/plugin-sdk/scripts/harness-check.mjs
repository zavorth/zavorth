/**
 * CI harness for @zavorth/plugin-sdk: definePlugin + manifest inference smoke.
 * Soft-fail style: exit non-zero only on hard contract breaks.
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

function loadSdk() {
  try {
    return require(path.join(root, 'dist', 'index.js'));
  } catch {
    return require(path.join(root, 'src', 'index.js'));
  }
}

const sdk = loadSdk();
const findings = [];

if (typeof sdk.definePlugin !== 'function') {
  findings.push('definePlugin export missing');
}

const plugin = sdk.definePlugin({
  id: 'harness-echo',
  kind: 'tool',
  summary: 'Harness echo plugin',
  tools: {
    'main.run': async ({ input }) => ({
      output: { ok: true, echo: input || {} },
    }),
  },
  permissions: 'auto',
});

if (!plugin || typeof plugin.register !== 'function') {
  findings.push('definePlugin did not return register()');
}

if (!plugin?.manifest || plugin.manifest.id !== 'harness-echo') {
  findings.push('definePlugin manifest.id mismatch');
}

if (typeof sdk.inferManifestFromDefinedPlugin === 'function') {
  try {
    const inferred = sdk.inferManifestFromDefinedPlugin(plugin);
    const manifestId = inferred?.manifest?.id || inferred?.id;
    if (!inferred || !manifestId) {
      findings.push('inferManifestFromDefinedPlugin returned empty');
    } else if (inferred.ok === false) {
      findings.push(`inferManifestFromDefinedPlugin ok=false: ${(inferred.findings || []).join('; ')}`);
    }
  } catch (error) {
    findings.push(`inferManifestFromDefinedPlugin failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (typeof sdk.permissionPresetForModuleKind === 'function') {
  const preset = sdk.permissionPresetForModuleKind('tool');
  if (!Array.isArray(preset) && typeof preset !== 'object') {
    findings.push('permissionPresetForModuleKind returned unexpected type');
  }
}

// Minimal register simulation
const bound = [];
try {
  plugin.register({
    bindCapability(id, handler) {
      bound.push({ id, handler });
    },
    getLogger() {
      return { info() {}, warn() {}, error() {} };
    },
    getWorkspacePath() {
      return root;
    },
  });
  if (bound.length === 0) {
    findings.push('register() bound zero capabilities');
  }
} catch (error) {
  findings.push(`register() threw: ${error instanceof Error ? error.message : String(error)}`);
}

if (findings.length > 0) {
  console.error('plugin-sdk harness FAILED');
  for (const line of findings) console.error(`  - ${line}`);
  process.exit(1);
}

console.log('plugin-sdk harness ok');
console.log(`  capabilities bound: ${bound.map((b) => b.id).join(', ')}`);
console.log(`  manifest id: ${plugin.manifest.id}`);
