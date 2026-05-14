import { WorkspaceHookService } from './WorkspaceHookService.js';
import type { WorkspaceProfile } from './WorkspaceProfileService.js';

type HookListener = (payload: {
  event: string;
  workspace: string | null;
  context: Record<string, any>;
}) => Promise<void> | void;

type ToolHookPipelineRuntime = {
  now?: () => Date;
  workspaceHookService?: WorkspaceHookService;
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
  ok: boolean;
};

const BUILTIN_EVENTS = [
  { name: 'gateway.before_dispatch', label: 'Antes do dispatch principal', scope: 'gateway' as const },
  { name: 'gateway.after_dispatch', label: 'Depois do dispatch principal', scope: 'gateway' as const },
  { name: 'session.before_send', label: 'Antes de enviar para uma sessao', scope: 'session' as const },
  { name: 'session.after_send', label: 'Depois de enviar para uma sessao', scope: 'session' as const },
  { name: 'session.before_spawn', label: 'Antes de abrir uma nova sessao', scope: 'session' as const },
  { name: 'session.after_spawn', label: 'Depois de abrir uma nova sessao', scope: 'session' as const },
  { name: 'tool.before_execute', label: 'Antes de executar uma tool', scope: 'tool' as const },
  { name: 'tool.after_execute', label: 'Depois de executar uma tool', scope: 'tool' as const },
  { name: 'runtime.before_execute', label: 'Antes da execucao do runtime', scope: 'runtime' as const },
  { name: 'runtime.after_execute', label: 'Depois da execucao do runtime', scope: 'runtime' as const },
  { name: 'runtime.exec_failed', label: 'Falha na execucao do runtime', scope: 'runtime' as const },
  { name: 'integration.before_action', label: 'Antes de acionar uma integracao', scope: 'integration' as const },
  { name: 'integration.after_action', label: 'Depois de acionar uma integracao', scope: 'integration' as const },
  { name: 'plugin.before_action', label: 'Antes de acionar um plugin', scope: 'plugin' as const },
  { name: 'plugin.after_action', label: 'Depois de acionar um plugin', scope: 'plugin' as const },
  { name: 'transport.before_action', label: 'Antes de acionar um transporte remoto', scope: 'transport' as const },
  { name: 'transport.after_action', label: 'Depois de acionar um transporte remoto', scope: 'transport' as const },
] as const;

export class ToolHookPipelineService {
  private readonly now: () => Date;
  private readonly workspaceHooks: WorkspaceHookService;
  private readonly listeners = new Map<string, Set<HookListener>>();

  constructor(runtime: ToolHookPipelineRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.workspaceHooks = runtime.workspaceHookService || new WorkspaceHookService();
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
    context?: Record<string, any>;
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
    }

    return {
      event,
      workspace,
      listenerCount: listeners.length,
      workspaceHookCount,
      ok,
    };
  }

  private normalizeEvent(value: string): string {
    return String(value || '').trim().toLowerCase();
  }
}
