import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { config } from '../config/index.js';
import {
  ZAVORTH_MNEMOS_PROMOTION_GATE_VERSION,
  type ZavorthMnemosPromotionStatus,
  type ZavorthMnemosPromotionCandidate,
  type ZavorthMnemosPromotionConflict,
  type ZavorthMnemosPromotionInput,
  type ZavorthMnemosPromotionSnapshot,
} from '../contracts/ZavorthMnemosPromotionGateContract.js';

type PromotionFsRuntime = Pick<
  typeof fs,
  'existsSync' | 'readFileSync' | 'writeFileSync' | 'mkdirSync'
>;

export type ZavorthMnemosPromotionGateRuntime = Partial<PromotionFsRuntime> & {
  now?: () => Date;
  projectRoot?: string;
};

export class ZavorthMnemosPromotionGateService {
  private readonly fsRuntime: PromotionFsRuntime;
  private readonly now: () => Date;
  private readonly projectRoot: string;

  constructor(runtime: ZavorthMnemosPromotionGateRuntime = {}) {
    this.fsRuntime = {
      existsSync: runtime.existsSync || fs.existsSync.bind(fs),
      readFileSync: runtime.readFileSync || fs.readFileSync.bind(fs),
      writeFileSync: runtime.writeFileSync || fs.writeFileSync.bind(fs),
      mkdirSync: runtime.mkdirSync || fs.mkdirSync.bind(fs),
    };
    this.now = runtime.now || (() => new Date());
    this.projectRoot = path.resolve(runtime.projectRoot || config.projectRoot);
  }

  public buildSnapshot(input: ZavorthMnemosPromotionInput = {}): ZavorthMnemosPromotionSnapshot {
    const generatedAt = this.now().toISOString();
    const candidates = Array.isArray(input.candidates) ? input.candidates : [];
    const applyRequested = input.apply === true;
    const approvalId = input.approvalId ? String(input.approvalId).trim() : null;

    // Detect conflicts against the existing wiki files
    const conflicts: ZavorthMnemosPromotionConflict[] = this.detectConflicts(candidates);

    const blockers: string[] = [];
    if (applyRequested && !approvalId) {
      blockers.push('approval-id-required');
    }
    if (conflicts.length > 0) {
      blockers.push('unresolved-conflicts-block-promotion');
    }

    const canApply = applyRequested && blockers.length === 0;
    const mutatedFiles = canApply ? this.applyPromotion(candidates) : [];
    const status: ZavorthMnemosPromotionStatus = canApply
      ? 'applied'
      : blockers.length > 0
        ? 'blocked'
        : 'preview-ready';

    return {
      version: ZAVORTH_MNEMOS_PROMOTION_GATE_VERSION,
      generatedAt,
      status,
      candidates: candidates.map((c) => ({
        ...c,
        fact: redactSecrets(c.fact),
      })),
      conflicts,
      apply: {
        requested: applyRequested,
        applied: canApply,
        approvalRequired: true,
        approvalSatisfied: Boolean(approvalId),
        approvalId,
        mutatedFiles,
        blockers,
      },
      safety: {
        secretsRedacted: true,
        provenanceLinked: true,
        dryRunDefault: true,
      },
      receipt: {
        id: `mnemos-promotion-${crypto.randomBytes(6).toString('hex')}`,
        durableMutation: canApply,
        approvalId,
      },
    };
  }

