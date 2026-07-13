import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  ZavorthExperienceLearningCandidate,
  ZavorthExperienceLearningDaemonSnapshot,
  ZavorthSkillForgeDraft,
  ZavorthSkillForgeRuntimeSnapshot,
} from '../contracts/native/ZavorthNativeAutonomySpineContract.js';
import {
  resolveLearningRuntimePolicy,
  type LearningRuntimePolicySnapshot,
} from './ZavorthLearningRuntimePolicy.js';
import { redactSensitiveText } from './ZavorthNativeAutonomyShared.js';

export type AutonomousLearningWriteResult = {
  mode: LearningRuntimePolicySnapshot['mode'];
  appliedPreferences: number;
  draftedSkills: number;
  blocked: number;
  receipts: AutonomousLearningReceipt[];
  preferenceStorePath: string;
  skillDraftRoot: string;
};

export type AutonomousLearningReceipt = {
  id: string;
  kind: 'preference' | 'skill-draft' | 'blocked';
  candidateId: string;
  lane: string;
  path: string | null;
  summary: string;
  createdAt: string;
  reversible: boolean;
};

type PreferenceRecord = {
  id: string;
  candidateId: string;
  summary: string;
  evidenceRefs: string[];
  confidence: number;
  expiry: string;
  receiptId: string;
  createdAt: string;
  sourceSurface: string;
  userId?: string;
  reversible: true;
};

type PreferenceStore = {
  version: 1 | 2;
  userId?: string;
  updatedAt: string;
  preferences: PreferenceRecord[];
};

type WriteDeps = {
  projectRoot?: string | null;
  userId?: string | null;
  now?: () => Date;
  policy?: LearningRuntimePolicySnapshot;
  mkdirSync?: typeof fs.mkdirSync;
  writeFileSync?: typeof fs.writeFileSync;
  readFileSync?: typeof fs.readFileSync;
  existsSync?: typeof fs.existsSync;
  renameSync?: typeof fs.renameSync;
  appendFileSync?: typeof fs.appendFileSync;
};

export function normalizeLearningUserId(userId: string | null | undefined): string {
  const raw = String(userId || '').trim();
  if (!raw) return 'local-user';
  const safe = raw.replace(/[^a-zA-Z0-9._@+-]+/g, '_').slice(0, 120);
  return safe || 'local-user';
}

export class ZavorthAutonomousLearningWriteService {
  private readonly projectRoot: string;
  private readonly userId: string;
  private readonly now: () => Date;
  private readonly policy: LearningRuntimePolicySnapshot;
  private readonly mkdirSync: typeof fs.mkdirSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly existsSync: typeof fs.existsSync;
  private readonly renameSync: typeof fs.renameSync;
  private readonly appendFileSync: typeof fs.appendFileSync;

  public constructor(deps: WriteDeps = {}) {
    this.projectRoot = path.resolve(String(deps.projectRoot || process.cwd()));
    this.userId = normalizeLearningUserId(deps.userId);
    this.now = deps.now || (() => new Date());
    this.policy = deps.policy || resolveLearningRuntimePolicy({
      projectRoot: this.projectRoot,
      userId: this.userId,
    });
    this.mkdirSync = deps.mkdirSync || fs.mkdirSync.bind(fs);
    this.writeFileSync = deps.writeFileSync || fs.writeFileSync.bind(fs);
    this.readFileSync = deps.readFileSync || fs.readFileSync.bind(fs);
    this.existsSync = deps.existsSync || fs.existsSync.bind(fs);
    this.renameSync = deps.renameSync || fs.renameSync.bind(fs);
    this.appendFileSync = deps.appendFileSync || fs.appendFileSync.bind(fs);
  }

  public get preferenceStorePath(): string {
    return path.join(
      this.projectRoot,
      'data',
      'runtime',
      'learning',
      'users',
      this.userId,
      'trusted-preferences.json',
    );
  }

  public get skillDraftRoot(): string {
    return path.join(
      this.projectRoot,
      'data',
      'runtime',
      'learning',
      'users',
      this.userId,
      'skill-drafts',
    );
  }

  public get receiptLogPath(): string {
    return path.join(
      this.projectRoot,
      'data',
      'runtime',
      'learning',
      'users',
      this.userId,
      'write-receipts.jsonl',
    );
  }

  public get scopedUserId(): string {
    return this.userId;
  }

