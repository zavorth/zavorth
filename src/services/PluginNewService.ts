import fs from 'node:fs';
import path from 'node:path';

import { ZAVORTH_PLUGIN_OS_API_VERSION } from '../contracts/PluginManifestContract.js';
import type { ZavorthPluginManifest, ZavorthPluginModuleKind } from '../contracts/PluginManifestContract.js';
import { PluginStateBridgeService } from './PluginStateBridgeService.js';
import { PluginDevService } from './PluginDevService.js';
import { PluginTestHarnessService } from './PluginTestHarnessService.js';

export type PluginNewStep = {
  id: string;
  ok: boolean;
  summary: string;
};

export type PluginNewResult = {
  ok: boolean;
  id: string;
  targetDir: string;
  moduleKind: ZavorthPluginModuleKind;
  enabled: boolean;
  smoked: boolean;
  steps: PluginNewStep[];
  nextUtterance: string;
  formatText(): string;
};

export type PluginNewServiceRuntime = {
  now?: () => Date;
  stateBridge?: PluginStateBridgeService;
  devService?: PluginDevService;
  testHarness?: PluginTestHarnessService;
  existsSync?: typeof fs.existsSync;
  mkdirSync?: typeof fs.mkdirSync;
  writeFileSync?: typeof fs.writeFileSync;
  readFileSync?: typeof fs.readFileSync;
};

/**
 * One-shot authoring path: scaffold → optional install/enable → optional harness smoke.
 * CLI: zavorth plugins new <id> --kind <k> --enable --smoke
 */
export class PluginNewService {
  private readonly now: () => Date;
  private readonly injectedBridge: PluginStateBridgeService | null;
  private readonly injectedDev: PluginDevService | null;
  private readonly injectedHarness: PluginTestHarnessService | null;
  private readonly existsSync: typeof fs.existsSync;
  private readonly mkdirSync: typeof fs.mkdirSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private readonly readFileSync: typeof fs.readFileSync;

  constructor(runtime: PluginNewServiceRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.injectedBridge = runtime.stateBridge || null;
    this.injectedDev = runtime.devService || null;
    this.injectedHarness = runtime.testHarness || null;
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.mkdirSync = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.writeFileSync = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
  }

