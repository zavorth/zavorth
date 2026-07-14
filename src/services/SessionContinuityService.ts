import type { Task } from '../contracts/TaskContract.js';
import type { MessageChannel } from '../contracts/PlatformContract.js';
import {
  buildWorkspaceContinuityContext,
  hasWorkspaceContinuitySignals,
  type WorkspaceContinuityContext,
} from './WorkspaceContinuityContext.js';
import {
  ExecutionLifecycleLinkService,
  type ExecutionLifecycleContextLink,
} from './ExecutionLifecycleLinkService.js';
import { SurfaceIdentityService } from './SurfaceIdentityService.js';


import { TenantContextService, type TenantContext } from './TenantContextService.js';

type TaskManagerLike = {
  getRecentTasks?(limit?: number, userId?: string): Task[];
  getRecentTasksByUsers?(userIds: string[], limit?: number): Task[];
  getRecentTasksByUsersAndTenant?(userIds: string[], tenantId: string, limit?: number): Task[];
  getLatestTaskForUsers?(userIds: string[], excludeTaskId?: string): Task | undefined;
  getLatestTaskForUsersAndTenant?(userIds: string[], tenantId: string, excludeTaskId?: string): Task | undefined;
  getRecentTasksByChat?(chatId: string, limit?: number): Task[];
};

export type SessionContinuityTask = {
  taskId: string;
  shortId: string;
  source: string;
  commandType: string;
  status: string;
  workspace: string | null;
  updatedAt: string;
  summary: string | null;
  execution: ExecutionLifecycleContextLink | null;
};

export type SessionContinuitySnapshot = {
  generatedAt: string;
  sessionId: string;
  chatId: string;
  userId: string;
  principalId: string;
  runtimeUserId: string;
  tenantContext: TenantContext | null;
  currentSurfaceTask: SessionContinuityTask | null;
  activeTask: SessionContinuityTask | null;
  latestTelegramTask: SessionContinuityTask | null;
  latestWebTask: SessionContinuityTask | null;
  latestDiscordTask: SessionContinuityTask | null;
  latestWhatsAppTask: SessionContinuityTask | null;
  focusTask: SessionContinuityTask | null;
  recentTasks: SessionContinuityTask[];
  surfaces: {
    telegram: number;
    web: number;
    other: number;
  };
  surfaceBreakdown: Record<string, number>;
  linkedSurfaces: Array<{ source: string; sourceUserId: string; linkedAt: string }>;
  suggestedAction: {
    kind: 'resume-active' | 'review-latest' | 'fresh-session';
    label: string;
    reason: string;
    prompt?: string | null;
  };
  workspaceContext: WorkspaceContinuityContext | null;
};

type SessionContinuityRuntime = {
  now?: () => Date;
  surfaceIdentityService?: SurfaceIdentityService;
  tenantContextService?: TenantContextService;
};

export class SessionContinuityService {
  private readonly now: () => Date;
  private readonly surfaceIdentity: SurfaceIdentityService;
  private readonly tenantContext: TenantContextService;
  private readonly lifecycleLinks = new ExecutionLifecycleLinkService();

  constructor(
    private readonly taskManager: TaskManagerLike,
    runtime: SessionContinuityRuntime = {},
  ) {
    this.now = runtime.now || (() => new Date());
    this.surfaceIdentity = runtime.surfaceIdentityService || new SurfaceIdentityService();
    this.tenantContext = runtime.tenantContextService || new TenantContextService();
  }

