import fs from 'node:fs';
import path from 'node:path';

import type {
  ZavorthPluginManifest,
  ZavorthPluginModuleKind,
} from '../contracts/PluginManifestContract.js';
import { definePlugin } from '../sdk/plugin/definePlugin.js';
import { resolvePluginPermissions } from '../sdk/plugin/permissionPresets.js';

export type PluginScaffoldKind =
  | 'tool'
  | 'channel'
  | 'memory'
  | 'provider'
  | 'agent'
  | 'diagnostics';

export type PluginScaffoldInput = {
  root: string;
  id: string;
  targetDir: string;
  moduleKind?: ZavorthPluginModuleKind | string;
  kind?: PluginScaffoldKind | string;
  withHooks?: boolean;
  withTools?: boolean;
  language?: 'js' | 'ts';
};

export type PluginScaffoldResult = {
  id: string;
  targetDir: string;
  moduleKind: ZavorthPluginModuleKind;
  language: 'js' | 'ts';
  files: string[];
  manifest: ZavorthPluginManifest;
};

export class PluginScaffoldService {
  public scaffold(input: PluginScaffoldInput): PluginScaffoldResult {
    const root = path.resolve(input.root || process.cwd());
    const id = normalizeId(input.id);
    const targetDir = path.resolve(input.targetDir);
    if (!isInside(root, targetDir)) {
      throw new Error('Refusing to scaffold outside the workspace.');
    }

    const kind = normalizeScaffoldKind(input.kind || input.moduleKind || 'tool');
    const moduleKind = kindToModuleKind(kind, input.moduleKind);
    const language = input.language === 'ts' ? 'ts' : 'js';
    const hooksEnabled = kind === 'agent' ? true : input.withHooks !== false;
    const toolsEnabled = (kind === 'channel' || kind === 'memory' || kind === 'provider')
      ? false
      : input.withTools !== false;

    const tools = toolsEnabled
      ? {
        'main.run': {
          name: id.replace(/[^a-z0-9]+/giu, '_').toLowerCase(),
          label: 'Main',
          description: 'Primary capability for this plugin scaffold.',
          handler: async ({ input: capabilityInput }: { input?: Record<string, unknown> }) => ({
            output: {
              pluginId: id,
              capabilityId: 'main.run',
              ok: true,
              input: capabilityInput || {},
              message: `Plugin OS scaffold ${id} is loaded.`,
            },
          }),
        },
      }
      : undefined;

    const capabilityIds = resolveCapabilityIds(kind, toolsEnabled);

    const defined = definePlugin({
      id,
      label: id,
      version: '0.1.0',
      kind: moduleKind,
      summary: `${id} Plugin OS scaffold (${kind})`,
      description: `Governed Zavorth Plugin OS package for ${id} (${kind}).`,
      tags: [moduleKind, kind, 'scaffold'],
      tools: toolsEnabled ? tools : undefined,
      capabilities: toolsEnabled ? undefined : capabilityIds,
      hooks: hooksEnabled
        ? {
          'tool.before_execute': async ({ context }) => {
            void context;
          },
          ...(kind === 'agent'
            ? {
              'agent.after_turn': async ({ context }) => {
                void context;
              },
            }
            : {}),
        }
        : undefined,
      permissions: 'auto',
      entrypoint: {
        module: './index.js',
        exportName: 'register',
        runtime: 'node',
      },
    });

    const manifest = defined.manifest;
    const permissions = resolvePluginPermissions({
      moduleKind,
      permissions: manifest.permissions,
    });
    void permissions;

    const indexJs = renderSelfContainedIndex({
      id,
      moduleKind,
      kind,
      capabilityIds: (manifest.capabilities || []).map((capability) => capability.id),
      withHooks: hooksEnabled,
    });

    const indexTs = language === 'ts'
      ? renderTypeScriptSource({
        id,
        moduleKind,
        kind,
        capabilityIds: (manifest.capabilities || []).map((capability) => capability.id),
        withHooks: hooksEnabled,
      })
      : null;

    const defineExample = renderDefinePluginExample({
      id,
      moduleKind,
      withHooks: hooksEnabled,
      withTools: toolsEnabled,
    });

    const legacyManifest = {
      id,
      name: id,
      version: '0.1.0',
      entry: 'index.js',
      permissions: (manifest.permissions || []).map((permission) => permission.kind),
      sandbox: {
        network: (manifest.permissions || []).some((permission) => permission.kind.startsWith('network.')),
        workspaceRead: (manifest.permissions || []).some((permission) => permission.kind === 'filesystem.read'),
        workspaceWrite: (manifest.permissions || []).some((permission) => permission.kind === 'filesystem.write'),
        shell: (manifest.permissions || []).some((permission) => permission.kind === 'process.spawn'),
        defaultMode: 'approval-required',
      },
      hooks: {
        doctor: 'node -e "console.log(JSON.stringify({ok:true}))"',
      },
    };

    const pkg = {
      name: id,
      version: '0.1.0',
      private: true,
      main: 'index.js',
      scripts: {
        doctor: `node -e "console.log(JSON.stringify({ok:true,plugin:'${escapeJs(id)}'}))"`,
      },
    };

    const relativeDir = path.relative(root, targetDir).replace(/\\/gu, '/');
    const readme = [
      `# ${id}`,
      '',
      `Zavorth Plugin OS scaffold (\`zavorth.plugin-os.v1\`) — kind **${kind}** / moduleKind **${moduleKind}**.`,
      '',
      '## Files',
      '',
      '- `manifest.json` — Plugin OS contract',
      '- `index.js` — self-contained CommonJS `register(ctx)` entrypoint',
      ...(language === 'ts' ? ['- `index.ts` — TypeScript source of truth (keep in sync with index.js for load)'] : []),
      '- `define-plugin.example.js` — monorepo author shape using `definePlugin`',
      '- `zavorth.plugin.json` — legacy CLI compat metadata',
      '',
      '## Install',
      '',
      '```bash',
      `zavorth plugins install ./${relativeDir} --yes`,
      `zavorth plugins enable ${id} --yes`,
      `zavorth plugins inspect ${id}`,
      `zavorth plugins test ./${relativeDir}`,
      '```',
      '',
      '## Local dev loop',
      '',
      '```bash',
      `zavorth plugins dev ./${relativeDir}`,
      `zavorth plugins dev ./${relativeDir} --watch`,
      `zavorth plugins dev ./${relativeDir} --write-manifest`,
      '```',
      '',
      'Capabilities must stay declared in the manifest. Code only binds declared capability ids.',
      '',
    ].join('\n');

    fs.mkdirSync(targetDir, { recursive: true });

    const files: Array<[string, string]> = [
      ['manifest.json', `${JSON.stringify(manifest, null, 2)}\n`],
      ['zavorth.plugin.json', `${JSON.stringify(legacyManifest, null, 2)}\n`],
      ['index.js', indexJs],
      ['define-plugin.example.js', defineExample],
      ['package.json', `${JSON.stringify(pkg, null, 2)}\n`],
      ['README.md', readme],
    ];
    if (indexTs) {
      files.push(['index.ts', indexTs]);
    }

    const written: string[] = [];
    for (const [file, content] of files) {
      const destination = path.join(targetDir, file);
      if (!isInside(root, destination)) {
        continue;
      }
      fs.writeFileSync(destination, content, 'utf8');
      written.push(path.relative(root, destination).replace(/\\/gu, '/'));
    }

    return {
      id,
      targetDir,
      moduleKind,
      language,
      files: written,
      manifest,
    };
  }
}

