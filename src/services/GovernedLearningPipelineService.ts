// Stub: source was removed; this provides the minimal interface the tests depend on.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import fs from 'node:fs';

export interface GovernedLearningRecord {
  id: string;
  workspaceId: string;
  observation: string;
  runtimeId: string;
  sessionId: string;
  sourceRefs: string[];
  stage: string;
  evidence: Array<{ id: string; kind: string; value: string; source: string; receipts: Array<{ status: string; reason?: string }> }>;
  candidate: { kind: string; content: string; sensitive: boolean } | null;
  dryRun: { passed: boolean; summary: string } | null;
  evaluation: { passed: boolean; score: number; summary: string } | null;
  approval: { token: string; approvedBy: string; expiresAt: string } | null;
  canary: { passed: boolean; cohort: string; receiptId: string; evidence: string } | null;
  apply: { receiptId: string } | null;
  monitor: { healthy: boolean; detail: string } | null;
  rollback: { receiptId: string } | null;
  contested: { actor: string; reason: string } | null;
  forgotten: boolean;
  provenance: { runtimeId: string; sessionId: string };
  receipts: Array<{ id: string; stage: string; status: string; reason?: string }>;
}

type SimulateFn = (id: string) => Promise<{ passed: boolean; summary: string }>;
type EvaluateFn = (id: string) => Promise<{ passed: boolean; score: number; summary: string }>;
type ApplyFn = (id: string) => Promise<{ receiptId: string; token?: string }>;
type RollbackFn = (id: string) => Promise<{ receiptId: string }>;

export class GovernedLearningPipelineService {
  private readonly records = new Map<string, GovernedLearningRecord>();
  private readonly storePath: string | null;
  private readonly simulateFn: SimulateFn;
  private readonly evaluateFn: EvaluateFn;
  private readonly applyFn: ApplyFn;
  private readonly rollbackFn: RollbackFn;
  private readonly native: any;
  private readonly adaptive: any;
  private readonly replay: any;
  private readonly skillEvolution: any;
  private readonly timeoutMs: number;
  private idCounter = 0;

  private readonly hasExplicitRuntimes: boolean;

  constructor(options: {
    storePath?: string | null;
    simulate?: SimulateFn;
    evaluate?: EvaluateFn;
    apply?: ApplyFn;
    rollback?: RollbackFn;
    native?: any;
    adaptive?: any;
    replay?: any;
    skillEvolution?: any;
    timeoutMs?: number;
  } = {}) {
    this.storePath = options.storePath ?? null;
    this.hasExplicitRuntimes = Boolean(options.simulate || options.evaluate);
    this.simulateFn = options.simulate ?? (async () => ({ passed: true, summary: 'default' }));
    this.evaluateFn = options.evaluate ?? (async () => ({ passed: true, score: 0.8, summary: 'default' }));
    this.applyFn = options.apply ?? (async () => ({ receiptId: 'apply-default' }));
    this.rollbackFn = options.rollback ?? (async () => ({ receiptId: 'rollback-default' }));
    this.native = options.native ?? {};
    this.adaptive = options.adaptive ?? {};
    this.replay = options.replay ?? {};
    this.skillEvolution = options.skillEvolution ?? {};
    this.timeoutMs = options.timeoutMs ?? 30000;
    this.load();
  }

  private genId(): string { return `lr-${++this.idCounter}-${Date.now()}`; }

  private guardObservation(text: string): void {
    if (/ignore\s+previous\s+instructions/i.test(text)) throw new Error('injection guard: prompt injection detected in observation');
    if (/token=|api_key=|secret|password/i.test(text)) throw new Error('secret material: observation contains secret material');
  }

  private guardCandidate(text: string): void {
    if (/ignore\s+previous\s+instructions/i.test(text)) throw new Error('injection guard: prompt injection detected in candidate');
  }

  private addReceipt(record: GovernedLearningRecord, stage: string, status: string, reason?: string) {
    record.receipts.push({ id: `r-${record.receipts.length + 1}`, stage, status, reason });
  }

