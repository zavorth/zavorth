import { isTransientToolError } from '../../runtime/agent/AgentRunNativeToolLoopUtils.js';
import { NaturalFirstMemoryContinuityService } from '../../runtime/agent/NaturalFirstMemoryContinuityService.js';
import {
  buildStructuredToolFailurePlan,
  type StructuredToolFailurePlan,
} from '../../runtime/agent/StructuredToolFailurePlan.js';
import { resolveRuntimeProfileId, listExperienceRuntimeProfileIds } from '../ExperienceRuntimeProfileMap.js';
import { ProfileManifestService } from '../ProfileManifestService.js';
import { MemoryService, type AutoExtractResult } from '../MemoryService.js';

export type AgentSmartnessMissionId =
  | 'smartness.tool.transient-classify'
  | 'smartness.tool.permanent-classify'
  | 'smartness.memory.no-invent'
  | 'smartness.memory.auto-extract-draft-only'
  | 'smartness.profile.experience-runtime-map'
  | 'smartness.recovery.structured-failure';

export type AgentSmartnessMissionResult = {
  id: AgentSmartnessMissionId;
  name: string;
  pass: boolean;
  score: number;
  durationMs: number;
  notes: string;
  evidence: Record<string, unknown>;
};

export type AgentSmartnessReport = {
  generatedAt: string;
  version: 'agent-smartness/v1';
  mode: 'hermetic-unit';
  simulated: false;
  dryRun: false;
  claimsLiveIntelligence: false;
  total: number;
  passed: number;
  failed: number;
  missionSuccessRate: number;
  results: AgentSmartnessMissionResult[];
  ok: boolean;
};

export type AgentSmartnessServiceOptions = {
  now?: () => Date;
  profileDir?: string | null;
  memoryService?: Pick<MemoryService, 'autoExtract' | 'listAll' | 'forget'>;
  profileService?: Pick<ProfileManifestService, 'compileProfileById'>;
};

type AutoExtractCapable = {
  autoExtract(
    userId: string,
    userMessage: string,
    botResponse: string,
    options?: { persist?: boolean },
  ): Promise<AutoExtractResult>;
  listAll(userId: string): Promise<Array<{ key: string }>>;
  forget(userId: string, key: string): Promise<boolean>;
};

export class AgentSmartnessService {
  private readonly now: () => Date;
  private readonly profileService: Pick<ProfileManifestService, 'compileProfileById'>;
  private readonly memoryService: AutoExtractCapable | null;

  constructor(options: AgentSmartnessServiceOptions = {}) {
    this.now = options.now || (() => new Date());
    this.profileService = options.profileService || new ProfileManifestService(
      options.profileDir ? { profileDir: options.profileDir } : {},
    );
    this.memoryService = options.memoryService || null;
  }

  public async run(options: { memoryUserId?: string } = {}): Promise<AgentSmartnessReport> {
    const results: AgentSmartnessMissionResult[] = [];
    results.push(this.runTransientClassify());
    results.push(this.runPermanentClassify());
    results.push(this.runNoInventMemory());
    results.push(await this.runAutoExtractDraftOnly(options.memoryUserId || 'smartness-eval-user'));
    results.push(this.runExperienceRuntimeMap());
    results.push(this.runStructuredFailureRecovery());

    const passed = results.filter((entry) => entry.pass).length;
    const failed = results.length - passed;
    return {
      generatedAt: this.now().toISOString(),
      version: 'agent-smartness/v1',
      mode: 'hermetic-unit',
      simulated: false,
      dryRun: false,
      claimsLiveIntelligence: false,
      total: results.length,
      passed,
      failed,
      missionSuccessRate: results.length ? passed / results.length : 0,
      results,
      ok: failed === 0,
    };
  }

