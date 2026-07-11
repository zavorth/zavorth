import fs from 'node:fs';
import type { Dirent } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { ZavorthMemoryPlaneService, ZavorthMemoryPlaneSnapshot } from './ZavorthMemoryPlaneService.js';
import type { ZavorthLayeredMemoryService, LayeredMemoryProcedureSnapshot } from './ZavorthLayeredMemoryService.js';
import type { ZavorthLearningPlaneService, LearningPlaneSnapshot } from './ZavorthLearningPlaneService.js';
import type { ZavorthTaskOperatingSystemService, ZavorthTaskOsSnapshot } from './ZavorthTaskOperatingSystemService.js';
import type { MemoryEntry, MemoryService } from './MemoryService.js';
import { logger } from '../logger.js';

export type ZavorthWorkspaceMemoryKind =
  | 'workspace_profile'
  | 'conversation_summary'
  | 'preference'
  | 'procedure'
  | 'task_reference'
  | 'artifact_reference'
  | 'follow_up';

export type ZavorthWorkspaceMemoryReviewEntry = {
  id: string;
  key: string;
  label: string;
  kind: ZavorthWorkspaceMemoryKind;
  layer: 'short' | 'long' | 'procedural';
  category: string;
  valuePreview: string;
  source: string;
  confidence: number;
  retention: {
    policy: string;
    ttlDays: number | null;
    reason: string;
  };
  redaction: {
    applied: boolean;
    reason: string | null;
  };
  actions: {
    forget: string | null;
    correct: string | null;
  };
};

export type ZavorthWorkspaceProfileSnapshot = {
  workspace: string | null;
  slug: string;
  stack: string[];
  buildCommands: string[];
  testCommands: string[];
  importantDirectories: string[];
  preferredExecutor: string | null;
  codeStyle: string[];
  architecturalDecisions: string[];
  repeatedFailures: string[];
};

export type ZavorthRecentTaskResolution = {
  taskId: string | null;
  state: string | null;
  workspace: string | null;
  executor: string | null;
  artifacts: string[];
  command: string | null;
  reason: string;
};

export type ZavorthConversationSummary = {
  conversation: string | null;
  sessionId: string | null;
  headline: string;
  recentTopics: string[];
  recentArtifacts: Array<{
    label: string;
    kind: string;
    command: string;
  }>;
};

export type ZavorthPreferenceLedgerSnapshot = {
  total: number;
  entries: ZavorthWorkspaceMemoryReviewEntry[];
  commands: {
    forget: string;
    correct: string;
  };
};

export type ZavorthWorkspaceMemoryOsSnapshot = {
  generatedAt: string;
  gate: 'workspace-memory-os';
  surface: 'workspace-memory-os';
  workspaceProfile: ZavorthWorkspaceProfileSnapshot;
  recentTaskResolver: ZavorthRecentTaskResolution;
  conversationSummary: ZavorthConversationSummary;
  preferenceLedger: ZavorthPreferenceLedgerSnapshot;
  review: {
    total: number;
    entries: ZavorthWorkspaceMemoryReviewEntry[];
  };
  retentionPolicy: Record<ZavorthWorkspaceMemoryKind, {
    ttlDays: number | null;
    defaultRemember: boolean;
    reason: string;
  }>;
  followUps: {
    examples: Array<{
      input: string;
      resolvesTo: string;
      command: string;
    }>;
  };
  contracts: {
    reviewShowsLearnedMemory: boolean;
    userCanForgetOrCorrect: boolean;
    workspaceCommandsReusable: boolean;
    followUpsResolveReferences: boolean;
    secretsRedactedByDefault: boolean;
    noRawLogDumpByDefault: boolean;
  };
  commands: {
    review: string;
    resolve: string;
    forget: string;
    correct: string;
  };
  narrative: {
    headline: string;
    operatorSummary: string;
  };
};

export type ZavorthFollowUpResolution = {
  generatedAt: string;
  gate: 'workspace-memory-os';
  surface: 'workspace-memory-resolution';
  input: string;
  intent: 'continue_task' | 'redeliver_artifact' | 'same_workspace' | 'memory_search';
  resolved: boolean;
  target: {
    taskId: string | null;
    workspace: string | null;
    artifactCommand: string | null;
    nextCommand: string | null;
  };
  evidence: string[];
  reason: string;
};

export type ZavorthMemoryReviewAction = 'forget' | 'correct';

export type ZavorthMemoryReviewActionResult = {
  generatedAt: string;
  gate: 'workspace-memory-os';
  surface: 'workspace-memory-action';
  action: ZavorthMemoryReviewAction;
  key: string;
  ok: boolean;
  status: 'applied' | 'blocked' | 'noop';
  summary: string;
  review: ZavorthWorkspaceMemoryOsSnapshot;
};