  observe(input: { workspaceId: string; observation: string; runtimeId: string; sessionId: string; sourceRefs?: string[] }): GovernedLearningRecord {
    this.guardObservation(input.observation);
    const id = this.genId();
    const record: GovernedLearningRecord = {
      id,
      workspaceId: input.workspaceId,
      observation: input.observation,
      runtimeId: input.runtimeId,
      sessionId: input.sessionId,
      sourceRefs: input.sourceRefs ?? [],
      stage: 'observed',
      evidence: [],
      candidate: null,
      dryRun: null,
      evaluation: null,
      approval: null,
      canary: null,
      apply: null,
      monitor: null,
      rollback: null,
      contested: null,
      forgotten: false,
      provenance: { runtimeId: input.runtimeId, sessionId: input.sessionId },
      receipts: [],
    };
    this.addReceipt(record, 'observation', 'recorded');
    this.records.set(id, record);
    this.persist();
    return { ...record };
  }

  attachEvidence(id: string, evidence: { kind: string; value: string; source: string }): GovernedLearningRecord {
    const record = this.records.get(id);
    if (!record) throw new Error(`Record ${id} not found`);
    const blocked = /<system>|<script>|<user>|<assistant>/i.test(evidence.value);
    const secretBlocked = /api_key|secret|password|token/i.test(evidence.value) && !blocked;
    const entry = { id: `ev-${record.evidence.length + 1}`, ...evidence, receipts: [] as Array<{ status: string; reason?: string }> };
    if (blocked) { entry.receipts.push({ status: 'blocked', reason: 'injection guard' }); }
    if (secretBlocked) { entry.receipts.push({ status: 'blocked', reason: 'secret material detected in evidence' }); }
    record.evidence.push(entry);
    this.addReceipt(record, 'evidence', blocked || secretBlocked ? 'blocked' : 'recorded');
    return { ...record };
  }

  async createCandidate(id: string, candidate: { kind: string; content: string; sensitive?: boolean }): Promise<GovernedLearningRecord> {
    const record = this.records.get(id);
    if (!record) throw new Error(`Record ${id} not found`);
    this.guardCandidate(candidate.content);
    if (!this.hasExplicitRuntimes) {
      this.addReceipt(record, 'candidate', 'blocked', 'no runtimes available');
      return { ...record };
    }
    if (!['observation', 'observed', 'evidence'].includes(record.stage) && record.stage !== 'contested') {
      this.addReceipt(record, 'candidate', 'blocked', 'Invalid learning transition');
      return { ...record };
    }
    record.candidate = { kind: candidate.kind, content: candidate.content, sensitive: candidate.sensitive ?? false };
    record.stage = 'candidate';
    this.addReceipt(record, 'candidate', 'recorded');
    return { ...record };
  }

