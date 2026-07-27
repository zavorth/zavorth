import { asErrorLike } from '../utils/errorLike';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from '../config/index.js';
import {
  ZAVORTH_EXTERNAL_AGENT_MIGRATION_PACK_CONTRACT_VERSION,
  type ZavorthExternalAgentMigrationAsset,
  type ZavorthExternalAgentMigrationAssetKind,
  type ZavorthExternalAgentMigrationPackSnapshot,
  type ZavorthExternalAgentMigrationPreset,
  type ZavorthExternalAgentMigrationReceipt,
  type ZavorthExternalAgentMigrationStatus,
} from '../contracts/ZavorthExternalAgentMigrationPackContract.js';
import type { ZavorthExternalAgentGatewayReceipt } from '../contracts/ZavorthExternalAgentGatewayContract.js';
import { logger } from '../logger.js';
import { Database } from '../storage/Database.js';
import { MemoryService } from './MemoryService.js';
import {
ZavorthExternalAgentOnboardingService,
  type ZavorthExternalAgentOnboardingInput,
} from './ZavorthExternalAgentOnboardingService.js';

export type ZavorthExternalAgentMigrationPackInput = {
  requestedBy?: string | null;
  pathHint?: string | null;
  approximatePathHint?: string | null;
  commandHint?: string | null;
  endpointHint?: string | null;
  consent?: boolean;
  preset?: ZavorthExternalAgentMigrationPreset | null;
  apply?: boolean;
  approvalId?: string | null;
  overwrite?: boolean;
  registerAsArm?: boolean;
  enableLive?: boolean;
  maxDepth?: number | null;
  maxFiles?: number | null;
  targetRoot?: string | null;
  writeReceipt?: boolean;
};

export type ZavorthExternalAgentMigrationPackRuntime = {
  now?: () => Date;
  projectRoot?: string;
  onboardingService?: Pick<ZavorthExternalAgentOnboardingService, 'buildSnapshot' | 'materializeGatewayProfile'>;
  existsSync?: typeof fs.existsSync;
  readdirSync?: typeof fs.readdirSync;
  readFileSync?: typeof fs.readFileSync;
  statSync?: typeof fs.statSync;
  mkdirSync?: typeof fs.mkdirSync;
  writeFileSync?: typeof fs.writeFileSync;
};

type CandidateFile = {
  fullPath: string;
  relativePath: string;
  name: string;
  ext: string;
  size: number;
};

type FileReadResult = {
  text: string;
  bytesRead: number;
  secretLikeContentDetected: boolean;
};

const MAX_SCAN_FILES = 360;
const MAX_TEXT_BYTES = 48_000;
const TEXT_EXTENSIONS = new Set(['.md', '.txt', '.json', '.toml', '.yaml', '.yml', '.ini', '.conf']);
const TTS_EXTENSIONS = new Set(['.wav', '.mp3', '.ogg', '.flac', '.m4a']);
const SOURCE_KIND_NONE = 'none' as const;

export class ZavorthExternalAgentMigrationPackService {
  private readonly now: () => Date;
  private readonly projectRoot: string;
  private readonly onboarding: Pick<ZavorthExternalAgentOnboardingService, 'buildSnapshot' | 'materializeGatewayProfile'>;
  private readonly existsSyncImpl: typeof fs.existsSync;
  private readonly readdirSyncImpl: typeof fs.readdirSync;
  private readonly readFileSyncImpl: typeof fs.readFileSync;
  private readonly statSyncImpl: typeof fs.statSync;
  private readonly mkdirSyncImpl: typeof fs.mkdirSync;
  private readonly writeFileSyncImpl: typeof fs.writeFileSync;

  public constructor(runtime: ZavorthExternalAgentMigrationPackRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.projectRoot = runtime.projectRoot || config.projectRoot;
    this.onboarding = runtime.onboardingService || new ZavorthExternalAgentOnboardingService({
      now: this.now,
      projectRoot: this.projectRoot,
    });
    this.existsSyncImpl = runtime.existsSync || fs.existsSync.bind(fs);
    this.readdirSyncImpl = runtime.readdirSync || fs.readdirSync.bind(fs);
    this.readFileSyncImpl = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.statSyncImpl = runtime.statSync || fs.statSync.bind(fs);
    this.mkdirSyncImpl = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.writeFileSyncImpl = runtime.writeFileSync || fs.writeFileSync.bind(fs);
  }