type MemoryPlaneLike = Pick<ZavorthMemoryPlaneService, 'buildSnapshot'>;
type LayeredMemoryLike = Pick<ZavorthLayeredMemoryService, 'buildStatus' | 'search' | 'readProcedures'>;
type LearningPlaneLike = Pick<ZavorthLearningPlaneService, 'buildSnapshot'>;
type TaskOsLike = Pick<ZavorthTaskOperatingSystemService, 'buildSnapshot'>;
type MemoryStoreLike =
  Pick<MemoryService, 'listAll'>
  & Partial<Pick<MemoryService, 'remember' | 'forget' | 'listRelevant'>>;

export type ZavorthWorkspaceMemoryOsInput = {
  userId?: string | null;
  platform?: string | null;
  chatId?: string | null;
  sessionId?: string | null;
  workspaceHint?: string | null;
  query?: string | null;
  limit?: number | null;
};

type ZavorthWorkspaceMemoryOsRuntime = {
  now?: () => Date;
  memoryPlaneService?: MemoryPlaneLike | null;
  layeredMemoryService?: LayeredMemoryLike | null;
  learningPlaneService?: LearningPlaneLike | null;
  taskOperatingSystemService?: TaskOsLike | null;
  memoryService?: MemoryStoreLike | null;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  readdirSync?: typeof fs.readdirSync;
};

const RETENTION_POLICY: ZavorthWorkspaceMemoryOsSnapshot['retentionPolicy'] = {
  workspace_profile: {
    ttlDays: 90,
    defaultRemember: true,
    reason: 'Project profile improves commands and routes, but must remain reviewable per workspace.',
  },
  conversation_summary: {
    ttlDays: 14,
    defaultRemember: true,
    reason: 'Short summary helps follow-ups without storing the entire conversation.',
  },
  preference: {
    ttlDays: null,
    defaultRemember: true,
    reason: 'Explicit preferences remain until the user deletes or corrects them.',
  },
  procedure: {
    ttlDays: 180,
    defaultRemember: true,
    reason: 'Validated procedures help safe repetition of technical tasks.',
  },
  task_reference: {
    ttlDays: 30,
    defaultRemember: true,
    reason: 'Recent references resolve continue, retry, and same-folder requests.',
  },
  artifact_reference: {
    ttlDays: 30,
    defaultRemember: true,
    reason: 'Recent artifacts can be resent without re-running work.',
  },
  follow_up: {
    ttlDays: 7,
    defaultRemember: true,
    reason: 'Short memory resolves follow-ups and expires quickly.',
  },
};

export class ZavorthWorkspaceMemoryOsService {
  private readonly now: () => Date;
  private readonly memoryPlaneService: MemoryPlaneLike | null;
  private readonly layeredMemoryService: LayeredMemoryLike | null;
  private readonly learningPlaneService: LearningPlaneLike | null;
  private readonly taskOperatingSystemService: TaskOsLike | null;
  private readonly memoryService: MemoryStoreLike | null;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly readdirSync: typeof fs.readdirSync;

  constructor(runtime: ZavorthWorkspaceMemoryOsRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.memoryPlaneService = runtime.memoryPlaneService || null;
    this.layeredMemoryService = runtime.layeredMemoryService || null;
    this.learningPlaneService = runtime.learningPlaneService || null;
    this.taskOperatingSystemService = runtime.taskOperatingSystemService || null;
    this.memoryService = runtime.memoryService || null;
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.readdirSync = runtime.readdirSync || fs.readdirSync.bind(fs);
  }

