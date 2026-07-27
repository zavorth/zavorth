import type {
  CapabilityAutopilotAudience,
  CapabilityAutopilotSurface,
} from '../contracts/CapabilityAutopilotContract.js';
import type {
  CapabilityPreflightHintKind,
  CapabilityPreflightHintResult,
  CapabilityPreflightHintStatus,
} from './CapabilityAutopilotPreflightHintService.js';
import { CapabilityAutopilotPreflightHintService } from './CapabilityAutopilotPreflightHintService.js';

type PreflightHintLike = Pick<CapabilityAutopilotPreflightHintService, 'buildPreflightHint'>;

export type CapabilityPreflightSurfaceActionKind =
  | 'view_preflight'
  | 'run_diagnosis'
  | 'request_permission'
  | 'show_fallbacks'
  | 'run_validation'
  | 'resume_after_check'
  | 'open_memory_hint';

export type CapabilityPreflightSurfaceAction = {
  id: string;
  kind: CapabilityPreflightSurfaceActionKind;
  label: string;
  description: string;
  requiresExplicitUserAction: true;
  enabled: boolean;
  command?: string | null;
  route?: string | null;
  callbackData?: string | null;
  metadata?: Record<string, unknown>;
};

export type CapabilityPreflightSurfacePayload = {
  generatedAt: string;
  surface: CapabilityAutopilotSurface;
  audience: CapabilityAutopilotAudience;
  capabilityId: string;
  status: CapabilityPreflightHintStatus;
  hintKind: CapabilityPreflightHintKind;
  tone: 'neutral' | 'attention' | 'blocked' | 'success';
  headline: string;
  body: string;
  technicalBody?: string | null;
  readinessSummary: string;
  recallSummary: string;
  recommendedNextAction: string | null;
  shouldAskPermission: boolean;
  requiresExplicitUserChoice: boolean;
  shouldRunAutomatically: false;
  actions: CapabilityPreflightSurfaceAction[];
  hint: CapabilityPreflightHintResult;
  metadata: Record<string, unknown>;
};

export type CapabilityPreflightSurfaceInput = {
  hint: CapabilityPreflightHintResult;
  surface?: CapabilityAutopilotSurface;
  audience?: CapabilityAutopilotAudience;
};

export type CapabilityAutopilotPreflightSurfaceRuntime = {
  now?: () => Date;
  hintService?: PreflightHintLike;
};

const COMPACT_SURFACES = new Set<CapabilityAutopilotSurface>(['chat', 'telegram', 'mobile']);

export class CapabilityAutopilotPreflightSurfaceService {
  private readonly now: () => Date;
  private readonly hintService: PreflightHintLike;

  constructor(runtime: CapabilityAutopilotPreflightSurfaceRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.hintService = runtime.hintService || new CapabilityAutopilotPreflightHintService({
      now: this.now,
    });
  }

  public async buildCapabilityPreflightPayload(
    capabilityId: string,
    options: Parameters<CapabilityAutopilotPreflightHintService['buildPreflightHint']>[0] & {
      surface?: CapabilityAutopilotSurface;
      audience?: CapabilityAutopilotAudience;
    },
  ): Promise<CapabilityPreflightSurfacePayload> {
    const hint = await this.hintService.buildPreflightHint({
      ...options,
      capabilityId,
    });
    return this.buildPayload({
      hint,
      surface: options.surface,
      audience: options.audience,
    });
  }

