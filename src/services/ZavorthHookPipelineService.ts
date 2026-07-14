import type { WorkspaceHook, WorkspaceProfile } from './WorkspaceProfileService.js';
import { WorkspaceHookService } from './WorkspaceHookService.js';
import { WorkspaceProfileService } from './WorkspaceProfileService.js';

type HookPipelineRuntime = {
  now?: () => Date;
  workspaceHookService?: WorkspaceHookService;
  workspaceProfileService?: WorkspaceProfileService;
};

export type ZavorthHookEventDescriptor = {
  id: string;
  label: string;
  summary: string;
  phase: 'session' | 'dispatch' | 'workflow' | 'approval' | 'runtime' | 'integration' | 'plugin' | 'transport' | 'release';
  status: 'ready' | 'partial' | 'planned';
  aliases: string[];
};

export type ZavorthHookPlanEntry = {
  event: string;
  hook: WorkspaceHook;
  origin: 'workspace';
};

export type ZavorthHookPipelineSnapshot = {
  generatedAt: string;
  workspace: string | null;
  summary: {
    totalRegistered: number;
    coveredEvents: number;
    customEvents: number;
  };
  events: ZavorthHookEventDescriptor[];
  registered: Array<{
    event: string;
    command: string;
    origin: 'workspace';
    mappedEvent: string | null;
  }>;
  narrative: {
    headline: string;
    operatorSummary: string;
  };
};