  public async buildReview(input: ZavorthWorkspaceMemoryOsInput = {}): Promise<ZavorthWorkspaceMemoryOsSnapshot> {
    const generatedAt = this.now().toISOString();
    const limit = Math.max(1, Math.min(Number(input.limit || 24), 80));
    const [memoryPlane, procedures, learning, taskOs, preferences] = await Promise.all([
      this.buildMemoryPlane(input),
      this.layeredMemoryService?.readProcedures({ workspaceHint: input.workspaceHint || null })
        || Promise.resolve(this.emptyProcedures(generatedAt)),
      Promise.resolve(this.learningPlaneService?.buildSnapshot({ workspace: input.workspaceHint || null }) || this.emptyLearning(generatedAt)),
      this.taskOperatingSystemService?.buildSnapshot({
        taskId: null,
        userId: input.userId || null,
        limit: 10,
      }) || Promise.resolve(null),
      this.readPreferences(input.userId || null),
    ]);

    const workspaceProfile = this.buildWorkspaceProfile({
      workspaceHint: input.workspaceHint || memoryPlane?.workspace?.workspace || null,
      memoryPlane,
      taskOs,
      procedures,
      learning,
    });
    const recentTaskResolver = this.buildRecentTaskResolver(taskOs);
    const conversationSummary = this.buildConversationSummary({
      input,
      memoryPlane,
      taskOs,
    });
    const preferenceLedger = this.buildPreferenceLedger(preferences);
    const reviewEntries = [
      ...this.reviewEntriesFromWorkspace(workspaceProfile),
      ...preferenceLedger.entries,
      ...this.reviewEntriesFromConversation(conversationSummary),
      ...this.reviewEntriesFromTasks(recentTaskResolver),
      ...this.reviewEntriesFromProcedures(procedures),
    ]
      .slice(0, limit);

    return {
      generatedAt,
      gate: 'workspace-memory-os',
      surface: 'workspace-memory-os',
      workspaceProfile,
      recentTaskResolver,
      conversationSummary,
      preferenceLedger,
      review: {
        total: reviewEntries.length,
        entries: reviewEntries,
      },
      retentionPolicy: RETENTION_POLICY,
      followUps: {
        examples: [
          {
            input: 'continua',
            resolvesTo: recentTaskResolver.taskId || 'task recente',
            command: recentTaskResolver.command || 'zavorth tasks resume latest',
          },
          {
            input: 'me manda de novo',
            resolvesTo: conversationSummary.recentArtifacts[0]?.label || 'artefato recente',
            command: conversationSummary.recentArtifacts[0]?.command || 'zavorth artifacts task latest',
          },
          {
            input: 'faz na mesma pasta',
            resolvesTo: workspaceProfile.workspace || 'workspace atual',
            command: workspaceProfile.workspace ? `zavorth --workspace "${workspaceProfile.workspace}" run <pedido>` : 'zavorth run <pedido>',
          },
        ],
      },
      contracts: {
        reviewShowsLearnedMemory: reviewEntries.length > 0 || preferenceLedger.total === 0,
        userCanForgetOrCorrect: Boolean(this.memoryService?.forget || this.memoryService?.remember),
        workspaceCommandsReusable: workspaceProfile.buildCommands.length > 0 || workspaceProfile.testCommands.length > 0,
        followUpsResolveReferences: Boolean(recentTaskResolver.taskId || workspaceProfile.workspace || conversationSummary.recentArtifacts.length > 0),
        secretsRedactedByDefault: reviewEntries.every((entry) => !this.containsSecret(entry.valuePreview)),
        noRawLogDumpByDefault: reviewEntries.every((entry) => !/stack trace|traceback|exception dump/i.test(entry.valuePreview)),
      },
      commands: {
        review: 'zavorth memory review --json',
        resolve: 'zavorth memory resolve "continua" --json',
        forget: 'zavorth memory forget <key>',
        correct: 'zavorth memory correct <key> <novo valor>',
      },
      narrative: this.buildNarrative(workspaceProfile, reviewEntries, recentTaskResolver),
    };
  }

