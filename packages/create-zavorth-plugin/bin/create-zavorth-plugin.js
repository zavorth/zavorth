#!/usr/bin/env node
'use strict';

/**
 * create-zavorth-plugin
 *
 * Standalone CLI for third-party Plugin OS authors (Wave 8).
 * Pure Node — no monorepo TypeScript imports.
 *
 * Usage:
 *   create-zavorth-plugin <id> --kind tool|provider|channel|memory|media|voice|search|diagnostics|bridge
 *   create-zavorth-plugin <id> --kind media --dir ./my-plugin
 *   create-zavorth-plugin <id> --kind tool --dry-run
 *   create-zavorth-plugin <id> --kind tool --yes
 */

const fs = require('node:fs');
const path = require('node:path');

const SCHEMA_VERSION = 'zavorth.plugin-os.v1';
const ZAVORTH_VERSION_RANGE = '>=1.1.0';

const KINDS = [
  'tool',
  'provider',
  'channel',
  'memory',
  'media',
  'voice',
  'search',
  'diagnostics',
  'bridge',
];

const args = process.argv.slice(2);

function hasFlag(name) {
  return args.includes(name);
}

function readFlag(name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  const next = args[index + 1];
  if (!next || next.startsWith('-')) return null;
  return next;
}

function firstPositional() {
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg.startsWith('-')) {
      // skip flag value when present
      if (
        (arg === '--kind' || arg === '--dir')
        && args[i + 1]
        && !args[i + 1].startsWith('-')
      ) {
        i += 1;
      }
      continue;
    }
    return arg;
  }
  return null;
}

function printHelp() {
  console.log(`create-zavorth-plugin

Scaffold a third-party Zavorth Plugin OS package (standalone, no monorepo needed).

Usage:
  create-zavorth-plugin <id> --kind <kind>
  create-zavorth-plugin <id> --kind media --dir ./my-plugin
  create-zavorth-plugin <id> --kind tool --dry-run
  create-zavorth-plugin <id> --kind tool --yes

Kinds:
  ${KINDS.join(' | ')}

Options:
  --kind <kind>   Plugin moduleKind (default: tool)
  --dir <path>    Output directory (default: ./<id> under cwd)
  --dry-run       Print files that would be written; write nothing
  --yes           Write files (default). Accepted for non-interactive scripts
  --install       After write, also copy into ./plugins/<id> when monorepo layout
                  is detected, else ./.zavorth/plugins/<id>
  -h, --help      Show this help

Generated files:
  manifest.json   zavorth.plugin-os.v1, one capability, permissions by kind
  index.js        register(ctx) with soft-fail bindCapability
  README.md       install / enable / invoke notes

Examples:
  create-zavorth-plugin my-tool --kind tool
  create-zavorth-plugin acme-search --kind search --dir ./plugins/acme-search
  create-zavorth-plugin demo-media --kind media --dry-run
`);
}

function softFail(message, code = 1) {
  console.error(`create-zavorth-plugin: ${message}`);
  console.error('Run `create-zavorth-plugin --help` for usage.');
  process.exit(code);
}

function normalizeId(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gu, '-')
    .replace(/-+/gu, '-')
    .replace(/^[-.]+|[-.]+$/gu, '');
}

function titleCase(id) {
  return String(id || '')
    .split(/[-_.]+/u)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || id;
}

function commandName(id, suffix) {
  const base = String(id || '')
    .replace(/[^a-z0-9]+/giu, '_')
    .replace(/^_+|_+$/gu, '')
    .toLowerCase() || 'plugin';
  return `${base}_${suffix}`;
}

function createPermission(kind, scope, reason, required) {
  return {
    kind,
    scope,
    reason: String(reason || 'Declared plugin permission.'),
    required: required !== false,
  };
}

