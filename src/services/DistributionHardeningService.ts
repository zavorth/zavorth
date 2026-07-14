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
          'Com distribuicao v1.x verificavel, o proximo passo e expandir docs e recipes publicas que uma pessoa externa consiga seguir sem historico interno.',
      },
    };
  }

  public renderReport(snapshot: DistributionHardeningSnapshot = this.buildSnapshot()): string {
    const lines: string[] = [];
    lines.push('[distribution-hardening] Readiness checkpoint 5 - Installer And Distribution Hardening');
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
    lines.push(`proximo passo recomendada: ${snapshot.nextRecommendedGate.gate} - ${snapshot.nextRecommendedGate.title}`);
    lines.push(snapshot.nextRecommendedGate.reason);
    return lines.join('\n');
  }

  private checkPackageBaseline(packageJson: PackageLike): DistributionHardeningCheck {
    const issues: string[] = [];
    if (packageJson.name !== 'zavorth') {
      issues.push(`name=${String(packageJson.name || '<ausente>')}`);
    }
    if (packageJson.version !== '1.0.0') {
      issues.push(`version=${String(packageJson.version || '<ausente>')}`);
    }
    return this.check(
      'distribution-hardening:package-baseline',
      'baseline v1.0.0 do pacote',
      issues.length === 0 ? 'pass' : 'fail',
      issues.length === 0
        ? 'package.json preserva zavorth@1.0.0 como baseline do ciclo v1.x.'
        : 'distribuicao hardening precisa partir do baseline publicado v1.0.0.',
      'package.json',
      issues,
    );
  }

  private checkCoreScripts(scripts: Record<string, string>): DistributionHardeningCheck[] {
    return DISTRIBUTION_HARDENING_REQUIRED_CORE_SCRIPTS.map((scriptName) => {
      const command = String(scripts[scriptName] || '').trim();
      return this.check(
        `distribution-hardening:script:${scriptName}`,
        `script canonico ${scriptName}`,
        command ? 'pass' : 'fail',
        command
          ? `repo principal expoe "${scriptName}" para distribuicao v1.x.`
          : `repo principal precisa expor "${scriptName}" no package.json.`,
        'package.json',
        [`script=${command || '<ausente>'}`],
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
        label: 'gate de release bundle usa service canonico',
      },
      {
        path: 'docs/product-direction.md',
        phrase: 'Readiness checkpoint 1 - Release Bundle And Installer Distribution',
        label: 'Readiness checkpoint 1 documentada como bundle/installer',
      },
      {
        path: 'src/services/DistributionPolicyContractService.ts',
        phrase: 'DistributionPolicyContractService',
        label: 'service de policy de distribuicao existe',
      },
      {
        path: 'scripts/distribution-policy.ts',
        phrase: 'DistributionPolicyContractService',
        label: 'gate de distribution policy usa service canonico',
      },
      {
        path: 'docs/product-direction.md',
        phrase: 'Readiness checkpoint 0 - Editions, Plans And Distribution Policy',
        label: 'Readiness checkpoint 0 documentada como policy de canais',
      },
    ];
    const missing = evidence
      .filter((item) => !(this.readCoreText(item.path) || '').includes(item.phrase))
      .map((item) => `${item.path}: ${item.label}`);
    return this.check(
      'distribution-hardening:prior-phase-evidence',
      'evidencias das Etapas 50 e 51',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'distribution policy e release bundle existem como base da distribuicao hardening.'
        : 'Readiness checkpoint 5 depende de policy e bundle publicos ja fechados.',
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
      ...missingChannels.map((channel) => `canal ausente: ${channel}`),
      ...missingStableGates.map((gate) => `stable sem gate: ${gate}`),
      ...missingScripts.map((gate) => `script ausente para stable: ${gate}`),
    ];
    return this.check(
      'distribution-hardening:channel-policy',
      'politica alpha beta stable',
      issues.length === 0 ? 'pass' : 'fail',
      issues.length === 0
        ? 'canais alpha, beta e stable possuem regras e stable exige gates minimos verdes.'
        : 'politica de canais v1.x esta incompleta.',
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
        return [`ausente: ${item.path}`];
      }
      if (!/^[a-f0-9]{64}$/.test(item.sha256)) {
        return [`sha256 invalido: ${item.path}`];
      }
      return [];
    });
    return this.check(
      'distribution-hardening:manifest-inputs',
      'inputs reproduziveis do manifest',
      issues.length === 0 ? 'pass' : 'fail',
      issues.length === 0
        ? 'todos os inputs canonicals do manifest existem e possuem sha256 calculavel.'
        : 'manifest v1.x nao consegue ser reproduzido a partir dos inputs canonicos.',
      undefined,
      issues,
    );
  }

  private checkManifestArtifact(): DistributionHardeningCheck {
    const artifact = this.readArtifactJson(this.manifestPath, 'distribution-manifest.json');
    if (!artifact) {
      return this.missingArtifactCheck(
        'distribution-hardening:manifest-artifact',
        'manifest de distribuicao',
        'distribution-manifest.json',
      );
    }

    const items = Array.isArray(artifact.items) ? artifact.items as JsonRecord[] : [];
    const channels = Array.isArray(artifact.channels) ? artifact.channels as JsonRecord[] : [];
    const issues: string[] = [];
    if (artifact.ok !== true) {
      issues.push('ok precisa ser true');
    }
    if (artifact.version !== 'v1.0.0') {
      issues.push(`version=${String(artifact.version || '<ausente>')}`);
    }
    if (typeof artifact.generatedAt !== 'string' || !artifact.generatedAt) {
      issues.push('generatedAt ausente');
    }
    for (const manifestItem of DISTRIBUTION_HARDENING_MANIFEST_ITEMS) {
      const found = items.find((item) => item.path === manifestItem.path);
      if (!found) {
        issues.push(`item ausente: ${manifestItem.path}`);
        continue;
      }
      if (found.present !== true) {
        issues.push(`item nao presente: ${manifestItem.path}`);
      }
      if (!/^[a-f0-9]{64}$/.test(String(found.sha256 || ''))) {
        issues.push(`sha256 invalido: ${manifestItem.path}`);
      }
    }
    for (const channel of ['alpha', 'beta', 'stable']) {
      if (!channels.some((item) => item.channel === channel)) {
        issues.push(`canal ausente no artifact: ${channel}`);
      }
    }
    const stable = channels.find((item) => item.channel === 'stable');
    const stableGates = Array.isArray(stable?.requiredGates) ? stable?.requiredGates as string[] : [];
    for (const gate of ['qa:distribution-hardening', 'qa:hosted-site', 'qa:release-bundle', 'qa:architecture']) {
      if (!stableGates.includes(gate)) {
        issues.push(`stable sem ${gate}`);
      }
    }
    const aggregateSha = String((artifact.integrity as JsonRecord | undefined)?.aggregateSha256 || '');
    if (!/^[a-f0-9]{64}$/.test(aggregateSha)) {
      issues.push('aggregateSha256 invalido');
    }

    return this.check(
      'distribution-hardening:manifest-artifact',
      'manifest de distribuicao',
      issues.length === 0 ? 'pass' : 'fail',
      issues.length === 0
        ? 'manifest v1.x registra itens, digests, canais e digest agregado.'
        : 'manifest v1.x esta ausente, incompleto ou nao reproduzivel.',
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
      issues.push('ok precisa ser true');
    }
    if (artifact.mutatesHost !== false) {
      issues.push('mutatesHost precisa ser false');
    }
    if (artifact.requiresConfirmation !== true) {
      issues.push('requiresConfirmation precisa ser true');
    }
    if (!targetRoot || !this.isInside(this.artifactDir, targetRoot)) {
      issues.push(`targetRoot fora do artifactDir: ${targetRoot || '<ausente>'}`);
    }
    for (const step of DISTRIBUTION_HARDENING_INSTALLER_PREVIEW_STEPS) {
      if (!steps.some((item) => item.id === step.id)) {
        issues.push(`step ausente: ${step.id}`);
      }
    }
    const rollbackPlan = Array.isArray(artifact.rollbackPlan) ? artifact.rollbackPlan : [];
    if (rollbackPlan.length === 0) {
      issues.push('rollbackPlan ausente');
    }
    if (cleanupPlan?.preserveUserData !== true) {
      issues.push('cleanupPlan precisa preservar user data');
    }
    if (cleanupPlan?.requiresOptInForUserData !== true) {
      issues.push('cleanupPlan precisa exigir opt-in para user data');
    }

    return this.check(
      'distribution-hardening:installer-preview',
      'installer preview-first',
      issues.length === 0 ? 'pass' : 'fail',
      issues.length === 0
        ? 'installer preview mostra destino, manifest, rollback e cleanup sem mutar host real.'
        : 'installer preview nao satisfaz o contrato preview-first e reversivel.',
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
      issues.push('ok precisa ser true');
    }
    if (!targetRoot || !this.isInside(this.artifactDir, targetRoot)) {
      issues.push(`targetRoot fora do artifactDir: ${targetRoot || '<ausente>'}`);
    }
    for (const expected of DISTRIBUTION_HARDENING_SMOKE_STEPS) {
      const step = steps.find((item) => item.id === expected.id);
      if (!step) {
        issues.push(`step ausente: ${expected.id}`);
        continue;
      }
      if (step.status !== 'pass') {
        issues.push(`step falhou: ${expected.id}`);
      }
      if (step.mutatesHost === true) {
        issues.push(`step muta host: ${expected.id}`);
      }
    }
    if (artifact.userDataPreserved !== true) {
      issues.push('userDataPreserved precisa ser true');
    }

    return this.check(
      'distribution-hardening:install-smoke',
      'smoke install health cleanup',
      issues.length === 0 ? 'pass' : 'fail',
      issues.length === 0
        ? 'smoke local cobre install preview, health check, uninstall preview e cleanup preservando user data.'
        : 'smoke local de install/uninstall esta ausente ou failurendo.',
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
      'documentacao e runbook da Readiness checkpoint 5',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'docs explicam manifest, checksums, installer preview, smoke e gates da Readiness checkpoint 5.'
        : 'docs precisam explicar como fechar e operar a distribuicao hardening.',
      'docs/product-direction.md',
      missing.map((term) => `faltando: ${term}`),
    );
  }

  private checkNextPhasePlanning(): DistributionHardeningCheck {
    const source = [
      this.readCoreText('docs/product-direction.md') || '',
      this.readCoreText('docs/product-direction.md') || '',
    ].join('\n');
    const missing = ['Readiness checkpoint 6 - Public Docs, Examples And Recipes Expansion', 'qa:public-docs-recipes']
      .filter((term) => !source.includes(term));
    return this.check(
      'distribution-hardening:next-phase',
      'recomendacao para Readiness checkpoint 6',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'Readiness checkpoint 5 aponta explicitamente para docs, examples e recipes publicas.'
        : 'Readiness checkpoint 5 precisa deixar a Readiness checkpoint 6 como proxima acao.',
      'docs/product-direction.md',
      missing,
    );
  }

  private missingArtifactCheck(id: string, title: string, fileName: string): DistributionHardeningCheck {
    return this.check(
      id,
      title,
      this.requireArtifacts ? 'fail' : 'warn',
      this.requireArtifacts
        ? `${fileName} precisa existir para o gate qa:distribution-hardening.`
        : `${fileName} ainda nao foi exigido neste snapshot; qa:distribution-hardening gera e valida o artifact.`,
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