  public async resolveFollowUp(
    text: string,
    input: ZavorthWorkspaceMemoryOsInput = {},
  ): Promise<ZavorthFollowUpResolution> {
    const generatedAt = this.now().toISOString();
    const review = await this.buildReview(input);
    const normalized = String(text || '').trim().toLowerCase();
    const wantsArtifact = /manda|envia|reenvia|artefato|de novo/.test(normalized);
    const wantsSameWorkspace = /mesma pasta|mesmo workspace|mesmo projeto|nessa pasta/.test(normalized);
    const wantsContinue = /continua|continue|retoma|segue|proximo|pr[oó]ximo/.test(normalized);

    if (wantsArtifact) {
      const artifact = review.conversationSummary.recentArtifacts[0] || null;
      return {
        generatedAt,
        gate: 'workspace-memory-os',
        surface: 'workspace-memory-resolution',
        input: text,
        intent: 'redeliver_artifact',
        resolved: Boolean(artifact),
        target: {
          taskId: review.recentTaskResolver.taskId,
          workspace: review.workspaceProfile.workspace,
          artifactCommand: artifact?.command || 'zavorth artifacts task latest',
          nextCommand: artifact?.command || 'zavorth artifacts task latest',
        },
        evidence: this.resolutionEvidence(review),
        reason: artifact
          ? `Resolved to recent artifact ${artifact.label}.`
          : 'No recent artifact found; used latest fallback.',
      };
    }

    if (wantsSameWorkspace) {
      return {
        generatedAt,
        gate: 'workspace-memory-os',
        surface: 'workspace-memory-resolution',
        input: text,
        intent: 'same_workspace',
        resolved: Boolean(review.workspaceProfile.workspace),
        target: {
          taskId: review.recentTaskResolver.taskId,
          workspace: review.workspaceProfile.workspace,
          artifactCommand: null,
          nextCommand: review.workspaceProfile.workspace
            ? `zavorth --workspace "${review.workspaceProfile.workspace}" run <pedido>`
            : 'zavorth run <pedido>',
        },
        evidence: this.resolutionEvidence(review),
        reason: review.workspaceProfile.workspace
          ? 'Resolved the reference to the operational profile workspace.'
          : 'No clear workspace existed; kept a generic command.',
      };
    }

    if (wantsContinue) {
      return {
        generatedAt,
        gate: 'workspace-memory-os',
        surface: 'workspace-memory-resolution',
        input: text,
        intent: 'continue_task',
        resolved: Boolean(review.recentTaskResolver.taskId),
        target: {
          taskId: review.recentTaskResolver.taskId,
          workspace: review.recentTaskResolver.workspace || review.workspaceProfile.workspace,
          artifactCommand: null,
          nextCommand: review.recentTaskResolver.command || 'zavorth tasks resume latest',
        },
        evidence: this.resolutionEvidence(review),
        reason: review.recentTaskResolver.reason,
      };
    }

    return {
      generatedAt,
      gate: 'workspace-memory-os',
      surface: 'workspace-memory-resolution',
      input: text,
      intent: 'memory_search',
      resolved: review.review.entries.length > 0,
      target: {
        taskId: review.recentTaskResolver.taskId,
        workspace: review.workspaceProfile.workspace,
        artifactCommand: null,
        nextCommand: `zavorth memory search "${this.redactText(text, 80)}"`,
      },
      evidence: this.resolutionEvidence(review),
      reason: 'Request does not look like a standard follow-up; resolved as operational memory search.',
    };
  }

  public async executeAction(input: {
    action: ZavorthMemoryReviewAction;
    key: string;
    value?: string | null;
    category?: string | null;
    userId?: string | null;
    platform?: string | null;
    chatId?: string | null;
    sessionId?: string | null;
    workspaceHint?: string | null;
  }): Promise<ZavorthMemoryReviewActionResult> {
    const key = String(input.key || '').trim();
    const userId = String(input.userId || '').trim();
    const generatedAt = this.now().toISOString();
    let ok = false;
    let status: ZavorthMemoryReviewActionResult['status'] = 'blocked';
    let summary = 'Action blocked.';

    if (!key || !userId) {
      summary = 'Provide user and memory key.';
    } else if (input.action === 'forget') {
      if (!this.memoryService?.forget) {
        summary = 'MemoryService does not offer forget in this runtime.';
      } else {
        ok = await this.memoryService.forget(userId, key);
        status = ok ? 'applied' : 'noop';
        summary = ok
          ? `Memory ${key} forgotten and archived.`
          : `Memory ${key} not found.`;
      }
    } else if (input.action === 'correct') {
      if (!this.memoryService?.remember) {
        summary = 'MemoryService does not offer correct/remember in this runtime.';
      } else {
        const value = String(input.value || '').trim();
        if (!value) {
          summary = 'Provide the new value to correct memory.';
        } else if (this.containsSecret(value)) {
          summary = 'Value blocked: it appears to contain a secret/token/credential.';
        } else {
          await this.memoryService.remember(userId, key, this.redactText(value, 240), input.category || 'preference');
          ok = true;
          status = 'applied';
          summary = `Memory ${key} corrected.`;
        }
      }
    }

    const review = await this.buildReview({
      userId,
      platform: input.platform || null,
      chatId: input.chatId || null,
      sessionId: input.sessionId || null,
      workspaceHint: input.workspaceHint || null,
    });

    return {
      generatedAt,
      gate: 'workspace-memory-os',
      surface: 'workspace-memory-action',
      action: input.action,
      key,
      ok,
      status,
      summary,
      review,
    };
  }

  private async buildMemoryPlane(input: ZavorthWorkspaceMemoryOsInput): Promise<ZavorthMemoryPlaneSnapshot | null> {
    if (!this.memoryPlaneService) {
      return null;
    }
    return this.memoryPlaneService.buildSnapshot({
      userId: input.userId || null,
      platform: input.platform || null,
      chatId: input.chatId || null,
      sessionId: input.sessionId || null,
      workspaceHint: input.workspaceHint || null,
    });
  }

