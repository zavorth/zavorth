/**
 * Unified skill install pipeline: preview → (approve) → apply → receipt.
 * Trust via SkillTrustScoreService (evidence + safe|daily|power policy).
 * Brand-agnostic: any local path / source type via detectSource.
 * CLI and zavorth_skill_marketplace must share this service.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  ZAVORTH_SKILL_WORKER_MESH_CONTRACT_VERSION,
  type SkillInstallPlan,
  type SkillInstallReceipt,
  type ZavorthDeclaredSkillTool,
  type ZavorthSkillInstallRisk,
  type ZavorthSkillIr,
  type ZavorthSkillSourceKind,
} from '../contracts/skill/ZavorthSkillWorkerMeshContract.js';
import { detectSource, getSourceHint } from '../skills/marketplace/SkillSourceDetector.js';
import { validateSkillPackage } from '../skills/marketplace/SkillPackageValidator.js';
import { scanSkillForSecurity } from '../skills/marketplace/SkillMarketplaceSecurity.js';
import { SkillGitRegistry } from '../skills/marketplace/SkillGitRegistry.js';
import { SkillIrNormalizerService } from '../skills/SkillIrNormalizerService.js';
import { asErrorLike } from '../utils/errorLike.js';
import {
  SkillTrustScoreService,
  type SkillTrustEvidence,
  type SkillTrustPolicyDecision,
  type SkillTrustProfileId,
} from './SkillTrustScoreService.js';
import {
  bindSkillDeclaredTools,
  formatToolBindsTable,
  mergeAliasMaps,
  SKILL_TOOL_ALIASES,
  type SkillExecutorBindingOptions,
} from './SkillExecutorBindingService.js';
import type { SkillToolRegistryLike } from './SkillToolRegistryBridge.js';
import type {
  DiscoveredSkill,
  SkillInstallApplyInput,
  SkillInstallPipelineRuntime,
  SkillInstallPreviewInput,
} from './SkillInstallPipelineContracts.js';
import {
  quoteSkillSource as quoteIfNeeded,
  sanitizeSkillId,
  sanitizeSkillReceiptId as sanitizeFileId,
} from './SkillInstallPipelineSupport.js';

export type {
  SkillInstallApplyInput,
  SkillInstallPipelineRuntime,
  SkillInstallPreviewInput,
} from './SkillInstallPipelineContracts.js';

const SECRET_NAME_RE = /\.(env|pem|key)$/i;
const SECRET_CONTENT_HINT = /\b(api[_-]?key|secret|token|password)\s*[:=]/i;

export class SkillInstallPipelineService {
  private readonly projectRoot: string;
  private readonly skillsDir: string;
  private readonly receiptsDir: string;
  private readonly now: () => Date;
  private readonly gitRegistry: SkillGitRegistry;
  private readonly trust: SkillTrustScoreService;
  private toolRegistry: SkillToolRegistryLike | null;
  private readonly irNormalizer: SkillIrNormalizerService;

  constructor(runtime: SkillInstallPipelineRuntime = {}) {
    this.projectRoot = runtime.projectRoot || process.cwd();
    this.skillsDir = runtime.skillsDir || path.join(this.projectRoot, 'skills');
    this.receiptsDir = runtime.receiptsDir || path.join(this.projectRoot, 'data', 'runtime', 'skill-install-receipts');
    this.now = runtime.now || (() => new Date());
    this.gitRegistry = runtime.gitRegistry || new SkillGitRegistry();
    this.trust =
      runtime.trustService ||
      new SkillTrustScoreService({
        projectRoot: this.projectRoot,
        profile: runtime.trustProfile,
        now: this.now,
      });
    this.toolRegistry = runtime.toolRegistry ?? null;
    this.irNormalizer = new SkillIrNormalizerService();
  }

  public getTrustService(): SkillTrustScoreService {
    return this.trust;
  }

  public setToolRegistry(registry: SkillToolRegistryLike | null | undefined): void {
    this.toolRegistry = registry ?? null;
  }

  /**
   * Dry-run plan. local paths are fully inspected offline.
   * Remote sources return a conservative plan (apply will fetch).
   */
  public preview(input: SkillInstallPreviewInput): SkillInstallPlan {
    try {
      const { getSkillHotPathCache } =
        require('./SkillHotPathCacheService.js') as typeof import('./SkillHotPathCacheService.js');
      getSkillHotPathCache().recordInstallPreview();
    } catch {
      /* soft */
    }
    const raw = String(input.source || '').trim();
    const generatedAt = this.now().toISOString();
    if (!raw) {
      return this.emptyPlan(raw, 'unknown', generatedAt, 'Provide a source path or URL.', [
        {
          id: 'missing-source',
          severity: 'high',
          title: 'Missing source',
          detail: 'source is required',
        },
      ]);
    }

    const detected = detectSource(raw);
    const sourceKind = detected.type as ZavorthSkillSourceKind;

    if (detected.type === 'local-path' || detected.type === 'local-file') {
      return this.previewLocal(raw, detected.resolved, input.skillId, generatedAt, sourceKind);
    }

    // Remote / registry: no network on preview (offline-safe).
    const evidence = this.evidenceRemote(raw, sourceKind);
    const decision = this.trust.evaluate(evidence);
    const risks: ZavorthSkillInstallRisk[] = [
      {
        id: 'remote-source-deferred',
        severity: 'info',
        title: 'Remote source',
        detail: `${getSourceHint(detected.type)} Full scan runs on apply with consent.`,
      },
      {
        id: 'trust-profile',
        severity: decision.allowApply ? 'info' : 'medium',
        title: `Trust profile ${decision.profile}`,
        detail: decision.reasons.slice(0, 4).join('; '),
      },
    ];
    return {
      contractVersion: ZAVORTH_SKILL_WORKER_MESH_CONTRACT_VERSION,
      kind: 'skill-install-plan',
      generatedAt,
      source: {
        raw,
        detectedType: sourceKind,
        resolved: detected.resolved || raw,
      },
      skillId: input.skillId ? String(input.skillId) : null,
      skillName: null,
      version: null,
      files: [],
      declaredTools: [],
      risks,
      trust: decision.score,
      previewOnly: true,
      applyBlockedWithoutConsent: true,
      nextSafeAction: this.nextActionForDecision(raw, null, decision),
    };
  }

  /**
   * Materialize only with explicit consent. Returns a durable receipt.
   */
  public async apply(input: SkillInstallApplyInput): Promise<SkillInstallReceipt> {
    const generatedAt = this.now().toISOString();
    const raw = String(input.source || '').trim();
    const plan = this.preview({ source: raw, skillId: input.skillId });
    try {
      const { getSkillHotPathCache } =
        require('./SkillHotPathCacheService.js') as typeof import('./SkillHotPathCacheService.js');
      getSkillHotPathCache().recordInstallApply();
    } catch {
      /* soft */
    }

    if (!raw) {
      return this.receiptFromPlan(plan, {
        id: this.newId(),
        generatedAt,
        status: 'blocked',
        materialized: false,
        targetDir: null,
        approvalGranted: false,
        reason: 'Missing source',
        toolBinds: [],
        smoke: { ran: false, ok: null, detail: null },
      });
    }

    const policy = this.evaluatePlanPolicy(plan, raw);

    const consentOk = input.consent === true || policy.autoConsentEligible;
    if (!consentOk) {
      const receipt = this.receiptFromPlan(plan, {
        id: this.newId(),
        generatedAt,
        status: 'blocked',
        materialized: false,
        targetDir: null,
        approvalGranted: false,
        reason:
          'Apply blocked without consent. Pass consent=true or --consent after preview' +
          (policy.autoConsentEligible ? '' : ` (profile=${policy.profile} requires explicit consent)`),
        toolBinds: [],
        smoke: { ran: false, ok: null, detail: null },
      });
      this.persistReceipt(receipt);
      return receipt;
    }

    if ((!policy.allowApply || plan.trust.band === 'deny') && !input.force) {
      const receipt = this.receiptFromPlan(plan, {
        id: this.newId(),
        generatedAt,
        status: 'blocked',
        materialized: false,
        targetDir: null,
        approvalGranted: Boolean(input.consent || policy.autoConsentEligible),
        reason:
          `Trust policy blocked apply (profile=${policy.profile}, band=${plan.trust.band}): ` +
          `${policy.reasons.slice(0, 5).join('; ')}. Use force only if intentional.`,
        toolBinds: [],
        smoke: { ran: false, ok: null, detail: null },
      });
      this.persistReceipt(receipt);
      return receipt;
    }

    try {
      // digest short-circuit — skip re-fetch when same SkillIR already installed.
      try {
        const { getSkillHotPathCache } =
          require('./SkillHotPathCacheService.js') as typeof import('./SkillHotPathCacheService.js');
        const hot = getSkillHotPathCache();
        const digest = plan.skillIrDigest || null;
        if (digest) {
          const existing = hot.findByDigest(digest);
          if (existing?.targetDir && fs.existsSync(existing.targetDir)) {
            hot.markDigestShortCircuit();
            const irCached = this.irNormalizer.normalizeFromDir({
              skillDir: existing.targetDir,
              sourceUri: raw,
              sourceKind: plan.source.detectedType,
              skillId: existing.skillId || plan.skillId,
              now: this.now,
            });
            const skillIr = irCached.skillIr || plan.skillIr || null;
            const skillIrDigest = irCached.skillIrDigest || digest;
            const binding = skillIr ? this.bindFromIr(skillIr) : this.bindDeclaredToolsFromDir(existing.targetDir);
            const receipt = this.receiptFromPlan(plan, {
              id: this.newId(),
              generatedAt,
              status: 'applied',
              materialized: true,
              targetDir: existing.targetDir,
              skillId: existing.skillId || plan.skillId || skillIr?.id || null,
              approvalGranted: true,
              reason: this.redactSecrets(
                `Digest short-circuit: skillIrDigest matches installed ${existing.skillId} (no re-fetch)`,
              ),
              toolBinds: binding.bindings,
              smoke: {
                ran: true,
                ok: true,
                detail: `digest_short_circuit=true skillIrDigest=${String(skillIrDigest).slice(0, 12)}…`,
              },
              skillIr,
              skillIrDigest,
              parserId: skillIr?.parserId || plan.parserId || null,
            });
            this.persistReceipt(receipt);
            hot.recordInstallDigest({
              skillId: String(receipt.skillId || existing.skillId),
              skillIrDigest: String(skillIrDigest),
              targetDir: existing.targetDir,
            });
            return receipt;
          }
        }
      } catch {
        /* soft — continue full install */
      }

      const result = await this.gitRegistry.installFromSource(raw, input.skillId ? String(input.skillId) : undefined);

      if (!result.success) {
        const receipt = this.receiptFromPlan(plan, {
          id: this.newId(),
          generatedAt,
          status: 'failed',
          materialized: false,
          targetDir: result.installedPath || null,
          skillId: result.skillId || plan.skillId,
          approvalGranted: true,
          reason: this.redactSecrets(result.message || 'Install failed'),
          toolBinds: [],
          smoke: { ran: false, ok: null, detail: null },
        });
        this.persistReceipt(receipt);
        return receipt;
      }

      const targetDir = result.installedPath || null;
      const structureSmoke = this.runObservationSmoke(targetDir);
      const irAfter = targetDir
        ? this.irNormalizer.normalizeFromDir({
            skillDir: targetDir,
            sourceUri: raw,
            sourceKind: plan.source.detectedType,
            skillId: result.skillId || plan.skillId,
            now: this.now,
          })
        : null;
      const skillIr = irAfter?.skillIr || plan.skillIr || null;
      const skillIrDigest = irAfter?.skillIrDigest || plan.skillIrDigest || null;
      const binding = skillIr ? this.bindFromIr(skillIr) : this.bindDeclaredToolsFromDir(targetDir);
      // Unresolved is allowed (guidance-only); partial only if structure smoke fails.
      const smokeOk = structureSmoke.ok !== false && (binding.smoke.ok === null || binding.smoke.ok === true);
      const smokeDetail = [
        structureSmoke.detail,
        binding.smoke.ran ? binding.smoke.detail : null,
        binding.unresolved.length ? `unresolved (guidance-only): ${binding.unresolved.join(', ')}` : null,
        skillIrDigest ? `skillIrDigest=${skillIrDigest.slice(0, 12)}…` : null,
      ]
        .filter(Boolean)
        .join('; ');

      const receipt = this.receiptFromPlan(plan, {
        id: this.newId(),
        generatedAt,
        status: smokeOk ? 'applied' : 'partial',
        materialized: true,
        targetDir,
        skillId: result.skillId || plan.skillId || skillIr?.id || null,
        approvalGranted: true,
        reason: this.redactSecrets(
          `${result.message || 'Installed'}; binds direct=${binding.direct.length} aliased=${binding.aliased.length} gateway=${binding.gateway.length} unresolved=${binding.unresolved.length}`,
        ),
        toolBinds: binding.bindings,
        smoke: {
          ran: true,
          ok: smokeOk,
          detail: smokeDetail || null,
        },
        skillIr,
        skillIrDigest,
        parserId: skillIr?.parserId || plan.parserId || null,
      });
      this.persistReceipt(receipt);
      try {
        const { getSkillHotPathCache } =
          require('./SkillHotPathCacheService.js') as typeof import('./SkillHotPathCacheService.js');
        if (skillIrDigest && receipt.skillId) {
          getSkillHotPathCache().recordInstallDigest({
            skillId: String(receipt.skillId),
            skillIrDigest: String(skillIrDigest),
            targetDir,
          });
          getSkillHotPathCache().invalidateSkillDir(targetDir || '');
        }
      } catch {
        /* soft */
      }
      return receipt;
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const receipt = this.receiptFromPlan(plan, {
        id: this.newId(),
        generatedAt,
        status: 'failed',
        materialized: false,
        targetDir: null,
        approvalGranted: true,
        reason: this.redactSecrets(err.message || String(error)),
        toolBinds: [],
        smoke: { ran: false, ok: null, detail: null },
      });
      this.persistReceipt(receipt);
      return receipt;
    }
  }

  public getReceipt(id: string): SkillInstallReceipt | null {
    const file = path.join(this.receiptsDir, `${sanitizeFileId(id)}.json`);
    if (!fs.existsSync(file)) return null;
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8')) as SkillInstallReceipt;
    } catch {
      return null;
    }
  }

  public listReceipts(limit = 20): SkillInstallReceipt[] {
    if (!fs.existsSync(this.receiptsDir)) return [];
    const files = fs
      .readdirSync(this.receiptsDir)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .reverse()
      .slice(0, Math.max(1, limit));
    const out: SkillInstallReceipt[] = [];
    for (const f of files) {
      try {
        out.push(JSON.parse(fs.readFileSync(path.join(this.receiptsDir, f), 'utf8')) as SkillInstallReceipt);
      } catch {
        /* skip corrupt */
      }
    }
    return out;
  }

  public formatPlanText(plan: SkillInstallPlan): string {
    const profile = this.trust.getProfile();
    const previewBinds = plan.skillIr
      ? this.bindFromIr(plan.skillIr)
      : bindSkillDeclaredTools(plan.declaredTools, {
          registry: this.toolRegistry,
          useKnownCatalog: true,
        });
    const lines = [
      'Skill install plan (preview only)',
      `contract: ${plan.contractVersion}`,
      `source: ${plan.source.raw} (${plan.source.detectedType})`,
      `skill: ${plan.skillId || '—'} ${plan.skillName || ''} ${plan.version ? `v${plan.version}` : ''}`.trim(),
      plan.parserId ? `parser: ${plan.parserId}` : '',
      plan.skillIrDigest ? `skillIrDigest: ${plan.skillIrDigest}` : '',
      plan.skillIr?.guidanceOnly ? 'guidanceOnly: true (no executable tools declared)' : '',
      `trust: ${plan.trust.band} score=${plan.trust.score.toFixed(2)} profile=${profile}`,
      ...plan.trust.reasons.slice(0, 6).map((r) => `  · ${r}`),
      `files: ${plan.files.length}`,
      ...plan.files.slice(0, 15).map((f) => ` ? ${f}`),
      plan.files.length > 15 ? `  … +${plan.files.length - 15} more` : '',
      `declared tools: ${plan.declaredTools.map((t) => t.name).join(', ') || '(none)'}`,
      'tool binds (preview):',
      formatToolBindsTable(previewBinds.bindings),
      'risks:',
      ...(plan.risks.length ? plan.risks.map((r) => `  [${r.severity}] ${r.title}: ${r.detail}`) : ['  (none)']),
      `next: ${plan.nextSafeAction}`,
    ].filter(Boolean);
    return lines.join('\n');
  }

  public formatReceiptText(receipt: SkillInstallReceipt): string {
    return [
      'Skill install receipt',
      `id: ${receipt.id}`,
      `status: ${receipt.status}`,
      `materialized: ${receipt.materialized}`,
      `skill: ${receipt.skillId || '—'}`,
      `target: ${receipt.targetDir || '—'}`,
      receipt.parserId ? `parser: ${receipt.parserId}` : '',
      receipt.skillIrDigest ? `skillIrDigest: ${receipt.skillIrDigest}` : '',
      `approval: ${receipt.approvalGranted}`,
      `smoke: ran=${receipt.smoke.ran} ok=${receipt.smoke.ok} ${receipt.smoke.detail || ''}`.trim(),
      'tool binds:',
      formatToolBindsTable(receipt.toolBinds || []),
      `reason: ${receipt.reason}`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  // ---------------------------------------------------------------------------
  // local preview
  // ---------------------------------------------------------------------------

  private previewLocal(
    raw: string,
    resolvedInput: string,
    skillIdFilter: string | null | undefined,
    generatedAt: string,
    sourceKind: ZavorthSkillSourceKind,
  ): SkillInstallPlan {
    const resolved = path.resolve(resolvedInput);
    if (!fs.existsSync(resolved)) {
      return this.emptyPlan(raw, sourceKind, generatedAt, `Path not found: ${raw}`, [
        {
          id: 'path-missing',
          severity: 'high',
          title: 'Path not found',
          detail: resolved,
        },
      ]);
    }

    const searchRoot = fs.statSync(resolved).isFile() ? path.dirname(resolved) : resolved;
    const discovered = this.findSkills(searchRoot);

    // Prefer classic SKILL.md+manifest packs; else normalize root as generic IR.
    const selected =
      (skillIdFilter
        ? discovered.find((s) => s.name === skillIdFilter || path.basename(s.dir) === skillIdFilter)
        : null) ||
      discovered[0] ||
      null;

    const packDir = selected?.dir || searchRoot;
    const irResult = this.irNormalizer.normalizeFromDir({
      skillDir: packDir,
      sourceUri: raw,
      sourceKind,
      skillId: skillIdFilter || selected?.name || null,
      now: this.now,
    });
    const skillIr = irResult.skillIr;
    const skillIrDigest = irResult.skillIrDigest;

    if (discovered.length === 0 && skillIr.parserId === 'opaque-guidance-v1' && skillIr.files.length === 0) {
      return {
        ...this.emptyPlan(raw, sourceKind, generatedAt, 'No skill pack found (empty or unreadable path).', [
          {
            id: 'no-skills',
            severity: 'medium',
            title: 'No skills in source',
            detail: getSourceHint(sourceKind === 'local-file' ? 'local-file' : 'local-path'),
          },
        ]),
        skillIr,
        skillIrDigest,
        parserId: skillIr.parserId,
      };
    }

    const validation = selected
      ? validateSkillPackage(selected.dir)
      : {
          valid: skillIr.parserId !== 'opaque-guidance-v1' || skillIr.files.length > 0,
          errors: [] as string[],
          warnings: skillIr.warnings.slice(),
          manifest: null as { name?: string; version?: string; author?: string; checksum?: string } | null,
        };
    const security = selected
      ? scanSkillForSecurity(selected.dir)
      : {
          riskLevel: 'low' as const,
          issues: [] as Array<{ code?: string; severity: string; message: string }>,
          gpgVerified: false,
        };
    const files = skillIr.files.length ? skillIr.files : this.listRelativeFiles(packDir, 80);
    const declaredTools = this.declaredToolsFromIr(skillIr);
    const risks = this.buildRisks(
      validation as ReturnType<typeof validateSkillPackage>,
      security as ReturnType<typeof scanSkillForSecurity>,
      files,
    );
    for (const w of skillIr.warnings) {
      risks.push({
        id: 'skill-ir-warning',
        severity: 'info',
        title: 'SkillIR',
        detail: w,
      });
    }
    if (skillIr.guidanceOnly) {
      risks.push({
        id: 'guidance-only',
        severity: 'info',
        title: 'Guidance-only pack',
        detail: 'No declared tools (or all unresolved after bind). Procedure text still installs.',
      });
    }
    const secretLikePresent = risks.some((r) => r.secretLike) || files.some((f) => SECRET_NAME_RE.test(f));
    const author = validation.manifest?.author
      ? String(validation.manifest.author)
      : skillIr.title || selected?.name || skillIr.id;
    const checksumPinned = Boolean(
      validation.manifest?.checksum && String(validation.manifest.checksum).startsWith('sha256:'),
    );

    const evidence: SkillTrustEvidence = {
      sourceRaw: raw,
      sourceKind,
      local: true,
      validPackage: validation.valid || Boolean(skillIr.files.length),
      hasSkillMd: fs.existsSync(path.join(packDir, 'SKILL.md')) || skillIr.parserId === 'skill-md-v1',
      hasManifest: fs.existsSync(path.join(packDir, 'manifest.json')),
      securityRisk: security.riskLevel,
      checksumPinned,
      signatureVerified: security.gpgVerified === true,
      secretLikePresent,
      author,
      publisher: author,
    };
    const decision = this.trust.evaluate(evidence);
    risks.push({
      id: 'trust-profile',
      severity: decision.allowApply ? 'info' : 'medium',
      title: `Trust profile ${decision.profile}`,
      detail: decision.reasons.slice(0, 5).join('; '),
    });

    const skillId = sanitizeSkillId(skillIr.id || selected?.name || path.basename(packDir));

    return {
      contractVersion: ZAVORTH_SKILL_WORKER_MESH_CONTRACT_VERSION,
      kind: 'skill-install-plan',
      generatedAt,
      source: {
        raw,
        detectedType: sourceKind,
        resolved,
      },
      skillId,
      skillName: skillIr.title || validation.manifest?.name || selected?.name || skillId,
      version: skillIr.version || validation.manifest?.version || selected?.version || null,
      files,
      declaredTools,
      risks,
      trust: decision.score,
      previewOnly: true,
      applyBlockedWithoutConsent: true,
      nextSafeAction: this.nextActionForDecision(raw, skillIdFilter ? skillId : null, decision),
      skillIr,
      skillIrDigest,
      parserId: skillIr.parserId,
    };
  }

  private evidenceRemote(raw: string, sourceKind: ZavorthSkillSourceKind): SkillTrustEvidence {
    return {
      sourceRaw: raw,
      sourceKind,
      local: false,
      validPackage: false,
      hasSkillMd: false,
      hasManifest: false,
      securityRisk: 'unknown',
      checksumPinned: false,
      signatureVerified: false,
      secretLikePresent: false,
      author: null,
      publisher: null,
    };
  }

  private evaluatePlanPolicy(plan: SkillInstallPlan, raw: string): SkillTrustPolicyDecision {
    const local = plan.source.detectedType === 'local-path' || plan.source.detectedType === 'local-file';
    const evidence: SkillTrustEvidence = {
      sourceRaw: raw,
      sourceKind: plan.source.detectedType,
      local,
      validPackage: plan.files.includes('SKILL.md') && plan.files.includes('manifest.json'),
      hasSkillMd: plan.files.some((f) => f === 'SKILL.md' || f.endsWith('/SKILL.md')),
      hasManifest: plan.files.some((f) => f === 'manifest.json' || f.endsWith('/manifest.json')),
      securityRisk:
        plan.trust.band === 'deny'
          ? 'blocked'
          : plan.risks.some((r) => r.severity === 'critical') ? 'high'
            : plan.risks.some((r) => r.severity === 'high') ? 'high'
              : plan.risks.some((r) => r.severity === 'medium') ? 'medium'
                : local ? 'low'
                  : 'unknown',
      secretLikePresent: plan.risks.some((r) => r.secretLike),
      author: plan.skillName,
      publisher: plan.skillName,
      checksumPinned: plan.trust.signals?.some((s) => s.id === 'checksum_pinned' && s.present),
      signatureVerified: plan.trust.signals?.some((s) => s.id === 'signature_verified' && s.present),
    };
    // Prefer re-score so policy floors apply consistently
    return this.trust.evaluate(evidence);
  }

  private nextActionForDecision(raw: string, skillId: string | null, decision: SkillTrustPolicyDecision): string {
    if (!decision.allowApply && decision.score.band === 'deny') {
      return 'Blocked by trust/security. Do not apply without force + explicit review.';
    }
    if (decision.autoConsentEligible) {
      return (
        `Policy ${decision.profile} may auto-consent. Apply: zavorth skill install ${quoteIfNeeded(raw)}` +
        (skillId ? ` --only ${skillId}` : '') +
        ' (or pass --consent explicitly).'
      );
    }
    return (
      `Apply with consent: zavorth skill install ${quoteIfNeeded(raw)} --consent` +
      (skillId ? ` --only ${skillId}` : '') +
      ` [profile=${decision.profile}]`
    );
  }

  private findSkills(root: string): DiscoveredSkill[] {
    const found: DiscoveredSkill[] = [];
    const visit = (dir: string, depth: number) => {
      if (depth > 4 || found.length >= 20) return;
      const skillMd = path.join(dir, 'SKILL.md');
      const manifest = path.join(dir, 'manifest.json');
      if (fs.existsSync(skillMd) && fs.existsSync(manifest)) {
        try {
          const raw = JSON.parse(fs.readFileSync(manifest, 'utf8')) as {
            name?: string;
            version?: string;
            description?: string;
          };
          found.push({
            dir,
            name: String(raw.name || path.basename(dir)),
            version: String(raw.version || '0.0.0'),
            description: String(raw.description || ''),
          });
        } catch {
          found.push({
            dir,
            name: path.basename(dir),
            version: '0.0.0',
            description: '',
          });
        }
        return;
      }
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        visit(path.join(dir, entry.name), depth + 1);
      }
    };
    visit(root, 0);
    return found;
  }

  private listRelativeFiles(skillDir: string, max: number): string[] {
    const out: string[] = [];
    const walk = (dir: string) => {
      if (out.length >= max) return;
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (out.length >= max) break;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' || entry.name === '.git') continue;
          walk(full);
        } else {
          out.push(path.relative(skillDir, full).replace(/\\/g, '/'));
        }
      }
    };
    walk(skillDir);
    return out;
  }

  private readDeclaredTools(skillDir: string): ZavorthDeclaredSkillTool[] {
    const manifestPath = path.join(skillDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) return [];
    try {
      const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
        tools?: Array<{ name?: string; description?: string }>;
        toolDefinitions?: Array<{ name?: string; description?: string }>;
      };
      const tools = raw.tools || raw.toolDefinitions || [];
      return tools
        .map((t) => ({
          name: String(t?.name || '').trim(),
          description: t?.description ? String(t.description) : undefined,
        }))
        .filter((t) => Boolean(t.name));
    } catch {
      return [];
    }
  }

  private buildRisks(
    validation: ReturnType<typeof validateSkillPackage>,
    security: ReturnType<typeof scanSkillForSecurity>,
    files: string[],
  ): ZavorthSkillInstallRisk[] {
    const risks: ZavorthSkillInstallRisk[] = [];
    for (const err of validation.errors || []) {
      risks.push({
        id: 'validation-error',
        severity: 'high',
        title: 'Package validation',
        detail: err,
      });
    }
    for (const warn of validation.warnings || []) {
      risks.push({
        id: 'validation-warning',
        severity: 'low',
        title: 'Package warning',
        detail: warn,
      });
    }
    for (const issue of security.issues || []) {
      const secretLike =
        /secret|password|token|credential|api?.key/i.test(issue.message) || issue.code === 'hardcoded-secret';
      risks.push({
        id: issue.code || 'security',
        severity:
          issue.severity === 'error'
            ? security.riskLevel === 'blocked'
              ? 'critical'
              : 'high'
            : issue.severity === 'warn'
              ? 'medium'
              : 'info',
        title: 'Security scan',
        detail: issue.message,
        secretLike,
      });
    }
    for (const f of files) {
      if (SECRET_NAME_RE.test(f)) {
        risks.push({
          id: 'secret-like-filename',
          severity: 'medium',
          title: 'Secret-like filename',
          detail: f,
          secretLike: true,
        });
      }
    }
    return risks;
  }

  private bindDeclaredToolsFromDir(targetDir: string | null) {
    if (!targetDir || !fs.existsSync(targetDir)) {
      return bindSkillDeclaredTools([], { registry: this.toolRegistry, useKnownCatalog: true });
    }
    const ir = this.irNormalizer.normalizeFromDir({
      skillDir: targetDir,
      sourceUri: targetDir,
      sourceKind: 'local-path',
      now: this.now,
    });
    return this.bindFromIr(ir.skillIr);
  }

  private bindFromIr(skillIr: ZavorthSkillIr) {
    const aliasMap = mergeAliasMaps(SKILL_TOOL_ALIASES, skillIr.declaredAliases);
    const declared = this.declaredToolsFromIr(skillIr);
    const opts: SkillExecutorBindingOptions = {
      registry: this.toolRegistry,
      useKnownCatalog: true,
      aliasMap,
      skillId: skillIr.id,
      useBindCache: !this.toolRegistry,
    };
    return bindSkillDeclaredTools(declared, opts);
  }

  private declaredToolsFromIr(skillIr: ZavorthSkillIr): ZavorthDeclaredSkillTool[] {
    return (skillIr.declaredTools || []).map((t) => ({
      name: t.name,
      description: t.description,
    }));
  }

  private runObservationSmoke(targetDir: string | null): SkillInstallReceipt['smoke'] {
    if (!targetDir || !fs.existsSync(targetDir)) {
      return { ran: true, ok: false, detail: 'target missing after install' };
    }
    const hasSkill = fs.existsSync(path.join(targetDir, 'SKILL.md'));
    const hasManifest = fs.existsSync(path.join(targetDir, 'manifest.json'));
    // SKILL.md alone is enough structure; manifest preferred but not required for smoke ok.
    const ok = hasSkill || hasManifest;
    return {
      ran: true,
      ok,
      detail:
        hasSkill && hasManifest ? 'SKILL.md + manifest.json present'
          : hasSkill ? 'SKILL.md present (manifest optional)'
            : hasManifest ? 'manifest.json present (SKILL.md missing)'
              : 'missing SKILL.md and manifest.json',
    };
  }

  private emptyPlan(
    raw: string,
    detectedType: ZavorthSkillSourceKind,
    generatedAt: string,
    next: string,
    risks: ZavorthSkillInstallRisk[],
  ): SkillInstallPlan {
    return {
      contractVersion: ZAVORTH_SKILL_WORKER_MESH_CONTRACT_VERSION,
      kind: 'skill-install-plan',
      generatedAt,
      source: { raw, detectedType, resolved: raw || null },
      skillId: null,
      skillName: null,
      version: null,
      files: [],
      declaredTools: [],
      risks,
      trust: {
        score: 0,
        band: 'deny',
        reasons: risks.map((r) => r.title),
        signals: [],
      },
      previewOnly: true,
      applyBlockedWithoutConsent: true,
      nextSafeAction: next,
      skillIr: null,
      skillIrDigest: null,
      parserId: null,
    };
  }

  private receiptFromPlan(
    plan: SkillInstallPlan,
    partial: {
      id: string;
      generatedAt: string;
      status: SkillInstallReceipt['status'];
      materialized: boolean;
      targetDir: string | null;
      skillId?: string | null;
      approvalGranted: boolean;
      reason: string;
      toolBinds: SkillInstallReceipt['toolBinds'];
      smoke: SkillInstallReceipt['smoke'];
      skillIr?: ZavorthSkillIr | null;
      skillIrDigest?: string | null;
      parserId?: SkillInstallReceipt['parserId'];
    },
  ): SkillInstallReceipt {
    const secretLikePresent = plan.risks.some((r) => r.secretLike) || SECRET_CONTENT_HINT.test(partial.reason);
    return {
      contractVersion: ZAVORTH_SKILL_WORKER_MESH_CONTRACT_VERSION,
      kind: 'skill-install-receipt',
      id: partial.id,
      generatedAt: partial.generatedAt,
      status: partial.status,
      source: plan.source,
      skillId: partial.skillId !== undefined ? partial.skillId : plan.skillId,
      targetDir: partial.targetDir,
      materialized: partial.materialized,
      toolBinds: partial.toolBinds,
      smoke: partial.smoke,
      trust: plan.trust,
      secretLikePresent,
      approvalGranted: partial.approvalGranted,
      reason: this.redactSecrets(partial.reason),
      skillIr: partial.skillIr !== undefined ? partial.skillIr : plan.skillIr || null,
      skillIrDigest: partial.skillIrDigest !== undefined ? partial.skillIrDigest : plan.skillIrDigest || null,
      parserId: partial.parserId !== undefined ? partial.parserId : plan.parserId || null,
    };
  }

  private persistReceipt(receipt: SkillInstallReceipt): void {
    try {
      fs.mkdirSync(this.receiptsDir, { recursive: true });
      const file = path.join(this.receiptsDir, `${sanitizeFileId(receipt.id)}.json`);
      const body = JSON.stringify(receipt, null, 2);
      // Defense: never write obvious secret assignments
      if (SECRET_CONTENT_HINT.test(body) && /=\s*['\"]?[A-Za-z0-9_\-]{16}/.test(body)) {
        const safe = { ...receipt, reason: 'redacted: secret-like content stripped from persist' };
        fs.writeFileSync(file, JSON.stringify(safe, null, 2), 'utf8');
        return;
      }
      fs.writeFileSync(file, body, 'utf8');
    } catch {
      /* soft-fail persist */
    }
  }

  private newId(): string {
    return `skill-install-${this.now().toISOString().replace(/[:.]/g, '')}-${crypto.randomBytes(4).toString('hex')}`;
  }

  private redactSecrets(text: string): string {
    return String(text || '')
      .replace(/(api[_-]?key|secret|token|password)\s*[:=]\s*\S+/gi, '$1=[redacted]')
      .slice(0, 2000);
  }
}