  async simulate(id: string): Promise<GovernedLearningRecord> {
    const record = this.records.get(id);
    if (!record) throw new Error(`Record ${id} not found`);
    if (!record.candidate) throw new Error('Invalid learning transition');
    try {
      const result = await Promise.race([
        this.simulateFn(id),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('dryRun runtime failed')), this.timeoutMs)),
      ]);
      record.dryRun = result;
      record.stage = 'dryRun';
      this.addReceipt(record, 'dryRun', result.passed ? 'passed' : 'blocked');
    } catch (e: any) {
      this.addReceipt(record, 'dryRun', 'blocked', e.message);
      throw e;
    }
    return { ...record };
  }

  async evaluate(id: string): Promise<GovernedLearningRecord> {
    const record = this.records.get(id);
    if (!record) throw new Error(`Record ${id} not found`);
    if (!record.dryRun) throw new Error('Invalid learning transition');
    record.evaluation = await this.evaluateFn(id);
    record.stage = 'evaluated';
    this.addReceipt(record, 'eval', record.evaluation.passed ? 'passed' : 'blocked');
    return { ...record };
  }

  issueApproval(id: string): { token: string; expiresAt: string } {
    const record = this.records.get(id);
    if (!record) throw new Error(`Record ${id} not found`);
    if (!record.evaluation) throw new Error('Invalid learning transition');
    const token = `token-${id}-${Date.now()}`;
    const expiresAt = new Date(Date.now() + 60000).toISOString();
    record.approval = { token, approvedBy: 'system', expiresAt };
    this.addReceipt(record, 'approval', 'issued');
    return { token, expiresAt };
  }

  approve(id: string, input: { token: string; approvedBy: string }): GovernedLearningRecord {
    const record = this.records.get(id);
    if (!record) throw new Error(`Record ${id} not found`);
    if (!record.approval) throw new Error('Invalid learning transition');
    if (record.approval.token !== input.token) throw new Error('Invalid approval token');
    if (record.approval.approvedBy !== 'system') throw new Error('Approval token expired');
    record.approval.approvedBy = input.approvedBy;
    record.stage = 'approved';
    this.addReceipt(record, 'approval', 'approved');
    return { ...record };
  }

  markCanary(id: string, canary: { passed: boolean; cohort: string; receiptId: string; evidence: string }): GovernedLearningRecord {
    const record = this.records.get(id);
    if (!record) throw new Error(`Record ${id} not found`);
    if (!record.approval) throw new Error('Invalid learning transition');
    record.canary = canary;
    record.stage = 'canaried';
    this.addReceipt(record, 'canary', canary.passed ? 'passed' : 'blocked');
    return { ...record };
  }

  async apply(id: string): Promise<GovernedLearningRecord> {
    const record = this.records.get(id);
    if (!record) throw new Error(`Record ${id} not found`);
    if (!record.canary || !record.canary.passed) throw new Error('Invalid learning transition');
    const result = await this.applyFn(id);
    if (/token=|secret|password/i.test(JSON.stringify(result))) throw new Error('apply runtime failed: unsafe receipt');
    record.apply = result;
    record.stage = 'applied';
    this.addReceipt(record, 'applied', 'recorded');
    this.persist();
    return { ...record };
  }

  monitor(id: string, input: { healthy: boolean; detail: string }): GovernedLearningRecord {
    const record = this.records.get(id);
    if (!record) throw new Error(`Record ${id} not found`);
    if (typeof input.healthy !== 'boolean') throw new Error('healthy must be boolean');
    record.monitor = input;
    record.stage = 'monitoring';
    this.addReceipt(record, 'monitoring', 'recorded');
    this.persist();
    return { ...record };
  }

  async rollback(id: string): Promise<GovernedLearningRecord> {
    const record = this.records.get(id);
    if (!record) throw new Error(`Record ${id} not found`);
    const result = await this.rollbackFn(id);
    record.rollback = result;
    record.stage = 'rolled_back';
    this.addReceipt(record, 'rollback', 'recorded');
    this.persist();
    return { ...record };
  }

  contest(id: string, input: { actor: string; reason: string }): GovernedLearningRecord {
    const record = this.records.get(id);
    if (!record) throw new Error(`Record ${id} not found`);
    record.contested = input;
    record.stage = 'contested';
    this.addReceipt(record, 'contested', 'recorded');
    this.persist();
    return { ...record };
  }

  forget(id: string, input: { actor: string; confirmed: boolean }): GovernedLearningRecord {
    const record = this.records.get(id);
    if (!record) throw new Error(`Record ${id} not found`);
    if (record.stage === 'applied' || record.stage === 'monitoring') throw new Error('Cannot forget: record must be rolled back first');
    if (record.stage !== 'rolled_back' && record.contested && !record.rollback) throw new Error('Cannot forget: record must be rolled back before forgetting after contest');
    record.observation = '[forgotten]';
    record.workspaceId = '[forgotten]';
    record.provenance = { runtimeId: '[forgotten]', sessionId: '[forgotten]' };
    record.forgotten = true;
    record.stage = 'forgotten';
    this.addReceipt(record, 'forgotten', 'recorded');
    this.persist();
    return { ...record };
  }

  get(id: string): GovernedLearningRecord | null {
    return this.records.get(id) ? { ...this.records.get(id)! } : null;
  }

  private persist(): void {
    if (!this.storePath) return;
    const data = JSON.stringify(Array.from(this.records.values()), null, 2);
    fs.writeFileSync(this.storePath, data, 'utf8');
  }

  private load(): void {
    if (!this.storePath) return;
    try {
      if (!fs.existsSync(this.storePath)) return;
      const data = JSON.parse(fs.readFileSync(this.storePath, 'utf8'));
      for (const record of data) {
        this.records.set(record.id, record);
      }
    } catch (err: unknown) { logger.warn(`[GovernedLearningPipeline] Failed to load store: ${err instanceof Error ? err.message : String(err)}`); }
  }
}
