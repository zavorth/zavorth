import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { config } from '../config/index.js';
import { logger } from '../logger.js';
import {
DISTRIBUTION_HARDENING_CHANNELS,
  DISTRIBUTION_HARDENING_INSTALLER_PREVIEW_STEPS,
  DISTRIBUTION_HARDENING_MANIFEST_ITEMS,
  DISTRIBUTION_HARDENING_REQUIRED_CORE_SCRIPTS,
  DISTRIBUTION_HARDENING_SMOKE_STEPS,
  type DistributionHardeningCheck,
  type DistributionHardeningCheckStatus,
  type DistributionHardeningManifestItem,
  type DistributionHardeningSnapshot,
} from '../contracts/DistributionHardeningContract.js';

type PackageLike = {
  name?: string;
  version?: string;
  scripts?: Record<string, string>;
};

type JsonRecord = Record<string, unknown>;

export type DistributionHardeningServiceOptions = {
  projectRoot?: string;
  artifactDir?: string;
  manifestPath?: string;
  installerPreviewPath?: string;
  smokeArtifactPath?: string;
  requireArtifacts?: boolean;
  files?: Record<string, string>;
  existsSync?: (targetPath: string) => boolean;
  readFileSync?: (targetPath: string, encoding: BufferEncoding) => string;
  statSync?: (targetPath: string) => { size: number };
  now?: () => Date;
};

export class DistributionHardeningService {
  private readonly projectRoot: string;
  private readonly artifactDir: string;
  private readonly manifestPath: string;
  private readonly installerPreviewPath: string;
  private readonly smokeArtifactPath: string;
  private readonly requireArtifacts: boolean;
  private readonly files: Record<string, string>;
  private readonly existsSync: (targetPath: string) => boolean;
  private readonly readFileSync: (targetPath: string, encoding: BufferEncoding) => string;
  private readonly statSync: (targetPath: string) => { size: number };
  private readonly now: () => Date;

  constructor(options: DistributionHardeningServiceOptions = {}) {
    this.projectRoot = options.projectRoot || config.projectRoot;
    this.artifactDir = options.artifactDir || path.join(this.projectRoot, '.qa', 'distribution-hardening');
    this.manifestPath = options.manifestPath || path.join(this.artifactDir, 'distribution-manifest.json');
    this.installerPreviewPath = options.installerPreviewPath || path.join(this.artifactDir, 'installer-preview.json');
    this.smokeArtifactPath = options.smokeArtifactPath || path.join(this.artifactDir, 'install-smoke.json');
    this.requireArtifacts = Boolean(options.requireArtifacts);
    this.files = options.files || {};
    this.existsSync = options.existsSync || fs.existsSync;
    this.readFileSync = options.readFileSync || fs.readFileSync;
    this.statSync = options.statSync || fs.statSync;
    this.now = options.now || (() => new Date());
  }

  public buildSnapshot(): DistributionHardeningSnapshot {
    const packageJson = this.readCoreJson('package.json') || {};
    const manifestItems = this.buildManifestItems();
    const checks = [
      this.checkPackageBaseline(packageJson),
      ...this.checkCoreScripts(packageJson.scripts || {}),
      this.checkPriorPhaseEvidence(),
      this.checkChannelPolicy(packageJson.scripts || {}),
      this.checkManifestCompleteness(manifestItems),
      this.checkManifestArtifact(),
      this.checkInstallerPreviewArtifact(),
      this.checkSmokeArtifact(),
      this.checkDocsRunbook(),
      this.checkNextPhasePlanning(),
    ];
    const failed = checks.filter((check) => check.status === 'fail').length;
    const warnings = checks.filter((check) => check.status === 'warn').length;
    const passed = checks.filter((check) => check.status === 'pass').length;

    return {
      gate: 'distribution-hardening',
      surface: 'distribution-hardening',
      generatedAt: this.now().toISOString(),
      status: failed > 0 ? 'blocked' : warnings > 0 ? 'attention' : 'ready',
      projectRoot: this.projectRoot,
      artifactDir: this.artifactDir,
      summary: {
        ok: failed === 0,
        passed,
        warnings,
        failed,
      },
      release: {
        expectedTag: 'v1.0.0',
        packageName: String(packageJson.name || ''),
        packageVersion: String(packageJson.version || ''),
      },
      artifacts: {
        manifestPath: this.manifestPath,
        installerPreviewPath: this.installerPreviewPath,
        smokeArtifactPath: this.smokeArtifactPath,
      },
      manifestItems,
      channels: DISTRIBUTION_HARDENING_CHANNELS,
      installerPreviewSteps: DISTRIBUTION_HARDENING_INSTALLER_PREVIEW_STEPS,
      smokeSteps: DISTRIBUTION_HARDENING_SMOKE_STEPS,
      checks,
      nextRecommendedGate: {
        gate: 'public-docs-recipes',
        title: 'Public Docs, Examples And Recipes Expansion',
        reason:
          'Com distribution v1.x verifiable, o next passo e expandir docs e recipes public que uma pessoa external consiga seguir without history interno.',
      },
    };
  }