const HOOK_EVENT_CATALOG: ZavorthHookEventDescriptor[] = [
  {
    id: 'before-task-dispatch',
    label: 'Antes do dispatch',
    summary: 'Roda antes de uma task ser enviada ao runtime principal.',
    phase: 'dispatch',
    status: 'ready',
    aliases: ['before-task-dispatch', 'gateway.before_dispatch'],
  },
  {
    id: 'after-task-dispatch',
    label: 'Depois do dispatch',
    summary: 'Roda depois de uma task ser registrada e enviada.',
    phase: 'dispatch',
    status: 'ready',
    aliases: ['after-task-dispatch', 'gateway.after_dispatch'],
  },
  {
    id: 'task-dispatch-failed',
    label: 'Falha no dispatch',
    summary: 'Roda quando o dispatch principal falha antes de produzir uma task valida.',
    phase: 'dispatch',
    status: 'partial',
    aliases: ['task-dispatch-failed', 'gateway.dispatch_failed'],
  },
  {
    id: 'before-workflow-phase',
    label: 'Antes de etapa de workflow',
    summary: 'Roda antes de iniciar uma etapa multiagente/workflow.',
    phase: 'workflow',
    status: 'partial',
    aliases: ['before-workflow-phase'],
  },
  {
    id: 'after-workflow-phase',
    label: 'Depois de etapa de workflow',
    summary: 'Roda depois de concluir uma etapa multiagente/workflow.',
    phase: 'workflow',
    status: 'partial',
    aliases: ['after-workflow-phase'],
  },
  {
    id: 'before-approval-request',
    label: 'Antes de pedir aprovacao',
    summary: 'Roda antes de emitir uma solicitacao de aprovacao.',
    phase: 'approval',
    status: 'partial',
    aliases: ['before-approval-request'],
  },
  {
    id: 'after-approval-resolution',
    label: 'Depois da aprovacao',
    summary: 'Roda depois de uma aprovacao ser decidida.',
    phase: 'approval',
    status: 'partial',
    aliases: ['after-approval-resolution'],
  },
  {
    id: 'before-session-send',
    label: 'Antes de enviar para sessao',
    summary: 'Roda antes de uma mensagem ser enviada para uma sessao existente.',
    phase: 'session',
    status: 'partial',
    aliases: ['before-session-send', 'session.before_send'],
  },
  {
    id: 'after-session-send',
    label: 'Depois de enviar para sessao',
    summary: 'Roda depois de uma mensagem ser entregue para uma sessao existente.',
    phase: 'session',
    status: 'partial',
    aliases: ['after-session-send', 'session.after_send'],
  },
  {
    id: 'before-session-spawn',
    label: 'Antes de abrir sessao',
    summary: 'Roda antes de criar uma nova sessao derivada.',
    phase: 'session',
    status: 'partial',
    aliases: ['before-session-spawn', 'session.before_spawn'],
  },
  {
    id: 'after-session-spawn',
    label: 'Depois de abrir sessao',
    summary: 'Roda depois de criar uma nova sessao derivada.',
    phase: 'session',
    status: 'partial',
    aliases: ['after-session-spawn', 'session.after_spawn'],
  },
  {
    id: 'before-runtime-exec',
    label: 'Antes da execucao',
    summary: 'Roda antes de executar shell/tool/runtime.',
    phase: 'runtime',
    status: 'ready',
    aliases: ['before-runtime-exec', 'tool.before_execute', 'runtime.before_execute'],
  },
  {
    id: 'after-runtime-exec',
    label: 'Depois da execucao',
    summary: 'Roda depois de executar shell/tool/runtime.',
    phase: 'runtime',
    status: 'ready',
    aliases: ['after-runtime-exec', 'tool.after_execute', 'runtime.after_execute'],
  },
  {
    id: 'runtime-exec-failed',
    label: 'Falha na execucao',
    summary: 'Roda quando uma execucao de runtime termina com falha.',
    phase: 'runtime',
    status: 'partial',
    aliases: ['runtime-exec-failed', 'runtime.exec_failed'],
  },
  {
    id: 'before-integration-action',
    label: 'Antes de acao do hub',
    summary: 'Roda antes de validar/reparar/instalar uma integracao.',
    phase: 'integration',
    status: 'partial',
    aliases: ['before-integration-action', 'integration.before_action'],
  },
  {
    id: 'after-integration-action',
    label: 'Depois de acao do hub',
    summary: 'Roda depois de validar/reparar/instalar uma integracao.',
    phase: 'integration',
    status: 'partial',
    aliases: ['after-integration-action', 'integration.after_action'],
  },
  {
    id: 'before-plugin-action',
    label: 'Antes de acao do plugin',
    summary: 'Roda antes de inspecionar, instalar, confiar ou remover um plugin/skill.',
    phase: 'plugin',
    status: 'partial',
    aliases: ['before-plugin-action', 'plugin.before_action'],
  },
  {
    id: 'after-plugin-action',
    label: 'Depois de acao do plugin',
    summary: 'Roda depois de inspecionar, instalar, confiar ou remover um plugin/skill.',
    phase: 'plugin',
    status: 'partial',
    aliases: ['after-plugin-action', 'plugin.after_action'],
  },
  {
    id: 'before-transport-action',
    label: 'Antes de acao do transporte',
    summary: 'Roda antes de inspecionar, preparar ou smokear um transporte remoto.',
    phase: 'transport',
    status: 'partial',
    aliases: ['before-transport-action', 'transport.before_action'],
  },
  {
    id: 'after-transport-action',
    label: 'Depois de acao do transporte',
    summary: 'Roda depois de inspecionar, preparar ou smokear um transporte remoto.',
    phase: 'transport',
    status: 'partial',
    aliases: ['after-transport-action', 'transport.after_action'],
  },
  {
    id: 'before-complete',
    label: 'Antes de concluir',
    summary: 'Evento legado de conclusao do workspace.',
    phase: 'release',
    status: 'ready',
    aliases: ['before-complete'],
  },
  {
    id: 'before-publish',
    label: 'Antes de publicar',
    summary: 'Evento legado de publicaction do workspace.',
    phase: 'release',
    status: 'ready',
    aliases: ['before-publish'],
  },
];

export class ZavorthHookPipelineService {
  private readonly now: () => Date;
  private readonly workspaceHooks: WorkspaceHookService;
  private readonly workspaceProfiles: WorkspaceProfileService;

  constructor(runtime: HookPipelineRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.workspaceHooks = runtime.workspaceHookService || new WorkspaceHookService();
    this.workspaceProfiles = runtime.workspaceProfileService || new WorkspaceProfileService();
  }

