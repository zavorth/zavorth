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
  metadata?: Record<string, unknown> | null;
};

export type ZavorthIntentDecisionRuntime = {
  now?: () => Date;
  naturalLanguageRouter?: Pick<NaturalLanguageRouter, 'route'>;
};

const ACTION_PATTERNS = [
  /\b(configur(e|ar|acao)|mude|alter(e|ar)|troque|ative|desative|governance|provider|provedor|home|wake|voice|canal|channel|skill|policy|setup|doctor)\b/iu,
  /\b(approval|approve|aprovar|governed|casual|sandbox|receipts?|recibos?)\b/iu,
];

const MEMORY_PATTERNS = [
  /\b(mem[oó]ria|lembre|recorde|esque[çc]a|forget|recall|mnemos|promote|corrija|correct|aprendizado|learning)\b/iu,
];

const BACKGROUND_PATTERNS = [
  /\b(background|segundo plano|continue depois|rod(e|ar) depois|long run|daemon|agende|cron|quando der|durante a noite)\b/iu,
];

const SWARM_PATTERNS = [
  /\b(todo o repo|projeto inteiro|codigo inteiro|auditoria completa|varra|analise tudo|muitos arquivos|centenas|milhares|massivo|larga escala|paralel[ao]|subagentes?)\b/iu,
];

const SANDBOX_PATTERNS = [
  /\b(rode|execut(e|ar)|instale|npm install|pnpm|yarn|pip install|build|test(es)?|script|shell|terminal|powershell|docker|wsl)\b/iu,
];

const CHANNEL_PATTERNS = [
  /\b(telegram|discord|slack|whatsapp|signal|teams|email|gmail|sms|instagram|canal|channel|mensagem|enviar para)\b/iu,
];

