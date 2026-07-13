import fs from 'node:fs';
import path from 'node:path';

import { ZAVORTH_PLUGIN_OS_API_VERSION } from '../contracts/PluginManifestContract.js';
import type { ZavorthPluginManifest, ZavorthPluginModuleKind } from '../contracts/PluginManifestContract.js';
import { PluginStateBridgeService } from './PluginStateBridgeService.js';
import { PluginDevService } from './PluginDevService.js';

export type PluginNewStep = {
  id: string;
  ok: boolean;
  summary: string;
};

export type PluginNewResult = {
  ok: boolean;
  id: string;
  targetDir: string;
  steps: PluginNewStep[];
  nextUtterance: string;
  formatText(): string;
};

export type PluginNewServiceRuntime = {
  now?: () => Date;
  stateBridge?: PluginStateBridgeService;
  devService?: PluginDevService;
  existsSync?: typeof fs.existsSync;
  mkdirSync?: typeof fs.mkdirSync;
  writeFileSync?: typeof fs.writeFileSync;
  readFileSync?: typeof fs.readFileSync;
};

export class PluginNewService {
  private readonly now: () => Date;
  private readonly injectedBridge: PluginStateBridgeService | null;
  private readonly injectedDev: PluginDevService | null;
  private readonly existsSync: typeof fs.existsSync;
  private readonly mkdirSync: typeof fs.mkdirSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private readonly readFileSync: typeof fs.readFileSync;

  constructor(runtime: PluginNewServiceRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.injectedBridge = runtime.stateBridge || null;
    this.injectedDev = runtime.devService || null;
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.mkdirSync = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.writeFileSync = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
  }