  public buildSnapshot(sessionId: string, chatId: string, userId: string): SessionContinuitySnapshot {
    const principalId = this.surfaceIdentity.resolveRuntimeUserId({
      source: this.inferSurfaceFromChatId(chatId),
      sourceUserId: userId,
      fallbackRuntimeUserId: userId,
    });
    const tenantContext = this.tenantContext.resolveFromSession({
      platform: this.inferSurfaceFromChatId(chatId),
      chatId,
      userId,
      sessionId,
    });
    const recentUserTasks = this.getRecentUserTasks(principalId, tenantContext);
    const currentSurfaceTasks = this.getRecentChatTasks(chatId, tenantContext);
    const currentSurfaceTask = this.serializeTask(currentSurfaceTasks[0] || null);
    const activeTask = this.serializeTask(
      recentUserTasks.find((task) => this.isActiveTask(task)) || null,
    );
    const latestTelegramTask = this.serializeTask(
      recentUserTasks.find((task) => String(task.source || '').trim() === 'telegram') || null,
    );
    const latestWebTask = this.serializeTask(
      recentUserTasks.find((task) => String(task.source || '').trim() === 'web') || null,
    );
    const latestDiscordTask = this.serializeTask(
      recentUserTasks.find((task) => String(task.source || '').trim() === 'discord') || null,
    );
    const latestWhatsAppTask = this.serializeTask(
      recentUserTasks.find((task) => String(task.source || '').trim() === 'whatsapp') || null,
    );
    const focusTask =
      currentSurfaceTask || activeTask || latestTelegramTask || latestWebTask || latestDiscordTask || latestWhatsAppTask;
    const workspaceContext = this.buildWorkspaceContext([
      currentSurfaceTasks[0] || null,
      recentUserTasks.find((task) => this.isActiveTask(task)) || null,
      recentUserTasks.find((task) => String(task.source || '').trim() === 'web') || null,
      recentUserTasks.find((task) => String(task.source || '').trim() === 'telegram') || null,
      ...recentUserTasks,
    ]);
    const surfaces = recentUserTasks.reduce(
      (summary, task) => {
        const source = String(task.source || '').trim();
        if (source === 'telegram') {
          summary.telegram += 1;
        } else if (source === 'web') {
          summary.web += 1;
        } else {
          summary.other += 1;
        }
        return summary;
      },
      { telegram: 0, web: 0, other: 0 },
    );
    const surfaceBreakdown = recentUserTasks.reduce((summary, task) => {
      const source = String(task.source || '').trim() || 'unknown';
      summary[source] = (summary[source] || 0) + 1;
      return summary;
    }, {} as Record<string, number>);

    return {
      generatedAt: this.now().toISOString(),
      sessionId,
      chatId,
      userId,
      principalId,
      runtimeUserId: principalId,
      tenantContext,
      currentSurfaceTask,
      activeTask,
      latestTelegramTask,
      latestWebTask,
      latestDiscordTask,
      latestWhatsAppTask,
      focusTask,
      recentTasks: recentUserTasks.slice(0, 6).map((task) => this.serializeTask(task)!),
      surfaces,
      surfaceBreakdown,
      linkedSurfaces: this.surfaceIdentity.listLinkedSurfaces(principalId),
      suggestedAction: this.buildSuggestedAction({
        currentSurfaceTask,
        activeTask,
        latestTelegramTask,
        latestWebTask,
        latestDiscordTask,
        latestWhatsAppTask,
        workspaceContext,
      }),
      workspaceContext,
    };
  }

  private buildWorkspaceContext(tasks: Array<Task | null | undefined>): SessionContinuitySnapshot['workspaceContext'] {
    const sourceTask = tasks.find((task) => hasWorkspaceContinuitySignals(task)) || null;
    if (!sourceTask) {
      return null;
    }
    return buildWorkspaceContinuityContext(sourceTask, String(sourceTask.source || '').trim());
  }

  private buildSuggestedAction(input: {
    currentSurfaceTask: SessionContinuityTask | null;
    activeTask: SessionContinuityTask | null;
    latestTelegramTask: SessionContinuityTask | null;
    latestWebTask: SessionContinuityTask | null;
    latestDiscordTask?: SessionContinuityTask | null;
    latestWhatsAppTask?: SessionContinuityTask | null;
    workspaceContext: SessionContinuitySnapshot['workspaceContext'];
  }): SessionContinuitySnapshot['suggestedAction'] {
    const prompt = input.workspaceContext?.followupPrompt || null;
    if (input.activeTask) {
      return {
        kind: 'resume-active',
        label: `Retomar ${input.activeTask.shortId}`,
        reason: `Existe uma tarefa ativa em ${input.activeTask.source}.`,
        prompt,
      };
    }

    const latestTask =
      input.currentSurfaceTask ||
      input.latestTelegramTask ||
      input.latestWebTask ||
      input.latestDiscordTask ||
      input.latestWhatsAppTask;
    if (latestTask) {
      return {
        kind: 'review-latest',
        label: `Revisar ${latestTask.shortId}`,
        reason: `A ultima tarefa conhecida veio de ${latestTask.source}.`,
        prompt,
      };
    }

    return {
      kind: 'fresh-session',
      label: 'Iniciar nova sessao',
      reason: 'There is no continuidade relevante registrada ainda.',
      prompt: null,
    };
  }

