import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config as defaultConfig } from '../config/index.js';
import { safeFetch } from '../security/SafeFetchService.js';
import { logger } from '../logger.js';

export type ZavorthManagedConfigStatus = 'ready' | 'attention' | 'blocked' | 'applied';

export type ZavorthManagedConfigFinding = {
  id: string;
  severity: 'info' | 'warning' | 'high';
  message: string;
};

export type ZavorthManagedConfigPlan = {
  schemaVersion: 1;
  generatedAt: string;
  source: 'ZavorthManagedConfigService';
  status: ZavorthManagedConfigStatus;
  ok: boolean;
  sourceRef: string | null;
  checksum: string | null;
  expectedChecksum: string | null;
  checksumVerified: boolean;
  deploymentKeyVerified: boolean | null;
  applyRequested: boolean;
  applied: boolean;
  targetDir: string;
  managedConfigPath: string;
  requirementsPath: string;
  receiptPath: string;
  summary: {
    managedKeys: string[];
    requirementKeys: string[];
    secretRefs: string[];
  };
  findings: ZavorthManagedConfigFinding[];
  receipt: {
    id: string;
    status: ZavorthManagedConfigStatus;
    checksum: string | null;
    applied: boolean;
    message: string;
  };
  nextActions: string[];
};

export type ZavorthManagedConfigInput = {
  sourceRef?: string | null;
  expectedChecksum?: string | null;
  deploymentKey?: string | null;
  apply?: boolean;
  yes?: boolean;
};

type ManagedDocument = {
  schemaVersion?: number;
  deployment?: {
    keySha256?: string;
    keyHash?: string;
  };
  managedConfig?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  requirements?: Record<string, unknown>;
  secretRefs?: Record<string, unknown>;
};

export class ZavorthManagedConfigService {
  private readonly targetDir: string;

  constructor(private readonly projectRoot = defaultConfig.projectRoot) {
    this.targetDir = path.join(projectRoot, 'data', 'runtime', 'managed-config');
  }

  public async buildPlan(input: ZavorthManagedConfigInput = {}): Promise<ZavorthManagedConfigPlan> {
    const sourceRef = input.sourceRef || process.env.ZAVORTH_MANAGED_CONFIG_URL || this.defaultManagedConfigPath();
    const loaded = await this.loadSource(sourceRef);
    const checksum = loaded.raw ? sha256(loaded.raw) : null;
    const expectedChecksum = String(input.expectedChecksum || process.env.ZAVORTH_MANAGED_CONFIG_SHA256 || '').trim() || null;
    const findings: ZavorthManagedConfigFinding[] = [];
    let document: ManagedDocument = {};

    if (!loaded.ok) {
      findings.push({ id: 'source-unavailable', severity: 'high', message: loaded.error || 'Managed config source is unavailable.' });
    } else {
      try {
        document = JSON.parse((loaded.raw || '{}').replace(/^\uFEFF/, '')) as ManagedDocument;
      } catch (error: unknown) {findings.push({ id: 'invalid-json', severity: 'high', message: 'Managed config is not valid JSON.' });
      }
    }

    const checksumVerified = Boolean(expectedChecksum && checksum && expectedChecksum.toLowerCase() === checksum.toLowerCase());
    if (expectedChecksum && !checksumVerified) {
      findings.push({ id: 'checksum-mismatch', severity: 'high', message: 'Expected checksum does not match the managed config payload.' });
    }
    if (!expectedChecksum && loaded.ok) {
      findings.push({
        id: 'checksum-not-provided',
        severity: input.apply ? 'high' : 'warning',
        message: 'No expected checksum was provided; preview is allowed, apply is blocked.',
      });
    }

    const deploymentKeyVerified = this.verifyDeploymentKey(document, input.deploymentKey || process.env.ZAVORTH_DEPLOYMENT_KEY || null);
    if (deploymentKeyVerified === false) {
      findings.push({ id: 'deployment-key-mismatch', severity: 'high', message: 'Deployment key does not match the managed config hash.' });
    }

    const rawSecrets = findRawSecretValues(document);
    for (const secret of rawSecrets.slice(0, 12)) {
      findings.push({ id: `raw-secret:${secret}`, severity: 'high', message: `Raw secret-like value is not allowed at ${secret}. Use secretRefs instead.` });
    }

    const applyRequested = input.apply === true;
    const canApply = loaded.ok
      && findings.every((finding) => finding.severity !== 'high')
      && checksumVerified
      && deploymentKeyVerified !== false
      && input.yes === true;
    const managedConfigPath = path.join(this.targetDir, 'managed_config.json');
    const requirementsPath = path.join(this.targetDir, 'requirements.json');
    const receiptPath = path.join(this.targetDir, 'managed_config_receipts.jsonl');
    let applied = false;

    if (applyRequested && canApply) {
      fs.mkdirSync(this.targetDir, { recursive: true });
      fs.writeFileSync(managedConfigPath, `${JSON.stringify(this.safeManagedConfig(document), null, 2)}\n`, 'utf8');
      fs.writeFileSync(requirementsPath, `${JSON.stringify(document.requirements || {}, null, 2)}\n`, 'utf8');
      applied = true;
    } else if (applyRequested && !input.yes) {
      findings.push({ id: 'confirmation-required', severity: 'warning', message: 'Apply requires --yes after reviewing the preview.' });
    }

    const status: ZavorthManagedConfigStatus = applied
      ? 'applied'
      : findings.some((finding) => finding.severity === 'high')
        ? 'blocked'
        : findings.some((finding) => finding.severity === 'warning')
          ? 'attention'
          : 'ready';
    const receipt = {
      id: `managed-config:${Date.now()}`,
      status,
      checksum,
      applied,
      message: applied
        ? 'Managed config applied without writing raw secrets.'
        : 'Managed config preview generated; nothing was applied.',
    };
    if (applyRequested) {
      fs.mkdirSync(this.targetDir, { recursive: true });
      fs.appendFileSync(receiptPath, `${JSON.stringify(receipt)}\n`, 'utf8');
    }

    return {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      source: 'ZavorthManagedConfigService',
      status,
      ok: status !== 'blocked',
      sourceRef,
      checksum,
      expectedChecksum,
      checksumVerified,
      deploymentKeyVerified,
      applyRequested,
      applied,
      targetDir: this.targetDir,
      managedConfigPath,
      requirementsPath,
      receiptPath,
      summary: {
        managedKeys: Object.keys(this.safeManagedConfig(document)),
        requirementKeys: Object.keys(document.requirements || {}),
        secretRefs: Object.keys(document.secretRefs || {}),
      },
      findings,
      receipt,
      nextActions: this.nextActions({ status, applyRequested, checksumVerified }),
    };
  }