  private async readPreferences(userId: string | null): Promise<MemoryEntry[]> {
    if (!userId || !this.memoryService?.listAll) {
      return [];
    }
    try {
      return await this.memoryService.listAll(userId);
    } catch (error: unknown) {logger.warn('[Zavorth Workspace Memory Os] operation failed', error); return []; }
  }

  private buildWorkspaceProfile(input: {
    workspaceHint: string | null;
    memoryPlane: ZavorthMemoryPlaneSnapshot | null;
    taskOs: ZavorthTaskOsSnapshot | null;
    procedures: LayeredMemoryProcedureSnapshot;
    learning: LearningPlaneSnapshot;
  }): ZavorthWorkspaceProfileSnapshot {
    const workspace = this.normalizeWorkspace(input.workspaceHint);
    const packageJson = this.readPackageJson(workspace);
    const scripts = packageJson?.scripts && typeof packageJson.scripts === 'object'
      ? packageJson.scripts as Record<string, string>
      : {};
    const stack = new Set<string>();
    const dependencies = {
      ...((packageJson?.dependencies || {}) as Record<string, unknown>),
      ...((packageJson?.devDependencies || {}) as Record<string, unknown>),
    };
    for (const name of Object.keys(dependencies)) {
      const normalized = name.toLowerCase();
      if (normalized.includes('typescript') || normalized === 'ts-node' || normalized === 'tsx') stack.add('typescript');
      if (normalized.includes('react')) stack.add('react');
      if (normalized.includes('next')) stack.add('nextjs');
      if (normalized.includes('vite')) stack.add('vite');
      if (normalized.includes('jest')) stack.add('jest');
      if (normalized.includes('playwright')) stack.add('playwright');
      if (normalized.includes('express') || normalized.includes('fastify')) stack.add('node-api');
    }
    if (this.existsInWorkspace(workspace, 'tsconfig.json')) stack.add('typescript');
    if (this.existsInWorkspace(workspace, 'src')) stack.add('src-layout');
    if (input.memoryPlane?.workspace?.workflowRecommendations?.length) stack.add('workflow-memory');
    if (input.learning.summary.total > 0) stack.add('learning-plane');

    return {
      workspace,
      slug: this.slug(workspace || 'workspace-desconhecido'),
      stack: Array.from(stack).sort(),
      buildCommands: this.pickScripts(scripts, ['build', 'runtime:build', 'compile']),
      testCommands: this.pickScripts(scripts, ['test', 'test:cli', 'runtime:check', 'qa:workspace-memory-os']),
      importantDirectories: this.findImportantDirectories(workspace),
      preferredExecutor: this.resolvePreferredExecutor(input.taskOs),
      codeStyle: this.inferCodeStyle(workspace, packageJson),
      architecturalDecisions: this.collectArchitectureSignals(input.procedures, input.memoryPlane),
      repeatedFailures: this.collectRepeatedFailures(input.taskOs),
    };
  }

  private buildRecentTaskResolver(taskOs: ZavorthTaskOsSnapshot | null): ZavorthRecentTaskResolution {
    const task = taskOs?.taskLedger.selected || taskOs?.taskLedger.tasks[0] || null;
    if (!task) {
      return {
        taskId: null,
        state: null,
        workspace: null,
        executor: null,
        artifacts: [],
        command: null,
        reason: 'No recent task found to resolve follow-up.',
      };
    }
    return {
      taskId: task.taskId,
      state: task.state.state,
      workspace: task.workspace,
      executor: task.executor,
      artifacts: task.relation.artifacts,
      command: task.resume.available ? task.resume.command : task.retry.available ? task.retry.command : `zavorth tasks ${task.taskId}`,
      reason: `Follow-up aponta para task ${task.shortId} em estado ${task.state.state}.`,
    };
  }

  private buildConversationSummary(input: {
    input: ZavorthWorkspaceMemoryOsInput;
    memoryPlane: ZavorthMemoryPlaneSnapshot | null;
    taskOs: ZavorthTaskOsSnapshot | null;
  }): ZavorthConversationSummary {
    const recentTopics = [
      ...(input.memoryPlane?.timeline.recent || []).map((entry) => entry.summary),
      ...(input.taskOs?.taskLedger.tasks || []).map((task) => task.summary),
    ]
      .map((value) => this.redactText(value, 80))
      .filter(Boolean)
      .slice(0, 5);
    const recentArtifacts = [
      ...(input.memoryPlane?.artifacts.recent || []).map((artifact) => ({
        label: artifact.label || 'artifact',
        kind: artifact.kind || 'artifact',
        command: 'zavorth artifacts task latest',
      })),
      ...(input.taskOs?.taskLedger.tasks || [])
        .filter((task) => task.artifacts.total > 0)
        .map((task) => ({
          label: task.artifacts.command,
          kind: 'task-artifacts',
          command: task.artifacts.command,
        })),
    ].slice(0, 5);

    return {
      conversation: input.input.chatId || null,
      sessionId: input.input.sessionId || null,
      headline: recentTopics[0] || 'Sem resumo conversacional recente.',
      recentTopics,
      recentArtifacts,
    };
  }