  private getRecentUserTasks(principalId: string, tenantContext: TenantContext | null): Task[] {
    const normalizedPrincipalId = String(principalId || '').trim();
    if (!normalizedPrincipalId) {
      return [];
    }

    const principalUserIds = this.surfaceIdentity.listPrincipalUserIds(normalizedPrincipalId);
    const tenantAwareLoader = this.taskManager.getRecentTasksByUsersAndTenant;
    if (
      this.tenantContext.shouldIsolateByTenant(tenantContext) &&
      typeof tenantAwareLoader === 'function'
    ) {
      return tenantAwareLoader.call(this.taskManager, principalUserIds, tenantContext!.tenantId, 12) || [];
    }

    const multiLoader = this.taskManager.getRecentTasksByUsers;
    if (typeof multiLoader === 'function') {
      return this.filterTasksByTenant(
        multiLoader.call(this.taskManager, principalUserIds, 12) || [],
        tenantContext,
      );
    }

    const loader = this.taskManager.getRecentTasks;
    if (typeof loader !== 'function') {
      return [];
    }

    return this.filterTasksByTenant(
      loader.call(this.taskManager, 12, normalizedPrincipalId) || [],
      tenantContext,
    );
  }

  private getRecentChatTasks(chatId: string, tenantContext: TenantContext | null): Task[] {
    const loader = this.taskManager.getRecentTasksByChat;
    if (typeof loader !== 'function' || !String(chatId || '').trim()) {
      return [];
    }

    return this.filterTasksByTenant(loader.call(this.taskManager, chatId, 12) || [], tenantContext);
  }

  private filterTasksByTenant(tasks: Task[], tenantContext: TenantContext | null): Task[] {
    if (!this.tenantContext.shouldIsolateByTenant(tenantContext)) {
      return tasks;
    }

    return (tasks || []).filter((task) => this.tenantContext.matchesTaskTenant(task, tenantContext));
  }

  private isActiveTask(task: Task): boolean {
    return ['pending', 'parsed', 'planned', 'waiting_approval', 'approved', 'running', 'validating', 'delivery_pending']
      .includes(String(task.status || '').trim());
  }

  private serializeTask(task: Task | null): SessionContinuityTask | null {
    if (!task) {
      return null;
    }

    const genericSurfaceSummary =
      task.metadata &&
      typeof task.metadata === 'object' &&
      task.metadata.surface_summary &&
      typeof task.metadata.surface_summary === 'object'
        ? task.metadata.surface_summary
        : null;
    const telegramSurfaceSummary =
      task.metadata &&
      typeof task.metadata === 'object' &&
      task.metadata.telegram_surface_summary &&
      typeof task.metadata.telegram_surface_summary === 'object'
        ? task.metadata.telegram_surface_summary
        : null;
    const effectiveSurfaceSummary = genericSurfaceSummary || telegramSurfaceSummary;
    const summary =
      String(effectiveSurfaceSummary?.summary || '').trim() ||
      task.result_summary ||
      task.error_summary ||
      task.raw_message ||
      null;

    return {
      taskId: task.task_id,
      shortId: task.task_id.substring(0, 8),
      source: String(task.source || '').trim() || 'unknown',
      commandType: String(task.command_type || '').trim(),
      status: String(task.status || '').trim(),
      workspace: task.workspace || null,
      updatedAt: String(task.updated_at || task.created_at || '').trim(),
      summary,
      execution: this.lifecycleLinks.buildTaskContextLink(task as unknown as Record<string, unknown>),
    };
  }

  private inferSurfaceFromChatId(chatId: string): MessageChannel {
    const normalized = String(chatId || '').trim().toLowerCase();
    if (normalized.startsWith('web:')) {
      return 'web';
    }
    if (normalized.startsWith('discord:')) {
      return 'discord';
    }
    if (normalized.startsWith('whatsapp:')) {
      return 'whatsapp';
    }
    if (normalized.startsWith('cli:')) {
      return 'cli';
    }
    return 'telegram';
  }

}