/** Permission presets for third-party authors (Wave 8 CLI contract). */
function permissionsForKind(kind) {
  switch (kind) {
    case 'provider':
      return [
        createPermission(
          'network.external',
          'external',
          'Call external provider HTTP APIs.',
          true,
        ),
        createPermission(
          'provider.call',
          'external',
          'Invoke an external model or provider API.',
          true,
        ),
        createPermission(
          'secret.read',
          'local',
          'Detect whether provider API keys are present (not values).',
          false,
        ),
      ];
    case 'channel':
      return [
        createPermission(
          'network.external',
          'external',
          'Reach external channel endpoints.',
          true,
        ),
        createPermission(
          'channel.send',
          'workspace',
          'Send messages through the channel adapter surface.',
          true,
        ),
      ];
    case 'memory':
      return [
        createPermission(
          'filesystem.read',
          'workspace',
          'Read local memory store files.',
          true,
        ),
        createPermission(
          'filesystem.write',
          'workspace',
          'Persist local memory store files.',
          true,
        ),
        createPermission(
          'memory.read',
          'workspace',
          'Expose memory read operations.',
          true,
        ),
        createPermission(
          'memory.write',
          'workspace',
          'Expose memory write operations.',
          true,
        ),
      ];
    case 'media':
    case 'voice':
      return [
        createPermission(
          'network.external',
          'external',
          'Fetch or stream media and voice payloads.',
          true,
        ),
        createPermission(
          'secret.read',
          'local',
          'Detect whether media/voice API keys are present (not values).',
          false,
        ),
      ];
    case 'search':
      return [
        createPermission(
          'network.external',
          'external',
          'Call external search APIs.',
          true,
        ),
      ];
    case 'diagnostics':
      return [
        createPermission(
          'filesystem.read',
          'workspace',
          'Read workspace files for diagnostics.',
          true,
        ),
      ];
    case 'bridge':
      return [
        createPermission(
          'network.external',
          'external',
          'Reach external bridge endpoints.',
          true,
        ),
        createPermission(
          'filesystem.read',
          'workspace',
          'Read workspace files for bridge operation.',
          true,
        ),
      ];
    case 'tool':
    default:
      return [
        createPermission(
          'filesystem.read',
          'workspace',
          'Read workspace files for plugin operation.',
          true,
        ),
      ];
  }
}

function capabilityForKind(id, kind) {
  const label = titleCase(id);
  switch (kind) {
    case 'provider':
      return {
        id: 'provider.complete',
        intent: 'provider.complete',
        label: 'Provider Complete',
        summary: `Stub completion for ${label}.`,
        artifactKinds: [],
        command: {
          name: commandName(id, 'complete'),
          aliases: [],
          usage: '{ prompt?, model? }',
        },
      };
    case 'channel':
      return {
        id: 'channel.send',
        intent: 'channel.send',
        label: 'Channel Send',
        summary: `Stub send for ${label}.`,
        artifactKinds: [],
        command: {
          name: commandName(id, 'send'),
          aliases: [],
          usage: '{ text?, payload? }',
        },
      };
    case 'memory':
      return {
        id: 'memory.read',
        intent: 'memory.read',
        label: 'Memory Read',
        summary: `Stub memory read for ${label}.`,
        artifactKinds: [],
        command: {
          name: commandName(id, 'memory_read'),
          aliases: [],
          usage: '{ key? }',
        },
      };
    case 'media':
      return {
        id: 'media.run',
        intent: 'media.run',
        label: 'Media Run',
        summary: `Stub media capability for ${label}.`,
        artifactKinds: [],
        command: {
          name: commandName(id, 'media'),
          aliases: [],
          usage: '{ input? }',
        },
      };
    case 'voice':
      return {
        id: 'voice.run',
        intent: 'voice.run',
        label: 'Voice Run',
        summary: `Stub voice capability for ${label}.`,
        artifactKinds: [],
        command: {
          name: commandName(id, 'voice'),
          aliases: [],
          usage: '{ input? }',
        },
      };
    case 'search':
      return {
        id: 'search.query',
        intent: 'search.query',
        label: 'Search Query',
        summary: `Stub search for ${label}.`,
        artifactKinds: [],
        command: {
          name: commandName(id, 'search'),
          aliases: [],
          usage: '{ query|q }',
        },
      };
    case 'diagnostics':
      return {
        id: 'diagnostics.status',
        intent: 'diagnostics.status',
        label: 'Diagnostics Status',
        summary: `Stub diagnostics status for ${label}.`,
        artifactKinds: [],
        command: {
          name: commandName(id, 'status'),
          aliases: ['status'],
          usage: '{}',
        },
      };
    case 'bridge':
      return {
        id: 'bridge.forward',
        intent: 'bridge.forward',
        label: 'Bridge Forward',
        summary: `Stub bridge forward for ${label}.`,
        artifactKinds: [],
        command: {
          name: commandName(id, 'forward'),
          aliases: [],
          usage: '{ payload? }',
        },
      };
    case 'tool':
    default:
      return {
        id: 'main.run',
        intent: 'tool.run',
        label: 'Main Run',
        summary: `Primary capability for ${label}.`,
        artifactKinds: [],
        command: {
          name: commandName(id, 'run'),
          aliases: [],
          usage: '{ input? }',
        },
      };
  }
}

