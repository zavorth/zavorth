import { WorkspaceHookService } from './WorkspaceHookService.js';
import type { WorkspaceProfile } from './WorkspaceProfileService.js';
import { ZavorthAutomationHookService } from './ZavorthAutomationHookService.js';

type HookListener = (payload: {
  event: string;
  workspace: string | null;
  context: Record<string, unknown>;
}) => Promise<void> | void;

type ToolHookPipelineRuntime = {
  now?: () => Date;
  workspaceHookService?: WorkspaceHookService;
  automationHookService?: Pick<ZavorthAutomationHookService, 'runEvent'>;
};

export type ToolHookPipelineSnapshot = {
  generatedAt: string;
  events: Array<{
    name: string;
    label: string;
    scope: 'gateway' | 'session' | 'tool' | 'runtime' | 'integration' | 'plugin' | 'transport';
  }>;
};

export type ToolHookPipelineResult = {
  event: string;
  workspace: string | null;
  listenerCount: number;
  workspaceHookCount: number;
  automationHookCount?: number;
  automationActionCount?: number;
  automationBlockedActionCount?: number;
  ok: boolean;
};

const BUILTIN_EVENTS = [
  { name: 'gateway.before_dispatch', label: 'Before main dispatch', scope: 'gateway' as const },
  { name: 'gateway.after_dispatch', label: 'After main dispatch', scope: 'gateway' as const },
  { name: 'session.before_send', label: 'Before sending to a session', scope: 'session' as const },
  { name: 'session.after_send', label: 'After sending to a session', scope: 'session' as const },
  { name: 'session.before_spawn', label: 'Before opening a new session', scope: 'session' as const },
  { name: 'session.after_spawn', label: 'After opening a new session', scope: 'session' as const },
  { name: 'tool.before_execute', label: 'Before running a tool', scope: 'tool' as const },
  { name: 'tool.after_execute', label: 'After running a tool', scope: 'tool' as const },
  { name: 'runtime.before_execute', label: 'Before runtime execution', scope: 'runtime' as const },
  { name: 'runtime.after_execute', label: 'After runtime execution', scope: 'runtime' as const },
  { name: 'runtime.exec_failed', label: 'Runtime execution failure', scope: 'runtime' as const },
  { name: 'integration.before_action', label: 'Before invoking an integration', scope: 'integration' as const },
  { name: 'integration.after_action', label: 'After invoking an integration', scope: 'integration' as const },
  { name: 'plugin.before_action', label: 'Before invoking a plugin', scope: 'plugin' as const },
  { name: 'plugin.after_action', label: 'After invoking a plugin', scope: 'plugin' as const },
  { name: 'transport.before_action', label: 'Before invoking a remote transport', scope: 'transport' as const },
  { name: 'transport.after_action', label: 'After invoking a remote transport', scope: 'transport' as const },
  { name: 'llm.before_request', label: 'Before calling the LLM', scope: 'runtime' as const },
  { name: 'llm.after_request', label: 'After calling the LLM', scope: 'runtime' as const },
  { name: 'agent.before_turn', label: 'Before the agent turn', scope: 'runtime' as const },
  { name: 'agent.after_turn', label: 'After the agent turn', scope: 'runtime' as const },
  { name: 'memory.before_write', label: 'Before writing memory', scope: 'runtime' as const },
  { name: 'memory.after_write', label: 'After writing memory', scope: 'runtime' as const },
  { name: 'channel.before_send', label: 'Before sending to the channel', scope: 'session' as const },
  { name: 'channel.after_send', label: 'After sending to the channel', scope: 'session' as const },
  { name: 'shutdown.before', label: 'Before shutdown', scope: 'runtime' as const },
  { name: 'shutdown.after', label: 'After shutdown', scope: 'runtime' as const },
] as const;

export class ToolHookPipelineService {
  private readonly now: () => Date;
  private readonly workspaceHooks: WorkspaceHookService;
  private readonly automationHooks: Pick<ZavorthAutomationHookService, 'runEvent'>;
  private readonly listeners = new Map<string, Set<HookListener>>();

  constructor(runtime: ToolHookPipelineRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.workspaceHooks = runtime.workspaceHookService || new WorkspaceHookService();
    this.automationHooks = runtime.automationHookService || new ZavorthAutomationHookService({ now: this.now });
  }

  public buildSnapshot(): ToolHookPipelineSnapshot {
    return {
      generatedAt: this.now().toISOString(),
      events: BUILTIN_EVENTS.map((entry) => ({ ...entry })),
    };
  }

  public registerListener(event: string, listener: HookListener): () => void {
    const normalizedEvent = this.normalizeEvent(event);
    const bucket = this.listeners.get(normalizedEvent) || new Set<HookListener>();
    bucket.add(listener);
    this.listeners.set(normalizedEvent, bucket);
    return () => {
      const current = this.listeners.get(normalizedEvent);
      current?.delete(listener);
    };
  }

  public async run(input: {
    event: string;
    workspace?: string | null;
    workspaceProfile?: WorkspaceProfile | Record<string, unknown> | null;
    context?: Record<string, unknown>;
    dryRun?: boolean;
  }): Promise<ToolHookPipelineResult> {
    const event = this.normalizeEvent(input.event);
    const workspace = String(input.workspace || '').trim() || null;
    const context = input.context && typeof input.context === 'object' ? input.context : {};
    const listeners = Array.from(this.listeners.get(event) || []);

    for (const listener of listeners) {
      await listener({
        event,
        workspace,
        context,
      });
    }

    let workspaceHookCount = 0;
    let automationHookCount = 0;
    let automationActionCount = 0;
    let automationBlockedActionCount = 0;
    let ok = true;
    if (workspace) {
      const execution = await this.workspaceHooks.runHooksForEvent({
        workspace,
        source: input.workspaceProfile || null,
        event,
        dryRun: input.dryRun === true,
      });
      workspaceHookCount = execution.hooks.length;
      ok = execution.ok;

      const automation = await this.automationHooks.runEvent({
        workspace,
        event,
        context,
        dryRun: input.dryRun === true,
      });
      automationHookCount = automation.matchedHooks;
      automationActionCount = automation.executedActions;
      automationBlockedActionCount = automation.blockedActions;
      ok = ok && automation.ok;
    }

    return {
      event,
      workspace,
      listenerCount: listeners.length,
      workspaceHookCount,
      automationHookCount,
      automationActionCount,
      automationBlockedActionCount,
      ok,
    };
  }

  private normalizeEvent(value: string): string {
    return String(value || '').trim().toLowerCase();
  }
}