function resolveCapabilityIds(kind: PluginScaffoldKind, toolsEnabled: boolean): string[] {
  switch (kind) {
    case 'channel':
      return ['channel.send'];
    case 'memory':
      return ['memory.read'];
    case 'provider':
      return ['provider.complete'];
    case 'agent':
      return ['agent.ping'];
    case 'diagnostics':
      return ['ephemera.status'];
    case 'tool':
    default:
      return toolsEnabled ? ['main.run'] : ['main.run'];
  }
}

function renderSelfContainedIndex(input: {
  id: string;
  moduleKind: ZavorthPluginModuleKind;
  kind: PluginScaffoldKind;
  capabilityIds: string[];
  withHooks: boolean;
}): string {
  const ids = input.capabilityIds.length > 0 ? input.capabilityIds : resolveCapabilityIds(input.kind, true);
  const lines: string[] = ['function register(ctx) {'];

  switch (input.kind) {
    case 'channel': {
      const capabilityId = ids[0] || 'channel.send';
      lines.push(
        `  ctx.bindChannel({`,
        `    id: '${escapeJs(input.id)}-channel',`,
        `    capabilityId: '${escapeJs(capabilityId)}',`,
        `    label: '${escapeJs(input.id)} channel',`,
        `    send: async (payload) => ({`,
        `      ok: true,`,
        `      pluginId: '${escapeJs(input.id)}',`,
        `      payload: payload || {},`,
        `    }),`,
        `  });`,
      );
      break;
    }
    case 'memory': {
      const capabilityId = ids[0] || 'memory.read';
      lines.push(
        `  ctx.bindMemoryBackend({`,
        `    id: '${escapeJs(input.id)}-memory',`,
        `    capabilityId: '${escapeJs(capabilityId)}',`,
        `    read: async (input) => ({ key: input && input.key, value: null, pluginId: '${escapeJs(input.id)}' }),`,
        `    write: async (input) => ({ ok: true, key: input && input.key, value: input && input.value }),`,
        `  });`,
      );
      break;
    }
    case 'provider': {
      const capabilityId = ids[0] || 'provider.complete';
      lines.push(
        `  ctx.bindProvider({`,
        `    id: '${escapeJs(input.id)}-provider',`,
        `    capabilityId: '${escapeJs(capabilityId)}',`,
        `    name: '${escapeJs(input.id)}',`,
        `    complete: async (request) => ({`,
        `      ok: true,`,
        `      pluginId: '${escapeJs(input.id)}',`,
        `      text: 'scaffold provider complete',`,
        `      request: request || {},`,
        `    }),`,
        `  });`,
      );
      break;
    }
    case 'agent': {
      for (const capabilityId of ids) {
        lines.push(
          `  ctx.bindCapability('${escapeJs(capabilityId)}', async ({ input }) => ({`,
          `    output: { pluginId: '${escapeJs(input.id)}', capabilityId: '${escapeJs(capabilityId)}', ok: true, input: input || {} },`,
          `  }));`,
        );
      }
      lines.push(
        '',
        `  ctx.registerHook('tool.before_execute', async ({ context }) => {`,
        `    ctx.getLogger().debug('tool.before_execute', { tool: context && context.toolName ? context.toolName : null });`,
        `  });`,
        `  ctx.registerHook('agent.after_turn', async ({ context }) => {`,
        `    ctx.getLogger().debug('agent.after_turn', { turn: context && context.turnId ? context.turnId : null });`,
        `  });`,
      );
      break;
    }
    case 'diagnostics': {
      for (const capabilityId of ids) {
        lines.push(
          `  ctx.bindCapability('${escapeJs(capabilityId)}', async ({ input }) => ({`,
          `    output: {`,
          `      pluginId: '${escapeJs(input.id)}',`,
          `      capabilityId: '${escapeJs(capabilityId)}',`,
          `      ok: true,`,
          `      status: 'idle',`,
          `      input: input || {},`,
          `    },`,
          `  }));`,
        );
      }
      if (input.withHooks) {
        lines.push(
          '',
          `  ctx.registerHook('tool.before_execute', async ({ context }) => {`,
          `    ctx.getLogger().debug('tool.before_execute', { tool: context && context.toolName ? context.toolName : null });`,
          `  });`,
        );
      }
      break;
    }
    case 'tool':
    default: {
      for (const capabilityId of ids) {
        lines.push(
          `  ctx.bindCapability('${escapeJs(capabilityId)}', async ({ input }) => ({`,
          `    output: {`,
          `      pluginId: '${escapeJs(input.id)}',`,
          `      capabilityId: '${escapeJs(capabilityId)}',`,
          `      ok: true,`,
          `      input: input || {},`,
          `      message: 'Plugin OS scaffold ${escapeJs(input.id)} is loaded.',`,
          `    },`,
          `  }));`,
        );
      }
      if (input.withHooks) {
        lines.push(
          '',
          `  ctx.registerHook('tool.before_execute', async ({ context }) => {`,
          `    ctx.getLogger().debug('tool.before_execute', { tool: context && context.toolName ? context.toolName : null });`,
          `  });`,
        );
      }
      break;
    }
  }

  lines.push(
    '}',
    '',
    'module.exports = {',
    '  register,',
    '};',
    '',
  );
  return lines.join('\n');
}