  public buildSnapshot(input: ZavorthExternalAgentMigrationPackInput = {}): ZavorthExternalAgentMigrationPackSnapshot {
    const generatedAt = this.now().toISOString();
    const preset = normalizePreset(input.preset);
    const apply = input.apply === true;
    const approvalId = clean(input.approvalId);
    const onboardingInput = this.toOnboardingInput(input);
    const onboarding = this.onboarding.buildSnapshot(onboardingInput);
    const sourceKind = onboarding.consent.scope.kind || SOURCE_KIND_NONE;
    const sourceValue = onboarding.consent.scope.value || null;
    const fingerprint = stableId(sourceKind, sourceValue || 'none', generatedAt.slice(0, 10));
    const targetRoot = path.resolve(input.targetRoot || path.join(this.projectRoot, 'data', 'runtime', 'zavorth-agent-migrations'));
    const draftRoot = path.join(targetRoot, fingerprint);
    const assetRoots = candidateRoots(onboarding);
    const files = onboarding.consent.provided && onboarding.inspection.performed
      ? this.collectFiles(assetRoots, clamp(input.maxDepth, 1, 5, 3), clamp(input.maxFiles, 1, 1000, MAX_SCAN_FILES))
      : [];
    const plannedAssets = this.planAssets({
      preset,
      files,
      draftRoot,
      sourceFingerprint: fingerprint,
    });
    const approvalMissing = apply && !approvalId;
    const canWrite = apply && Boolean(approvalId) && onboarding.status === 'ready-for-review';
    const writtenAssets = canWrite
      ? this.writeAssets(plannedAssets, {
        overwrite: input.overwrite === true,
      })
      : plannedAssets;
    const registrationReceipts = canWrite && input.registerAsArm === true
      ? this.registerCandidate(input)
      : [];
    const status = resolveStatus({
      onboardingStatus: onboarding.status,
      hasHint: sourceKind !== SOURCE_KIND_NONE,
      apply,
      approvalMissing,
      plannedAssets,
      writtenAssets,
    });
    const receipt = this.buildReceipt({
      generatedAt,
      status,
      approvalId,
      apply,
      preset,
      fingerprint,
      assets: writtenAssets,
    });

    const snapshot: ZavorthExternalAgentMigrationPackSnapshot = {
      generatedAt,
      contractVersion: ZAVORTH_EXTERNAL_AGENT_MIGRATION_PACK_CONTRACT_VERSION,
      surface: 'external-agent-migration-pack',
      status,
      preset,
      requestedBy: clean(input.requestedBy) || 'operator',
      source: {
        kind: sourceKind,
        value: sourceValue,
        fingerprint,
      },
      onboarding,
      summary: summarize(writtenAssets, onboarding.candidates.length),
      assets: writtenAssets,
      registrationReceipts,
      receipt,
      policy: {
        dryRunDefault: true,
        applyRequiresApprovalId: true,
        noDotEnvRead: true,
        noSecretFileRead: true,
        noRuntimeExecution: true,
        noNetworkProbe: true,
        importedSkillsDraftOnly: true,
        externalAgentRegistrationSeparateFromInvocation: true,
        rollbackByReceipt: true,
      },
      rollback: {
        available: writtenAssets.some((asset) => asset.status === 'written'),
        affectedPaths: writtenAssets
          .filter((asset) => asset.status === 'written' && asset.targetPath)
          .map((asset) => asset.targetPath as string),
        instruction: writtenAssets.some((asset) => asset.status === 'written') ? 'Remove only the files listed in affectedPaths after reviewing this receipt.'
          : null,
      },
      commands: {
        preview: 'zavorth agent import --path <path> --consent --dry-run',
        apply: 'zavorth agent import --path <path> --consent --apply --approval-id <approval-id>',
        registerAsArm: 'zavorth agent import --path <path> --consent --apply --approval-id <approval-id> --register-as-arm',
        check: 'npm run zavorth:external-agent-migration-pack:check --silent',
      },
    };

    if (input.writeReceipt === true || canWrite) {
      this.writeReceipt(snapshot);
    }

    return snapshot;
  }