  public renderReport(snapshot: DistributionHardeningSnapshot = this.buildSnapshot()): string {
    const lines: string[] = [];
    lines.push('[distribution-hardening] Readiness item 5 - Installer And Distribution Hardening');
    lines.push(`status: ${snapshot.status}`);
    lines.push(`ok: ${snapshot.summary.ok ? 'yes' : 'no'} | pass=${snapshot.summary.passed} warn=${snapshot.summary.warnings} fail=${snapshot.summary.failed}`);
    lines.push(`release: ${snapshot.release.expectedTag} | package=${snapshot.release.packageName}@${snapshot.release.packageVersion}`);
    lines.push(`artifacts: ${snapshot.artifactDir}`);
    lines.push('');
    for (const check of snapshot.checks) {
      const suffix = check.path ? ` (${check.path})` : '';
      lines.push(`[${check.status}] ${check.title}${suffix}`);
      lines.push(`  ${check.reason}`);
      for (const evidence of check.evidence || []) {
        lines.push(`  - ${evidence}`);
      }
    }
    lines.push('');
    lines.push(`next passo recomendada: ${snapshot.nextRecommendedGate.gate} - ${snapshot.nextRecommendedGate.title}`);
    lines.push(snapshot.nextRecommendedGate.reason);
    return lines.join('\n');
  }

  private checkPackageBaseline(packageJson: PackageLike): DistributionHardeningCheck {
    const issues: string[] = [];
    if (packageJson.name !== 'zavorth') {
      issues.push(`name=${String(packageJson.name || '<missing>')}`);
    }
    if (packageJson.version !== '1.0.0') {
      issues.push(`version=${String(packageJson.version || '<missing>')}`);
    }
    return this.check(
      'distribution-hardening:package-baseline',
      'baseline v1.0.0 do pacote',
      issues.length === 0 ? 'pass' : 'fail',
      issues.length === 0
        ? 'package.json preserva zavorth@1.0.0 como baseline do ciclo v1.x.'
        : 'distribution hardening must start from the published v1.0.0 baseline.',
      'package.json',
      issues,
    );
  }

  private checkCoreScripts(scripts: Record<string, string>): DistributionHardeningCheck[] {
    return DISTRIBUTION_HARDENING_REQUIRED_CORE_SCRIPTS.map((scriptName) => {
      const command = String(scripts[scriptName] || '').trim();
      return this.check(
        `distribution-hardening:script:${scriptName}`,
        `script canonical ${scriptName}`,
        command ? 'pass' : 'fail',
        command ? `main repository exposes "${scriptName}" for distribution v1.x.`
          : `main repo must expose "${scriptName}" no package.json.`,
        'package.json',
        [`script=${command || '<missing>'}`],
      );
    });
  }

  private checkPriorPhaseEvidence(): DistributionHardeningCheck {
    const evidence = [
      {
        path: 'src/contracts/PublicReleaseBundleContract.ts',
        phrase: 'sha256:',
        label: 'release bundle declara digest sha256',
      },
      {
        path: 'scripts/release-bundle.ts',
        phrase: 'PublicReleaseBundleContractService',
        label: 'gate de release bundle usa service canonical',
      },
      {
        path: 'docs/product-direction.md',
        phrase: 'Readiness item 1 - Release Bundle And Installer Distribution',
        label: 'Readiness item 1 documents bundle and installer coverage',
      },
      {
        path: 'src/services/DistributionPolicyContractService.ts',
        phrase: 'DistributionPolicyContractService',
        label: 'service de policy de distribution existe',
      },
      {
        path: 'scripts/distribution-policy.ts',
        phrase: 'DistributionPolicyContractService',
        label: 'gate de distribution policy usa service canonical',
      },
      {
        path: 'docs/product-direction.md',
        phrase: 'Readiness item 0 - Editions, Plans And Distribution Policy',
        label: 'Readiness item 0 documents channel policy',
      },
    ];
    const missing = evidence
      .filter((item) => !(this.readCoreText(item.path) || '').includes(item.phrase))
      .map((item) => `${item.path}: ${item.label}`);
    return this.check(
      'distribution-hardening:prior-gate-evidence',
      'evidence from steps 50 and 51',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'distribution policy e release bundle existem como base da distribution hardening.'
        : 'Readiness item 5 depends on already closed public policy and bundle evidence.',
      undefined,
      missing,
    );
  }