  public async run(input: {
    root: string;
    id: string;
    kind?: string;
    /** Legacy alias: install + enable (local dev). */
    run?: boolean;
    /** Install + enable (same as run). */
    enable?: boolean;
    /** After enable, run PluginTestHarnessService on the package. */
    smoke?: boolean;
    targetDir?: string;
  }): Promise<PluginNewResult> {
    const root = path.resolve(input.root || process.cwd());
    const id = normalizeId(input.id);
    const steps: PluginNewStep[] = [];
    const wantSmoke = input.smoke === true;
    const shouldEnable = input.run === true || input.enable === true || wantSmoke;
    const moduleKind = normalizeModuleKind(input.kind || 'tool');
    const targetDir = path.resolve(input.targetDir || path.join(root, 'plugins', id));

    if (!id) {
      return this.finish({
        ok: false,
        id: '',
        targetDir,
        moduleKind,
        enabled: false,
        smoked: false,
        steps: [{ id: 'validate', ok: false, summary: 'Plugin id is required.' }],
        nextUtterance: '',
      });
    }

    if (!isInside(root, targetDir)) {
      return this.finish({
        ok: false,
        id,
        targetDir,
        moduleKind,
        enabled: false,
        smoked: false,
        steps: [{ id: 'validate', ok: false, summary: 'Refusing to create plugin outside the workspace.' }],
        nextUtterance: '',
      });
    }

    try {
      if (moduleKind === 'bridge') {
        this.scaffoldBridgePackage({ root, id, targetDir });
      } else {
        this.scaffoldPingPackage({ root, id, targetDir, moduleKind });
      }
      steps.push({
        id: 'scaffold',
        ok: true,
        summary:
          moduleKind === 'bridge'
            ? `Scaffolded generic bridge template at ${path.relative(root, targetDir).replace(/\\/gu, '/')}`
            : `Scaffolded ping template at ${path.relative(root, targetDir).replace(/\\/gu, '/')}`,
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
        moduleKind,
        enabled: false,
        smoked: false,
        steps,
        nextUtterance: `Fix scaffold errors, then: zavorth plugins new ${id} --kind ${moduleKind} --enable --smoke --yes`,
      });
    }

    let enabled = false;
    if (shouldEnable) {
      try {
        const bridge =
          this.injectedBridge ||
          new PluginStateBridgeService({
            now: this.now,
            projectRoot: root,
          });
        const relativeLocator = path.relative(root, targetDir).replace(/\\/gu, '/');
        const locator = relativeLocator.startsWith('.') ? relativeLocator : `./${relativeLocator}`;
        const bridged = bridge.markInstalled({
          pluginId: id,
          revision: '0.1.0',
          sourceLocator: locator,
          sourceTrusted: true,
          trust: 'trusted',
          enable: true,
        });
        enabled = bridged.installed && bridged.enabled;
        steps.push({
          id: 'install-enable',
          ok: enabled,
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
        const dev =
          this.injectedDev ||
          new PluginDevService({
            now: this.now,
            stateBridge:
              this.injectedBridge ||
              new PluginStateBridgeService({
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
        summary: 'Skipped install/enable. Use --enable or --run (or --smoke) to enable for local dev.',
      });
    }

    let smoked = false;
    if (wantSmoke) {
      try {
        const harness =
          this.injectedHarness ||
          new PluginTestHarnessService({
            now: this.now,
            stateBridge: this.injectedBridge || new PluginStateBridgeService({ now: this.now, projectRoot: root }),
          });
        const smokeResult = await harness.run({ root, pluginPath: targetDir });
        smoked = smokeResult.ok;
        steps.push({
          id: 'smoke',
          ok: smokeResult.ok,
          summary: smokeResult.ok
            ? `Harness smoke ok (${smokeResult.results.filter((r) => r.ok).length}/${smokeResult.results.length} checks)`
            : `Harness smoke failed: ${smokeResult.results
                .filter((r) => !r.ok)
                .map((r) => `${r.name}: ${r.detail}`)
                .join('; ')
                .slice(0, 240)}`,
        });
      } catch (error) {
        steps.push({
          id: 'smoke',
          ok: false,
          summary: `Harness soft-fail: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    } else {
      steps.push({
        id: 'smoke',
        ok: true,
        summary: 'Skipped smoke harness (pass --smoke to run plugins test).',
      });
    }

    const nextUtterance =
      moduleKind === 'bridge'
        ? `Ask the agent: "invoke bridge ${id}" (capability bridge.invoke — soft-fails without endpoint)`
        : `Ask the agent: "run plugin ${id} ping" (capability main.ping)`;

    const scaffoldOk = steps.some((step) => step.id === 'scaffold' && step.ok);
    const enableOk = !shouldEnable || steps.some((step) => step.id === 'install-enable' && step.ok);
    const smokeOk = !wantSmoke || steps.some((step) => step.id === 'smoke' && step.ok);
    const ok = scaffoldOk && enableOk && smokeOk;

    return this.finish({
      ok,
      id,
      targetDir,
      moduleKind,
      enabled,
      smoked,
      steps,
      nextUtterance,
    });
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
      `Minimal Zavorth Plugin OS package (\`${ZAVORTH_PLUGIN_OS_API_VERSION}\`, moduleKind=${moduleKind}).`,
      '',
      '## Capability',
      '',
      '- `main.ping` — returns `{ ok, pong, input, pluginId }`',
      '',
      '## One-shot local authoring',
      '',
      '```bash',
      `zavorth plugins new ${id} --kind ${moduleKind} --enable --smoke --yes`,
      `zavorth plugins inspect ${id}`,
      '```',
      '',
      '`--enable` installs with trust=trusted. `--smoke` runs the Plugin OS test harness.',
      '`--run` is an alias of `--enable` (legacy).',
      '',
      `Path: \`${relativeDir}\``,
      '',
    ].join('\n');

    this.writePackageFiles(root, targetDir, id, manifest, indexJs, readme);
  }

  /**
   * Generic bridge: HTTP / CLI / MCP invoke with soft-fail when endpoint missing.
   * No third-party product brand names — user supplies url/command/server.
   */
  private scaffoldBridgePackage(input: { root: string; id: string; targetDir: string }): void {
    const { root, id, targetDir } = input;
    this.mkdirSync(targetDir, { recursive: true });

    const manifest = buildBridgeManifest(id);
    const indexJs = buildBridgeIndexJs(id);
    const relativeDir = path.relative(root, targetDir).replace(/\\/gu, '/');
    const readme = [
      `# ${id}`,
      '',
      `Generic Zavorth Plugin OS **bridge** (\`${ZAVORTH_PLUGIN_OS_API_VERSION}\`).`,
      '',
      'Exposes `bridge.invoke` with transport modes: `http` | `cli` | `mcp`.',
      'Soft-fails when endpoint / command / MCP server id is missing — never invents remote hubs.',
      '',
      '## Capability',
      '',
      '- `bridge.invoke` — `{ mode?, url|endpoint?, command?, mcpServer?, payload? }`',
      '',
      '## Env (optional)',
      '',
      '- `ZAVORTH_BRIDGE_ENDPOINT` — default HTTPS URL for mode=http',
      '- `ZAVORTH_BRIDGE_CLI` — default CLI command for mode=cli',
      '- `ZAVORTH_BRIDGE_MCP_SERVER` — default MCP server id for mode=mcp',
      '',
      '## One-shot authoring',
      '',
      '```bash',
      `zavorth plugins new ${id} --kind bridge --enable --smoke --yes`,
      `zavorth plugins test ./${relativeDir}`,
      '```',
      '',
      'Outbound HTTP/CLI is planned-only in the scaffold (no network/process without operator config).',
      '',
    ].join('\n');

    this.writePackageFiles(root, targetDir, id, manifest, indexJs, readme);
  }

  private writePackageFiles(
    root: string,
    targetDir: string,
    id: string,
    manifest: ZavorthPluginManifest,
    indexJs: string,
    readme: string,
  ): void {
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
      if (!isInside(root, destination)) continue;
      this.writeFileSync(destination, content, 'utf8');
    }
  }

  private finish(input: {
    ok: boolean;
    id: string;
    targetDir: string;
    moduleKind: ZavorthPluginModuleKind;
    enabled: boolean;
    smoked: boolean;
    steps: PluginNewStep[];
    nextUtterance: string;
  }): PluginNewResult {
    const { ok, id, targetDir, moduleKind, enabled, smoked, steps, nextUtterance } = input;
    return {
      ok,
      id,
      targetDir,
      moduleKind,
      enabled,
      smoked,
      steps,
      nextUtterance,
      formatText() {
        const lines = [
          `Plugin new: ${id || '<missing>'}`,
          `Target: ${targetDir}`,
          `moduleKind: ${moduleKind}`,
          `enabled=${enabled} smoked=${smoked}`,
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

function buildBridgeManifest(id: string): ZavorthPluginManifest {
  return {
    schemaVersion: ZAVORTH_PLUGIN_OS_API_VERSION,
    id,
    label: id,
    version: '0.1.0',
    moduleKind: 'bridge',
    summary: `${id} generic bridge (HTTP / CLI / MCP soft-fail)`,
    description:
      `Generic bridge Plugin OS package for ${id}. Invokes external tools via ` +
      'http|cli|mcp modes. Soft-fails without endpoint. No product brand hubs.',
    tags: ['bridge', 'scaffold', 'http', 'cli', 'mcp'],
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
        id: 'bridge.invoke',
        intent: 'bridge.invoke',
        label: 'Bridge Invoke',
        summary: 'Generic HTTP/CLI/MCP invoke with soft-fail when target missing.',
        artifactKinds: [],
        command: {
          name: `${id.replace(/[^a-z0-9]+/giu, '_').toLowerCase()}_invoke`,
          aliases: ['invoke', 'bridge'],
          usage: '{ mode?: http|cli|mcp, url?, command?, mcpServer?, payload? }',
        },
      },
      {
        id: 'bridge.forward',
        intent: 'bridge.forward',
        label: 'Bridge Forward',
        summary: 'Alias of bridge.invoke for catalog compatibility.',
        artifactKinds: [],
        command: {
          name: `${id.replace(/[^a-z0-9]+/giu, '_').toLowerCase()}_forward`,
          aliases: ['forward'],
          usage: '{ payload?, mode?, url?, command?, mcpServer? }',
        },
      },
    ],
    permissions: [
      {
        kind: 'network.external',
        scope: 'external',
        reason: 'Optional HTTPS invoke when operator supplies a public endpoint.',
        required: false,
      },
      {
        kind: 'process.spawn',
        scope: 'local',
        reason: 'Optional CLI bridge when operator supplies an allowlisted command.',
        required: false,
      },
      {
        kind: 'filesystem.read',
        scope: 'workspace',
        reason: 'Read local payload files when bridging workspace content.',
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
      requiresApproval: true,
      allowNetworkByDefault: false,
      allowFilesystemWriteByDefault: false,
      allowProcessSpawnByDefault: false,
      sandboxProfile: 'restricted',
    },
    artifactKinds: [],
    receiptKinds: [],
  };
}

/** Shared bridge register body — also mirrored in create-zavorth-plugin + examples. */
export function buildBridgeIndexJs(id: string): string {
  const safeId = escapeJs(id);
  return `/**
 * ${id} — generic Plugin OS bridge (HTTP / CLI / MCP).
 * Soft-fails without endpoint; never auto-calls private networks.
 */
function register(ctx) {
  const logger = typeof ctx.getLogger === 'function'
    ? ctx.getLogger()
    : { debug() {}, info() {}, warn() {}, error() {} };

  async function invokeBridge({ input }) {
    const body = input && typeof input === 'object' ? input : {};
    const mode = String(body.mode || body.transport || 'http').toLowerCase();
    const endpoint = String(
      body.url || body.endpoint || process.env.ZAVORTH_BRIDGE_ENDPOINT || '',
    ).trim();
    const command = String(
      body.command || body.cli || process.env.ZAVORTH_BRIDGE_CLI || '',
    ).trim();
    const mcpServer = String(
      body.mcpServer || body.server || process.env.ZAVORTH_BRIDGE_MCP_SERVER || '',
    ).trim();
    const payload = body.payload !== undefined ? body.payload : body;

    if (mode === 'cli' || mode === 'shell' || mode === 'process') {
      if (!command) {
        return {
          output: {
            ok: false,
            softFail: true,
            reason: 'cli_missing',
            pluginId: '${safeId}',
            capabilityId: 'bridge.invoke',
            mode: 'cli',
            message: 'CLI bridge soft-fail: set command/cli or ZAVORTH_BRIDGE_CLI.'}};
      }
      return {
        output: {
          ok: true,
          softFail: true,
          forwarded: false,
          pluginId: '${safeId}',
          capabilityId: 'bridge.invoke',
          mode: 'cli',
          command,
          payload,
          message: 'CLI bridge planned only (scaffold does not spawn processes).'}};
    }

    if (mode === 'mcp') {
      if (!mcpServer) {
        return {
          output: {
            ok: false,
            softFail: true,
            reason: 'mcp_server_missing',
            pluginId: '${safeId}',
            capabilityId: 'bridge.invoke',
            mode: 'mcp',
            message: 'MCP bridge soft-fail: set mcpServer or ZAVORTH_BRIDGE_MCP_SERVER.'}};
      }
      return {
        output: {
          ok: true,
          softFail: true,
          forwarded: false,
          pluginId: '${safeId}',
          capabilityId: 'bridge.invoke',
          mode: 'mcp',
          mcpServer,
          payload,
          message: 'MCP bridge planned only (wire via plugins mcp materialize when ready).'}};
    }

    // default: http
    if (!endpoint) {
      return {
        output: {
          ok: false,
          softFail: true,
          reason: 'endpoint_missing',
          pluginId: '${safeId}',
          capabilityId: 'bridge.invoke',
          mode: 'http',
          message: 'HTTP bridge soft-fail: set url/endpoint or ZAVORTH_BRIDGE_ENDPOINT.'}};
    }
    if (!/^https:\\/\\//i.test(endpoint)) {
      return {
        output: {
          ok: false,
          softFail: true,
          reason: 'https_required',
          pluginId: '${safeId}',
          capabilityId: 'bridge.invoke',
          mode: 'http',
          endpoint,
          message: 'HTTP bridge requires public HTTPS URL (SSRF-safe policy).'}};
    }
    return {
      output: {
        ok: true,
        softFail: true,
        forwarded: false,
        pluginId: '${safeId}',
        capabilityId: 'bridge.invoke',
        mode: 'http',
        endpoint,
        payload,
        message: 'HTTP bridge planned only (scaffold does not perform outbound fetch).'}};
  }

  if (typeof ctx.bindCapability === 'function') {
    ctx.bindCapability('bridge.invoke', invokeBridge);
    ctx.bindCapability('bridge.forward', invokeBridge);
  } else {
    logger.warn('bindCapability unavailable; ${safeId} registered without capability binding');
  }
}

module.exports = { register };
`;
}

function normalizeId(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
}

function normalizeModuleKind(value: string): ZavorthPluginModuleKind {
  const raw = String(value || 'tool')
    .trim()
    .toLowerCase();
  const allowed: ZavorthPluginModuleKind[] = [
    'agent',
    'provider',
    'channel',
    'sandbox',
    'tool',
    'media',
    'voice',
    'search',
    'memory',
    'diagnostics',
    'qa',
    'bridge',
    'workspace',
    'module',
  ];
  return (allowed.includes(raw as ZavorthPluginModuleKind) ? raw : 'tool') as ZavorthPluginModuleKind;
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