  public buildPayload(input: CapabilityPreflightSurfaceInput): CapabilityPreflightSurfacePayload {
    const surface = input.surface || 'cli';
    const audience = input.audience || 'everyday_user';

    return {
      generatedAt: this.now().toISOString(),
      surface,
      audience,
      capabilityId: input.hint.capabilityId,
      status: input.hint.status,
      hintKind: input.hint.hintKind,
      tone: this.resolveTone(input.hint),
      headline: this.buildHeadline(input.hint, surface, audience),
      body: this.buildBody(input.hint, surface, audience),
      technicalBody: audience === 'technical_operator' || surface === 'api'
        ? input.hint.technicalSummary
        : null,
      readinessSummary: `${input.hint.readiness.status}: ${input.hint.readiness.summary}`,
      recallSummary: input.hint.recall.safeSummary,
      recommendedNextAction: input.hint.recommendedNextAction,
      shouldAskPermission: input.hint.shouldAskPermission,
      requiresExplicitUserChoice: input.hint.requiresExplicitUserChoice,
      shouldRunAutomatically: false,
      actions: this.buildActions(input.hint, surface),
      hint: input.hint,
      metadata: {
        gate: 'capability-autopilot-preflight-surface',
        compact: COMPACT_SURFACES.has(surface),
        sourceHintStatus: input.hint.status,
        sourceHintKind: input.hint.hintKind,
        autoExecute: false,
        rawIntentStored: false,
        rawWorkspaceStored: false,
      },
    };
  }

  public buildPayloads(
    hint: CapabilityPreflightHintResult,
    surfaces: CapabilityAutopilotSurface[],
    audience: CapabilityAutopilotAudience = 'everyday_user',
  ): CapabilityPreflightSurfacePayload[] {
    return surfaces.map((surface) => this.buildPayload({ hint, surface, audience }));
  }

  private resolveTone(hint: CapabilityPreflightHintResult): CapabilityPreflightSurfacePayload['tone'] {
    if (hint.status === 'insufficient_signal') {
      return 'neutral';
    }
    if (hint.status === 'no_hint') {
      return hint.readiness.severity === 'critical' ? 'blocked' : 'attention';
    }
    if (hint.hintKind === 'ready') {
      return 'success';
    }
    if (hint.hintKind === 'manual') {
      return 'blocked';
    }
    return 'attention';
  }

  private buildHeadline(
    hint: CapabilityPreflightHintResult,
    surface: CapabilityAutopilotSurface,
    audience: CapabilityAutopilotAudience,
  ): string {
    if (surface === 'api') {
      return `${hint.capabilityId}:preflight:${hint.status}:${hint.hintKind}`;
    }
    if (audience === 'technical_operator') {
      return `${hint.headline} (${hint.status}/${hint.hintKind})`;
    }
    return hint.headline;
  }

  private buildBody(
    hint: CapabilityPreflightHintResult,
    surface: CapabilityAutopilotSurface,
    audience: CapabilityAutopilotAudience,
  ): string {
    const chunks = [
      audience === 'technical_operator' ? hint.technicalSummary : hint.userSummary,
    ];
    if (hint.shouldAskPermission) {
      chunks.push('Any next action needs contextual permission.');
    }
    if (hint.requiresExplicitUserChoice) {
      chunks.push('The choice must be explicit; nothing will be done automatically.');
    }
    chunks.push('This preflight is only a safe suggestion.');

    const text = chunks.filter(Boolean).join(' ');
    if (surface === 'telegram' || surface === 'mobile') {
      return this.truncate(text, 420);
    }
    if (surface === 'chat') {
      return this.truncate(text, 700);
    }
    return text;
  }