  public renderText(snapshot: ZavorthExternalAgentMigrationPackSnapshot): string {
    const lines = [
      'Zavorth External Agent Migration Pack',
      `Status: ${snapshot.status}`,
      `Preset: ${snapshot.preset}`,
      `source: ${snapshot.source.kind}${snapshot.source.value ? ` | ${snapshot.source.value}` : ''}`,
      `Candidates: ${snapshot.summary.candidates}`,
      `Assets: ${snapshot.summary.assetsPlanned} planejados | ${snapshot.summary.assetsWritten} escritos | ${snapshot.summary.skippedSecrets} secrets pulados`,
      '',
    ];
    if (snapshot.status === 'needs-user-hint') {
      lines.push('Provide a folder, command, or endpoint before migration.');
      lines.push(`next: ${snapshot.commands.preview}`);
      return `${lines.join('\n')}\n`;
    }
    if (snapshot.status === 'blocked') {
      lines.push('Blocked: read-only consent and a reviewable candidate are required.');
      lines.push('Nothing was copied, registered, or executed.');
      return `${lines.join('\n')}\n`;
    }
    if (snapshot.status === 'approval-required') {
      lines.push('Preview ready. Para aplicar, informe approval-id explicit.');
    }
    lines.push('Plan');
    for (const asset of snapshot.assets.slice(0, 14)) {
      lines.push(`- ${asset.kind}: ${asset.label} | ${asset.status} | ${asset.action}`);
    }
    if (snapshot.assets.length > 14) {
      lines.push(`- mais ${snapshot.assets.length - 14} asset(s) no JSON/receipt`);
    }
    lines.push(
      '',
      'Garantias',
      '- none process external foi iniciado',
      '- none endpoint foi chamado',
      '- .env/secrets/tokens files are not read',
      '- provider keys viram SecretRefs, nunca value bruto',
      '- skills entram como draft governado',
      '',
      `next: ${snapshot.status === 'preview-ready' || snapshot.status === 'approval-required' ? snapshot.commands.apply : snapshot.commands.check}`,
    );
    return `${lines.join('\n')}\n`;
  }

  private toOnboardingInput(input: ZavorthExternalAgentMigrationPackInput): ZavorthExternalAgentOnboardingInput {
    return {
      requestedBy: input.requestedBy,
      pathHint: input.pathHint,
      approximatePathHint: input.approximatePathHint,
      commandHint: input.commandHint,
      endpointHint: input.endpointHint,
      consent: input.consent === true,
      maxDepth: input.maxDepth,
      writeSnapshot: false,
    };
  }

  private collectFiles(roots: string[], maxDepth: number, maxFiles: number): CandidateFile[] {
    const out: CandidateFile[] = [];
    const seen = new Set<string>();
    for (const root of roots) {
      if (!root || !this.existsSyncImpl(root)) continue;
      const base = path.resolve(root);
      const visit = (current: string, depth: number) => {
        if (out.length >= maxFiles) return;
        let entries: fs.Dirent[];
        try {
          entries = this.readdirSyncImpl(current, { withFileTypes: true }) as fs.Dirent[];
        } catch (error: unknown) {logger.warn('[Zavorth External Agent Migration Pack] filesystem operation failed', error);
    return;
  }
        for (const entry of entries.slice(0, 120)) {
          if (out.length >= maxFiles) return;
          if (shouldSkipName(entry.name)) continue;
          const fullPath = path.join(current, entry.name);
          if (entry.isDirectory()) {
            if (depth < maxDepth) visit(fullPath, depth + 1);
            continue;
          }
          if (!entry.isFile()) continue;
          const ext = path.extname(entry.name).toLowerCase();
          if (!TEXT_EXTENSIONS.has(ext) && !TTS_EXTENSIONS.has(ext)) continue;
          try {
            const stat = this.statSyncImpl(fullPath);
            if (stat.size > MAX_TEXT_BYTES * 8 && !TTS_EXTENSIONS.has(ext)) continue;
            const resolved = path.resolve(fullPath);
            if (seen.has(resolved)) continue;
            seen.add(resolved);
            out.push({
              fullPath: resolved,
              relativePath: path.relative(base, resolved).replace(/\\/g, '/'),
              name: entry.name,
              ext,
              size: stat.size,
            });
          } catch (error: unknown) {// read-only best effort
      logger.warn('[Zavorth External Agent Migration Pack] operation failed', error);
    }
        }
      };
      visit(base, 0);
    }
    return out;
  }