  public async run(input: {
    root: string;
    id: string;
    kind?: string;
    run?: boolean;
    targetDir?: string;
  }): Promise<PluginNewResult> {
    const root = path.resolve(input.root || process.cwd());
    const id = normalizeId(input.id);
    const steps: PluginNewStep[] = [];
    const shouldRun = input.run === true;
    const moduleKind = normalizeModuleKind(input.kind || 'tool');
    const targetDir = path.resolve(
      input.targetDir || path.join(root, 'plugins', id),
    );

    if (!id) {
      return this.finish({
        ok: false,
        id: '',
        targetDir,
        steps: [{ id: 'validate', ok: false, summary: 'Plugin id is required.' }],
        nextUtterance: '',
      });
    }

    if (!isInside(root, targetDir)) {
      return this.finish({
        ok: false,
        id,
        targetDir,
        steps: [{ id: 'validate', ok: false, summary: 'Refusing to create plugin outside the workspace.' }],
        nextUtterance: '',
      });
    }

    try {
      this.scaffoldPingPackage({ root, id, targetDir, moduleKind });
      steps.push({
        id: 'scaffold',
        ok: true,
        summary: `Scaffolded ping template at ${path.relative(root, targetDir).replace(/\\/gu, '/')}`,
      });
    } catch (error) {
      steps.push({
        id: 'scaffold',
        ok: false,
        summary: error instanceof Error ? error.message : String(error),
      });
      return this.finish({
        ok: false,
        id,
        targetDir,
        steps,
        nextUtterance: `Fix scaffold errors, then: zavorth plugins new ${id} --run --yes`,
      });
    }

    if (shouldRun) {
      try {
        const bridge = this.injectedBridge || new PluginStateBridgeService({
          now: this.now,
          projectRoot: root,
        });
        const relativeLocator = path.relative(root, targetDir).replace(/\\/gu, '/');
        const locator = relativeLocator.startsWith('.') ? relativeLocator : `./${relativeLocator}`;
        const devPreset = process.env.ZAVORTH_PLUGIN_DEV === '1' || shouldRun;
        const bridged = bridge.markInstalled({
          pluginId: id,
          revision: '0.1.0',
          sourceLocator: locator,
          sourceTrusted: true,
          trust: devPreset ? 'trusted' : 'trusted',
          enable: true,
        });
        steps.push({
          id: 'install-enable',
          ok: bridged.installed && bridged.enabled,
          summary: `Bridge installed + enabled (trust=${bridged.trust}, local dev preset)`,
        });
      } catch (error) {
        steps.push({
          id: 'install-enable',
          ok: false,
          summary: error instanceof Error ? error.message : String(error),
        });
      }

      try {
        const dev = this.injectedDev || new PluginDevService({
          now: this.now,
          stateBridge: this.injectedBridge || new PluginStateBridgeService({
            now: this.now,
            projectRoot: root,
          }),
        });
        const snapshot = await dev.run({
          root,
          pluginPath: targetDir,
          enable: true,
          trust: 'trusted',
          applyInference: false,
          writeManifest: false,
          watch: false,
        });
        const bootstrapOk = snapshot.steps.some((step) => step.ok);
        steps.push({
          id: 'dev-bootstrap',
          ok: bootstrapOk,
          summary: bootstrapOk
            ? `PluginDev bootstrap ok (pluginId=${snapshot.pluginId || id})`
            : `PluginDev bootstrap soft-failed: ${snapshot.steps.map((s) => s.summary).join('; ')}`,
        });
      } catch (error) {
        steps.push({
          id: 'dev-bootstrap',
          ok: false,
          summary: `PluginDev soft-fail: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    } else {
      steps.push({
        id: 'install-enable',
        ok: true,
        summary: 'Skipped install/enable (run=false). Use --run to enable for local dev.',
      });
    }

    const nextUtterance = `Ask the agent: "run plugin ${id} ping" (capability main.ping)`;
    const ok = steps.every((step) => step.ok) || (
      steps.some((step) => step.id === 'scaffold' && step.ok)
      && (!shouldRun || steps.some((step) => step.id === 'install-enable' && step.ok))
    );

    return this.finish({ ok, id, targetDir, steps, nextUtterance });
  }

  private scaffoldPingPackage(input: {
    root: string;
    id: string;
    targetDir: string;
    moduleKind: ZavorthPluginModuleKind;
  }): void {
    const { root, id, targetDir, moduleKind } = input;
    this.mkdirSync(targetDir, { recursive: true });

    const manifest = buildPingManifest(id, moduleKind);
    const indexJs = [
      'function register(ctx) {',
      "  ctx.bindCapability('main.ping', async ({ input }) => ({",
      '    output: {',
      '      ok: true,',
      '      pong: true,',
      '      input: input || {},',
      `      pluginId: '${escapeJs(id)}',`,
      '    },',
      '  }));',
      '}',
      '',
      'module.exports = { register };',
      '',
    ].join('\n');

    const relativeDir = path.relative(root, targetDir).replace(/\\/gu, '/');
    const readme = [
      `# ${id}`,
      '',
      `Minimal Zavorth Plugin OS ping package (\`${ZAVORTH_PLUGIN_OS_API_VERSION}\`).`,
      '',
      '## Capability',
      '',
      '- `main.ping` — returns `{ ok, pong, input, pluginId }`',
      '',
      '## Local dev',
      '',
      '```bash',
      `zavorth plugins new ${id} --run --yes`,
      `zavorth plugins inspect ${id}`,
      '```',
      '',
      '`--run` installs with trust=trusted and enable=true (local dev preset).',
      `Set \`ZAVORTH_PLUGIN_DEV=1\` for the same preset with other workflows.`,
      '',
      `Path: \`${relativeDir}\``,
      '',
    ].join('\n');

    const pkg = {
      name: id,
      version: '0.1.0',
      private: true,
      main: 'index.js',
    };

    const files: Array<[string, string]> = [
      ['manifest.json', `${JSON.stringify(manifest, null, 2)}\n`],
      ['index.js', indexJs],
      ['package.json', `${JSON.stringify(pkg, null, 2)}\n`],
      ['README.md', readme],
    ];

    for (const [name, content] of files) {
      const destination = path.join(targetDir, name);
      if (!isInside(root, destination)) {
        continue;
      }
      this.writeFileSync(destination, content, 'utf8');
    }
  }

  private finish(input: {
    ok: boolean;
    id: string;
    targetDir: string;
    steps: PluginNewStep[];
    nextUtterance: string;
  }): PluginNewResult {
    const { ok, id, targetDir, steps, nextUtterance } = input;
    return {
      ok,
      id,
      targetDir,
      steps,
      nextUtterance,
      formatText() {
        const lines = [
          `Plugin new: ${id || '<missing>'}`,
          `Target: ${targetDir}`,
          `ok=${ok}`,
          ...steps.map((step) => `  ${step.ok ? 'ok' : 'fail'} ${step.id}: ${step.summary}`),
          nextUtterance ? `Next: ${nextUtterance}` : '',
        ].filter(Boolean);
        return lines.join('\n');
      },
    };
  }
}

function buildPingManifest(id: string, moduleKind: ZavorthPluginModuleKind): ZavorthPluginManifest {
  return {
    schemaVersion: ZAVORTH_PLUGIN_OS_API_VERSION,
    id,
    label: id,
    version: '0.1.0',
    moduleKind,
    summary: `${id} ping plugin scaffold`,
    description: `Minimal Plugin OS package for ${id} with main.ping capability.`,
    tags: [moduleKind, 'scaffold', 'ping'],
    source: {
      kind: 'local',
      locator: `local://plugins/${id}`,
      digest: null,
      trusted: false,
    },
    compatibility: {
      zavorthVersion: '>=1.1.0',
      pluginApiVersion: ZAVORTH_PLUGIN_OS_API_VERSION,
    },
    capabilities: [
      {
        id: 'main.ping',
        intent: 'tool.ping',
        label: 'Ping',
        summary: 'Health-check capability that echoes input.',
        artifactKinds: [],
        command: {
          name: `${id.replace(/[^a-z0-9]+/giu, '_').toLowerCase()}_ping`,
          aliases: ['ping'],
          usage: null,
        },
      },
    ],
    permissions: [
      {
        kind: 'filesystem.read',
        scope: 'workspace',
        reason: 'Auto-declared workspace read for local plugin packages.',
        required: false,
      },
    ],
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
      requiresApproval: false,
      allowNetworkByDefault: false,
      allowFilesystemWriteByDefault: false,
      allowProcessSpawnByDefault: false,
      sandboxProfile: 'restricted',
    },
    artifactKinds: [],
    receiptKinds: [],
  };
}

function normalizeId(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
}

function normalizeModuleKind(value: string): ZavorthPluginModuleKind {
  const raw = String(value || 'tool').trim().toLowerCase();
  const allowed: ZavorthPluginModuleKind[] = [
    'agent', 'provider', 'channel', 'sandbox', 'tool', 'media', 'voice',
    'search', 'memory', 'diagnostics', 'qa', 'bridge', 'workspace', 'module',
  ];
  return (allowed.includes(raw as ZavorthPluginModuleKind)
    ? raw
    : 'tool') as ZavorthPluginModuleKind;
}

function isInside(root: string, target: string): boolean {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  const relative = path.relative(resolvedRoot, resolvedTarget);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function escapeJs(value: string): string {
  return String(value).replace(/\\/gu, '\\\\').replace(/'/gu, "\\'");
}