  private buildActions(
    hint: CapabilityPreflightHintResult,
    surface: CapabilityAutopilotSurface,
  ): CapabilityPreflightSurfaceAction[] {
    const actions: CapabilityPreflightSurfaceAction[] = [
      this.action({
        id: 'view-preflight',
        kind: 'view_preflight',
        label: surface === 'api' ? 'view_preflight' : 'Ver preflight',
        description: 'View readiness, found memory, and recommendation reason.',
        command: surface === 'cli' ? `npm run capability-autopilot -- --capability=${hint.capabilityId}` : null,
        route: this.route(surface, hint, null),
        callbackData: this.callback(surface, hint, 'preflight'),
      }),
    ];

    if (hint.status !== 'hint_available') {
      actions.push(this.action({
        id: 'run-diagnosis',
        kind: 'run_diagnosis',
        label: surface === 'api' ? 'run_diagnosis' : 'run diagnostic',
        description: 'Follow the normal readiness, diagnostic, and repair-plan flow.',
        command: surface === 'cli' ? `npm run capability-autopilot -- --capability=${hint.capabilityId}` : null,
        route: this.route(surface, hint, 'diagnosis'),
        callbackData: this.callback(surface, hint, 'diagnosis'),
      }));
      return actions;
    }

    actions.push(this.action({
      id: 'open-memory-hint',
      kind: 'open_memory_hint',
      label: surface === 'api' ? 'open_memory_hint' : 'View memory',
      description: 'Open the safe summary of procedural memory used as a hint.',
      command: null,
      route: this.route(surface, hint, 'memory'),
      callbackData: this.callback(surface, hint, 'memory'),
    }));

    if (hint.hintKind === 'fallback') {
      actions.push(this.action({
        id: 'show-fallbacks',
        kind: 'show_fallbacks',
        label: surface === 'api' ? 'show_fallbacks' : 'Mostrar alternativas',
        description: 'Show fallback(s) for explicit user choice.',
        command: null,
        route: this.route(surface, hint, 'fallbacks'),
        callbackData: this.callback(surface, hint, 'fallbacks'),
      }));
    }

    if (hint.hintKind === 'permission' || hint.hintKind === 'repair') {
      actions.push(this.action({
        id: 'request-permission',
        kind: 'request_permission',
        label: surface === 'api' ? 'request_permission' : 'Prepare permission',
        description: 'Prepare contextual approval before any repair or fallback.',
        command: null,
        route: this.route(surface, hint, 'permission'),
        callbackData: this.callback(surface, hint, 'permission'),
      }));
    }

    if (hint.hintKind === 'ready') {
      actions.push(this.action({
        id: 'run-validation',
        kind: 'run_validation',
        label: surface === 'api' ? 'run_validation' : 'validate de novo',
        description: 'Revalidar readiness before resume o request original.',
        command: surface === 'cli' ? `npm run capability-autopilot:resume -- --capability=${hint.capabilityId}` : null,
        route: this.route(surface, hint, 'validate'),
        callbackData: this.callback(surface, hint, 'validate'),
      }));
      actions.push(this.action({
        id: 'resume-after-check',
        kind: 'resume_after_check',
        label: surface === 'api' ? 'resume_after_check' : 'Resume after check',
        description: 'resume only after governed validation.',
        command: surface === 'cli' ? `npm run capability-autopilot:resume -- --capability=${hint.capabilityId}` : null,
        route: this.route(surface, hint, 'resume'),
        callbackData: this.callback(surface, hint, 'resume'),
      }));
    }

    return actions;
  }

  private action(input: {
    id: string;
    kind: CapabilityPreflightSurfaceActionKind;
    label: string;
    description: string;
    command?: string | null;
    route?: string | null;
    callbackData?: string | null;
    enabled?: boolean;
    metadata?: Record<string, unknown>;
  }): CapabilityPreflightSurfaceAction {
    return {
      id: input.id,
      kind: input.kind,
      label: input.label,
      description: input.description,
      requiresExplicitUserAction: true,
      enabled: input.enabled !== false,
      command: input.command || null,
      route: input.route || null,
      callbackData: input.callbackData || null,
      metadata: input.metadata || {},
    };
  }

  private route(
    surface: CapabilityAutopilotSurface,
    hint: CapabilityPreflightHintResult,
    suffix: string | null,
  ): string | null {
    const base = surface === 'api'
      ? `/api/capabilities/${hint.capabilityId}/autopilot/preflight`
      : (surface === 'web' || surface === 'mobile'
        ? `/capabilities/${hint.capabilityId}/autopilot/preflight`
        : null);
    if (!base || !suffix) {
      return base;
    }
    return `${base}/${suffix}`;
  }

  private callback(
    surface: CapabilityAutopilotSurface,
    hint: CapabilityPreflightHintResult,
    action: string,
  ): string | null {
    if (surface !== 'telegram' && surface !== 'chat') {
      return null;
    }
    return `capability_autopilot_preflight:${hint.capabilityId}:${action}`;
  }

  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
  }
}