  private checkChannelPolicy(scripts: Record<string, string>): DistributionHardeningCheck {
    const channelNames = new Set(DISTRIBUTION_HARDENING_CHANNELS.map((policy) => policy.channel));
    const missingChannels = ['alpha', 'beta', 'stable'].filter((channel) => !channelNames.has(channel as never));
    const stablePolicy = DISTRIBUTION_HARDENING_CHANNELS.find((policy) => policy.channel === 'stable');
    const stableRequired = ['qa:distribution-hardening', 'qa:hosted-site', 'qa:release-bundle', 'qa:architecture'];
    const missingStableGates = stableRequired.filter((gate) => !stablePolicy?.requiredGates.includes(gate));
    const missingScripts = stableRequired.filter((gate) => !String(scripts[gate] || '').trim());
    const issues = [
      ...missingChannels.map((channel) => `channel missing: ${channel}`),
      ...missingStableGates.map((gate) => `stable without gate: ${gate}`),
      ...missingScripts.map((gate) => `script missing for stable: ${gate}`),
    ];
    return this.check(
      'distribution-hardening:channel-policy',
      'policy alpha beta stable',
      issues.length === 0 ? 'pass' : 'fail',
      issues.length === 0
        ? 'alpha, beta, and stable channels have rules, and stable requires minimum green gates.'
        : 'policy de channels v1.x is incompleta.',
      'src/contracts/DistributionHardeningContract.ts',
      issues,
    );
  }

  private checkManifestCompleteness(items: DistributionHardeningManifestItem[]): DistributionHardeningCheck {
    const issues = items.flatMap((item) => {
      if (!item.required) {
        return [];
      }
      if (!item.present) {
        return [`missing: ${item.path}`];
      }
      if (!/^[a-f0-9]{64}$/.test(item.sha256)) {
        return [`sha256 invalid: ${item.path}`];
      }
      return [];
    });
    return this.check(
      'distribution-hardening:manifest-inputs',
      'inputs reproduziveis do manifest',
      issues.length === 0 ? 'pass' : 'fail',
      issues.length === 0
        ? 'todos os inputs canonicals do manifest existem e possuem sha256 calculavel.'
        : 'manifest v1.x cannot be reproduced from canonical inputs.',
      undefined,
      issues,
    );
  }

  private checkManifestArtifact(): DistributionHardeningCheck {
    const artifact = this.readArtifactJson(this.manifestPath, 'distribution-manifest.json');
    if (!artifact) {
      return this.missingArtifactCheck(
        'distribution-hardening:manifest-artifact',
        'manifest de distribution',
        'distribution-manifest.json',
      );
    }

    const items = Array.isArray(artifact.items) ? artifact.items as JsonRecord[] : [];
    const channels = Array.isArray(artifact.channels) ? artifact.channels as JsonRecord[] : [];
    const issues: string[] = [];
    if (artifact.ok !== true) {
      issues.push('ok must be true');
    }
    if (artifact.version !== 'v1.0.0') {
      issues.push(`version=${String(artifact.version || '<missing>')}`);
    }
    if (typeof artifact.generatedAt !== 'string' || !artifact.generatedAt) {
      issues.push('generatedAt missing');
    }
    for (const manifestItem of DISTRIBUTION_HARDENING_MANIFEST_ITEMS) {
      const found = items.find((item) => item.path === manifestItem.path);
      if (!found) {
        issues.push(`item missing: ${manifestItem.path}`);
        continue;
      }
      if (found.present !== true) {
        issues.push(`item not present: ${manifestItem.path}`);
      }
      if (!/^[a-f0-9]{64}$/.test(String(found.sha256 || ''))) {
        issues.push(`sha256 invalid: ${manifestItem.path}`);
      }
    }
    for (const channel of ['alpha', 'beta', 'stable']) {
      if (!channels.some((item) => item.channel === channel)) {
        issues.push(`channel missing no artifact: ${channel}`);
      }
    }
    const stable = channels.find((item) => item.channel === 'stable');
    const stableGates = Array.isArray(stable?.requiredGates) ? stable?.requiredGates as string[] : [];
    for (const gate of ['qa:distribution-hardening', 'qa:hosted-site', 'qa:release-bundle', 'qa:architecture']) {
      if (!stableGates.includes(gate)) {
        issues.push(`stable without ${gate}`);
      }
    }
    const aggregateSha = String((artifact.integrity as JsonRecord | undefined)?.aggregateSha256 || '');
    if (!/^[a-f0-9]{64}$/.test(aggregateSha)) {
      issues.push('aggregateSha256 invalid');
    }

    return this.check(
      'distribution-hardening:manifest-artifact',
      'manifest de distribution',
      issues.length === 0 ? 'pass' : 'fail',
      issues.length === 0
        ? 'manifest v1.x registra itens, digests, channels e digest agregado.'
        : 'manifest v1.x is missing, incomplete, or not reproducible.',
      this.manifestPath,
      issues,
    );
  }

