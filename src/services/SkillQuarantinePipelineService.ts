import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { ZavorthSandboxControlPlaneService } from './ZavorthSandboxControlPlaneService.js';

import { config } from '../config/index.js';
import type {
  ZavorthOperationalRefinementReceipt,
  ZavorthOperationalSkillQuarantine,
} from '../contracts/ZavorthOperationalRefinementContract.js';

export type SkillQuarantinePipelineInput = {
  skillId?: string | null;
  title?: string | null;
  summary?: string | null;
  source?: string | null;
  applyDraft?: boolean;
  promote?: boolean;
  approvalId?: string | null;
};

export type SkillQuarantinePipelineSnapshot = ZavorthOperationalSkillQuarantine & {
  generatedAt: string;
  proposalPath: string;
  sandboxPosture: string;
};

type SkillQuarantinePipelineRuntime = {
  projectRoot?: string;
  now?: () => Date;
  sandbox?: Pick<ZavorthSandboxControlPlaneService, 'buildSnapshot'>;
};

export class SkillQuarantinePipelineService {
  private readonly projectRoot: string;
  private readonly now: () => Date;
  private readonly sandbox: Pick<ZavorthSandboxControlPlaneService, 'buildSnapshot'>;

  constructor(runtime: SkillQuarantinePipelineRuntime = {}) {
    this.projectRoot = path.resolve(runtime.projectRoot || config.projectRoot || process.cwd());
    this.now = runtime.now || (() => new Date());
    this.sandbox = runtime.sandbox || new ZavorthSandboxControlPlaneService({ workspaceRoot: this.projectRoot });
  }

  public buildSnapshot(input: SkillQuarantinePipelineInput = {}): SkillQuarantinePipelineSnapshot {
    const generatedAt = this.now().toISOString();
    const skillId = normalizeSkillId(input.skillId || input.title || 'learned-skill');
    const title = sanitizeLine(input.title || skillIdToTitle(skillId));
    const summary = sanitizeLine(input.summary || 'Draft skill proposed by the learning loop.');
    const quarantinePath = path.join(this.projectRoot, '.zavorth', 'skills', 'quarantine', skillId);
    const proposalPath = path.join(quarantinePath, 'proposal.json');
    const sandboxSnapshot = this.sandbox.buildSnapshot({
      command: `node -e "logger.info('skill:${skillId}:smoke')"`,
      preferredProfile: 'auto',
      networkPolicy: 'none',
      requestedBy: 'skill-quarantine',
      sourceSurface: 'skill-quarantine-pipeline',
    });
    const receipts: ZavorthOperationalRefinementReceipt[] = [
      receipt('skill-quarantine', 'ready', 'Skill draft is normalized and kept out of runtime exposure.', generatedAt),
      receipt(
        'skill-quarantine',
        sandboxSnapshot.summary.untrustedExecutionReady ? 'ready' : 'partial',
        sandboxSnapshot.summary.untrustedExecutionReady ? 'A strong sandbox profile is available before promotion.'
          : 'Sandbox preview exists; strong runtime is not installed, so promotion remains approval-gated.',
        generatedAt,
      ),
    ];
    const applyDraft = input.applyDraft === true;
    if (applyDraft) {
      this.writeDraft({ skillId, title, summary, source: input.source || 'learning-loop', quarantinePath, proposalPath, generatedAt });
      receipts.push(receipt('skill-quarantine', 'ready', 'Quarantine draft was written without enabling the skill.', generatedAt));
    }

    const wantsPromotion = input.promote === true;
    const hasApproval = Boolean(String(input.approvalId || '').trim());
    let promotedPath: string | null = null;
    let promotionPerformed = false;
    if (wantsPromotion && hasApproval) {
      promotedPath = this.promoteDraft({ skillId, title, summary, quarantinePath, approvalId: String(input.approvalId), generatedAt });
      promotionPerformed = true;
      receipts.push(receipt('skill-quarantine', 'ready', 'Approved skill promotion wrote a native skill copy.', generatedAt));
    } else if (wantsPromotion) {
      receipts.push(receipt('skill-quarantine', 'attention', 'Promotion requested without approval id; no runtime skill was enabled.', generatedAt));
    }

    const draftWritten = applyDraft || fs.existsSync(proposalPath);
    return {
      generatedAt,
      status: Boolean(sandboxSnapshot.envelopePreview) ? 'ready' : 'partial',
      skillId,
      quarantinePath,
      proposalPath,
      promotedPath,
      draftWritten,
      sandboxPreviewReady: Boolean(sandboxSnapshot.envelopePreview),
      sandboxPosture: sandboxSnapshot.summary.posture,
      approvalRequired: !promotionPerformed,
      promotionPerformed,
      receipts,
      safety: {
        noSkillExecutionDuringDraft: true,
        sandboxBeforePromotion: true,
        approvalRequiredForPromotion: true,
        secretsRedacted: true,
      },
    };
  }

