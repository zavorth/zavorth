/**
 * Yellow-lane promote path for shadow skills / procedures.
 * Green auto-prefs stay in Adaptive Learning OS; this service owns staged digests
 * and one-tap promotion with consent.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import type {
  LearningPromoteCandidate,
  LearningPromoteKind,
  LearningPromoteReceipt,
} from '../../contracts/UniversalPowerFabricContract.js';

type Runtime = {
  storeDir?: string;
  now?: () => Date;
  existsSync?: typeof fs.existsSync;
  mkdirSync?: typeof fs.mkdirSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
};

type Store = {
  version: 1;
  candidates: LearningPromoteCandidate[];
};

export class LearningPromoteService {
  private readonly storeFile: string;
  private readonly now: () => Date;
  private readonly existsSync: typeof fs.existsSync;
  private readonly mkdirSync: typeof fs.mkdirSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly writeFileSync: typeof fs.writeFileSync;

  constructor(runtime: Runtime = {}) {
    const dir = path.resolve(runtime.storeDir || path.join(process.cwd(), '.zavorth', 'learning-promote'));
    this.storeFile = path.join(dir, 'candidates.json');
    this.now = runtime.now || (() => new Date());
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.mkdirSync = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSync = runtime.writeFileSync || fs.writeFileSync.bind(fs);
  }

  public list(status: LearningPromoteCandidate['status'] | 'all' = 'staged'): LearningPromoteCandidate[] {
    const store = this.load();
    if (status === 'all') return store.candidates;
    return store.candidates.filter((c) => c.status === status);
  }

  public stage(input: {
    kind: LearningPromoteKind;
    title: string;
    summary: string;
    evidenceRefs?: string[];
    lane?: 'green' | 'yellow' | 'red';
  }): { candidate: LearningPromoteCandidate; receipt: LearningPromoteReceipt } {
    const store = this.load();
    const candidate: LearningPromoteCandidate = {
      id: `learn_${crypto.randomBytes(6).toString('hex')}`,
      kind: input.kind,
      lane: input.lane || 'yellow',
      title: String(input.title || input.kind).slice(0, 120),
      summary: String(input.summary || '').slice(0, 2000),
      evidenceRefs: (input.evidenceRefs || []).slice(0, 20),
      status: 'staged',
      createdAt: this.now().toISOString(),
      promotedAt: null,
    };
    store.candidates.unshift(candidate);
    store.candidates = store.candidates.slice(0, 200);
    this.save(store);
    return {
      candidate,
      receipt: this.receipt('observe', candidate.id, 'pass', `Staged ${candidate.kind} candidate for Yellow digest.`),
    };
  }

  public previewPromote(candidateId: string): {
    candidate: LearningPromoteCandidate | null;
    receipt: LearningPromoteReceipt;
  } {
    const candidate = this.load().candidates.find((c) => c.id === candidateId) || null;
    if (!candidate) {
      return {
        candidate: null,
        receipt: this.receipt('deny', null, 'deny', `Unknown candidate: ${candidateId}`),
      };
    }
    return {
      candidate,
      receipt: this.receipt('preview', candidate.id, 'preview', `Preview promote ${candidate.kind}: ${candidate.title}`),
    };
  }

  public promote(candidateId: string, consent: boolean): {
    candidate: LearningPromoteCandidate | null;
    receipt: LearningPromoteReceipt;
    materialPath: string | null;
  } {
    if (!consent) {
      return {
        candidate: null,
        materialPath: null,
        receipt: this.receipt('deny', candidateId, 'deny', 'Promotion requires explicit consent.'),
      };
    }
    const store = this.load();
    const idx = store.candidates.findIndex((c) => c.id === candidateId);
    if (idx < 0) {
      return {
        candidate: null,
        materialPath: null,
        receipt: this.receipt('deny', candidateId, 'deny', `Unknown candidate: ${candidateId}`),
      };
    }
    const candidate = store.candidates[idx];
    if (candidate.lane === 'red') {
      return {
        candidate,
        materialPath: null,
        receipt: this.receipt('deny', candidate.id, 'deny', 'Red-lane candidates cannot be promoted.'),
      };
    }
    if (candidate.status === 'promoted') {
      return {
        candidate,
        materialPath: null,
        receipt: this.receipt('promote', candidate.id, 'pass', 'Candidate already promoted.'),
      };
    }

    const dir = path.dirname(this.storeFile);
    const materialDir = path.join(dir, 'promoted', candidate.id);
    this.mkdirSync(materialDir, { recursive: true });
    const materialPath = path.join(materialDir, candidate.kind === 'shadow-skill' ? 'SKILL.md' : 'PROCEDURE.md');
    const body = [
      '---',
      `name: ${candidate.title}`,
      `kind: ${candidate.kind}`,
      `promotedAt: ${this.now().toISOString()}`,
      'source: zavorth-learning-promote',
      '---',
      '',
      `# ${candidate.title}`,
      '',
      candidate.summary,
      '',
      '## Evidence',
      ...candidate.evidenceRefs.map((e) => `- ${e}`),
      '',
      '_Promoted from Yellow digest with explicit consent. Review before broad enable._',
      '',
    ].join('\n');
    this.writeFileSync(materialPath, body, 'utf8');

    candidate.status = 'promoted';
    candidate.promotedAt = this.now().toISOString();
    store.candidates[idx] = candidate;
    this.save(store);

    return {
      candidate,
      materialPath,
      receipt: this.receipt('promote', candidate.id, 'pass', `Promoted ${candidate.kind} to ${materialPath}`),
    };
  }

  public deny(candidateId: string, reason?: string): LearningPromoteReceipt {
    const store = this.load();
    const idx = store.candidates.findIndex((c) => c.id === candidateId);
    if (idx < 0) return this.receipt('deny', candidateId, 'deny', `Unknown candidate: ${candidateId}`);
    store.candidates[idx] = { ...store.candidates[idx], status: 'denied' };
    this.save(store);
    return this.receipt('deny', candidateId, 'deny', reason || 'Candidate denied by operator.');
  }

  private load(): Store {
    if (!this.existsSync(this.storeFile)) return { version: 1, candidates: [] };
    try {
      const parsed = JSON.parse(this.readFileSync(this.storeFile, 'utf8')) as Store;
      return {
        version: 1,
        candidates: Array.isArray(parsed.candidates) ? parsed.candidates : [],
      };
    } catch {
      return { version: 1, candidates: [] };
    }
  }

  private save(store: Store): void {
    this.mkdirSync(path.dirname(this.storeFile), { recursive: true });
    this.writeFileSync(this.storeFile, JSON.stringify(store, null, 2), 'utf8');
  }

  private receipt(
    kind: LearningPromoteReceipt['kind'],
    candidateId: string | null,
    status: LearningPromoteReceipt['status'],
    summary: string,
  ): LearningPromoteReceipt {
    return {
      id: `rcpt_${crypto.randomBytes(6).toString('hex')}`,
      kind,
      candidateId,
      status,
      summary,
      createdAt: this.now().toISOString(),
      rawSecretsSerialized: false,
    };
  }
}