  private planAssets(input: {
    preset: ZavorthExternalAgentMigrationPreset;
    files: CandidateFile[];
    draftRoot: string;
    sourceFingerprint: string;
  }): ZavorthExternalAgentMigrationAsset[] {
    const assets: ZavorthExternalAgentMigrationAsset[] = [];
    for (const file of input.files) {
      const kind = classifyFile(file);
      if (!presetAllows(input.preset, kind)) continue;
      const read = TTS_EXTENSIONS.has(file.ext)
        ? { text: '', bytesRead: 0, secretLikeContentDetected: false }
        : this.readSafeText(file);
      const secretLike = read.secretLikeContentDetected || looksSecretFile(file.relativePath);
      const id = `${kind}-${stableId(input.sourceFingerprint, file.relativePath)}`;
      const targetPath = targetForAsset({
        draftRoot: input.draftRoot,
        kind,
        file,
        id,
      });
      assets.push({
        id,
        kind,
        label: labelForAsset(kind, file),
        sourcePath: maskHome(file.fullPath),
        targetPath: secretLike && kind !== 'provider' ? null : targetPath,
        action: actionForAsset(kind, secretLike),
        status: secretLike && kind !== 'provider' ? 'skipped' : 'planned',
        risk: riskForAsset(kind, secretLike),
        reasons: reasonsForAsset(kind, secretLike),
        bytesRead: read.bytesRead,
        secretLikeContentDetected: secretLike,
      });
    }
    assets.push({
      id: `agent-profile-${input.sourceFingerprint}`,
      kind: 'agent-profile',
      label: 'External capability profile candidate',
      sourcePath: null,
      targetPath: path.join(input.draftRoot, 'agent-profile-candidate.json'),
      action: 'register-profile-preview',
      status: 'planned',
      risk: 'medium',
      reasons: ['Profile registration is separate from invocation and requires approval.'],
      bytesRead: 0,
      secretLikeContentDetected: false,
    });
    return dedupeAssets(assets);
  }

  private readSafeText(file: CandidateFile): FileReadResult {
    if (looksSecretFile(file.relativePath)) {
      return { text: '', bytesRead: 0, secretLikeContentDetected: true };
    }
    try {
      const raw = String(this.readFileSyncImpl(file.fullPath, 'utf8') || '').slice(0, MAX_TEXT_BYTES);
      return {
        text: sanitizeText(raw),
        bytesRead: Buffer.byteLength(raw, 'utf8'),
        secretLikeContentDetected: containsSecretLike(raw),
      };
    } catch (error: unknown) {logger.warn('[Zavorth External Agent Migration Pack] filesystem operation failed', error);
    return { text: '', bytesRead: 0, secretLikeContentDetected: false };
  }
  }

