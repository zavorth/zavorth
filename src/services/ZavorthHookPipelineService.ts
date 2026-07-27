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
  scope: 'session' | 'dispatch' | 'workflow' | 'approval' | 'runtime' | 'integration' | 'plugin' | 'transport' | 'release';
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
    label: 'Before dispatch',
    summary: 'Runs before a task is sent to the main runtime.',
    scope: 'dispatch',
    status: 'ready',
    aliases: ['before-task-dispatch', 'gateway.before_dispatch'],
  },
  {
    id: 'after-task-dispatch',
    label: 'After dispatch',
    summary: 'Runs after a task is registered and sent.',
    scope: 'dispatch',
    status: 'ready',
    aliases: ['after-task-dispatch', 'gateway.after_dispatch'],
  },
  {
    id: 'task-dispatch-failed',
    label: 'Dispatch failure',
    summary: 'Runs when the main dispatch fails before producing a valid task.',
    scope: 'dispatch',
    status: 'partial',
    aliases: ['task-dispatch-failed', 'gateway.dispatch_failed'],
  },
  {
    id: 'before-workflow-stage',
    label: 'Before workflow stage',
    summary: 'Runs before starting a multi-agent/workflow stage.',
    scope: 'workflow',
    status: 'partial',
    aliases: ['before-workflow-stage'],
  },
  {
    id: 'after-workflow-stage',
    label: 'After workflow stage',
    summary: 'Runs after completing a multi-agent/workflow stage.',
    scope: 'workflow',
    status: 'partial',
    aliases: ['after-workflow-stage'],
  },
  {
    id: 'before-approval-request',
    label: 'Before requesting approval',
    summary: 'Runs before emitting an approval request.',
    scope: 'approval',
    status: 'partial',
    aliases: ['before-approval-request'],
  },
  {
    id: 'after-approval-resolution',
    label: 'After approval',
    summary: 'Runs after an approval is decided.',
    scope: 'approval',
    status: 'partial',
    aliases: ['after-approval-resolution'],
  },
  {
    id: 'before-session-send',
    label: 'Before session send',
    summary: 'Runs before a message is sent to an existing session.',
    scope: 'session',
    status: 'partial',
    aliases: ['before-session-send', 'session.before_send'],
  },
  {
    id: 'after-session-send',
    label: 'After session send',
    summary: 'Runs after a message is delivered to an existing session.',
    scope: 'session',
    status: 'partial',
    aliases: ['after-session-send', 'session.after_send'],
  },
  {
    id: 'before-session-spawn',
    label: 'Before opening session',
    summary: 'Runs before creating a derived session.',
    scope: 'session',
    status: 'partial',
    aliases: ['before-session-spawn', 'session.before_spawn'],
  },
  {
    id: 'after-session-spawn',
    label: 'After opening session',
    summary: 'Runs after creating a derived session.',
    scope: 'session',
    status: 'partial',
    aliases: ['after-session-spawn', 'session.after_spawn'],
  },
  {
    id: 'before-runtime-exec',
    label: 'Before execution',
    summary: 'Runs before shell/tool/runtime execution.',
    scope: 'runtime',
    status: 'ready',
    aliases: ['before-runtime-exec', 'tool.before_execute', 'runtime.before_execute'],
  },
  {
    id: 'after-runtime-exec',
    label: 'After execution',
    summary: 'Runs after shell/tool/runtime execution.',
    scope: 'runtime',
    status: 'ready',
    aliases: ['after-runtime-exec', 'tool.after_execute', 'runtime.after_execute'],
  },
  {
    id: 'runtime-exec-failed',
    label: 'Execution failure',
    summary: 'Runs when a runtime execution ends with failure.',
    scope: 'runtime',
    status: 'partial',
    aliases: ['runtime-exec-failed', 'runtime.exec_failed'],
  },
  {
    id: 'before-integration-action',
    label: 'Before hub action',
    summary: 'Runs before validating, repairing, or installing an integration.',
    scope: 'integration',
    status: 'partial',
    aliases: ['before-integration-action', 'integration.before_action'],
  },
  {
    id: 'after-integration-action',
    label: 'After hub action',
    summary: 'Runs after validating, repairing, or installing an integration.',
    scope: 'integration',
    status: 'partial',
    aliases: ['after-integration-action', 'integration.after_action'],
  },
  {
    id: 'before-plugin-action',
    label: 'Before plugin action',
    summary: 'Runs before inspecting, installing, trusting, or removing a plugin/skill.',
    scope: 'plugin',
    status: 'partial',
    aliases: ['before-plugin-action', 'plugin.before_action'],
  },
  {
    id: 'after-plugin-action',
    label: 'After plugin action',
    summary: 'Runs after inspecting, installing, trusting, or removing a plugin/skill.',
    scope: 'plugin',
    status: 'partial',
    aliases: ['after-plugin-action', 'plugin.after_action'],
  },
  {
    id: 'before-transport-action',
    label: 'Before transport action',
    summary: 'Runs before inspecting, preparing, or smoke-checking a remote transport.',
    scope: 'transport',
    status: 'partial',
    aliases: ['before-transport-action', 'transport.before_action'],
  },
  {
    id: 'after-transport-action',
    label: 'After transport action',
    summary: 'Runs after inspecting, preparing, or smoke-checking a remote transport.',
    scope: 'transport',
    status: 'partial',
    aliases: ['after-transport-action', 'transport.after_action'],
  },
  {
    id: 'before-complete',
    label: 'Before completion',
    summary: 'Legacy workspace completion event.',
    scope: 'release',
    status: 'ready',
    aliases: ['before-complete'],
  },
  {
    id: 'before-publish',
    label: 'Before publish',
    summary: 'Legacy workspace publish event.',
    scope: 'release',
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
        headline: hooks.length ? `Pipeline de hooks com ${hooks.length} hook(s) active(s).`
          : 'No hook operational active ainda.',
        operatorSummary: hooks.length ? `${coveredEvents.size} evento(s) canonical(s) coberto(s) no workspace current.`
          : 'Adicione uma section Hooks ao ZAVORTH.md para ativar o pipeline.',
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