  private checkInstallerPreviewArtifact(): DistributionHardeningCheck {
    const artifact = this.readArtifactJson(this.installerPreviewPath, 'installer-preview.json');
    if (!artifact) {
      return this.missingArtifactCheck(
        'distribution-hardening:installer-preview',
        'installer preview-first',
        'installer-preview.json',
      );
    }

    const steps = Array.isArray(artifact.steps) ? artifact.steps as JsonRecord[] : [];
    const targetRoot = String(artifact.targetRoot || '');
    const cleanupPlan = artifact.cleanupPlan as JsonRecord | undefined;
    const issues: string[] = [];
    if (artifact.ok !== true) {
      issues.push('ok must be true');
    }
    if (artifact.mutatesHost !== false) {
      issues.push('mutatesHost must be false');
    }
    if (artifact.requiresConfirmation !== true) {
      issues.push('requiresConfirmation must be true');
    }
    if (!targetRoot || !this.isInside(this.artifactDir, targetRoot)) {
      issues.push(`targetRoot outside do artifactDir: ${targetRoot || '<missing>'}`);
    }
    for (const step of DISTRIBUTION_HARDENING_INSTALLER_PREVIEW_STEPS) {
      if (!steps.some((item) => item.id === step.id)) {
        issues.push(`step missing: ${step.id}`);
      }
    }
    const rollbackPlan = Array.isArray(artifact.rollbackPlan) ? artifact.rollbackPlan : [];
    if (rollbackPlan.length === 0) {
      issues.push('rollbackPlan missing');
    }
    if (cleanupPlan?.preserveUserData !== true) {
      issues.push('cleanupPlan must preserve user data');
    }
    if (cleanupPlan?.requiresOptInForUserData !== true) {
      issues.push('cleanupPlan must require opt-in for user data');
    }

    return this.check(
      'distribution-hardening:installer-preview',
      'installer preview-first',
      issues.length === 0 ? 'pass' : 'fail',
      issues.length === 0
        ? 'installer preview mostra destino, manifest, rollback e cleanup without mutar host real.'
        : 'installer preview does not satisfy the preview-first and reversible contract.',
      this.installerPreviewPath,
      issues,
    );
  }

  private checkSmokeArtifact(): DistributionHardeningCheck {
    const artifact = this.readArtifactJson(this.smokeArtifactPath, 'install-smoke.json');
    if (!artifact) {
      return this.missingArtifactCheck(
        'distribution-hardening:install-smoke',
        'smoke install health cleanup',
        'install-smoke.json',
      );
    }

    const steps = Array.isArray(artifact.steps) ? artifact.steps as JsonRecord[] : [];
    const targetRoot = String(artifact.targetRoot || '');
    const issues: string[] = [];
    if (artifact.ok !== true) {
      issues.push('ok must be true');
    }
    if (!targetRoot || !this.isInside(this.artifactDir, targetRoot)) {
      issues.push(`targetRoot outside do artifactDir: ${targetRoot || '<missing>'}`);
    }
    for (const expected of DISTRIBUTION_HARDENING_SMOKE_STEPS) {
      const step = steps.find((item) => item.id === expected.id);
      if (!step) {
        issues.push(`step missing: ${expected.id}`);
        continue;
      }
      if (step.status !== 'pass') {
        issues.push(`step failed: ${expected.id}`);
      }
      if (step.mutatesHost === true) {
        issues.push(`step muta host: ${expected.id}`);
      }
    }
    if (artifact.userDataPreserved !== true) {
      issues.push('userDataPreserved must be true');
    }

    return this.check(
      'distribution-hardening:install-smoke',
      'smoke install health cleanup',
      issues.length === 0 ? 'pass' : 'fail',
      issues.length === 0
        ? 'smoke local cobre install preview, health check, uninstall preview e cleanup preservando user data.'
        : 'smoke local de install/uninstall is missing ou failurendo.',
      this.smokeArtifactPath,
      issues,
    );
  }