function renderTypeScriptSource(input: {
  id: string;
  moduleKind: ZavorthPluginModuleKind;
  kind: PluginScaffoldKind;
  capabilityIds: string[];
  withHooks: boolean;
}): string {
  const body = renderSelfContainedIndex(input)
    .split('\n')
    .filter((line) => !/^function register/.test(line)
      && !/^module\.exports/.test(line)
      && line.trim() !== 'register,'
      && line.trim() !== '};'
      && !(line.trim() === '}' && !line.startsWith(' ')));

  return [
    '// TypeScript source of truth for authors.',
    '// Plugin OS loads CommonJS index.js — keep both files aligned (or compile TS to index.js).',
    `// kind=${input.kind} moduleKind=${input.moduleKind}`,
    "import type { ZavorthPluginRegistrationContext } from '../../src/contracts/core/PluginRuntimeContract.js';",
    '',
    'export function register(ctx: ZavorthPluginRegistrationContext): void {',
    ...body.filter((line) => line !== '}'),
    '}',
    '',
    'export default { register };',
    '',
  ].join('\n');
}

function renderDefinePluginExample(input: {
  id: string;
  moduleKind: ZavorthPluginModuleKind;
  withHooks: boolean;
  withTools: boolean;
}): string {
  const hooks = input.withHooks
    ? [
      '  hooks: {',
      "    'tool.before_execute': async ({ context }) => {",
      '      void context;',
      '    },',
      '  },',
    ].join('\n')
    : '';

  const tools = input.withTools
    ? [
      '  tools: {',
      "    'main.run': async ({ input }) => ({",
      '      output: {',
      `        pluginId: '${escapeJs(input.id)}',`,
      "        capabilityId: 'main.run',",
      '        ok: true,',
      '        input: input || {},',
      '      },',
      '    }),',
      '  },',
    ].join('\n')
    : "  capabilities: ['main.run'],";

  return [
    '// Monorepo author example. Bundled plugins use self-contained index.js at runtime.',
    "import { definePlugin } from '../../src/sdk/plugin/definePlugin.js';",
    '',
    'export const plugin = definePlugin({',
    `  id: '${escapeJs(input.id)}',`,
    `  kind: '${input.moduleKind}',`,
    `  summary: '${escapeJs(input.id)} Plugin OS scaffold',`,
    tools,
    hooks,
    "  permissions: 'auto',",
    '});',
    '',
    'export const register = plugin.register;',
    'export const manifest = plugin.manifest;',
    '',
  ].filter(Boolean).join('\n');
}

