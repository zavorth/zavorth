import {
  ZAVORTH_AGENT_KERNEL_SNAPSHOT_VERSION,
  type ZavorthIntentDecision,
  type ZavorthIntentDecisionKind,
} from '../contracts/ZavorthAgentKernelSnapshotContract.js';
import { NaturalLanguageRouter } from '../cognitive-firewall/NaturalLanguageRouter.js';

export type ZavorthIntentDecisionInput = {
  text: string;
  channel?: string | null;
  profileId?: string | null;
  requestedTools?: string[] | null;
  /** Structured kind only — free text never keyword-selects product surfaces. */
  kind?: ZavorthIntentDecisionKind | null;
  metadata?: Record<string, unknown> | null;
};

export type ZavorthIntentDecisionRuntime = {
  now?: () => Date;
  naturalLanguageRouter?: Pick<NaturalLanguageRouter, 'route'>;
};

const STRUCTURED_KINDS: readonly ZavorthIntentDecisionKind[] = [
  'direct_response',
  'zavorth_action',
  'memory',
  'background_task',
  'swarm',
  'sandbox',
  'channel',
  'approval',
] as const;

export class ZavorthIntentDecisionService {
  private readonly now: () => Date;
  private readonly router: Pick<NaturalLanguageRouter, 'route'>;

  constructor(runtime: ZavorthIntentDecisionRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.router = runtime.naturalLanguageRouter || new NaturalLanguageRouter();
  }

  public decide(input: ZavorthIntentDecisionInput): ZavorthIntentDecision {
    const text = normalize(input.text);
    const natural = this.router.route(text);
    const kind = this.resolveKind(input);
    const risk = this.estimateRisk(kind);
    const requiresApproval =
      risk === 'danger' || kind === 'approval' || kind === 'sandbox' || kind === 'channel' || kind === 'zavorth_action';
    const requiresPreview = requiresApproval || ['zavorth_action', 'sandbox', 'channel', 'swarm'].includes(kind);

    return {
      contractVersion: ZAVORTH_AGENT_KERNEL_SNAPSHOT_VERSION,
      generatedAt: this.now().toISOString(),
      kind,
      confidence: kind === 'direct_response' ? 0.5 : 0.9,
      risk,
      reason: this.reasonFor(kind, text),
      nextSurface: this.nextSurface(kind),
      suggestedActionId: this.suggestActionId(kind, input),
      requiresPreview,
      requiresApproval,
      backgroundAllowed: ['background_task', 'swarm'].includes(kind),
      fallback: kind === 'direct_response' ? 'direct_response' : 'zavorth_action',
      hints: {
        cognitiveCategory: String(natural.intentCategory || 'full_toolset'),
        useFastModel: Boolean(natural.useFastModel),
        trivialChat: false,
      },
    };
  }

  /**
   * Free text always → direct_response (LLM + tools).
   * Structured input.kind (or metadata.kind) selects product surfaces.
   */
  private resolveKind(input: ZavorthIntentDecisionInput): ZavorthIntentDecisionKind {
    const fromField = normalizeKind(input.kind);
    if (fromField) return fromField;
    const metaKind = normalizeKind(input.metadata?.kind);
    if (metaKind) return metaKind;
    return 'direct_response';
  }

  private estimateRisk(kind: ZavorthIntentDecisionKind): ZavorthIntentDecision['risk'] {
    if (['sandbox', 'channel', 'zavorth_action', 'approval', 'swarm'].includes(kind)) {
      return 'attention';
    }
    return 'safe';
  }

  private reasonFor(kind: ZavorthIntentDecisionKind, text: string): string {
    if (!text) return 'Empty request; direct response is the safest route.';
    const reasons: Record<ZavorthIntentDecisionKind, string> = {
      direct_response: 'Free text is model-owned; no keyword product routing. LLM + tools decide.',
      zavorth_action: 'Structured zavorth_action intent; use Action Harness.',
      memory: 'Structured memory intent; use Mnemos memory contracts.',
      background_task: 'Structured background_task intent; use Task Plane/Goal Loop.',
      swarm: 'Structured swarm intent; use workload assessment and parallel workers.',
      sandbox: 'Structured sandbox intent; use sandbox policy first.',
      channel: 'Structured channel intent; normalize and enforce channel policy.',
      approval: 'Structured approval intent; route through approvals.',
    };
    return reasons[kind];
  }

  private nextSurface(kind: ZavorthIntentDecisionKind): string {
    const surfaces: Record<ZavorthIntentDecisionKind, string> = {
      direct_response: 'llm',
      zavorth_action: 'action-harness',
      memory: 'mnemos',
      background_task: 'task-plane',
      swarm: 'swarm-scale-plane',
      sandbox: 'sandbox-control-plane',
      channel: 'channel-mesh',
      approval: 'approval-plane',
    };
    return surfaces[kind];
  }

  private suggestActionId(kind: ZavorthIntentDecisionKind, input: ZavorthIntentDecisionInput): string | null {
    const structured = normalize(input.metadata?.suggestedActionId);
    if (structured) return structured;
    if (kind === 'memory') return 'memory.search';
    if (kind === 'zavorth_action') return 'action.schema.lookup';
    if (kind === 'background_task') return 'tasks.create';
    if (kind === 'approval') return 'approvals.status';
    return null;
  }
}

function normalizeKind(value: unknown): ZavorthIntentDecisionKind | null {
  const raw = String(value ?? '').trim() as ZavorthIntentDecisionKind;
  return STRUCTURED_KINDS.includes(raw) ? raw : null;
}

function normalize(value: unknown): string {
  return String(value ?? '').trim();
}
