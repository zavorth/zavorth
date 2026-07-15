'use strict';

/**
 * @zavorth/example-plugins
 *
 * Lightweight reference index for bundled Plugin OS examples that live in the
 * monorepo at `plugins/examples/*`. This package does not bundle plugin source
 * trees (they stay in plugins/examples so first-party discovery keeps working).
 * Third parties clone patterns from those paths or scaffold via
 * create-zavorth-plugin / @zavorth/plugin-sdk.
 */

/** @typedef {{ id: string, moduleKind: string, relativePath: string, capabilityId: string, summary: string }} ExamplePluginRef */

/** @type {ExamplePluginRef[]} */
const EXAMPLES = [
  {
    id: 'hello-world',
    moduleKind: 'tool',
    relativePath: 'plugins/examples/hello-world',
    capabilityId: 'main.run',
    summary: 'Minimal tool that echoes input.',
  },
  {
    id: 'example-channel',
    moduleKind: 'channel',
    relativePath: 'plugins/examples/example-channel',
    capabilityId: 'channel.send',
    summary: 'Channel adapter stub via bindChannel.',
  },
  {
    id: 'example-provider',
    moduleKind: 'provider',
    relativePath: 'plugins/examples/example-provider',
    capabilityId: 'provider.complete',
    summary: 'Provider complete stub via bindProvider.',
  },
  {
    id: 'example-memory',
    moduleKind: 'memory',
    relativePath: 'plugins/examples/example-memory',
    capabilityId: 'memory.read',
    summary: 'In-memory backend via bindMemoryBackend.',
  },
  {
    id: 'example-hook',
    moduleKind: 'agent',
    relativePath: 'plugins/examples/example-hook',
    capabilityId: 'agent.ping',
    summary: 'Agent hooks (tool.before_execute, agent.after_turn).',
  },
  {
    id: 'example-auxiliary',
    moduleKind: 'diagnostics',
    relativePath: 'plugins/examples/example-auxiliary',
    capabilityId: 'ephemera.status',
    summary: 'Diagnostics status-only capability.',
  },
  {
    id: 'example-media',
    moduleKind: 'media',
    relativePath: 'plugins/examples/example-media',
    capabilityId: 'media.run',
    summary: 'Media capability stub (no network).',
  },
  {
    id: 'example-voice',
    moduleKind: 'voice',
    relativePath: 'plugins/examples/example-voice',
    capabilityId: 'voice.run',
    summary: 'Voice capability stub (no audio I/O).',
  },
  {
    id: 'example-search',
    moduleKind: 'search',
    relativePath: 'plugins/examples/example-search',
    capabilityId: 'search.query',
    summary: 'Search query stub (empty results).',
  },
  {
    id: 'example-bridge',
    moduleKind: 'bridge',
    relativePath: 'plugins/examples/example-bridge',
    capabilityId: 'bridge.forward',
    summary: 'Bridge forward stub (no outbound I/O).',
  },
  {
    id: 'example-sandbox',
    moduleKind: 'sandbox',
    relativePath: 'plugins/examples/example-sandbox',
    capabilityId: 'sandbox.run',
    summary: 'Sandbox run stub (no process spawn).',
  },
  {
    id: 'example-qa',
    moduleKind: 'qa',
    relativePath: 'plugins/examples/example-qa',
    capabilityId: 'qa.check',
    summary: 'QA check stub (always pass).',
  },
  {
    id: 'example-workspace',
    moduleKind: 'workspace',
    relativePath: 'plugins/examples/example-workspace',
    capabilityId: 'workspace.info',
    summary: 'Workspace info stub.',
  },
];

/**
 * Map moduleKind → example id (first match).
 * @type {Record<string, string>}
 */
const BY_MODULE_KIND = EXAMPLES.reduce((acc, example) => {
  if (!acc[example.moduleKind]) {
    acc[example.moduleKind] = example.id;
  }
  return acc;
}, /** @type {Record<string, string>} */ ({}));

/**
 * @param {string} id
 * @returns {ExamplePluginRef | undefined}
 */
function getExample(id) {
  return EXAMPLES.find((example) => example.id === id);
}

/**
 * @param {string} moduleKind
 * @returns {ExamplePluginRef | undefined}
 */
function getExampleByKind(moduleKind) {
  const id = BY_MODULE_KIND[String(moduleKind || '').trim()];
  return id ? getExample(id) : undefined;
}

module.exports = {
  EXAMPLES,
  BY_MODULE_KIND,
  getExample,
  getExampleByKind,
  /** Monorepo-relative root for example packages. */
  EXAMPLES_ROOT: 'plugins/examples',
  /** Schema shared by all examples. */
  SCHEMA_VERSION: 'zavorth.plugin-os.v1',
};
