import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

import { ZAVORTH_PLUGIN_OS_API_VERSION } from '../contracts/PluginManifestContract.js';
import type { ZavorthPluginManifest, ZavorthPluginModuleKind } from '../contracts/PluginManifestContract.js';
import { PluginTestHarnessService } from './PluginTestHarnessService.js';
import { PluginStateBridgeService } from './PluginStateBridgeService.js';

export type PluginForgePlan = {
  ok: boolean;
  intent: string;
  pluginId: string;
  previewDir: string;
  files: Array<{ path: string; content: string }>;
  manifest: object;
  findings: string[];
  nextCommands: string[];
  formatText(): string;
};

export type PluginForgeApplyResult = {
  ok: boolean;
  targetDir: string;
  pluginId: string;
  testOk?: boolean;
  receiptPath?: string;
  findings: string[];
  formatText(): string;
};

export type PluginForgeServiceRuntime = {
  now?: () => Date;
  projectRoot?: string;
  stateBridge?: PluginStateBridgeService;
  testHarness?: PluginTestHarnessService;
  llmChat?: (prompt: string) => Promise<string | null>;
  existsSync?: typeof fs.existsSync;
  mkdirSync?: typeof fs.mkdirSync;
  writeFileSync?: typeof fs.writeFileSync;
  readFileSync?: typeof fs.readFileSync;
  readdirSync?: typeof fs.readdirSync;
  cpSync?: typeof fs.cpSync;
  rmSync?: typeof fs.rmSync;
};

type TemplateKind = 'search' | 'memory' | 'hook' | 'tool';

export class PluginForgeService {
  private readonly now: () => Date;
  private readonly projectRoot: string;
  private readonly injectedBridge: PluginStateBridgeService | null;
  private readonly injectedHarness: PluginTestHarnessService | null;
  private readonly llmChat: ((prompt: string) => Promise<string | null>) | null;
  private readonly existsSync: typeof fs.existsSync;
  private readonly mkdirSync: typeof fs.mkdirSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly readdirSync: typeof fs.readdirSync;
  private readonly cpSync: typeof fs.cpSync;
  private readonly rmSync: typeof fs.rmSync;

  constructor(runtime: PluginForgeServiceRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.projectRoot = path.resolve(runtime.projectRoot || process.cwd());
    this.injectedBridge = runtime.stateBridge || null;
    this.injectedHarness = runtime.testHarness || null;
    this.llmChat = runtime.llmChat || null;
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.mkdirSync = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.writeFileSync = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.readdirSync = runtime.readdirSync || fs.readdirSync.bind(fs);
    this.cpSync = runtime.cpSync || fs.cpSync.bind(fs);
    this.rmSync = runtime.rmSync || fs.rmSync.bind(fs);
  }