  public renderText(snapshot: SkillQuarantinePipelineSnapshot): string {
    return [
      '[zavorth-skill-quarantine-pipeline]',
      `status=${snapshot.status} skill=${snapshot.skillId} draft=${snapshot.draftWritten ? 'yes' : 'no'} promote=${snapshot.promotionPerformed ? 'yes' : 'no'}`,
      `quarantine=${snapshot.quarantinePath}`,
      `proposal=${snapshot.proposalPath}`,
      `sandbox=${snapshot.sandboxPosture} preview=${snapshot.sandboxPreviewReady ? 'yes' : 'no'}`,
      `promoted=${snapshot.promotedPath || 'none'}`,
      '',
    ].join('\n');
  }

  private writeDraft(input: {
    skillId: string;
    title: string;
    summary: string;
    source: string;
    quarantinePath: string;
    proposalPath: string;
    generatedAt: string;
  }): void {
    fs.mkdirSync(input.quarantinePath, { recursive: true });
    const skillMarkdown = renderSkillMarkdown(input.title, input.summary);
    fs.writeFileSync(path.join(input.quarantinePath, 'SKILL.md'), skillMarkdown, 'utf8');
    fs.writeFileSync(input.proposalPath, `${JSON.stringify({
      id: input.skillId,
      title: input.title,
      summary: input.summary,
      source: sanitizeLine(input.source),
      createdAt: input.generatedAt,
      contentHash: hash(skillMarkdown),
      trustState: 'quarantined',
      executionPerformed: false,
      promotionRequiresApproval: true,
      rawSecretsSerialized: false,
    }, null, 2)}\n`, 'utf8');
  }

  private promoteDraft(input: {
    skillId: string;
    title: string;
    summary: string;
    quarantinePath: string;
    approvalId: string;
    generatedAt: string;
  }): string {
    if (!fs.existsSync(path.join(input.quarantinePath, 'SKILL.md'))) {
      this.writeDraft({
        skillId: input.skillId,
        title: input.title,
        summary: input.summary,
        source: 'promotion-request',
        quarantinePath: input.quarantinePath,
        proposalPath: path.join(input.quarantinePath, 'proposal.json'),
        generatedAt: input.generatedAt,
      });
    }
    const promotedPath = path.join(this.projectRoot, 'skill-library', 'native', input.skillId);
    fs.mkdirSync(promotedPath, { recursive: true });
    fs.copyFileSync(path.join(input.quarantinePath, 'SKILL.md'), path.join(promotedPath, 'SKILL.md'));
    fs.writeFileSync(path.join(promotedPath, 'ZAVORTH_NATIVE_SKILL.json'), `${JSON.stringify({
      id: input.skillId,
      title: input.title,
      summary: input.summary,
      source: 'skill-quarantine-pipeline',
      promotedAt: input.generatedAt,
      approvalId: sanitizeLine(input.approvalId),
      executionPerformedDuringPromotion: false,
      rawSecretsSerialized: false,
    }, null, 2)}\n`, 'utf8');
    return promotedPath;
  }
}

function renderSkillMarkdown(title: string, summary: string): string {
  return [
    '---',
    `name: ${title}`,
    `description: ${summary}`,
    '---',
    '',
    '# Skill',
    '',
    summary,
    '',
    'Use this skill only after its quarantine proposal has been reviewed and promoted by Zavorth.',
    '',
  ].join('\n');
}

function receipt(
  kind: ZavorthOperationalRefinementReceipt['kind'],
  status: ZavorthOperationalRefinementReceipt['status'],
  summary: string,
  createdAt: string,
): ZavorthOperationalRefinementReceipt {
  return {
    id: `${kind}-${hash(`${summary}:${createdAt}`).slice(0, 12)}`,
    kind,
    status,
    summary,
    createdAt,
  };
}

function normalizeSkillId(value: string): string {
  return String(value || 'learned-skill')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    || 'learned-skill';
}

function skillIdToTitle(skillId: string): string {
  return skillId.split('-').filter(Boolean).map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(' ');
}

function sanitizeLine(value: unknown): string {
  return String(value || '')
    .replace(/\b(api[_-]?key|token|secret|password)\s*[:=]\s*["']?[^"'\s,;]+/gi, '$1=[REDACTED_SECRET]')
    .replace(/[\r\n]+/g, ' ')
    .trim();
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