  private buildPreferenceLedger(entries: MemoryEntry[]): ZavorthPreferenceLedgerSnapshot {
    const filtered = entries
      .filter((entry) => /prefer|workspace|tecnologia|contexto|profissional|style|estilo/i.test(`${entry.category} ${entry.key}`))
      .slice(0, 12)
      .map((entry) => this.memoryEntryToReviewEntry(entry));
    return {
      total: filtered.length,
      entries: filtered,
      commands: {
        forget: 'zavorth memory forget <key>',
        correct: 'zavorth memory correct <key> <novo valor>',
      },
    };
  }

  private memoryEntryToReviewEntry(entry: MemoryEntry): ZavorthWorkspaceMemoryReviewEntry {
    const redacted = this.redactText(entry.value, 160);
    return {
      id: `memory:${entry.key}`,
      key: entry.key,
      label: entry.key,
      kind: 'preference',
      layer: 'long',
      category: entry.category || 'general',
      valuePreview: redacted,
      source: 'user_memory',
      confidence: 0.86,
      retention: {
        policy: 'preference',
        ttlDays: RETENTION_POLICY.preference.ttlDays,
        reason: RETENTION_POLICY.preference.reason,
      },
      redaction: {
        applied: redacted !== entry.value,
        reason: redacted !== entry.value ? 'Value contained a sensitive pattern.' : null,
      },
      actions: {
        forget: `zavorth memory forget ${entry.key}`,
        correct: `zavorth memory correct ${entry.key} <new value>`,
      },
    };
  }

  private reviewEntriesFromWorkspace(profile: ZavorthWorkspaceProfileSnapshot): ZavorthWorkspaceMemoryReviewEntry[] {
    const entries: ZavorthWorkspaceMemoryReviewEntry[] = [];
    if (profile.stack.length > 0) {
      entries.push(this.reviewEntry({
        key: 'workspace.stack',
        label: 'Project stack',
        kind: 'workspace_profile',
        layer: 'long',
        category: 'workspace',
        value: profile.stack.join(', '),
        source: 'workspace-profile',
        confidence: 0.78,
      }));
    }
    if (profile.buildCommands.length > 0 || profile.testCommands.length > 0) {
      entries.push(this.reviewEntry({
        key: 'workspace.commands',
        label: 'Build/test commands',
        kind: 'workspace_profile',
        layer: 'long',
        category: 'workspace',
        value: [...profile.buildCommands, ...profile.testCommands].join(' | '),
        source: 'package-json',
        confidence: 0.88,
      }));
    }
    if (profile.importantDirectories.length > 0) {
      entries.push(this.reviewEntry({
        key: 'workspace.directories',
        label: 'Diretorios importantes',
        kind: 'workspace_profile',
        layer: 'long',
        category: 'workspace',
        value: profile.importantDirectories.join(', '),
        source: 'workspace-inspector',
        confidence: 0.72,
      }));
    }
    return entries;
  }

  private reviewEntriesFromConversation(summary: ZavorthConversationSummary): ZavorthWorkspaceMemoryReviewEntry[] {
    if (summary.recentTopics.length === 0 && summary.recentArtifacts.length === 0) {
      return [];
    }
    return [
      this.reviewEntry({
        key: 'conversation.recent',
        label: 'Resumo recente da conversa',
        kind: 'conversation_summary',
        layer: 'short',
        category: 'conversation',
        value: [summary.headline, ...summary.recentTopics.slice(1, 3)].join(' | '),
        source: 'memory-plane',
        confidence: 0.7,
      }),
    ];
  }

  private reviewEntriesFromTasks(resolution: ZavorthRecentTaskResolution): ZavorthWorkspaceMemoryReviewEntry[] {
    if (!resolution.taskId) {
      return [];
    }
    return [
      this.reviewEntry({
        key: 'task.recent',
        label: 'Task recente para follow-up',
        kind: 'task_reference',
        layer: 'short',
        category: 'task',
        value: `${resolution.taskId} ${resolution.state || ''} ${resolution.workspace || ''}`.trim(),
        source: 'task-os',
        confidence: 0.82,
      }),
    ];
  }