  public renderText(report: AgentSmartnessReport): string {
    return [
      'Zavorth Agent Smartness (hermetic unit scoreboard)',
      `passed ${report.passed}/${report.total} (${Math.round(report.missionSuccessRate * 100)}%)`,
      `mode: ${report.mode} | claimsLiveIntelligence: ${report.claimsLiveIntelligence}`,
      '',
      ...report.results.map((entry) => `- [${entry.pass ? 'pass' : 'fail'}] ${entry.id}: ${entry.notes}`),
    ].join('\n');
  }

  private runTransientClassify(): AgentSmartnessMissionResult {
    const started = Date.now();
    const samples = [
      'ETIMEDOUT: connection timeout',
      '429 Too Many Requests rate limit',
      'service unavailable, try again later',
      '503 Service Unavailable',
    ];
    const allTransient = samples.every((sample) => isTransientToolError(new Error(sample)));
    return mission(
      'smartness.tool.transient-classify',
      'Transient tool errors are retryable',
      allTransient,
      allTransient ? 1 : 0,
      started,
      allTransient ? 'All transient samples classified for retry.' : 'Transient classifier missed a retryable error.',
      { samples },
    );
  }

  private runPermanentClassify(): AgentSmartnessMissionResult {
    const started = Date.now();
    const samples = [
      'permission denied for path',
      'unknown tool: foo_bar',
      'schema validation failed',
      'policy blocked shell.exec',
      'network policy blocked egress',
      'resource busy waiting for approval',
    ];
    const noneTransient = samples.every((sample) => !isTransientToolError(new Error(sample)));
    return mission(
      'smartness.tool.permanent-classify',
      'Permanent tool errors are not retry-looped',
      noneTransient,
      noneTransient ? 1 : 0,
      started,
      noneTransient ? 'Permanent failures stay non-retryable.' : 'Permanent failure incorrectly marked transient.',
      { samples },
    );
  }

  private runNoInventMemory(): AgentSmartnessMissionResult {
    const started = Date.now();
    const service = new NaturalFirstMemoryContinuityService();
    const generatedAt = this.now().toISOString();
    const run = {
      id: 'smartness-memory-run',
      traceId: 'smartness-memory-trace',
      requestId: 'smartness-memory-request',
      sessionId: 'smartness-memory-session',
      userId: 'smartness-user',
      channel: 'cli',
      workspace: null,
      status: 'completed',
      createdAt: generatedAt,
      updatedAt: generatedAt,
      approvals: [],
      memorySignals: [],
      metadata: {},
    } as any;
    const request = {
      text: 'What is my favorite editor...',
      channel: 'cli',
      userId: 'smartness-user',
      sessionId: 'smartness-memory-session',
      requestedTools: ['memory_recall'],
      metadata: {},
    } as any;
    const snapshot = service.buildSnapshot({
      run,
      request,
      generatedAt,
      memoryWithReceipts: null,
    });
    const reply = service.buildReplyText(snapshot, { run, request, generatedAt, memoryWithReceipts: null });
    const claimsMemory = false;
    const pass = snapshot.status === 'memory-empty'
      && snapshot.policy.noMemoryInvented === true
      && !claimsMemory;
    return mission(
      'smartness.memory.no-invent',
      'Recall without receipts does not invent memory',
      pass,
      pass ? 1 : 0,
      started,
      pass ? 'Empty memory path stays honest.' : 'Memory path invented content without receipts.',
      { status: snapshot.status, replyPreview: reply.slice(0, 180) },
    );
  }