  private writeAssets(
    assets: ZavorthExternalAgentMigrationAsset[],
    options: { overwrite: boolean },
  ): ZavorthExternalAgentMigrationAsset[] {
    return assets.map((asset) => {
      if (!asset.targetPath || asset.status === 'skipped' || asset.status === 'blocked') {
        return asset;
      }
      if (this.existsSyncImpl(asset.targetPath) && !options.overwrite) {
        return {
          ...asset,
          status: 'skipped',
          reasons: [...asset.reasons, 'Target already exists; pass overwrite to replace.'],
        };
      }
      this.mkdirSyncImpl(path.dirname(asset.targetPath), { recursive: true });
      const body = this.bodyForAsset(asset);
      this.writeFileSyncImpl(asset.targetPath, body, 'utf8');

      // Native destination copies
      try {
        if (asset.kind === 'persona') {
          const nativePath = path.join(this.projectRoot, 'SOUL.md');
          if (options.overwrite || !this.existsSyncImpl(nativePath)) {
            this.writeFileSyncImpl(nativePath, body, 'utf8');
            logger.info(`[Migration] Imported persona written natively to SOUL.md`);
          }
        } else if (asset.kind === 'skill') {
          const match = asset.targetPath.match(/skill-drafts[\\/]([^\\/]+)/);
          const skillName = match ? match[1] : slug(asset.label);
          const nativePath = path.join(this.projectRoot, 'skills', skillName, 'SKILL.md');
          if (options.overwrite || !this.existsSyncImpl(nativePath)) {
            this.mkdirSyncImpl(path.dirname(nativePath), { recursive: true });
            this.writeFileSyncImpl(nativePath, body, 'utf8');
            logger.info(`[Migration] Imported skill written natively to skills/${skillName}/SKILL.md`);
          }
        } else if (asset.kind === 'memory') {
          const memoryKey = `imported_${slug(asset.label).replace(/[^a-z0-9_-]/g, '_')}`;
          const memoryService = new MemoryService();
          void memoryService.remember('cli-operator', memoryKey, body, 'imported').then(() => {
            logger.info(`[Migration] Imported memory "${memoryKey}" registered in SQLite.`);
          }).catch((err) => {
            logger.warn(`[Migration] Failed to register memory in SQLite: ${err}`);
          });
        }
      } catch (error: unknown) {
        const err = asErrorLike(error);

        logger.warn(`[Migration] Failed during native migration write: ${err}`);
      }

      return { ...asset, status: 'written' };
    });
  }