  private reviewEntriesFromProcedures(procedures: LayeredMemoryProcedureSnapshot): ZavorthWorkspaceMemoryReviewEntry[] {
    return procedures.data.slice(0, 6).map((procedure) =>
      this.reviewEntry({
        key: `procedure.${procedure.id}`,
        label: procedure.label,
        kind: 'procedure',
        layer: 'procedural',
        category: 'procedure',
        value: `${procedure.summary} | ${procedure.steps.slice(0, 3).join(' > ')}`,
        source: procedure.source,
        confidence: procedure.confidence,
      }));
  }

  private reviewEntry(input: {
    key: string;
    label: string;
    kind: ZavorthWorkspaceMemoryKind;
    layer: ZavorthWorkspaceMemoryReviewEntry['layer'];
    category: string;
    value: string;
    source: string;
    confidence: number;
  }): ZavorthWorkspaceMemoryReviewEntry {
    const valuePreview = this.redactText(input.value, 180);
    const policy = RETENTION_POLICY[input.kind];
    return {
      id: `${input.kind}:${this.digest(input.key)}`,
      key: input.key,
      label: input.label,
      kind: input.kind,
      layer: input.layer,
      category: input.category,
      valuePreview,
      source: input.source,
      confidence: input.confidence,
      retention: {
        policy: input.kind,
        ttlDays: policy.ttlDays,
        reason: policy.reason,
      },
      redaction: {
        applied: valuePreview !== input.value,
        reason: valuePreview !== input.value ? 'Value contained a sensitive pattern or exceeded preview.' : null,
      },
      actions: input.kind === 'preference'
        ? {
            forget: `zavorth memory forget ${input.key}`,
            correct: `zavorth memory correct ${input.key} <new value>`,
          }
        : {
            forget: null,
            correct: null,
          },
    };
  }

  private readPackageJson(workspace: string | null): Record<string, unknown> | null {
    if (!workspace) {
      return null;
    }
    const packagePath = path.join(workspace, 'package.json');
    try {
      if (!this.existsSync(packagePath)) {
        return null;
      }
      return JSON.parse(String(this.readFileSync(packagePath, 'utf8') || '{}')) as Record<string, unknown>;
    } catch (error: unknown) {logger.warn('[Zavorth Workspace Memory Os] JSON parse failed', error); return null; }
  }

  private existsInWorkspace(workspace: string | null, target: string): boolean {
    if (!workspace) {
      return false;
    }
    try {
      return this.existsSync(path.join(workspace, target));
    } catch (error: unknown) {logger.warn('[Zavorth Workspace Memory Os] JSON parse failed', error); return false; }
  }

  private findImportantDirectories(workspace: string | null): string[] {
    if (!workspace) {
      return [];
    }
    const known = ['src', 'tests', 'test', 'docs', 'scripts', 'apps', 'packages', 'agent', 'sdk'];
    const fromKnown = known.filter((entry) => this.existsInWorkspace(workspace, entry));
    if (fromKnown.length > 0) {
      return fromKnown;
    }
    try {
      return this.readdirSync(workspace, { withFileTypes: true })
        .filter((entry: Dirent) => entry.isDirectory())
        .map((entry: Dirent) => String(entry.name))
        .filter((name) => !name.startsWith('.') && name !== 'node_modules' && name !== 'dist')
        .slice(0, 8);
    } catch (error: unknown) {logger.warn('[Zavorth Workspace Memory Os] filesystem operation failed', error); return []; }
  }

  private pickScripts(scripts: Record<string, string>, preferred: string[]): string[] {
    const commands: string[] = [];
    for (const name of preferred) {
      if (scripts[name]) {
        commands.push(`npm run ${name}`);
      }
    }
    if (commands.length === 0) {
      for (const name of Object.keys(scripts).filter((entry) => /build|test|check|qa/i.test(entry)).slice(0, 4)) {
        commands.push(`npm run ${name}`);
      }
    }
    return Array.from(new Set(commands)).slice(0, 6);
  }

