import fs from 'node:fs';
import path from 'node:path';

import { PluginStateBridgeService } from './PluginStateBridgeService.js';
import { PluginCuratedMarketplaceService } from './PluginCuratedMarketplaceService.js';

export type PluginOsPermissionPreviewEntry = {
  kind: string;
  scope?: string;
  reason?: string;
  required?: boolean;
};

export type PluginOsPermissionPreview = {
  ok: boolean;
  pluginId: string;
  label?: string;
  trust: string;
  tier?: string;
  permissions: PluginOsPermissionPreviewEntry[];
  risks: string[];
  needsCredentials: boolean;
  sourceLocator?: string | null;
  signed?: boolean | null;
  findings?: string[];
  formatText(): string;
};

export type PluginOsPermissionPreviewRuntime = {
  projectRoot?: string;
  stateBridge?: PluginStateBridgeService;
  curated?: PluginCuratedMarketplaceService;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  readdirSync?: typeof fs.readdirSync;
};

const CREDENTIAL_PLUGIN_IDS = new Set([
  'gmail',
  'linear',
  'notion',
  'calendar',
  'github',
  'memory-honcho',
]);

const RISK_BY_KIND: Record<string, string> = {
  'network.external': 'May access network',
  'network.local': 'May access local network',
  'filesystem.read': 'May read files',
  'filesystem.write': 'May write files',
  'secret.read': 'May read secrets',
  'process.spawn': 'May spawn processes',
  'artifact.read': 'May read artifacts',
  'artifact.write': 'May write artifacts',
  'memory.read': 'May read memory',
  'memory.write': 'May write memory',
  'channel.send': 'May send channel messages',
  'provider.call': 'May call providers',
  'node.invoke': 'May invoke nodes',
};

/**
 * Read-only permission / trust preview for a plugin package before enable.
 * Soft-fails when the package or manifest is missing.
 */
export class PluginOsPermissionPreviewService {
  private readonly projectRoot: string;
  private readonly bridge: PluginStateBridgeService;
  private readonly curated: PluginCuratedMarketplaceService;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;

  constructor(runtime: PluginOsPermissionPreviewRuntime = {}) {
    this.projectRoot = path.resolve(runtime.projectRoot || process.cwd());
    this.bridge = runtime.stateBridge || new PluginStateBridgeService({
      projectRoot: this.projectRoot,
    });
    this.curated = runtime.curated || new PluginCuratedMarketplaceService({
      projectRoot: this.projectRoot,
    });
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
  }