  private checkDocsRunbook(): DistributionHardeningCheck {
    const source = [
      this.readCoreText('docs/product-direction.md') || '',
      this.readCoreText('docs/product-direction.md') || '',
    ].join('\n').toLowerCase();
    const required = [
      'manifest',
      'checksum',
      'preview',
      'install',
      'cleanup',
      'qa:distribution-hardening',
    ];
    const missing = required.filter((term) => !source.includes(term));
    return this.check(
      'distribution-hardening:docs-runbook',
      'documentation and runbook for Readiness item 5',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'Docs explain manifest, checksums, installer preview, smoke, and gates for Readiness item 5.'
        : 'docs must explain how to close and operate distribution hardening.',
      'docs/product-direction.md',
      missing.map((term) => `faltando: ${term}`),
    );
  }

  private checkNextPhasePlanning(): DistributionHardeningCheck {
    const source = [
      this.readCoreText('docs/product-direction.md') || '',
      this.readCoreText('docs/product-direction.md') || '',
    ].join('\n');
    const missing = ['Readiness item 6 - Public Docs, Examples And Recipes Expansion', 'qa:public-docs-recipes']
      .filter((term) => !source.includes(term));
    return this.check(
      'distribution-hardening:next-gate',
      'recommendation for Readiness item 6',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'Readiness item 5 explicitly points to public docs, examples, and recipes.'
        : 'Readiness item 5 must leave Readiness item 6 as the next action.',
      'docs/product-direction.md',
      missing,
    );
  }

  private missingArtifactCheck(id: string, title: string, fileName: string): DistributionHardeningCheck {
    return this.check(
      id,
      title,
      this.requireArtifacts ? 'fail' : 'warn',
      this.requireArtifacts ? `${fileName} must exist for the qa:distribution-hardening gate.`
        : `${fileName} is not required in this snapshot yet; qa:distribution-hardening generates and validates the artifact.`,
      path.join(this.artifactDir, fileName),
    );
  }

  private buildManifestItems(): DistributionHardeningManifestItem[] {
    return DISTRIBUTION_HARDENING_MANIFEST_ITEMS.map((item) => {
      const content = this.readCoreText(item.path);
      const present = content !== null;
      const bytes = present ? Buffer.byteLength(content, 'utf8') : 0;
      const sha256 = present ? createHash('sha256').update(content, 'utf8').digest('hex') : '';
      return {
        path: item.path,
        required: item.required,
        present,
        bytes,
        sha256,
      };
    });
  }

  private readCoreJson(relativePath: string): PackageLike | null {
    const raw = this.readCoreText(relativePath);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as PackageLike;
    } catch (error: unknown) {logger.warn('[Distribution Hardening] JSON parse failed', error); return null; }
  }

  private readArtifactJson(filePath: string, artifactName: string): JsonRecord | null {
    const directKeys = [
      `artifact:${artifactName}`,
      `absolute:${filePath.replace(/\\/g, '/')}`,
      filePath.replace(/\\/g, '/'),
    ];
    for (const key of directKeys) {
      if (Object.prototype.hasOwnProperty.call(this.files, key)) {
        return this.parseJson(this.files[key]);
      }
    }
    if (!this.existsSync(filePath)) {
      return null;
    }
    try {
      return this.parseJson(this.readFileSync(filePath, 'utf8'));
    } catch (error: unknown) {logger.warn('[Distribution Hardening] filesystem operation failed', error); return null; }
  }

  private readCoreText(relativePath: string): string | null {
    const normalized = relativePath.replace(/\\/g, '/');
    const keys = [`core:${normalized}`, normalized];
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(this.files, key)) {
        return this.files[key];
      }
    }
    const targetPath = path.resolve(this.projectRoot, normalized);
    if (!this.existsSync(targetPath)) {
      return null;
    }
    try {
      return this.readFileSync(targetPath, 'utf8');
    } catch (error: unknown) {logger.warn('[Distribution Hardening] filesystem operation failed', error); return null; }
  }

  private parseJson(raw: string): JsonRecord | null {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as JsonRecord : null;
    } catch (error: unknown) {logger.warn('[Distribution Hardening] JSON parse failed', error); return null; }
  }

  private isInside(root: string, target: string): boolean {
    const resolvedRoot = path.resolve(root);
    const resolvedTarget = path.resolve(target);
    const relative = path.relative(resolvedRoot, resolvedTarget);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
  }

  private check(
    id: string,
    title: string,
    status: DistributionHardeningCheckStatus,
    reason: string,
    filePath?: string,
    evidence: string[] = [],
  ): DistributionHardeningCheck {
    return { id, title, status, reason, path: filePath, evidence };
  }
}