  private resolvePreferredExecutor(taskOs: ZavorthTaskOsSnapshot | null): string | null {
    const counts = new Map<string, number>();
    for (const task of taskOs?.taskLedger.tasks || []) {
      const executor = String(task.executor || '').trim();
      if (executor) {
        counts.set(executor, (counts.get(executor) || 0) + 1);
      }
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  }

  private inferCodeStyle(workspace: string | null, packageJson: Record<string, unknown> | null): string[] {
    const style = new Set<string>();
    if (packageJson?.type === 'module') style.add('esm');
    if (this.existsInWorkspace(workspace, 'tsconfig.json')) style.add('typescript-strict');
    if (this.existsInWorkspace(workspace, '.eslintrc') || this.existsInWorkspace(workspace, 'eslint.config.js')) style.add('eslint');
    if (this.existsInWorkspace(workspace, '.prettierrc') || packageJson?.prettier) style.add('prettier');
    if (Object.keys((packageJson?.scripts || {}) as Record<string, unknown>).some((script) => /jest/i.test(script))) style.add('jest-tests');
    return Array.from(style).sort();
  }

  private collectArchitectureSignals(
    procedures: LayeredMemoryProcedureSnapshot,
    memoryPlane: ZavorthMemoryPlaneSnapshot | null,
  ): string[] {
    return [
      ...(memoryPlane?.workspace?.workflowRecommendations || []).map((entry) => `${entry.workflow}: ${entry.rationale}`),
      ...procedures.data
        .filter((entry) => /architecture|arquitet|boundary|runtime|release|workflow/i.test(`${entry.label} ${entry.summary}`))
        .map((entry) => entry.summary),
    ].map((value) => this.redactText(value, 120)).slice(0, 6);
  }

  private collectRepeatedFailures(taskOs: ZavorthTaskOsSnapshot | null): string[] {
    const failed = (taskOs?.taskLedger.tasks || [])
      .filter((task) => task.state.state === 'failed' || /falh|erro|fail|error/i.test(task.summary))
      .map((task) => task.summary);
    return failed.map((value) => this.redactText(value, 120)).slice(0, 6);
  }

  private normalizeWorkspace(value: string | null): string | null {
    const normalized = String(value || '').trim();
    if (!normalized) {
      return null;
    }
    try {
      return path.resolve(normalized);
    } catch (error: unknown) {logger.warn('[Zavorth Workspace Memory Os] path resolution failed', error); return normalized; }
  }

  private buildNarrative(
    profile: ZavorthWorkspaceProfileSnapshot,
    entries: ZavorthWorkspaceMemoryReviewEntry[],
    recentTask: ZavorthRecentTaskResolution,
  ): ZavorthWorkspaceMemoryOsSnapshot['narrative'] {
    return {
      headline: `${entries.length} reviewable memory item(s) for ${profile.slug}.`,
      operatorSummary: recentTask.taskId
        ? `Follow-ups can resume ${recentTask.taskId}; ${profile.buildCommands.length + profile.testCommands.length} known workspace command(s).`
        : `${profile.buildCommands.length + profile.testCommands.length} known workspace command(s); no recent task linked.`,
    };
  }

  private resolutionEvidence(review: ZavorthWorkspaceMemoryOsSnapshot): string[] {
    return [
      review.recentTaskResolver.taskId ? `task:${review.recentTaskResolver.taskId}` : null,
      review.workspaceProfile.workspace ? `workspace:${review.workspaceProfile.slug}` : null,
      review.conversationSummary.recentArtifacts[0]?.label ? `artifact:${review.conversationSummary.recentArtifacts[0].label}` : null,
    ].filter((entry): entry is string => Boolean(entry));
  }

  private emptyProcedures(generatedAt: string): LayeredMemoryProcedureSnapshot {
    return { generatedAt, total: 0, data: [] };
  }

  private emptyLearning(generatedAt: string): LearningPlaneSnapshot {
    return {
      generatedAt,
      summary: {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        promoted: 0,
        published: 0,
        quarantined: 0,
        highConfidence: 0,
      },
      candidates: [],
      narrative: {
        headline: 'Learning plane unavailable.',
        operatorSummary: 'No candidate loaded.',
      },
    };
  }

  private redactText(value: string | null | undefined, maxLength = 160): string {
    const original = String(value || '');
    const redacted = original
      .replace(/\b(sk|pk|api|token|secret)[_-]?[A-Za-z0-9_-]{8,}\b/gi, '[redacted-secret]')
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[redacted-email]')
      .replace(/\b(?:password|senha|token|secret|api[_-]?key)\s*[:=]\s*\S+/gi, '$1=[redacted]')
      .replace(/\b(?:\d[ -]*?){13,16}\b/g, '[redacted-number]')
      .replace(/\s+/g, ' ')
      .trim();
    return redacted.length <= maxLength
      ? redacted
      : `${redacted.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
  }

  private containsSecret(value: string | null | undefined): boolean {
    return /\b(sk|pk|api|token|secret)[_-]?[A-Za-z0-9_-]{8,}\b/i.test(String(value || ''))
      || /\b(?:password|senha|token|secret|api[_-]?key)\s*[:=]\s*\S+/i.test(String(value || ''));
  }

  private slug(value: string): string {
    const base = path.basename(String(value || '').replace(/[\\/]+$/, '')) || 'workspace';
    return base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace';
  }

  private digest(value: string): string {
    return createHash('sha256').update(String(value || '')).digest('hex').slice(0, 12);
  }
}