  public preview(pluginId: string, root?: string): PluginOsPermissionPreview {
    const projectRoot = path.resolve(root || this.projectRoot);
    const id = normalizeId(pluginId);
    const findings: string[] = [];

    if (!id) {
      return finishPreview({
        ok: false,
        pluginId: String(pluginId || '').trim() || 'unknown',
        trust: 'review',
        permissions: [],
        risks: [],
        needsCredentials: false,
        findings: ['pluginId is required'],
      });
    }

    let bridged: { trust?: string; sourceLocator?: string | null; sourceTrusted?: boolean | null } = {};
    try {
      const resolved = this.bridge.resolve(id);
      bridged = {
        trust: resolved.trust,
        sourceLocator: resolved.sourceLocator,
        sourceTrusted: resolved.sourceTrusted,
      };
    } catch {
      bridged = {};
    }

    const packageDir = this.findPackage(projectRoot, id);
    let manifest: Record<string, unknown> | null = null;
    let sourceLocator: string | null = bridged.sourceLocator || null;
    let signed: boolean | null = null;

    if (!packageDir) {
      findings.push('package not found under plugins/, plugins/examples/, or .zavorth/plugins/');
    } else {
      sourceLocator = sourceLocator
        || path.relative(projectRoot, packageDir).replace(/\\/gu, '/');
      if (sourceLocator && !sourceLocator.startsWith('.') && !sourceLocator.startsWith('/')) {
        sourceLocator = `./${sourceLocator}`;
      }
      try {
        const raw = JSON.parse(
          this.readFileSync(path.join(packageDir, 'manifest.json'), 'utf8'),
        ) as Record<string, unknown>;
        manifest = raw && typeof raw === 'object' ? raw : null;
      } catch (error: unknown) {
        findings.push(
          `manifest read failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      signed = this.detectSigned(packageDir);
    }

    const permissions = extractPermissions(manifest);
    const risks = buildRisks(permissions, manifest);
    const moduleKind = String(manifest?.moduleKind || '').trim().toLowerCase();
    const hasExternalNetwork = permissions.some(
      (entry) => String(entry.kind || '').toLowerCase() === 'network.external',
    );
    const needsCredentials = CREDENTIAL_PLUGIN_IDS.has(id)
      || (hasExternalNetwork && (moduleKind === 'bridge' || id.includes('bridge')));

    let tier: string | undefined;
    try {
      const catalog = this.curated.list({ root: projectRoot });
      const hit = catalog.entries.find((entry) => normalizeId(entry.id) === id);
      if (hit?.tier) tier = String(hit.tier);
    } catch {
      /* soft */
    }

    const policy = (manifest?.policy && typeof manifest.policy === 'object'
      ? manifest.policy as Record<string, unknown>
      : {}) || {};
    const trust = String(
      bridged.trust
      || policy.defaultTrust
      || 'review',
    ).trim().toLowerCase() || 'review';

    const label = manifest?.label
      ? String(manifest.label)
      : (manifest?.id ? String(manifest.id) : id);

    return finishPreview({
      ok: Boolean(packageDir && manifest),
      pluginId: id,
      label,
      trust,
      tier,
      permissions,
      risks,
      needsCredentials,
      sourceLocator,
      signed,
      findings: findings.length ? findings : undefined,
    });
  }

  private findPackage(root: string, pluginId: string): string | null {
    const candidates = [
      path.join(root, 'plugins', pluginId),
      path.join(root, 'plugins', 'examples', pluginId),
      path.join(root, '.zavorth', 'plugins', pluginId),
    ];
    for (const candidate of candidates) {
      if (this.existsSync(path.join(candidate, 'manifest.json'))) {
        return candidate;
      }
    }
    return null;
  }

  private detectSigned(packageDir: string): boolean | null {
    try {
      if (this.existsSync(path.join(packageDir, 'SIGNATURE'))) return true;
      if (this.existsSync(path.join(packageDir, 'signature.json'))) return true;
      if (this.existsSync(path.join(packageDir, '.signature'))) return true;
      return false;
    } catch {
      return null;
    }
  }
}

function extractPermissions(manifest: Record<string, unknown> | null): PluginOsPermissionPreviewEntry[] {
  if (!manifest) return [];
  const raw = manifest.permissions;
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (!item || typeof item !== 'object') {
      return { kind: String(item || 'unknown') };
    }
    const entry = item as Record<string, unknown>;
    return {
      kind: String(entry.kind || 'unknown'),
      scope: entry.scope != null ? String(entry.scope) : undefined,
      reason: entry.reason != null ? String(entry.reason) : undefined,
      required: typeof entry.required === 'boolean' ? entry.required : undefined,
    };
  });
}

function buildRisks(
  permissions: PluginOsPermissionPreviewEntry[],
  manifest: Record<string, unknown> | null,
): string[] {
  const risks: string[] = [];
  const seen = new Set<string>();

  const push = (line: string) => {
    const text = String(line || '').trim();
    if (!text || seen.has(text)) return;
    seen.add(text);
    risks.push(text);
  };

  for (const entry of permissions) {
    const kind = String(entry.kind || '').toLowerCase();
    if (RISK_BY_KIND[kind]) {
      push(RISK_BY_KIND[kind]);
    } else if (kind) {
      push(`May use ${kind}`);
    }
  }

  const policy = (manifest?.policy && typeof manifest.policy === 'object'
    ? manifest.policy as Record<string, unknown>
    : null);
  if (policy) {
    if (policy.allowNetworkByDefault === true) push('May access network');
    if (policy.allowFilesystemWriteByDefault === true) push('May write files');
    if (policy.allowProcessSpawnByDefault === true) push('May spawn processes');
    if (policy.requiresApproval === true) push('Sensitive actions require approval');
  }

  if (permissions.length === 0 && risks.length === 0) {
    push('No declared permissions (review still recommended)');
  }

  return risks;
}

function normalizeId(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
}

function finishPreview(input: Omit<PluginOsPermissionPreview, 'formatText'>): PluginOsPermissionPreview {
  return {
    ...input,
    formatText() {
      const lines = [
        `Permission preview: ${input.label || input.pluginId}`,
        `ok=${input.ok} id=${input.pluginId} trust=${input.trust}`
          + (input.tier ? ` tier=${input.tier}` : '')
          + (input.signed != null ? ` signed=${input.signed}` : ''),
        input.sourceLocator ? `source: ${input.sourceLocator}` : null,
        `needsCredentials=${input.needsCredentials}`,
        'Permissions:',
        ...(input.permissions.length
          ? input.permissions.map((entry) => {
            const bits = [entry.kind];
            if (entry.scope) bits.push(`scope=${entry.scope}`);
            if (entry.required === true) bits.push('required');
            if (entry.reason) bits.push(`— ${entry.reason}`);
            return `  - ${bits.join(' ')}`;
          })
          : ['  (none declared)']),
        'Risks:',
        ...(input.risks.length
          ? input.risks.map((risk) => ` ? ${risk}`)
          : ['  (none)']),
        'Note: recommendations and previews never auto-enable plugins.',
        ...(input.findings || []).map((line) => `  ! ${line}`),
      ];
      return lines.filter((line) => line != null).join('\n');
    },
  };
}