  private safeManagedConfig(document: ManagedDocument): Record<string, unknown> {
    return {
      schemaVersion: document.schemaVersion || 1,
      managedConfig: document.managedConfig || document.settings || {},
      requirements: document.requirements || {},
      secretRefs: document.secretRefs || {},
      appliedBy: 'zavorth-managed-config',
    };
  }

  private verifyDeploymentKey(document: ManagedDocument, deploymentKey: string | null): boolean | null {
    const expected = String(document.deployment?.keySha256 || document.deployment?.keyHash || '').trim().toLowerCase();
    if (!expected) return null;
    if (!deploymentKey) return false;
    return sha256(deploymentKey).toLowerCase() === expected;
  }

  private async loadSource(sourceRef: string | null): Promise<{ ok: boolean; raw: string | null; error?: string }> {
    if (!sourceRef) {
      return { ok: false, raw: null, error: 'No source was provided.' };
    }
    if (/^https?:\/\//i.test(sourceRef)) {
      try {
        const response = await safeFetch(sourceRef, { method: 'GET' }, { serviceName: 'Zavorth managed config loader' });
        if (!response.ok) {
          return { ok: false, raw: null, error: `HTTP ${response.status} while reading managed config.` };
        }
        return { ok: true, raw: await response.text() };
      } catch (error: unknown) {logger.warn('[Zavorth Managed] network request failed', error);
    return { ok: false, raw: null, error: String(error?.message || error) };
  }
    }
    const fullPath = path.isAbsolute(sourceRef) ? sourceRef : path.join(this.projectRoot, sourceRef);
    try {
      return { ok: true, raw: fs.readFileSync(fullPath, 'utf8') };
    } catch (error: unknown) {logger.warn('[Zavorth Managed] filesystem operation failed', error);
    return { ok: false, raw: null, error: String(error?.message || error) };
  }
  }

  private defaultManagedConfigPath(): string {
    return fs.existsSync(path.join(this.projectRoot, 'managed_config.json'))
      ? 'managed_config.json'
      : '';
  }

  private nextActions(input: { status: ZavorthManagedConfigStatus; applyRequested: boolean; checksumVerified: boolean }): string[] {
    if (input.status === 'blocked') {
      return ['Fix blocked findings before applying managed config.'];
    }
    if (!input.checksumVerified) {
      return ['Provide --checksum <sha256> before applying managed config.'];
    }
    if (!input.applyRequested) {
      return ['Review the preview, then run zavorth managed-config apply --checksum <sha256> --yes.'];
    }
    return ['Run zavorth inspect to confirm the managed configuration is visible.'];
  }
}

function findRawSecretValues(value: unknown, pathParts: string[] = []): string[] {
  if (!value || typeof value !== 'object') {
    return [];
  }
  const currentPath = pathParts.join('.');
  if (/\bsecretRefs\b/i.test(currentPath)) {
    return [];
  }
  const findings: string[] = [];
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const childPath = [...pathParts, key];
    const joinedPath = childPath.join('.');
    if (/^deployment\.(keySha256|keyHash)$/i.test(joinedPath)) {
      continue;
    }
    const keyLooksSecret = /(secret|password|token|api[_-]?key|credential)/i.test(key);
    if (keyLooksSecret && typeof child === 'string' && child.trim()) {
      findings.push(joinedPath);
      continue;
    }
    findings.push(...findRawSecretValues(child, childPath));
  }
  return findings;
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}