function normalizeId(value: string): string {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.:/-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (!normalized) {
    throw new Error('Plugin scaffold id is required.');
  }
  return normalized;
}

function normalizeScaffoldKind(value: string): PluginScaffoldKind {
  const kind = String(value || '').trim().toLowerCase();
  const allowed: PluginScaffoldKind[] = ['tool', 'channel', 'memory', 'provider', 'agent', 'diagnostics'];
  if (allowed.includes(kind as PluginScaffoldKind)) {
    return kind as PluginScaffoldKind;
  }
  if (kind === 'bridge') {
    return 'channel';
  }
  // Wave 8: map expanded moduleKinds onto scaffold families
  if (kind === 'media' || kind === 'voice' || kind === 'search' || kind === 'qa' || kind === 'module' || kind === 'workspace' || kind === 'sandbox') {
    return 'tool';
  }
  return 'tool';
}

function kindToModuleKind(
  kind: PluginScaffoldKind,
  override?: string,
): ZavorthPluginModuleKind {
  if (override) {
    const normalized = normalizeModuleKind(override);
    if (normalized) {
      return normalized;
    }
  }
  switch (kind) {
    case 'channel':
      return 'channel';
    case 'memory':
      return 'memory';
    case 'provider':
      return 'provider';
    case 'agent':
      return 'agent';
    case 'diagnostics':
      return 'diagnostics';
    case 'tool':
    default:
      return 'tool';
  }
}

function normalizeModuleKind(value: string): ZavorthPluginModuleKind | null {
  const kind = String(value || '').trim().toLowerCase();
  const allowed = new Set<ZavorthPluginModuleKind>([
    'agent', 'provider', 'channel', 'sandbox', 'tool', 'media', 'voice',
    'search', 'memory', 'diagnostics', 'qa', 'bridge', 'workspace', 'module',
  ]);
  return allowed.has(kind as ZavorthPluginModuleKind)
    ? kind as ZavorthPluginModuleKind
    : null;
}

function isInside(root: string, target: string): boolean {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  const relative = path.relative(resolvedRoot, resolvedTarget);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function escapeJs(value: string): string {
  return String(value || '').replace(/\\/gu, '\\\\').replace(/'/gu, "\\'");
}
