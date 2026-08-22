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
  scope: 'session' | 'dispatch' | 'tool' | 'workflow' | 'approval' | 'runtime' | 'integration' | 'plugin' | 'transport' | 'release';
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
        scope: this.normalizeScope(event.scope),
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
        headline: `Zavorth exposes ${summary.supportedEvents} hook events for session, tool, workflow and release.`,
        operatorSummary:
          summary.registeredHooks > 0
            ? `${summary.registeredHooks} hook(s) de workspace registrados em ${summary.workspaces} workspace(s).`
            : 'No hooks are registered yet, but the event plane is explicit and ready to grow.',
      },
    };
  }

  private normalizeScope(
    scope: string,
  ): ZavorthHookEventSnapshot['scope'] {
    switch (scope) {
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
        return scope;
      default:
        return 'tool';
    }
  }
}