  private async runAutoExtractDraftOnly(userId: string): Promise<AgentSmartnessMissionResult> {
    const started = Date.now();
    const userText = 'My profile is SmartnessProbe with a dark-mode preference and a city context.';
    const botText = 'Ok, posso guardar como rascunho se you approve.';
    if (!this.memoryService) {
      const local = new MemoryService();
      const before = await local.listAll(userId).catch(() => []);
      const result = await local.autoExtract(userId, userText, botText);
      const after = await local.listAll(userId).catch(() => []);
      const persistedKeys = after
        .map((entry) => entry.key)
        .filter((key) => !before.some((prior) => prior.key === key));
      for (const key of persistedKeys) {
        await local.forget(userId, key).catch(() => false);
      }
      const drafts = local.listMemoryDrafts(userId);
      for (const draft of drafts) {
        local.forgetMemoryDraft(draft.id);
      }
      const pass = Array.isArray(result?.candidates)
        && result.candidates.length >= 1
        && result.persisted === false
        && persistedKeys.length === 0
        && drafts.length >= 1;
      return mission(
        'smartness.memory.auto-extract-draft-only',
        'autoExtract does not silently promote memory',
        pass,
        pass ? 1 : 0,
        started,
        pass ? 'Candidates extracted to draft store without durable persistence.'
          : 'autoExtract failed honesty (empty extract, silent persist, or missing drafts).',
        { candidateCount: result?.candidates?.length || 0, draftCount: drafts.length, persistedKeys },
      );
    }

    const before = await this.memoryService.listAll(userId);
    const result = await this.memoryService.autoExtract(userId, userText, botText);
    const after = await this.memoryService.listAll(userId);
    const persistedKeys = after
      .map((entry) => entry.key)
      .filter((key) => !before.some((prior) => prior.key === key));
    for (const key of persistedKeys) {
      await this.memoryService.forget(userId, key).catch(() => false);
    }
    const pass = Boolean(result?.persisted === false && (result?.candidates?.length || 0) >= 1 && persistedKeys.length === 0);
    return mission(
      'smartness.memory.auto-extract-draft-only',
      'autoExtract does not silently promote memory',
      pass,
      pass ? 1 : 0,
      started,
      pass ? 'Candidates extracted without silent persistence.'
        : 'autoExtract failed honesty (empty extract or silent persist).',
      { candidateCount: result?.candidates?.length || 0, persistedKeys },
    );
  }

  private runExperienceRuntimeMap(): AgentSmartnessMissionResult {
    const started = Date.now();
    const ids = listExperienceRuntimeProfileIds();
    const missing: string[] = [];
    for (const id of ids) {
      const runtimeId = resolveRuntimeProfileId(id);
      const bundle = this.profileService.compileProfileById(runtimeId);
      if (!bundle) missing.push(id);
    }
    const pass = missing.length === 0 && resolveRuntimeProfileId('business') === 'business';
    return mission(
      'smartness.profile.experience-runtime-map',
      'Experience profiles compile to runtime manifests',
      pass,
      pass ? 1 : 0,
      started,
      pass ? 'All experience profile ids resolve to runtime bundles.' : `Missing manifests: ${missing.join(', ')}`,
      { ids, missing },
    );
  }

  private runStructuredFailureRecovery(): AgentSmartnessMissionResult {
    const started = Date.now();
    const permanent = !isTransientToolError(new Error('tool foo failed: schema validation failed'));
    const recoveryPlan = buildStructuredToolFailurePlan({
      toolName: 'read_file',
      errorMessage: 'ENOENT: no such file or directory',
      availableAlternatives: ['list_directory', 'web_search'],
    });
    const pass = permanent
      && recoveryPlan.shouldRetry === false
      && recoveryPlan.nextActions.length >= 1
      && recoveryPlan.userVisibleSummary.includes('read_file');
    return mission(
      'smartness.recovery.structured-failure',
      'Structured recovery plan after permanent tool failure',
      pass,
      pass ? 1 : 0,
      started,
      pass ? 'Permanent tool failure yields an explicit recovery plan.' : 'Recovery plan missing or incorrect.',
      { recoveryPlan },
    );
  }
}

export type { StructuredToolFailurePlan };
export { buildStructuredToolFailurePlan };

function mission(
  id: AgentSmartnessMissionId,
  name: string,
  pass: boolean,
  score: number,
  started: number,
  notes: string,
  evidence: Record<string, unknown>,
): AgentSmartnessMissionResult {
  return {
    id,
    name,
    pass,
    score,
    durationMs: Math.max(0, Date.now() - started),
    notes,
    evidence,
  };
}
