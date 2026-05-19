import { ZavorthHookPipelineService } from './ZavorthHookPipelineService.js';
import { WorkspaceExtensionRegistryService } from './WorkspaceExtensionRegistryService.js';

type ZavorthHookPlaneRuntime = {
  now?: () => Date;
  workspaceExtensions?: WorkspaceExtensionRegistryService;
  hookPipelineService?: Pick<ZavorthHookPipelineService, 'listEventDescriptors' | 'resolveCanonicalEvent'>;
};

export type ZavorthHookEventSnapshot = {
  id: string;
  label: string;
  phase: 'session' | 'dispatch' | 'tool' | 'workflow' | 'approval' | 'runtime' | 'integration' | 'plugin' | 'transport' | 'release';
  description: string;
  status: 'ready' | 'partial' | 'planned';
  registeredHooks: number;
  sampleCommand: string | null;
};

export type ZavorthHookRegistrationSnapshot = {
  workspace: string;
  workspaceName: string;
  event: string;
  command: string;
};

export type ZavorthHookPlaneSnapshot = {
  generatedAt: string;
  summary: {
    supportedEvents: number;
    coveredEvents: number;
    readyEvents: number;
    partialEvents: number;
    plannedEvents: number;
    customEvents: number;
    registeredHooks: number;
    workspaces: number;
  };
  events: ZavorthHookEventSnapshot[];
  registrations: ZavorthHookRegistrationSnapshot[];
  narrative: {
    headline: string;
    operatorSummary: string;
  };
};

const SUPPORTED_EVENTS: Array<{
  id: string;
  label: string;
  phase: ZavorthHookEventSnapshot['phase'];
  description: string;
  status: ZavorthHookEventSnapshot['status'];
}> = [
  {
    id: 'before-task-dispatch',
    label: 'Antes do dispatch',
    phase: 'dispatch',
    description: 'Executa validacoes antes de enviar trabalho para o runtime.',
    status: 'ready',
  },
  {
    id: 'after-task-dispatch',
    label: 'Depois do dispatch',
    phase: 'dispatch',
    description: 'Executa passos de pos-processamento apos a criacao da task.',
    status: 'ready',
  },
  {
    id: 'task-dispatch-failed',
    label: 'Falha no dispatch',
    phase: 'dispatch',
    description: 'Permite resposta operacional quando o dispatch falha.',
    status: 'partial',
  },
  {
    id: 'before-tool-execute',
    label: 'Antes da tool',
    phase: 'tool',
    description: 'Permite gates antes de executar tools e acoes sensiveis.',
    status: 'partial',
  },
  {
    id: 'after-tool-execute',
    label: 'Depois da tool',
    phase: 'tool',
    description: 'Permite registrar telemetria e follow-ups apos o uso de tools.',
    status: 'partial',
  },
  {
    id: 'before-workflow-start',
    label: 'Antes do workflow',
    phase: 'workflow',
    description: 'Permite preparar contexto antes de abrir um workflow composto.',
    status: 'partial',
  },
  {
    id: 'after-workflow-complete',
    label: 'Depois do workflow',
    phase: 'workflow',
    description: 'Permite publicar artefatos e sumarizar o resultado final.',
    status: 'partial',
  },
  {
    id: 'permission-required',
    label: 'Permissao pendente',
    phase: 'approval',
    description: 'Permite automacoes quando uma permissao bloqueia a trilha.',
    status: 'partial',
  },
  {
    id: 'handoff-generated',
    label: 'Handoff gerado',
    phase: 'session',
    description: 'Permite automacoes quando um handoff entre superficies e gerado.',
    status: 'partial',
  },
  {
    id: 'before-complete',
    label: 'Antes de concluir',
    phase: 'release',
    description: 'Hook operacional de workspace antes de concluir uma entrega.',
    status: 'ready',
  },
  {
    id: 'before-publish',
    label: 'Antes de publicar',
    phase: 'release',
    description: 'Hook operacional de workspace antes de publicar ou shippar algo.',
    status: 'ready',
  },
];

export class ZavorthHookPlaneService {
  private readonly now: () => Date;
  private readonly workspaceExtensions: WorkspaceExtensionRegistryService;
  private readonly hookPipeline: Pick<ZavorthHookPipelineService, 'listEventDescriptors' | 'resolveCanonicalEvent'>;

  constructor(runtime: ZavorthHookPlaneRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.workspaceExtensions = runtime.workspaceExtensions || new WorkspaceExtensionRegistryService();
    this.hookPipeline = runtime.hookPipelineService || new ZavorthHookPipelineService();
  }

  public buildSnapshot(): ZavorthHookPlaneSnapshot {
    const workspaceEntries = this.workspaceExtensions.listEntries();
    const registrations = workspaceEntries.flatMap((entry) =>
      entry.hooks.map((hook) => ({
        workspace: entry.workspace,
        workspaceName: entry.workspaceName,
        event: hook.event,
        command: hook.command,
      })),
    );
    const events = this.hookPipeline.listEventDescriptors().map((event) => {
      const matchedHooks = registrations.filter((entry) => this.hookPipeline.resolveCanonicalEvent(entry.event) === event.id);
      return {
        id: event.id,
        label: event.label,
        phase: this.normalizeStage(event.phase),
        description: event.summary,
        status: event.status,
        registeredHooks: matchedHooks.length,
        sampleCommand: matchedHooks[0]?.command || null,
      };
    });
    const customEvents = registrations.filter((entry) => !this.hookPipeline.resolveCanonicalEvent(entry.event)).length;

    const summary = {
      supportedEvents: events.length,
      coveredEvents: events.filter((event) => event.registeredHooks > 0).length,
      readyEvents: events.filter((event) => event.status === 'ready').length,
      partialEvents: events.filter((event) => event.status === 'partial').length,
      plannedEvents: events.filter((event) => event.status === 'planned').length,
      customEvents,
      registeredHooks: registrations.length,
      workspaces: workspaceEntries.length,
    };

    return {
      generatedAt: this.now().toISOString(),
      summary,
      events,
      registrations,
      narrative: {
        headline: `Zavorth expõe ${summary.supportedEvents} eventos de hook para sessao, tool, workflow e release.`,
        operatorSummary:
          summary.registeredHooks > 0
            ? `${summary.registeredHooks} hook(s) de workspace registrados em ${summary.workspaces} workspace(s).`
            : 'Ainda nao ha hooks registrados, mas o plano de eventos ja esta explicito e pronto para crescer.',
      },
    };
  }

  private normalizeStage(
    phase: string,
  ): ZavorthHookEventSnapshot['phase'] {
    switch (phase) {
      case 'session':
      case 'dispatch':
      case 'workflow':
      case 'approval':
      case 'runtime':
      case 'integration':
      case 'plugin':
      case 'transport':
      case 'release':
      case 'tool':
        return phase;
      default:
        return 'tool';
    }
  }
}