  private bodyForAsset(asset: ZavorthExternalAgentMigrationAsset): string {
    if (asset.sourcePath) {
      const actualSourcePath = unmaskHome(asset.sourcePath);
      if (this.existsSyncImpl(actualSourcePath)) {
        try {
          const content = this.readFileSyncImpl(actualSourcePath, 'utf8');
          if (asset.kind === 'persona' || asset.kind === 'memory' || asset.kind === 'workspace-instruction') {
            return content;
          }
          if (asset.kind === 'skill') {
            let name = slug(asset.label);
            let description = 'Draft skill imported through Zavorth migration review.';
            let bodyContent = content;

            if (content.trim().startsWith('---')) {
              const parts = content.split('---');
              if (parts.length >= 3) {
                const fm = parts[1];
                const nameMatch = fm.match(/name:\s*(.+)/i);
                const descMatch = fm.match(/description:\s*(.+)/i);
                if (nameMatch) name = nameMatch[1].trim().replace(/['"]/g, '');
                if (descMatch) description = descMatch[1].trim().replace(/['"]/g, '');
                bodyContent = parts.slice(2).join('---').trim();
              }
            } else {
              const titleMatch = content.match(/^#\s+(.+)/m);
              if (titleMatch) {
                name = slug(titleMatch[1].trim());
                bodyContent = content.replace(/^#\s+(.+)/m, '').trim();
              }
            }

            return [
              '---',
              `name: ${name}`,
              `description: ${description}`,
              '---',
              '',
              bodyContent,
            ].join('\n');
          }
        } catch (error: unknown) { const err = asErrorLike(error); logger.warn(`[Migration Pack] Failed to read or parse source file: ${err}`);
        }
      }
    }

    if (asset.kind === 'agent-profile' || asset.kind === 'provider' || asset.kind === 'messaging' || asset.kind === 'command-policy') {
      return `${JSON.stringify({
        id: asset.id,
        kind: asset.kind,
        label: asset.label,
        sourcePath: asset.sourcePath,
        action: asset.action,
        status: 'draft',
        note: 'Generated by Zavorth migration pack. Review before enabling.',
        secretValuesIncluded: false,
      }, null, 2)}\n`;
    }

    return [
      '# Zavorth Migration Draft',
      '',
      `Kind: ${asset.kind}`,
      `Label: ${asset.label}`,
      `Source: ${asset.sourcePath || 'redacted'}`,
      '',
      'This draft is reference material for the Zavorth operator. It is not a system instruction until reviewed and approved.',
    ].join('\n') + '\n';
  }

  private registerCandidate(input: ZavorthExternalAgentMigrationPackInput): ZavorthExternalAgentGatewayReceipt[] {
    const result = this.onboarding.materializeGatewayProfile({
      ...this.toOnboardingInput(input),
      approveRegistration: true,
      enableLive: input.enableLive === true,
      requestedBy: input.requestedBy,
      writeSnapshot: false,
      requireStrongIsolation: true,
    });
    return result.receipt ? [result.receipt] : [];
  }

  private buildReceipt(input: {
    generatedAt: string;
    status: ZavorthExternalAgentMigrationStatus;
    approvalId: string | null;
    apply: boolean;
    preset: ZavorthExternalAgentMigrationPreset;
    fingerprint: string;
    assets: ZavorthExternalAgentMigrationAsset[];
  }): ZavorthExternalAgentMigrationReceipt {
    return {
      id: `zavorth.external-agent-migration.${stableId(input.generatedAt, input.fingerprint)}`,
      generatedAt: input.generatedAt,
      status: input.status,
      approvalId: input.approvalId,
      apply: input.apply,
      preset: input.preset,
      sourceFingerprint: input.fingerprint,
      assetsPlanned: input.assets.length,
      assetsWritten: input.assets.filter((asset) => asset.status === 'written').length,
      skippedSecrets: input.assets.filter((asset) => asset.secretLikeContentDetected || asset.action === 'secret-ref-only').length,
      guarantees: {
        consentRequired: true,
        noExternalProcessStarted: true,
        noNetworkProbe: true,
        rawSecretsSerialized: false,
        writesRequireApproval: true,
        skillImportsAreDrafts: true,
        providerKeysBecomeSecretRefsOnly: true,
      },
    };
  }

  private writeReceipt(snapshot: ZavorthExternalAgentMigrationPackSnapshot): void {
    const dir = path.join(this.projectRoot, 'data', 'runtime');
    this.mkdirSyncImpl(dir, { recursive: true });
    this.writeFileSyncImpl(
      path.join(dir, 'external-agent-migration-last.json'),
      `${JSON.stringify(snapshot, null, 2)}\n`,
      'utf8',
    );
  }
}

function classifyFile(file: CandidateFile): ZavorthExternalAgentMigrationAssetKind {
  const relSegments = file.relativePath.toLowerCase().split(/[\\/]+/).filter(Boolean);
  const name = file.name.toLowerCase();
  const stem = name.includes('.') ? name.slice(0, name.indexOf('.')) : name;
  if (TTS_EXTENSIONS.has(file.ext)) return 'tts-asset';
  const namedKind: Record<string, ZavorthExternalAgentMigrationAssetKind> = {
    soul: 'persona', persona: 'persona', profile: 'persona', identity: 'persona',
    memory: 'memory', user: 'memory', memories: 'memory', notes: 'memory',
    agents: 'workspace-instruction', agent: 'workspace-instruction', instructions: 'workspace-instruction', workspace: 'workspace-instruction', readme: 'workspace-instruction',
  };
  if (namedKind[stem]) return namedKind[stem];
  const segmentKinds: Record<string, ZavorthExternalAgentMigrationAssetKind> = {
    memory: 'memory', memories: 'memory', skills: 'skill', 'skill-library': 'skill', extensions: 'skill',
    allow: 'command-policy', permission: 'command-policy', policy: 'command-policy', command: 'command-policy',
    telegram: 'messaging', discord: 'messaging', slack: 'messaging', whatsapp: 'messaging', signal: 'messaging', email: 'messaging',
    provider: 'provider', model: 'provider', llm: 'provider',
  };
  for (const segment of relSegments) {
    if (segmentKinds[segment]) return segmentKinds[segment];
  }
  if (name === 'env.example') return 'provider';
  if (name === 'agents.md') return 'workspace-instruction';
  return 'unknown';
}

function presetAllows(preset: ZavorthExternalAgentMigrationPreset, kind: ZavorthExternalAgentMigrationAssetKind): boolean {
  if (kind === 'unknown') return false;
  if (preset === 'full') return true;
  if (preset === 'capabilities') return ['skill', 'command-policy', 'provider', 'agent-profile'].includes(kind);
  if (preset === 'user-data') return ['persona', 'memory', 'messaging', 'provider', 'tts-asset', 'workspace-instruction', 'agent-profile'].includes(kind);
  return true;
}

function actionForAsset(kind: ZavorthExternalAgentMigrationAssetKind, secretLike: boolean): ZavorthExternalAgentMigrationAsset['action'] {
  if (secretLike || kind === 'provider') return 'secret-ref-only';
  if (kind === 'skill') return 'materialize-skill-draft';
  if (kind === 'agent-profile') return 'register-profile-preview';
  return 'copy-sanitized-draft';
}

function riskForAsset(kind: ZavorthExternalAgentMigrationAssetKind, secretLike: boolean): ZavorthExternalAgentMigrationAsset['risk'] {
  if (secretLike || kind === 'command-policy' || kind === 'agent-profile') return 'medium';
  if (kind === 'skill' || kind === 'provider') return 'medium';
  return 'low';
}

function reasonsForAsset(kind: ZavorthExternalAgentMigrationAssetKind, secretLike: boolean): string[] {
  if (secretLike) {
    return ['Secret-like content detected; raw value will not be copied.', 'Use SecretRef or manual provider setup.'];
  }
  if (kind === 'skill') return ['Skill becomes a draft; runtime use requires review/approval.'];
  if (kind === 'provider') return ['Provider settings are represented as SecretRef requirements only.'];
  if (kind === 'agent-profile') return ['External agent can be registered as a governed arm, not invoked by migration.'];
  return ['Sanitized draft can be reviewed inside Zavorth.'];
}

function targetForAsset(input: {
  draftRoot: string;
  kind: ZavorthExternalAgentMigrationAssetKind;
  file: CandidateFile;
  id: string;
}): string {
  if (input.kind === 'skill') {
    const skillName = input.file.name.toLowerCase() === 'skill.md'
      ? path.basename(path.dirname(input.file.fullPath))
      : input.file.name;
    return path.join(input.draftRoot, 'skill-drafts', slug(skillName), 'SKILL.md');
  }
  if (input.kind === 'tts-asset') {
    return path.join(input.draftRoot, 'echo-assets', `${slug(input.file.name)}.json`);
  }
  return path.join(input.draftRoot, `${input.kind}-${input.id}.md`);
}

function labelForAsset(kind: ZavorthExternalAgentMigrationAssetKind, file: CandidateFile): string {
  return `${kind}: ${file.relativePath}`;
}

function candidateRoots(onboarding: { candidates: Array<{ source: { inspectedPath: string | null } }>; inspection: { inspectedRoots: string[] } }): string[] {
  return unique([
    ...onboarding.candidates.map((candidate) => candidate.source.inspectedPath || '').filter(Boolean),
    ...onboarding.inspection.inspectedRoots,
  ]);
}

function summarize(
  assets: ZavorthExternalAgentMigrationAsset[],
  candidates: number,
): ZavorthExternalAgentMigrationPackSnapshot['summary'] {
  const count = (kind: ZavorthExternalAgentMigrationAssetKind) => assets.filter((asset) => asset.kind === kind).length;
  return {
    candidates,
    assetsPlanned: assets.length,
    assetsWritten: assets.filter((asset) => asset.status === 'written').length,
    persona: count('persona'),
    memory: count('memory'),
    skills: count('skill'),
    commandPolicies: count('command-policy'),
    messaging: count('messaging'),
    providers: count('provider'),
    ttsAssets: count('tts-asset'),
    workspaceInstructions: count('workspace-instruction'),
    agentProfiles: count('agent-profile'),
    skippedSecrets: assets.filter((asset) => asset.secretLikeContentDetected || asset.action === 'secret-ref-only').length,
    blockedAssets: assets.filter((asset) => asset.status === 'blocked').length,
  };
}

function resolveStatus(input: {
  onboardingStatus: string;
  hasHint: boolean;
  apply: boolean;
  approvalMissing: boolean;
  plannedAssets: ZavorthExternalAgentMigrationAsset[];
  writtenAssets: ZavorthExternalAgentMigrationAsset[];
}): ZavorthExternalAgentMigrationStatus {
  if (!input.hasHint) return 'needs-user-hint';
  if (input.onboardingStatus === 'blocked' || input.onboardingStatus === 'no-candidate-found') return 'blocked';
  if (input.apply && input.approvalMissing) return 'approval-required';
  if (!input.apply) return 'preview-ready';
  const written = input.writtenAssets.filter((asset) => asset.status === 'written').length;
  if (written === 0 && input.plannedAssets.length > 0) return 'partial';
  return input.writtenAssets.some((asset) => asset.status === 'skipped') ? 'partial' : 'migrated';
}

function normalizePreset(value: unknown): ZavorthExternalAgentMigrationPreset {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'user-data' || text === 'capabilities' || text === 'full') return text;
  return 'preview';
}

function shouldSkipName(name: string): boolean {
  const lower = name.toLowerCase();
  return lower === 'node_modules'
    || lower === '.git'
    || lower === 'dist'
    || lower === 'build'
    || lower === '.next'
    || lower === '__pycache__'
    || lower === '.venv'
    || lower === 'venv'
    || lower === '.env'
    || lower.endsWith('.pem')
    || lower.endsWith('.key')
    || lower.includes('secret')
    || lower.includes('token')
    || lower.includes('credential');
}

function looksSecretFile(value: string): boolean {
  const lower = value.toLowerCase();
  return lower.split(/[\\/]/).some((part) =>
    part === '.env'
    || part.includes('secret')
    || part.includes('token')
    || part.includes('credential')
    || part.includes('password'),
  );
}

function containsSecretLike(value: string): boolean {
  return /\b(sk-[A-Za-z0-9_-]{12,}|xox[baprs]-[A-Za-z0-9-]{12,}|gh[pousr]_[A-Za-z0-9_]{12,}|hf_[A-Za-z0-9]{20,})\b/.test(value)
    || /\b(?:API[_-]...KEY|TOKEN|SECRET|PASSWORD|PASS|CREDENTIAL)\b\s*[:=]/i.test(value);
}

function sanitizeText(value: string): string {
  return String(value || '')
    .replace(/\b(sk-[A-Za-z0-9_-]{8,})\b/g, 'sk-[redacted]')
    .replace(/\b(xox[baprs]-[A-Za-z0-9-]{8,})\b/g, 'xox-[redacted]')
    .replace(/\b(gh[pousr]_[A-Za-z0-9_]{8,})\b/g, 'gh_[redacted]')
    .replace(/\b(hf_[A-Za-z0-9]{12,})\b/g, 'hf_[redacted]')
    .replace(/\b([A-Z0-9_]*(?:API[_-]...KEY|TOKEN|SECRET|PASSWORD|PASS|CREDENTIAL)[A-Z0-9_]*)\s*[:=]\s*([^\s"'`,;]+)/gi, '$1=[redacted]');
}

function dedupeAssets(assets: ZavorthExternalAgentMigrationAsset[]): ZavorthExternalAgentMigrationAsset[] {
  const seen = new Set<string>();
  return assets.filter((asset) => {
    const key = `${asset.kind}:${asset.sourcePath || asset.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function clean(value: unknown): string | null {
  const text = String(value || '').trim();
  return text ? text.slice(0, 1000) : null;
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function stableId(...parts: string[]): string {
  return crypto.createHash('sha256').update(parts.join(':')).digest('hex').slice(0, 16);
}

function slug(value: string): string {
  return String(value || 'item')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'item';
}

function maskHome(value: string): string {
  const home = process.env.USERPROFILE || process.env.HOME || '';
  return home && value.toLowerCase().startsWith(home.toLowerCase()) ? `~${value.slice(home.length)}`
    : value;
}

function unmaskHome(value: string): string {
  if (value.startsWith('~')) {
    const home = process.env.USERPROFILE || process.env.HOME || '';
    return path.join(home, value.slice(1));
  }
  return value;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}