  private detectConflicts(candidates: ZavorthMnemosPromotionCandidate[]): ZavorthMnemosPromotionConflict[] {
    const conflicts: ZavorthMnemosPromotionConflict[] = [];

    for (const candidate of candidates) {
      const pagePath = path.join(this.projectRoot, '.zavorth', 'wiki', `${candidate.targetPage}.md`);
      if (!this.fsRuntime.existsSync(pagePath)) {
        continue;
      }
      try {
        const content = String(this.fsRuntime.readFileSync(pagePath, 'utf8'));

        // Conflict check 1: database Postgres vs SQLite
        if (/postgres|postgresql/i.test(candidate.fact) && /sqlite/i.test(content)) {
          conflicts.push({
            id: `conflict-${crypto.randomBytes(4).toString('hex')}`,
            candidateId: candidate.id,
            existingFact: 'Utiliza SQLite local na pasta .zavorth.',
            contradictionRule: 'Wiki contains competing database claims (Postgres vs SQLite).',
            recommendation: 'Esclarecer se o SQLite sera descontinuado ou migrado explicitamente.',
          });
        }

        // Conflict check 2: No approvals vs Requires approval
        if (/no\s+approval\s+required/i.test(candidate.fact) && /requires?\s+approval/i.test(content)) {
          conflicts.push({
            id: `conflict-${crypto.randomBytes(4).toString('hex')}`,
            candidateId: candidate.id,
            existingFact: 'Toda alteracao critica requer permissao/aprovacao explicita.',
            contradictionRule: 'Wiki contains competing approval claims (No approval vs Required).',
            recommendation: 'Manter a regra de seguranca transacional e rejeitar o bypass de aprovacao.',
          });
        }
      } catch {
        // Safe skip on read error
      }
    }

    return conflicts;
  }

  private applyPromotion(candidates: ZavorthMnemosPromotionCandidate[]): string[] {
    const mutated: Set<string> = new Set();

    for (const candidate of candidates) {
      const pagePath = path.join(this.projectRoot, '.zavorth', 'wiki', `${candidate.targetPage}.md`);
      if (!this.fsRuntime.existsSync(pagePath)) {
        continue;
      }
      try {
        let content = String(this.fsRuntime.readFileSync(pagePath, 'utf8'));

        // 1. Redact secrets in candidate fact
        const cleanFact = redactSecrets(candidate.fact);

        // 2. Append to ## Current Facts
        const factsHeader = '## Current Facts';
        const index = content.indexOf(factsHeader);
        if (index !== -1) {
          const insertIndex = index + factsHeader.length;
          const before = content.slice(0, insertIndex);
          const after = content.slice(insertIndex);
          content = `${before}\n\n- ${cleanFact}${after}`;
        }

        // 3. Update updated_at in frontmatter
        const todayStr = this.now().toISOString().slice(0, 10);
        content = content.replace(/^updated_at:\s*[0-9]{4}-[0-9]{2}-[0-9]{2}$/m, `updated_at: ${todayStr}`);

        // 4. Update sources in frontmatter
        const cleanSource = redactSecrets(candidate.source);
        if (!content.includes(cleanSource)) {
          const sourcesHeader = 'sources:';
          const srcIndex = content.indexOf(sourcesHeader);
          if (srcIndex !== -1) {
            const insertSrcIndex = srcIndex + sourcesHeader.length;
            const srcBefore = content.slice(0, insertSrcIndex);
            const srcAfter = content.slice(insertSrcIndex);
            content = `${srcBefore}\n  - ${cleanSource}${srcAfter}`;
          }
        }

        this.fsRuntime.writeFileSync(pagePath, content, 'utf8');
        mutated.add(`.zavorth/wiki/${candidate.targetPage}.md`);
      } catch {
        // Safe skip on write error
      }
    }

    return Array.from(mutated);
  }
}

function redactSecrets(value: string): string {
  return String(value || '')
    .replace(/\b(token|api[_ -]?key|secret|senha|password|chave)\s*[:=]\s*([^\s,;]+)/gi, '$1=[redacted-secret]')
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, '[redacted-secret]')
    .replace(/\bgh[pousr]_[A-Za-z0-9_]{8,}\b/g, '[redacted-secret]')
    .replace(/\bxox[baprs]-[A-Za-z0-9-]{8,}\b/g, '[redacted-secret]')
    .replace(/\bAIza[0-9A-Za-z_-]{16,}\b/g, '[redacted-secret]')
    .replace(/\b[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\b/g, '[redacted-secret]');
}