  public applyFromSpine(input: {
    learning: ZavorthExperienceLearningDaemonSnapshot;
    skillForge?: ZavorthSkillForgeRuntimeSnapshot | null;
    sourceSurface?: string | null;
  }): AutonomousLearningWriteResult {
    const receipts: AutonomousLearningReceipt[] = [];
    let appliedPreferences = 0;
    let draftedSkills = 0;
    let blocked = 0;
    const createdAt = this.now().toISOString();
    const sourceSurface = String(input.sourceSurface || input.learning.postTurnReview.sourceSurface || 'runtime').trim();

    if (this.policy.mode !== 'autonomous') {
      return {
        mode: this.policy.mode,
        appliedPreferences: 0,
        draftedSkills: 0,
        blocked: input.learning.candidates.filter((c) => c.lane === 'red' || c.status === 'blocked').length,
        receipts: [],
        preferenceStorePath: this.preferenceStorePath,
        skillDraftRoot: this.skillDraftRoot,
      };
    }

    for (const candidate of input.learning.candidates) {
      if (
        candidate.lane === 'red'
        || candidate.status === 'blocked'
        || candidate.kind === 'policy-change'
        || candidate.kind === 'sensitive-user-model'
      ) {
        blocked += 1;
        receipts.push(this.receipt({
          kind: 'blocked',
          candidate,
          path: null,
          summary: candidate.summary,
          createdAt,
          reversible: false,
        }));
        continue;
      }

      if (
        this.policy.autoWriteGreenPreferences
        && candidate.lane === 'green'
        && candidate.kind === 'preference'
        && candidate.status === 'auto-applied'
      ) {
        const record = this.persistPreference(candidate, sourceSurface, createdAt);
        appliedPreferences += 1;
        receipts.push(this.receipt({
          kind: 'preference',
          candidate,
          path: this.preferenceStorePath,
          summary: record.summary,
          createdAt,
          reversible: true,
        }));
        continue;
      }

      if (
        this.policy.autoMaterializeYellowSkillDrafts
        && candidate.lane === 'yellow'
        && (candidate.kind === 'skill-signal' || candidate.kind === 'procedure')
      ) {
        const draft = this.findMatchingDraft(input.skillForge)
          || this.syntheticDraft(candidate, sourceSurface);
        const draftPath = this.materializeSkillDraft(draft, candidate, createdAt);
        draftedSkills += 1;
        receipts.push(this.receipt({
          kind: 'skill-draft',
          candidate,
          path: draftPath,
          summary: `Skill draft materialized for review: ${draft.title}`,
          createdAt,
          reversible: true,
        }));
      }
    }

    this.appendReceiptLog(receipts);
    return {
      mode: this.policy.mode,
      appliedPreferences,
      draftedSkills,
      blocked,
      receipts,
      preferenceStorePath: this.preferenceStorePath,
      skillDraftRoot: this.skillDraftRoot,
    };
  }

  public listTrustedPreferences(): PreferenceRecord[] {
    return this.readPreferenceStore().preferences.slice();
  }

  public removePreference(id: string): { ok: boolean; summary: string; removedId: string | null } {
    const target = String(id || '').trim();
    if (!target) return { ok: false, summary: 'Id de preferencia ausente.', removedId: null };
    const store = this.readPreferenceStore();
    const match = store.preferences.find((entry) => entry.id === target || entry.candidateId === target);
    if (!match) return { ok: false, summary: `Preferencia nao encontrada: ${target}`, removedId: null };
    const next: PreferenceStore = {
      version: 2,
      userId: this.userId,
      updatedAt: this.now().toISOString(),
      preferences: store.preferences.filter((entry) => entry.id !== match.id),
    };
    this.atomicWriteJson(this.preferenceStorePath, next);
    return { ok: true, summary: `Preferencia removida: ${match.summary}`, removedId: match.id };
  }

  public removeSkillDraft(id: string): { ok: boolean; summary: string; removedId: string | null } {
    const target = path.basename(String(id || '').trim());
    if (!target || target === '.' || target === '..') {
      return { ok: false, summary: 'Id de rascunho ausente ou invalido.', removedId: null };
    }
    if (!this.existsSync(this.skillDraftRoot)) {
      return { ok: false, summary: `Rascunho nao encontrado: ${target}`, removedId: null };
    }
    const dirs = fs.readdirSync(this.skillDraftRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());
    for (const dir of dirs) {
      const full = path.join(this.skillDraftRoot, dir.name);
      const resolved = path.resolve(full);
      if (!resolved.startsWith(path.resolve(this.skillDraftRoot) + path.sep)) continue;
      if (dir.name === target) {
        fs.rmSync(resolved, { recursive: true, force: true });
        return { ok: true, summary: `Rascunho removido: ${dir.name}`, removedId: dir.name };
      }
      try {
        const meta = JSON.parse(this.readFileSync(path.join(resolved, 'draft.meta.json'), 'utf8')) as {
          candidateId?: string;
          draftId?: string;
        };
        if (meta.candidateId === target || meta.draftId === target) {
          fs.rmSync(resolved, { recursive: true, force: true });
          return { ok: true, summary: `Rascunho removido: ${dir.name}`, removedId: meta.candidateId || dir.name };
        }
      } catch {
      }
    }
    return { ok: false, summary: `Rascunho nao encontrado: ${target}`, removedId: null };
  }