  public async plan(
    intent: string,
    options: { id?: string; root?: string } = {},
  ): Promise<PluginForgePlan> {
    const root = path.resolve(options.root || this.projectRoot);
    const findings: string[] = [];
    const trimmedIntent = String(intent || '').trim();
    if (!trimmedIntent) {
      return finishPlan({
        ok: false,
        intent: '',
        pluginId: '',
        previewDir: '',
        files: [],
        manifest: {},
        findings: ['intent is required'],
        nextCommands: ['zavorth plugins forge plan "<intent>"'],
      });
    }

    const templateKind = detectTemplateKind(trimmedIntent);
    const pluginId = normalizePluginId(options.id || derivePluginId(trimmedIntent, templateKind));
    const stamp = stampFromDate(this.now());
    const previewDir = path.join(root, '.zavorth', 'plugin-forge', 'previews', `${pluginId}-${stamp}`);

    if (!isInside(root, previewDir)) {
      return finishPlan({
        ok: false,
        intent: trimmedIntent,
        pluginId,
        previewDir,
        files: [],
        manifest: {},
        findings: ['Refusing to write preview outside workspace'],
        nextCommands: [],
      });
    }

    const moduleKind = templateKindToModuleKind(templateKind);
    const capabilities = templateCapabilities(templateKind, pluginId, trimmedIntent);
    const manifest = buildManifest({
      pluginId,
      moduleKind,
      intent: trimmedIntent,
      templateKind,
      capabilities,
    });

    let indexJs = renderTemplateIndex({
      pluginId,
      templateKind,
      intent: trimmedIntent,
      capabilities,
    });

    const wantLlm = Boolean(this.llmChat) || process.env.ZAVORTH_PLUGIN_FORGE_LLM === '1';
    if (wantLlm) {
      try {
        const richer = await this.tryLlmIndex({
          pluginId,
          intent: trimmedIntent,
          templateKind,
          capabilities,
        });
        if (richer) {
          indexJs = richer;
          findings.push('index.js generated with optional LLM assist');
        } else {
          findings.push('LLM assist unavailable — used template index.js');
        }
      } catch (error: unknown) {
        findings.push(
          `LLM assist soft-failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    } else {
      findings.push(`template=${templateKind}`);
    }

    const relativePreview = path.relative(root, previewDir).replace(/\\/gu, '/');
    const readme = [
      `# ${pluginId}`,
      '',
      `Plugin forge preview generated from intent: ${trimmedIntent}`,
      '',
      `Template kind: **${templateKind}** / moduleKind **${moduleKind}**`,
      '',
      '## Apply',
      '',
      '```bash',
      `zavorth plugins forge apply ${relativePreview} --yes`,
      `zavorth plugins enable ${pluginId} --yes`,
      '```',
      '',
      'Does not auto-enable. Review the package before apply.',
      '',
    ].join('\n');

    const pkg = {
      name: pluginId,
      version: '0.1.0',
      private: true,
      main: 'index.js',
    };

    const files: Array<{ path: string; content: string }> = [
      { path: 'manifest.json', content: `${JSON.stringify(manifest, null, 2)}\n` },
      { path: 'index.js', content: indexJs },
      { path: 'package.json', content: `${JSON.stringify(pkg, null, 2)}\n` },
      { path: 'README.md', content: readme },
      {
        path: 'FORGE_META.json',
        content: `${JSON.stringify({
          intent: trimmedIntent,
          pluginId,
          templateKind,
          generatedAt: this.now().toISOString(),
        }, null, 2)}\n`,
      },
    ];

    try {
      this.mkdirSync(previewDir, { recursive: true });
      for (const file of files) {
        const destination = path.join(previewDir, file.path);
        if (!isInside(previewDir, destination) && destination !== previewDir) {
          findings.push(`skipped unsafe path: ${file.path}`);
          continue;
        }
        this.writeFileSync(destination, file.content, 'utf8');
      }
      findings.push(`preview written: ${relativePreview}`);
    } catch (error: unknown) {
      findings.push(
        `preview write failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return finishPlan({
        ok: false,
        intent: trimmedIntent,
        pluginId,
        previewDir: relativePreview,
        files,
        manifest,
        findings,
        nextCommands: [],
      });
    }

    return finishPlan({
      ok: true,
      intent: trimmedIntent,
      pluginId,
      previewDir: relativePreview,
      files,
      manifest,
      findings,
      nextCommands: [
        `zavorth plugins forge apply ${relativePreview} --yes`,
        `zavorth plugins forge apply ${relativePreview} --yes --enable`,
        `zavorth plugins test ${relativePreview}`,
      ],
    });
  }

  public async apply(
    previewDirOrId: string,
    options: {
      approved?: boolean;
      enable?: boolean;
      root?: string;
      target?: 'plugins' | 'zavorth';
    } = {},
  ): Promise<PluginForgeApplyResult> {
    const root = path.resolve(options.root || this.projectRoot);
    const findings: string[] = [];

    if (options.approved !== true) {
      return finishApply({
        ok: false,
        targetDir: '',
        pluginId: '',
        findings: [
          'apply requires approved===true (pass --yes on CLI)',
          'Never mutates production packages without explicit approval',
        ],
      });
    }

    const previewDir = this.resolvePreviewDir(root, previewDirOrId);
    if (!previewDir || !this.existsSync(previewDir)) {
      return finishApply({
        ok: false,
        targetDir: '',
        pluginId: '',
        findings: [`preview not found: ${previewDirOrId}`],
      });
    }

    const manifestPath = path.join(previewDir, 'manifest.json');
    if (!this.existsSync(manifestPath)) {
      return finishApply({
        ok: false,
        targetDir: '',
        pluginId: '',
        findings: [`manifest.json missing in preview: ${previewDir}`],
      });
    }

    let pluginId = '';
    try {
      const manifest = JSON.parse(this.readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
      pluginId = normalizePluginId(String(manifest.id || path.basename(previewDir)));
    } catch (error: unknown) {
      return finishApply({
        ok: false,
        targetDir: '',
        pluginId: '',
        findings: [
          `manifest parse failed: ${error instanceof Error ? error.message : String(error)}`,
        ],
      });
    }

    const preferBundled = options.target === 'plugins';
    const targetDir = preferBundled
      ? path.join(root, 'plugins', pluginId)
      : path.join(root, '.zavorth', 'plugins', pluginId);

    if (!isInside(root, targetDir)) {
      return finishApply({
        ok: false,
        targetDir,
        pluginId,
        findings: ['Refusing to write package outside workspace'],
      });
    }

    try {
      this.mkdirSync(path.dirname(targetDir), { recursive: true });
      if (this.existsSync(targetDir)) {
        this.rmSync(targetDir, { recursive: true, force: true });
      }
      this.cpSync(previewDir, targetDir, { recursive: true });
      findings.push(`package copied to ${path.relative(root, targetDir).replace(/\\/gu, '/')}`);
    } catch (error: unknown) {
      return finishApply({
        ok: false,
        targetDir: path.relative(root, targetDir).replace(/\\/gu, '/'),
        pluginId,
        findings: [
          `copy failed: ${error instanceof Error ? error.message : String(error)}`,
        ],
      });
    }

    let testOk: boolean | undefined;
    try {
      const harness = this.injectedHarness || new PluginTestHarnessService({
        stateBridge: this.injectedBridge || new PluginStateBridgeService({
          now: this.now,
          projectRoot: root,
        }),
      });
      const harnessResult = await harness.run({
        root,
        pluginPath: targetDir,
        cases: ['manifest-validates', 'module-loads-register'],
      });
      testOk = harnessResult.ok;
      findings.push(
        harnessResult.ok ? 'PluginTestHarness soft pass (manifest + module load)'
          : `PluginTestHarness soft findings: ${harnessResult.results.map((r) => r.detail).join('; ')}`,
      );
    } catch (error: unknown) {
      testOk = false;
      findings.push(
        `PluginTestHarness soft-failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (options.enable === true) {
      try {
        const bridge = this.injectedBridge || new PluginStateBridgeService({
          now: this.now,
          projectRoot: root,
        });
        const relative = path.relative(root, targetDir).replace(/\\/gu, '/');
        bridge.markInstalled({
          pluginId,
          revision: '0.1.0',
          sourceLocator: relative.startsWith('.') ? relative : `./${relative}`,
          trust: 'review',
          enable: true,
        });
        findings.push('plugin enabled via bridge (explicit --enable)');
      } catch (error: unknown) {
        findings.push(
          `enable soft-failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    } else {
      findings.push('not auto-enabled (pass --enable to enable)');
    }

    let receiptPath: string | undefined;
    try {
      const stamp = stampFromDate(this.now());
      const receiptsDir = path.join(root, '.zavorth', 'plugin-forge', 'receipts');
      this.mkdirSync(receiptsDir, { recursive: true });
      const receiptName = `${pluginId}-${stamp}.json`;
      receiptPath = path.join(receiptsDir, receiptName);
      const relativePreview = path.relative(root, previewDir).replace(/\\/gu, '/');
      const relativeTarget = path.relative(root, targetDir).replace(/\\/gu, '/');
      const packageDigest = this.digestPackage(targetDir);
      const receipt = {
        kind: 'plugin.forge.apply',
        pluginId,
        previewDir: relativePreview,
        targetDir: relativeTarget,
        approved: true,
        enable: options.enable === true,
        testOk,
        packageDigest,
        createdAt: this.now().toISOString(),
        findings: [...findings],
      };
      this.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
      receiptPath = path.relative(root, receiptPath).replace(/\\/gu, '/');
      findings.push(`receipt: ${receiptPath}`);

      // Also append to the shared Plugin OS receipt ledger for audit trails.
      try {
        const ledgerDir = path.join(root, '.zavorth', 'receipts');
        this.mkdirSync(ledgerDir, { recursive: true });
        const ledgerPath = path.join(ledgerDir, 'plugins.jsonl');
        const ledgerLine = `${JSON.stringify({
          id: `plugin-forge-${pluginId}-${stamp}`,
          kind: 'plugin.forge.apply',
          pluginId,
          action: 'forge.apply',
          previewDir: relativePreview,
          targetDir: relativeTarget,
          approved: true,
          enable: options.enable === true,
          testOk,
          packageDigest,
          receiptPath,
          createdAt: this.now().toISOString(),
        })}\n`;
        fs.appendFileSync(ledgerPath, ledgerLine, 'utf8');
        findings.push(`ledger: ${path.relative(root, ledgerPath).replace(/\\/gu, '/')}`);
      } catch {
        /* ledger is best-effort */
      }
    } catch (error: unknown) {
      findings.push(
        `receipt soft-failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return finishApply({
      ok: true,
      targetDir: path.relative(root, targetDir).replace(/\\/gu, '/'),
      pluginId,
      testOk,
      receiptPath,
      findings,
    });
  }

  public resolvePreviewDir(root: string, previewDirOrId: string): string | null {
    const raw = String(previewDirOrId || '').trim();
    if (!raw) return null;

    const absolute = path.isAbsolute(raw) ? path.resolve(raw) : path.resolve(root, raw);
    if (this.existsSync(path.join(absolute, 'manifest.json'))) {
      return absolute;
    }

    const previewsRoot = path.join(root, '.zavorth', 'plugin-forge', 'previews');
    if (!this.existsSync(previewsRoot)) return null;

    // exact folder name
    const direct = path.join(previewsRoot, raw);
    if (this.existsSync(path.join(direct, 'manifest.json'))) {
      return direct;
    }

    // match by plugin id prefix (latest stamp wins)
    try {
      const entries = this.readdirSync(previewsRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .filter((name) => name === raw || name.startsWith(`${raw}-`))
        .sort();
      if (entries.length > 0) {
        const latest = entries[entries.length - 1];
        const candidate = path.join(previewsRoot, latest);
        if (this.existsSync(path.join(candidate, 'manifest.json'))) {
          return candidate;
        }
      }
    } catch {
      /* soft-fail */
    }
    return null;
  }

  private digestPackage(packageDir: string): string | null {
    try {
      if (!this.existsSync(packageDir)) return null;
      const hash = createHash('sha256');
      const walk = (dir: string) => {
        let entries: fs.Dirent[] = [];
        try {
          entries = this.readdirSync(dir, { withFileTypes: true }) as fs.Dirent[];
        } catch {
          return;
        }
        for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
          const full = path.join(dir, entry.name);
          const relative = path.relative(packageDir, full).replace(/\\/gu, '/');
          if (entry.isDirectory()) {
            walk(full);
            continue;
          }
          if (!entry.isFile()) continue;
          hash.update(relative);
          hash.update('\0');
          try {
            hash.update(this.readFileSync(full));
            hash.update('\0');
          } catch {
            /* skip unreadable */
          }
        }
      };
      walk(packageDir);
      return hash.digest('hex');
    } catch {
      return null;
    }
  }

  private async tryLlmIndex(input: {
    pluginId: string;
    intent: string;
    templateKind: TemplateKind;
    capabilities: Array<{ id: string }>;
  }): Promise<string | null> {
    const prompt = [
      'Generate a CommonJS Zavorth Plugin OS index.js that exports register(ctx).',
      'Use ctx.bindCapability only. Soft-fail all errors. No TypeScript.',
      `pluginId=${input.pluginId}`,
      `templateKind=${input.templateKind}`,
      `intent=${input.intent}`,
      `capabilities=${input.capabilities.map((c) => c.id).join(',')}`,
      'Return only the JavaScript source.',
    ].join('\n');

    let text: string | null = null;
    if (this.llmChat) {
      text = await this.llmChat(prompt);
    } else {
      text = await tryDefaultLlmChat(prompt);
    }
    if (!text) return null;
    const cleaned = stripCodeFence(text);
    if (!cleaned.includes('register') || !cleaned.includes('module.exports')) {
      return null;
    }
    return cleaned.endsWith('\n') ? cleaned : `${cleaned}\n`;
  }
}

function finishPlan(input: Omit<PluginForgePlan, 'formatText'>): PluginForgePlan {
  return {
    ...input,
    formatText() {
      return [
        `Plugin forge plan: ${input.pluginId || '<none>'}`,
        `intent: ${input.intent || '<empty>'}`,
        `ok=${input.ok}`,
        `preview: ${input.previewDir || 'n/a'}`,
        `files: ${input.files.map((f) => f.path).join(', ') || 'none'}`,
        ...input.findings.map((line) => ` ? ${line}`),
        ...input.nextCommands.map((cmd) => `  next: ${cmd}`),
      ].join('\n');
    },
  };
}

function finishApply(input: Omit<PluginForgeApplyResult, 'formatText'>): PluginForgeApplyResult {
  return {
    ...input,
    formatText() {
      return [
        `Plugin forge apply: ${input.pluginId || '<none>'}`,
        `ok=${input.ok}`,
        `target: ${input.targetDir || 'n/a'}`,
        typeof input.testOk === 'boolean' ? `testOk=${input.testOk}` : '',
        input.receiptPath ? `receipt: ${input.receiptPath}` : '',
        ...input.findings.map((line) => ` ? ${line}`),
      ].filter(Boolean).join('\n');
    },
  };
}

function detectTemplateKind(intent: string): TemplateKind {
  const lower = intent.toLowerCase();
  if (/\b(search|web|google|query|searx|exa)\b/u.test(lower)) return 'search';
  if (/\b(memory|remember|recall|store|kv)\b/u.test(lower)) return 'memory';
  if (/\b(hook|cost|token|diagnostic|before_request|after_request)\b/u.test(lower)) return 'hook';
  return 'tool';
}

function templateKindToModuleKind(kind: TemplateKind): ZavorthPluginModuleKind {
  if (kind === 'search') return 'search';
  if (kind === 'memory') return 'memory';
  if (kind === 'hook') return 'diagnostics';
  return 'tool';
}

function derivePluginId(intent: string, kind: TemplateKind): string {
  const tokens = intent
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter((part) => part.length >= 2)
    .slice(0, 4);
  const base = tokens.join('-') || kind;
  return normalizePluginId(`forge-${base}`.slice(0, 48));
}

function normalizePluginId(raw: string): string {
  const cleaned = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .replace(/-{2,}/gu, '-');
  return cleaned || 'forge-plugin';
}

function stampFromDate(date: Date): string {
  return date.toISOString().replace(/[:.]/gu, '-');
}

function templateCapabilities(
  kind: TemplateKind,
  pluginId: string,
  intent: string,
): Array<{
  id: string;
  intent: string;
  label: string;
  summary: string;
  commandName: string;
  usage: string | null;
}> {
  if (kind === 'search') {
    return [{
      id: 'search.query',
      intent: 'search.web.query',
      label: 'Search Query',
      summary: `Search capability forged for: ${intent}`,
      commandName: `${safeCommand(pluginId)}_search`,
      usage: '{ query, limit... }',
    }];
  }
  if (kind === 'memory') {
    return [
      {
        id: 'memory.write',
        intent: 'memory.write',
        label: 'Memory Write',
        summary: 'Write a key/value entry.',
        commandName: `${safeCommand(pluginId)}_write`,
        usage: '{ key, value }',
      },
      {
        id: 'memory.get',
        intent: 'memory.get',
        label: 'Memory Get',
        summary: 'Get a value by key.',
        commandName: `${safeCommand(pluginId)}_get`,
        usage: '{ key }',
      },
    ];
  }
  if (kind === 'hook') {
    return [{
      id: 'cost.summary',
      intent: 'diagnostics.cost.summary',
      label: 'Cost Summary',
      summary: 'Summarize forged diagnostics ledger.',
      commandName: `${safeCommand(pluginId)}_summary`,
      usage: null,
    }];
  }
  return [{
    id: 'main.run',
    intent: 'tool.run',
    label: 'Main',
    summary: intent.slice(0, 160),
    commandName: `${safeCommand(pluginId)}_run`,
    usage: '{ ? }',
  }];
}

function buildManifest(input: {
  pluginId: string;
  moduleKind: ZavorthPluginModuleKind;
  intent: string;
  templateKind: TemplateKind;
  capabilities: ReturnType<typeof templateCapabilities>;
}): ZavorthPluginManifest {
  const permissions = resolvePermissions(input.templateKind);
  return {
    schemaVersion: ZAVORTH_PLUGIN_OS_API_VERSION,
    id: input.pluginId,
    label: input.pluginId,
    version: '0.1.0',
    moduleKind: input.moduleKind,
    summary: `Forged plugin: ${input.intent.slice(0, 120)}`,
    description: `Plugin forge package (${input.templateKind}) for intent: ${input.intent}`,
    tags: [input.moduleKind, input.templateKind, 'forge', 'generated'],
    source: {
      kind: 'local',
      locator: `forge://${input.pluginId}`,
      digest: null,
      trusted: false,
    },
    compatibility: {
      zavorthVersion: '>=1.1.0',
      pluginApiVersion: ZAVORTH_PLUGIN_OS_API_VERSION,
    },
    capabilities: input.capabilities.map((cap) => ({
      id: cap.id,
      intent: cap.intent,
      label: cap.label,
      summary: cap.summary,
      artifactKinds: [],
      command: {
        name: cap.commandName,
        aliases: [],
        usage: cap.usage,
      },
    })),
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
      requiresApproval: true,
      allowNetworkByDefault: false,
      allowFilesystemWriteByDefault: false,
      allowProcessSpawnByDefault: false,
      sandboxProfile: input.templateKind === 'search' ? 'networked' : 'restricted',
    },
    artifactKinds: [],
    receiptKinds: ['plugin-forge.receipt'],
  };
}

function resolvePermissions(kind: TemplateKind): ZavorthPluginManifest['permissions'] {
  if (kind === 'search') {
    return [{
      kind: 'network.external',
      scope: 'external',
      reason: 'Optional outbound search calls.',
      required: false,
    }];
  }
  if (kind === 'memory' || kind === 'hook') {
    return [
      {
        kind: 'filesystem.read',
        scope: 'workspace',
        reason: 'Read forged store/ledger under .zavorth.',
        required: true,
      },
      {
        kind: 'filesystem.write',
        scope: 'workspace',
        reason: 'Persist forged store/ledger under .zavorth.',
        required: true,
      },
    ];
  }
  return [{
    kind: 'filesystem.read',
    scope: 'workspace',
    reason: 'Workspace read for tool plugin packages.',
    required: false,
  }];
}

function renderTemplateIndex(input: {
  pluginId: string;
  templateKind: TemplateKind;
  intent: string;
  capabilities: ReturnType<typeof templateCapabilities>;
}): string {
  const id = escapeJs(input.pluginId);
  const intent = escapeJs(input.intent);

  if (input.templateKind === 'search') {
    return [
      'function register(ctx) {',
      '  const logger = ctx.getLogger();',
      "  ctx.bindCapability('search.query', async ({ input }) => {",
      '    try {',
      "      const query = String((input && (input.query || input.q || input.text)) || '').trim();",
      '      if (!query) {',
      "        return { output: { ok: false, reason: 'query is required', pluginId: '" + id + "' } };",
      '      }',
      '      return {',
      '        output: {',
      '          ok: true,',
      "          backend: 'forge-template',",
      '          pluginId: \'' + id + '\',',
      '          query,',
      '          results: [{ title: query, url: \'\', snippet: \'Forged search template (configure a real backend).\' }],',
      '          intent: \'' + intent + '\',',
      '        },',
      '      };',
      '    } catch (error) {',
      "      logger.warn('search.query failed', { error: error instanceof Error ? error.message : String(error) });",
      "      return { output: { ok: false, message: error instanceof Error ? error.message : String(error) } };",
      '    }',
      '  });',
      '}',
      '',
      'module.exports = { register };',
      '',
    ].join('\n');
  }

  if (input.templateKind === 'memory') {
    return [
      "const fs = require('node:fs');",
      "const path = require('node:path');",
      '',
      'function register(ctx) {',
      '  const logger = ctx.getLogger();',
      '  const workspace = ctx.getWorkspacePath();',
      "  const storePath = path.join(workspace, '.zavorth', 'forge-memory', '" + id + "', 'store.json');",
      '',
      '  function readStore() {',
      '    try {',
      '      if (!fs.existsSync(storePath)) return {};',
      '      return JSON.parse(fs.readFileSync(storePath, \'utf8\'));',
      '    } catch { return {}; }',
      '  }',
      '',
      '  function writeStore(data) {',
      '    fs.mkdirSync(path.dirname(storePath), { recursive: true });',
      '    fs.writeFileSync(storePath, JSON.stringify(data, null, 2) + \'\\n\', \'utf8\');',
      '  }',
      '',
      "  ctx.bindCapability('memory.write', async ({ input }) => {",
      '    try {',
      "      const key = String((input && input.key) || '').trim();",
      '      if (!key) return { output: { ok: false, reason: \'key is required\' } };',
      '      const store = readStore();',
      '      store[key] = { value: input && input.value, updatedAt: new Date().toISOString() };',
      '      writeStore(store);',
      '      return { output: { ok: true, key, pluginId: \'' + id + '\' } };',
      '    } catch (error) {',
      "      logger.warn('memory.write failed', { error: error instanceof Error ? error.message : String(error) });",
      "      return { output: { ok: false, message: error instanceof Error ? error.message : String(error) } };",
      '    }',
      '  });',
      '',
      "  ctx.bindCapability('memory.get', async ({ input }) => {",
      '    try {',
      "      const key = String((input && input.key) || '').trim();",
      '      if (!key) return { output: { ok: false, reason: \'key is required\' } };',
      '      const store = readStore();',
      '      const hit = store[key];',
      '      return { output: { ok: Boolean(hit), key, entry: hit || null, pluginId: \'' + id + '\' } };',
      '    } catch (error) {',
      "      logger.warn('memory.get failed', { error: error instanceof Error ? error.message : String(error) });",
      "      return { output: { ok: false, message: error instanceof Error ? error.message : String(error) } };",
      '    }',
      '  });',
      '}',
      '',
      'module.exports = { register };',
      '',
    ].join('\n');
  }

  if (input.templateKind === 'hook') {
    return [
      "const fs = require('node:fs');",
      "const path = require('node:path');",
      '',
      'function register(ctx) {',
      '  const logger = ctx.getLogger();',
      '  const workspace = ctx.getWorkspacePath();',
      "  const ledgerPath = path.join(workspace, '.zavorth', 'forge-hooks', '" + id + "', 'ledger.jsonl');",
      '',
      '  function append(entry) {',
      '    fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });',
      "    fs.appendFileSync(ledgerPath, JSON.stringify(entry) + '\\n', 'utf8');",
      '  }',
      '',
      "  if (typeof ctx.registerHook === 'function') {",
      "    ctx.registerHook('llm.before_request', async ({ context }) => {",
      "      append({ kind: 'before_request', at: new Date().toISOString(), context: context || {} });",
      '    });',
      "    ctx.registerHook('llm.after_request', async ({ context }) => {",
      "      append({ kind: 'after_request', at: new Date().toISOString(), context: context || {} });",
      '    });',
      '  }',
      '',
      "  ctx.bindCapability('cost.summary', async () => {",
      '    try {',
      '      let lines = [];',
      '      if (fs.existsSync(ledgerPath)) {',
      "        lines = fs.readFileSync(ledgerPath, 'utf8').split(/\\r?\\n/u).filter(Boolean);",
      '      }',
      '      return { output: { ok: true, pluginId: \'' + id + '\', entryCount: lines.length, ledgerPath, intent: \'' + intent + '\' } };',
      '    } catch (error) {',
      "      logger.warn('cost.summary failed', { error: error instanceof Error ? error.message : String(error) });",
      "      return { output: { ok: false, message: error instanceof Error ? error.message : String(error) } };",
      '    }',
      '  });',
      '}',
      '',
      'module.exports = { register };',
      '',
    ].join('\n');
  }

  // default tool — implement intent description (e.g. uppercase echo)
  const wantsUpper = /\b(upper|uppercase|toUpperCase)\b/iu.test(input.intent);
  const body = wantsUpper
    ? [
      "      const text = String((input && (input.text || input.value || input.message || input.echo)) || '');",
      '      return {',
      '        output: {',
      '          ok: true,',
      "          pluginId: '" + id + "',",
      "          capabilityId: 'main.run',",
      '          result: text.toUpperCase(),',
      '          intent: \'' + intent + '\',',
      '          input: input || {},',
      '        },',
      '      };',
    ]
    : [
      '      return {',
      '        output: {',
      '          ok: true,',
      "          pluginId: '" + id + "',",
      "          capabilityId: 'main.run',",
      '          message: \'Forged tool implementing: ' + intent + '\',',
      '          intent: \'' + intent + '\',',
      '          input: input || {},',
      '        },',
      '      };',
    ];

  return [
    'function register(ctx) {',
    '  const logger = ctx.getLogger();',
    "  ctx.bindCapability('main.run', async ({ input }) => {",
    '    try {',
    ...body,
    '    } catch (error) {',
    "      logger.warn('main.run failed', { error: error instanceof Error ? error.message : String(error) });",
    "      return { output: { ok: false, message: error instanceof Error ? error.message : String(error) } };",
    '    }',
    '  });',
    '}',
    '',
    'module.exports = { register };',
    '',
  ].join('\n');
}

function safeCommand(pluginId: string): string {
  return pluginId.replace(/[^a-z0-9]+/giu, '_').toLowerCase();
}

function escapeJs(value: string): string {
  return String(value || '')
    .replace(/\\/gu, '\\\\')
    .replace(/'/gu, "\\'")
    .replace(/\r?\n/gu, ' ');
}

function stripCodeFence(text: string): string {
  const raw = String(text || '').trim();
  const fenced = raw.match(/```(?:javascript|js)?\s*([\s\S]*?)```/iu);
  if (fenced) return fenced[1].trim();
  return raw;
}

function isInside(root: string, target: string): boolean {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  const relative = path.relative(resolvedRoot, resolvedTarget);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function tryDefaultLlmChat(prompt: string): Promise<string | null> {
  try {
    const candidates = [
      path.resolve(__dirname, 'llm/LlmRuntimeService.js'),
      path.resolve(__dirname, 'llm/LlmRuntimeService.ts'),
      path.resolve(process.cwd(), 'dist/services/llm/LlmRuntimeService.js'),
      path.resolve(process.cwd(), 'src/services/llm/LlmRuntimeService.js'),
    ];
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const { createRequire } = require('node:module') as typeof import('node:module');
    const req = createRequire(__filename);
    for (const candidate of candidates) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
        const mod = req(candidate) as {
          LlmRuntimeService?: new () => {
            chat: (messages: Array<{ role: string; content: string }>) => Promise<{ content?: string; text?: string }>;
          };
        };
        if (!mod?.LlmRuntimeService) continue;
        const service = new mod.LlmRuntimeService();
        const response = await service.chat([{ role: 'user', content: prompt }]);
        const text = String(response?.content || response?.text || '').trim();
        if (text) return text;
      } catch {
        /* try next */
      }
    }
  } catch {
    /* soft-fail */
  }
  return null;
}

// keep checksum helper available for future receipt integrity
export function forgePreviewChecksum(files: Array<{ path: string; content: string }>): string {
  const hash = createHash('sha256');
  for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    hash.update(file.path);
    hash.update('\0');
    hash.update(file.content);
    hash.update('\n');
  }
  return hash.digest('hex');
}