  public async buildSnapshot(workspaceHint?: string | null): Promise<ZavorthHookPipelineSnapshot> {
    const profile = await this.resolveProfile(workspaceHint);
    const hooks = this.workspaceHooks.listHooks(profile);
    const coveredEvents = new Set<string>();
    const registered = hooks.map((hook) => {
      const mappedEvent = this.resolveCanonicalEvent(hook.event);
      if (mappedEvent) {
        coveredEvents.add(mappedEvent);
      }
      return {
        event: hook.event,
        command: hook.command,
        origin: 'workspace' as const,
        mappedEvent,
      };
    });

    return {
      generatedAt: this.now().toISOString(),
      workspace: profile?.workspace || null,
      summary: {
        totalRegistered: hooks.length,
        coveredEvents: coveredEvents.size,
        customEvents: hooks.filter((hook) => !this.resolveCanonicalEvent(hook.event)).length,
      },
      events: this.listEventDescriptors(),
      registered,
      narrative: {
        headline: hooks.length
          ? `Pipeline de hooks com ${hooks.length} hook(s) ativo(s).`
          : 'Nenhum hook operacional ativo ainda.',
        operatorSummary: hooks.length
          ? `${coveredEvents.size} evento(s) canonico(s) coberto(s) no workspace atual.`
          : 'Adicione uma secao Hooks ao ZAVORTH.md para ativar o pipeline.',
      },
    };
  }

  public async buildExecutionPlan(input: {
    workspace: string;
    event: string;
  }): Promise<ZavorthHookPlanEntry[]> {
    const profile = await this.resolveProfile(input.workspace);
    const aliases = this.resolveEventAliases(input.event);
    const hooks = aliases.flatMap((event) =>
      this.workspaceHooks.getHooksForEvent(profile, event).map((hook) => ({
        event,
        hook,
        origin: 'workspace' as const,
      })),
    );
    const seen = new Set<string>();
    return hooks.filter((entry) => {
      const key = `${entry.event}:${entry.hook.command}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  public async runEvent(input: {
    workspace: string;
    event: string;
    dryRun?: boolean;
  }) {
    const profile = await this.resolveProfile(input.workspace);
    const aliases = this.resolveEventAliases(input.event);
    const aggregate = {
      event: input.event,
      workspace: input.workspace,
      dryRun: input.dryRun === true,
      ok: true,
      executions: [] as Array<Awaited<ReturnType<WorkspaceHookService['runHooksForEvent']>>>,
    };

    for (const event of aliases) {
      const execution = await this.workspaceHooks.runHooksForEvent({
        workspace: input.workspace,
        source: profile,
        event,
        dryRun: input.dryRun,
      });
      aggregate.executions.push(execution);
      if (!execution.ok) {
        aggregate.ok = false;
      }
    }

    return aggregate;
  }

  private async resolveProfile(workspaceHint?: string | null): Promise<WorkspaceProfile | null> {
    if (!String(workspaceHint || '').trim()) {
      return null;
    }
    return this.workspaceProfiles.getProfile(workspaceHint);
  }

  public listEventDescriptors(): ZavorthHookEventDescriptor[] {
    return HOOK_EVENT_CATALOG.map((entry) => ({ ...entry, aliases: entry.aliases.slice() }));
  }

  public resolveCanonicalEvent(event: string): string | null {
    const normalized = this.normalizeEvent(event);
    return HOOK_EVENT_CATALOG.find((entry) => entry.id === normalized || entry.aliases.includes(normalized))?.id || null;
  }

  private resolveEventAliases(event: string): string[] {
    const normalized = this.normalizeEvent(event);
    const descriptor = HOOK_EVENT_CATALOG.find((entry) => entry.id === normalized || entry.aliases.includes(normalized));
    if (!descriptor) {
      return [normalized];
    }
    return Array.from(new Set([descriptor.id, ...descriptor.aliases]));
  }

  private normalizeEvent(value: string): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-');
  }
}