  public listSkillDrafts(): Array<{ id: string; title: string; path: string; createdAt: string }> {
    if (!this.existsSync(this.skillDraftRoot)) return [];
    const out: Array<{ id: string; title: string; path: string; createdAt: string }> = [];
    for (const name of fs.readdirSync(this.skillDraftRoot)) {
      const full = path.join(this.skillDraftRoot, name);
      try {
        if (!fs.statSync(full).isDirectory()) continue;
        const metaPath = path.join(full, 'draft.meta.json');
        const meta = this.existsSync(metaPath)
          ? JSON.parse(this.readFileSync(metaPath, 'utf8')) as { title?: string; createdAt?: string; candidateId?: string }
          : {};
        out.push({
          id: meta.candidateId || name,
          title: meta.title || name,
          path: full,
          createdAt: meta.createdAt || '',
        });
      } catch {
        // skip
      }
    }
    return out;
  }

  private persistPreference(
    candidate: ZavorthExperienceLearningCandidate,
    sourceSurface: string,
    createdAt: string,
  ): PreferenceRecord {
    const store = this.readPreferenceStore();
    const summary = redactSensitiveText(candidate.summary)
      .replace(/\b\d{6,12}:[A-Za-z0-9_-]{20,}\b/g, '[REDACTED_SECRET]')
      .slice(0, 500);
    const existing = store.preferences.find((entry) => entry.candidateId === candidate.candidateId);
    const record: PreferenceRecord = existing
      ? {
          ...existing,
          summary,
          evidenceRefs: candidate.evidenceRefs.slice(),
          confidence: candidate.confidence,
          expiry: candidate.expiry,
          receiptId: candidate.receiptId,
          createdAt: existing.createdAt,
          sourceSurface,
        }
      : {
          id: stablePreferenceId(candidate.candidateId),
          candidateId: candidate.candidateId,
          summary,
          evidenceRefs: candidate.evidenceRefs.slice(),
          confidence: candidate.confidence,
          expiry: candidate.expiry,
          receiptId: candidate.receiptId,
          createdAt,
          sourceSurface,
          reversible: true,
        };

    const next: PreferenceStore = {
      version: 2,
      userId: this.userId,
      updatedAt: createdAt,
      preferences: [
        { ...record, userId: this.userId },
        ...store.preferences.filter((entry) => entry.candidateId !== candidate.candidateId),
      ].slice(0, 500),
    };
    this.atomicWriteJson(this.preferenceStorePath, next);
    return record;
  }

  private materializeSkillDraft(
    draft: ZavorthSkillForgeDraft,
    candidate: ZavorthExperienceLearningCandidate,
    createdAt: string,
  ): string {
    const safeName = draft.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'skill-draft';
    const dir = path.join(this.skillDraftRoot, `${safeName}-${candidate.candidateId.slice(0, 12)}`);
    this.mkdirSync(dir, { recursive: true });
    const skillMd = [
      '---',
      `name: ${safeName}`,
      'source: zavorth-autonomous-learning',
      `draftId: ${draft.draftId}`,
      `candidateId: ${candidate.candidateId}`,
      `risk: ${draft.risk}`,
      'status: draft',
      `createdAt: ${createdAt}`,
      'installBlocked: true',
      '---',
      '',
      draft.preview.skillBody,
      '',
      '## Evidence',
      ...candidate.evidenceRefs.map((ref) => `- ${ref}`),
      '',
      '## Gates remaining',
      ...draft.preview.tests.map((test) => `- ${test}`),
      '',
      'This draft is not installed into skill-library. Promotion requires approval and smoke.',
      '',
    ].join('\n');
    const meta = {
      draftId: draft.draftId,
      candidateId: candidate.candidateId,
      title: draft.title,
      risk: draft.risk,
      approvalRequired: true,
      materialized: true,
      installed: false,
      createdAt,
      preview: draft.preview,
    };
    this.atomicWriteText(path.join(dir, 'SKILL.md'), skillMd);
    this.atomicWriteJson(path.join(dir, 'draft.meta.json'), meta);
    return dir;
  }