function escapeJs(value) {
  return String(value).replace(/\\/gu, '\\\\').replace(/'/gu, "\\'");
}

function buildManifest(id, kind) {
  const capability = capabilityForKind(id, kind);
  const permissions = permissionsForKind(kind);
  const hasNetwork = permissions.some((p) => p.kind === 'network.external');
  const requiresApproval = permissions.some((p) => p.required);

  return {
    schemaVersion: SCHEMA_VERSION,
    id,
    label: titleCase(id),
    version: '0.1.0',
    moduleKind: kind,
    summary: `${titleCase(id)} Plugin OS scaffold (${kind}).`,
    description: `Third-party Zavorth Plugin OS package for ${id} (moduleKind=${kind}). Generated by create-zavorth-plugin.`,
    tags: [kind, 'scaffold', 'third-party'],
    source: {
      kind: 'local',
      locator: `local://plugins/${id}`,
      digest: null,
      trusted: false,
    },
    compatibility: {
      zavorthVersion: ZAVORTH_VERSION_RANGE,
      pluginApiVersion: SCHEMA_VERSION,
    },
    capabilities: [capability],
    permissions,
    entrypoint: {
      module: './index.js',
      exportName: 'register',
      runtime: 'node',
    },
    lifecycle: {
      actions: ['install', 'enable', 'disable', 'uninstall', 'invoke', 'doctor'],
      defaultAction: 'invoke',
    },
    policy: {
      defaultTrust: 'review',
      requiresApproval,
      allowNetworkByDefault: false,
      allowFilesystemWriteByDefault: false,
      allowProcessSpawnByDefault: false,
      sandboxProfile: hasNetwork ? 'networked' : 'restricted',
    },
    artifactKinds: [],
    receiptKinds: [],
  };
}

/**
 * Self-contained register(ctx) with soft-fail binds.
 * Always attempts bindCapability; optional specialized adapters when present.
 */
function buildIndexJs(id, kind, capabilityId) {
  const safeId = escapeJs(id);
  const safeCap = escapeJs(capabilityId);
  const lines = [
    '/**',
    ` * ${id} — Zavorth Plugin OS entrypoint (generated).`,
    ' * Soft-fails when optional registration helpers are missing.',
    ' */',
    'function register(ctx) {',
    '  const logger = typeof ctx.getLogger === \'function\'',
    '    ? ctx.getLogger()',
    '    : { debug() {}, info() {}, warn() {}, error() {} };',
    '',
    '  // Primary capability (soft-fail if bindCapability is unavailable).',
    '  if (typeof ctx.bindCapability === \'function\') {',
    `    ctx.bindCapability('${safeCap}', async ({ input }) => ({`,
    '      output: {',
    '        ok: true,',
    `        pluginId: '${safeId}',`,
    `        capabilityId: '${safeCap}',`,
    `        moduleKind: '${escapeJs(kind)}',`,
    '        input: input || {},',
    `        message: 'Plugin ${safeId} is loaded.',`,
    '      },',
    '    }));',
    '  } else {',
    `    logger.warn('bindCapability unavailable; ${safeId} registered without capability binding');`,
    '  }',
    '',
  ];

  switch (kind) {
    case 'provider':
      lines.push(
        '  if (typeof ctx.bindProvider === \'function\') {',
        '    try {',
        '      ctx.bindProvider({',
        `        id: '${safeId}',`,
        `        capabilityId: '${safeCap}',`,
        `        name: '${safeId}',`,
        '        complete: async (request) => ({',
        '          ok: true,',
        `          pluginId: '${safeId}',`,
        '          text: \'scaffold provider complete\',',
        '          request: request || {},',
        '        }),',
        '      });',
        '    } catch (error) {',
        '      logger.warn(\'bindProvider soft-fail\', {',
        '        error: error instanceof Error ? error.message : String(error),',
        '      });',
        '    }',
        '  }',
        '',
      );
      break;
    case 'channel':
      lines.push(
        '  if (typeof ctx.bindChannel === \'function\') {',
        '    try {',
        '      ctx.bindChannel({',
        `        id: '${safeId}-channel',`,
        `        capabilityId: '${safeCap}',`,
        `        label: '${safeId} channel',`,
        '        send: async (payload) => ({',
        '          ok: true,',
        `          pluginId: '${safeId}',`,
        '          payload: payload || {},',
        '        }),',
        '      });',
        '    } catch (error) {',
        '      logger.warn(\'bindChannel soft-fail\', {',
        '        error: error instanceof Error ? error.message : String(error),',
        '      });',
        '    }',
        '  }',
        '',
      );
      break;
    case 'memory':
      lines.push(
        '  if (typeof ctx.bindMemoryBackend === \'function\') {',
        '    try {',
        '      const store = new Map();',
        '      ctx.bindMemoryBackend({',
        `        id: '${safeId}-memory',`,
        `        capabilityId: '${safeCap}',`,
        '        read: async (input) => {',
        '          const key = String((input && input.key) || \'\');',
        '          return {',
        '            key,',
        '            value: store.has(key) ? store.get(key) : null,',
        `            pluginId: '${safeId}',`,
        '          };',
        '        },',
        '        write: async (input) => {',
        '          const key = String((input && input.key) || \'\');',
        '          const value = input ? input.value : null;',
        '          store.set(key, value);',
        '          return { ok: true, key, value };',
        '        },',
        '      });',
        '    } catch (error) {',
        '      logger.warn(\'bindMemoryBackend soft-fail\', {',
        '        error: error instanceof Error ? error.message : String(error),',
        '      });',
        '    }',
        '  }',
        '',
      );
      break;
    default:
      break;
  }

  lines.push(
    '}',
    '',
    'module.exports = { register };',
    '',
  );
  return lines.join('\n');
}

function buildReadme(id, kind, capabilityId, targetDir) {
  const relativeHint = path.basename(targetDir) === id
    ? `./${id}`
    : targetDir;
  return [
    `# ${id}`,
    '',
    `Zavorth Plugin OS package (\`${SCHEMA_VERSION}\`) — **moduleKind: ${kind}**.`,
    '',
    'Generated by `create-zavorth-plugin` (standalone third-party scaffold).',
    '',
    '## Files',
    '',
    '- `manifest.json` — Plugin OS contract (one capability, permissions by kind)',
    '- `index.js` — CommonJS `register(ctx)` with soft-fail `bindCapability`',
    '- `README.md` — this file',
    '',
    '## Capability',
    '',
    `- \`${capabilityId}\` — primary scaffold capability`,
    '',
    '## Permissions',
    '',
    ...permissionsForKind(kind).map(
      (p) => `- \`${p.kind}\` (${p.scope}${p.required ? ', required' : ', optional'}) — ${p.reason}`,
    ),
    '',
    '## Install (Zavorth workspace)',
    '',
    '```bash',
    `zavorth plugins install ${relativeHint} --yes`,
    `zavorth plugins enable ${id} --yes`,
    `zavorth plugins inspect ${id}`,
    '```',
    '',
    '## Local authoring notes',
    '',
    '- Keep capability ids declared in `manifest.json` in sync with `index.js` binds.',
    '- Soft-fail: missing `bindCapability` / specialized binders must not crash load.',
    '- Do not return secret values from handlers; report presence only.',
    '- Publish as a signed pack when using the remote marketplace (Wave 8).',
    '',
    '## Next steps',
    '',
    '1. Implement real handler logic for your capability.',
    '2. Adjust `permissions` to the least privilege you need.',
    '3. Test with `zavorth plugins test <path>` when available.',
    '',
  ].join('\n');
}

function planFiles(id, kind, targetDir) {
  const manifest = buildManifest(id, kind);
  const capabilityId = manifest.capabilities[0].id;
  const files = [
    {
      name: 'manifest.json',
      path: path.join(targetDir, 'manifest.json'),
      content: `${JSON.stringify(manifest, null, 2)}\n`,
    },
    {
      name: 'index.js',
      path: path.join(targetDir, 'index.js'),
      content: buildIndexJs(id, kind, capabilityId),
    },
    {
      name: 'README.md',
      path: path.join(targetDir, 'README.md'),
      content: buildReadme(id, kind, capabilityId, targetDir),
    },
  ];
  return { manifest, capabilityId, files };
}

// --- main ---

if (hasFlag('--help') || hasFlag('-h')) {
  printHelp();
  process.exit(0);
}

const rawId = firstPositional();
if (!rawId) {
  softFail('plugin id is required');
}

const id = normalizeId(rawId);
if (!id) {
  // Soft-fail on bad id: do not throw a stack; exit cleanly.
  softFail(`invalid plugin id "${rawId}" (use letters, numbers, ., _, -)`);
}

const kindRaw = String(readFlag('--kind') || 'tool').trim().toLowerCase();
if (!KINDS.includes(kindRaw)) {
  softFail(
    `unsupported kind "${kindRaw}" (expected: ${KINDS.join(', ')})`,
  );
}
const kind = kindRaw;

const dirFlag = readFlag('--dir');
const targetDir = path.resolve(
  process.cwd(),
  dirFlag || id,
);

const dryRun = hasFlag('--dry-run');
// --yes is the explicit write gate; write is also the default when not dry-run.
const writeEnabled = !dryRun;

const { capabilityId, files } = planFiles(id, kind, targetDir);

if (dryRun) {
  console.log('create-zavorth-plugin dry-run');
  console.log('');
  console.log(`Id:          ${id}`);
  console.log(`Kind:        ${kind}`);
  console.log(`Capability:  ${capabilityId}`);
  console.log(`Target:      ${targetDir}`);
  console.log('');
  console.log('Files that would be written:');
  for (const file of files) {
    console.log(`  > ${file.name}`);
  }
  console.log('');
  console.log('No files were written.');
  process.exit(0);
}

if (!writeEnabled) {
  softFail('write disabled unexpectedly; use --dry-run to preview only');
}

try {
  fs.mkdirSync(targetDir, { recursive: true });
  for (const file of files) {
    fs.writeFileSync(file.path, file.content, 'utf8');
  }
} catch (error) {
  softFail(
    `failed to write scaffold: ${error instanceof Error ? error.message : String(error)}`,
  );
}

console.log('create-zavorth-plugin');
console.log('');
console.log(`Id:          ${id}`);
console.log(`Kind:        ${kind}`);
console.log(`Capability:  ${capabilityId}`);
console.log(`Target:      ${targetDir}`);
console.log('');
console.log('Wrote:');
for (const file of files) {
  console.log(`  > ${file.name}`);
}

let installPath = null;
if (hasFlag('--install')) {
  try {
    const cwd = process.cwd();
    const monorepoPlugins = path.join(cwd, 'plugins');
    const monorepoMarker = path.join(cwd, 'config', 'plugin-marketplace-curated.json');
    const isMonorepo = fs.existsSync(monorepoPlugins) && fs.existsSync(monorepoMarker);
    installPath = isMonorepo
      ? path.join(monorepoPlugins, id)
      : path.join(cwd, '.zavorth', 'plugins', id);
    if (typeof fs.cpSync === 'function') {
      fs.mkdirSync(path.dirname(installPath), { recursive: true });
      fs.cpSync(targetDir, installPath, { recursive: true });
      console.log('');
      console.log(`Installed copy: ${installPath}`);
      console.log(isMonorepo ? '(monorepo plugins/)' : '(.zavorth/plugins/)');
    } else {
      console.log('');
      console.log('Note: --install skipped (fs.cpSync unavailable on this Node version).');
    }
  } catch (error) {
    console.log('');
    console.log(
      `Warning: --install soft-failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

console.log('');
console.log('Next:');
console.log(`  zavorth plugins install ${installPath || targetDir} --yes`);
console.log(`  zavorth plugins enable ${id} --yes`);
console.log(`  zavorth plugins inspect ${id}`);
console.log(`  zavorth plugins marketplace show ${id}`);