const APPROVAL_PATTERNS = [
  /\b(aprove|aprovar|rejeite|reject|defer|confirme|approval|pendente|permitir|bloquear)\b/iu,
];

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
    const ranked = this.rank(text);
    const best = ranked[0] || { kind: 'direct_response' as const, score: 0.25 };
    const risk = this.estimateRisk(text, best.kind);
    const requiresApproval = risk === 'danger'
      || best.kind === 'approval'
      || (best.kind === 'sandbox' && mutatingExecutionRequested(text))
      || (best.kind === 'channel' && outboundRequested(text))
      || (best.kind === 'zavorth_action' && mutatingActionRequested(text));
    const requiresPreview = requiresApproval || ['zavorth_action', 'sandbox', 'channel', 'swarm'].includes(best.kind);
    return {
      contractVersion: ZAVORTH_AGENT_KERNEL_SNAPSHOT_VERSION,
      generatedAt: this.now().toISOString(),
      kind: best.kind,
      confidence: round(best.score),
      risk,
      reason: this.reasonFor(best.kind, text),
      nextSurface: this.nextSurface(best.kind),
      suggestedActionId: this.suggestActionId(best.kind, text),
      requiresPreview,
      requiresApproval,
      backgroundAllowed: ['background_task', 'swarm'].includes(best.kind),
      fallback: best.kind === 'direct_response' ? 'direct_response' : 'zavorth_action',
      hints: {
        cognitiveCategory: String(natural.intentCategory || 'unknown'),
        useFastModel: Boolean(natural.useFastModel),
        trivialChat: Boolean(natural.isTrivialChat),
      },
    };
  }

  private rank(text: string): Array<{ kind: ZavorthIntentDecisionKind; score: number }> {
    const candidates: Array<{ kind: ZavorthIntentDecisionKind; score: number }> = [
      { kind: 'approval', score: score(text, APPROVAL_PATTERNS, 0.88) },
      { kind: 'zavorth_action', score: score(text, ACTION_PATTERNS, 0.82) },
      { kind: 'memory', score: score(text, MEMORY_PATTERNS, 0.78) },
      { kind: 'background_task', score: score(text, BACKGROUND_PATTERNS, 0.76) },
      { kind: 'swarm', score: score(text, SWARM_PATTERNS, 0.74) },
      { kind: 'sandbox', score: score(text, SANDBOX_PATTERNS, 0.72) },
      { kind: 'channel', score: score(text, CHANNEL_PATTERNS, 0.7) },
      { kind: 'direct_response', score: text.length < 160 ? 0.45 : 0.35 },
    ];
    if (isQuestionOnly(text)) {
      candidates.push({ kind: 'direct_response', score: 0.68 });
    }
    return candidates
      .filter((candidate) => candidate.score > 0)
      .sort((left, right) => right.score - left.score);
  }

  private estimateRisk(text: string, kind: ZavorthIntentDecisionKind): ZavorthIntentDecision['risk'] {
    if (/\b(delete|apague|remova|rm -rf|format|token|secret|senha|credencial|prod|deploy|send|enviar|publish|commit|push)\b/iu.test(text)) {
      return 'danger';
    }
    if (['sandbox', 'channel', 'zavorth_action', 'approval', 'swarm'].includes(kind)) {
      return 'attention';
    }
    return 'safe';
  }

  private reasonFor(kind: ZavorthIntentDecisionKind, text: string): string {
    if (!text) return 'Empty request; direct response is the safest route.';
    const reasons: Record<ZavorthIntentDecisionKind, string> = {
      direct_response: 'The request can be answered naturally without external effects.',
      zavorth_action: 'The request changes or inspects Zavorth configuration/runtime state; use Action Harness.',
      memory: 'The request addresses recall, forget, correction or learning; use Mnemos memory contracts.',
      background_task: 'The request describes deferred or long-running work; use Task Plane/Goal Loop.',
      swarm: 'The request is broad enough to benefit from workload assessment and parallel workers.',
      sandbox: 'The request asks for command execution, install, build or tests; use sandbox policy first.',
      channel: 'The request involves a communication channel; normalize intent and enforce channel policy.',
      approval: 'The request is an operator decision for pending work; route through approvals.',
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

  private suggestActionId(kind: ZavorthIntentDecisionKind, text: string): string | null {
    if (kind === 'memory') {
      if (/\b(forget|esque[çc]a|apague da mem[oó]ria)\b/iu.test(text)) return 'memory.forget';
      if (/\b(correct|corrija)\b/iu.test(text)) return 'memory.correct';
      if (/\b(promote|promova)\b/iu.test(text)) return 'memory.promote';
      return 'memory.search';
    }
    if (kind === 'zavorth_action') {
      if (/\b(governance|governed|casual|skill)\b/iu.test(text)) return 'skills.governance.set';
      if (/\b(home|ZAVORTH_HOME)\b/u.test(text)) return 'home.status';
      if (/\b(provider|provedor|modelo|model)\b/iu.test(text)) return 'providers.status';
      if (/\b(channel|canal|telegram|discord|slack|whatsapp)\b/iu.test(text)) return 'channels.status';
      if (/\b(wake|voice|microfone|echo)\b/iu.test(text)) return 'echo.wake.status';
      return 'action.schema.lookup';
    }
    if (kind === 'background_task') return 'tasks.create';
    if (kind === 'approval') return 'approvals.status';
    return null;
  }
}

function score(text: string, patterns: RegExp[], weight: number): number {
  if (!text) return 0;
  const matches = patterns.filter((pattern) => pattern.test(text)).length;
  return matches > 0 ? Math.min(0.99, weight + (matches - 1) * 0.05) : 0;
}

function mutatingExecutionRequested(text: string): boolean {
  return /\b(install|instale|rode|execut(e|ar)|delete|apague|write|edite|alter(e|ar)|build|test)\b/iu.test(text);
}

function outboundRequested(text: string): boolean {
  return /\b(enviar|send|poste|postar|publish|responda no|mande para)\b/iu.test(text);
}

function mutatingActionRequested(text: string): boolean {
  return /\b(mude|alter(e|ar)|troque|ative|desative|configure|set|switch|apply|aplique)\b/iu.test(text);
}

function isQuestionOnly(text: string): boolean {
  return /[?？]\s*$/u.test(text)
    || /^(o que|como|por que|qual|quando|onde|me diga|explique|what|how|why|which|when|where)\b/iu.test(text);
}

function normalize(value: unknown): string {
  return String(value ?? '').trim();
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