  private findMatchingDraft(
    skillForge: ZavorthSkillForgeRuntimeSnapshot | null | undefined,
  ): ZavorthSkillForgeDraft | null {
    if (!skillForge?.drafts?.length) return null;
    return skillForge.drafts.find((draft) => draft.status === 'draft') || skillForge.drafts[0] || null;
  }

  private syntheticDraft(
    candidate: ZavorthExperienceLearningCandidate,
    sourceSurface: string,
  ): ZavorthSkillForgeDraft {
    const title = candidate.kind === 'procedure' ? 'Procedure Draft' : 'Workflow Skill Draft';
    return {
      draftId: `skill-draft-${candidate.candidateId}`,
      title,
      status: 'draft',
      materialized: false,
      approvalRequired: true,
      smokeRequired: true,
      rollbackAvailable: true,
      risk: 'medium',
      evidenceRefs: candidate.evidenceRefs.slice(),
      preview: {
        manifest: JSON.stringify({
          name: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          source: 'zavorth-autonomous-learning',
          sourceSurface,
          installBlocked: true,
        }, null, 2),
        skillBody: [
          `# ${title}`,
          '',
          redactSensitiveText(candidate.summary),
          '',
          'Generated as a reviewable draft. Not installed.',
        ].join('\n'),
        tests: ['static-risk-scan', 'non-destructive-smoke', 'rollback-proof'],
      },
    };
  }

  private receipt(input: {
    kind: AutonomousLearningReceipt['kind'];
    candidate: ZavorthExperienceLearningCandidate;
    path: string | null;
    summary: string;
    createdAt: string;
    reversible: boolean;
  }): AutonomousLearningReceipt {
    return {
      id: `lr-${crypto.createHash('sha256').update(`${input.candidate.candidateId}:${input.kind}:${input.createdAt}`).digest('hex').slice(0, 16)}`,
      kind: input.kind,
      candidateId: input.candidate.candidateId,
      lane: input.candidate.lane,
      path: input.path,
      summary: input.summary,
      createdAt: input.createdAt,
      reversible: input.reversible,
    };
  }

  private appendReceiptLog(receipts: AutonomousLearningReceipt[]): void {
    if (!receipts.length) return;
    this.mkdirSync(path.dirname(this.receiptLogPath), { recursive: true });
    const lines = receipts.map((receipt) => JSON.stringify(receipt)).join('\n');
    this.appendFileSync(this.receiptLogPath, `${lines}\n`, 'utf8');
  }

  private readPreferenceStore(): PreferenceStore {
    const empty: PreferenceStore = {
      version: 2,
      userId: this.userId,
      updatedAt: this.now().toISOString(),
      preferences: [],
    };
    try {
      if (this.existsSync(this.preferenceStorePath)) {
        const parsed = JSON.parse(this.readFileSync(this.preferenceStorePath, 'utf8')) as PreferenceStore;
        if (parsed && Array.isArray(parsed.preferences)) {
          return {
            version: 2,
            userId: this.userId,
            updatedAt: parsed.updatedAt || this.now().toISOString(),
            preferences: parsed.preferences,
          };
        }
      }
      // Legacy host-global store (pre user-scope): only for local-user bootstrap.
      const legacyPath = path.join(this.projectRoot, 'data', 'runtime', 'learning', 'trusted-preferences.json');
      if (this.userId === 'local-user' && this.existsSync(legacyPath)) {
        const legacy = JSON.parse(this.readFileSync(legacyPath, 'utf8')) as PreferenceStore;
        if (legacy && Array.isArray(legacy.preferences)) {
          return {
            version: 2,
            userId: this.userId,
            updatedAt: legacy.updatedAt || this.now().toISOString(),
            preferences: legacy.preferences.map((entry) => ({ ...entry, userId: this.userId })),
          };
        }
      }
      return empty;
    } catch {
      return empty;
    }
  }

  private atomicWriteJson(filePath: string, value: unknown): void {
    this.atomicWriteText(filePath, `${JSON.stringify(value, null, 2)}\n`);
  }

  private atomicWriteText(filePath: string, content: string): void {
    this.mkdirSync(path.dirname(filePath), { recursive: true });
    const temp = `${filePath}.${process.pid}.tmp`;
    this.writeFileSync(temp, content, 'utf8');
    this.renameSync(temp, filePath);
  }
}

function stablePreferenceId(candidateId: string): string {
  return `pref-${crypto.createHash('sha256').update(candidateId).digest('hex').slice(0, 16)}`;
}
