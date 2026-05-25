import {
  EXPERIENCE_PLAN_CONTRACT_VERSION,
  type ExperienceAction,
  type ExperienceCommand,
  type ExperienceJourneyKind,
  type ExperiencePlan,
  type ExperiencePlanStep,
} from './ExperienceContracts.js';

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function makeAction(input: {
  id: string;
  label: string;
  kind: ExperienceAction['kind'];
  reason: string;
  command?: string | null;
  route?: string | null;
  risk?: ExperienceAction['risk'];
  requiresApproval?: boolean;
}): ExperienceAction {
  return {
    id: input.id,
    label: input.label,
    kind: input.kind,
    command: input.command ?? null,
    route: input.route ?? null,
    risk: input.risk || 'safe',
    requiresApproval: input.requiresApproval === true,
    reason: input.reason,
  };
}

function step(id: string, title: string, detail: string, status: ExperiencePlanStep['status'] = 'pending'): ExperiencePlanStep {
  return { id, title, detail, status };
}

export class NaturalCommandRouterService {
  public route(command: ExperienceCommand): ExperiencePlan {
    const text = String(command.text || '').trim();
    const normalized = normalizeText(text);
    const explicit = command.intent;
    const kind = this.resolveKind(normalized, explicit);
    const risk = this.resolveRisk(kind, normalized);
    const requiresApproval = this.requiresApproval(kind, normalized);
    const shouldExecuteAgent = this.shouldExecuteAgent(kind, normalized, explicit);
    const title = this.titleFor(kind);
    const summary = this.summaryFor(kind, text);
    const nextSafeAction = this.nextSafeActionFor(kind, requiresApproval);
    const actions = this.actionsFor(kind, text, command);

    return {
      contractVersion: EXPERIENCE_PLAN_CONTRACT_VERSION,
      id: `experience-plan:${kind}:${Date.now().toString(36)}`,
      kind,
      title,
      summary,
      nextSafeAction,
      risk,
      requiresApproval,
      shouldExecuteAgent,
      steps: this.stepsFor(kind, requiresApproval, shouldExecuteAgent),
      actions,
      metadata: {
        normalizedIntent: normalized,
        explicitIntent: explicit || null,
        surface: command.surface,
      },
    };
  }

  private resolveKind(normalized: string, explicit?: ExperienceCommand['intent']): ExperienceJourneyKind {
    if (explicit === 'open-dashboard') return 'dashboard';
    if (explicit === 'diagnose') return 'diagnostics';
    if (explicit === 'approve' || explicit === 'reject') return 'approval';
    if (explicit === 'learn') return 'learning';
    if (explicit === 'memory') return 'memory';
    if (explicit === 'setup') return 'first-run';

    if (/\b(aprovar|approve|rejeitar|reject)\b/.test(normalized)) return 'approval';
    if (/\b(aprendi|aprendizado|learning|learn|memoria|memory|preferencia|preference)\b/.test(normalized)) {
      return /\b(memoria|memory|recall|lembr)\b/.test(normalized) ? 'memory' : 'learning';
    }
    if (/\b(abrir|open|dashboard|painel|control|dashboard)\b/.test(normalized)) return 'dashboard';
    if (/\b(doctor|diagnostico|diagnose|status|bloqueado|blocked|erro|falha|health|ready)\b/.test(normalized)) {
      return /\b(bloqueado|blocked|por que|porque|why)\b/.test(normalized) ? 'explain-block' : 'diagnostics';
    }
    if (/\b(provider|modelo|model|openai|gemini|anthropic|openrouter|ollama)\b/.test(normalized)) return 'provider-setup';
    if (/\b(telegram|discord|slack|email|canal|channel|whatsapp|signal)\b/.test(normalized)) return 'channel-setup';
    if (/\b(seguranca|security|audit|auditar|vulnerabilidade|owasp|secrets?)\b/.test(normalized)) return 'security-audit';
    if (/\b(release|ship|deploy|publicar|lancar)\b/.test(normalized)) return 'release';
    if (/\b(automatizar|automacao|schedule|scheduler|cron|rotina)\b/.test(normalized)) return 'automation';
    if (/\b(revisar|review|corrigir|fix|bug|feature|implementar|codigo|code|repo|workspace|testar|teste)\b/.test(normalized)) {
      return /\b(revisar|revise|review)\b/.test(normalized) ? 'workspace-review' : 'code-task';
    }
    if (/\b(setup|configurar|comecar|onboarding|primeiro uso|first run)\b/.test(normalized)) return 'first-run';
    return 'conversation';
  }

  private resolveRisk(kind: ExperienceJourneyKind, normalized: string): ExperienceAction['risk'] {
    if (kind === 'security-audit' || kind === 'diagnostics' || kind === 'dashboard' || kind === 'memory' || kind === 'learning') {
      return 'safe';
    }
    if (kind === 'approval') return 'attention';
    if (/\b(delete|deletar|remover|rm\s+-|formatar|publish|publicar|deploy|enviar|send|shell|powershell|npm|pnpm|yarn|git)\b/.test(normalized)) {
      return 'danger';
    }
    if (kind === 'code-task' || kind === 'automation' || kind === 'release' || kind === 'channel-setup' || kind === 'provider-setup') {
      return 'attention';
    }
    return 'safe';
  }

  private requiresApproval(kind: ExperienceJourneyKind, normalized: string): boolean {
    if (kind === 'approval') return false;
    if (kind === 'dashboard' || kind === 'diagnostics' || kind === 'memory' || kind === 'learning' || kind === 'conversation') {
      return false;
    }
    return /\b(delete|deletar|remover|rm\s+-|formatar|publish|publicar|deploy|enviar|send|instalar|install|shell|powershell)\b/.test(normalized);
  }

  private shouldExecuteAgent(kind: ExperienceJourneyKind, normalized: string, explicit?: ExperienceCommand['intent']): boolean {
    if (explicit === 'run') return true;
    if (kind === 'dashboard' || kind === 'diagnostics' || kind === 'approval' || kind === 'learning' || kind === 'memory') return false;
    if (kind === 'conversation') return normalized.length > 0;
    return true;
  }

  private titleFor(kind: ExperienceJourneyKind): string {
    const titles: Record<ExperienceJourneyKind, string> = {
      conversation: 'Conversa natural',
      'first-run': 'Primeiro uso guiado',
      'provider-setup': 'Configurar provider',
      'channel-setup': 'Conectar canal',
      'workspace-review': 'Revisar workspace',
      'code-task': 'Executar tarefa de codigo',
      'security-audit': 'Auditoria de seguranca',
      'explain-block': 'Explicar bloqueio',
      approval: 'Resolver aprovacao',
      memory: 'Consultar memoria',
      learning: 'Revisar aprendizado',
      dashboard: 'Abrir Dashboard',
      diagnostics: 'Diagnosticar runtime',
      release: 'Preparar release',
      automation: 'Automatizar rotina',
    };
    return titles[kind];
  }

  private summaryFor(kind: ExperienceJourneyKind, text: string): string {
    const request = String(text || '').trim();
    if (kind === 'dashboard') return 'Abrir a superficie visual principal do Zavorth.';
    if (kind === 'diagnostics') return 'Ler sinais de readiness, runtime e proximas acoes seguras.';
    if (kind === 'learning') return 'Mostrar, aprovar, rejeitar ou exportar aprendizados governados.';
    if (kind === 'memory') return 'Consultar sinais de memoria e continuidade do workspace.';
    return request ? `Plano natural-first para: ${request}` : 'Plano natural-first pronto para receber o pedido.';
  }

  private nextSafeActionFor(kind: ExperienceJourneyKind, requiresApproval: boolean): string {
    if (requiresApproval) return 'Revisar o Trust Lens antes de executar qualquer efeito sensivel.';
    if (kind === 'dashboard') return 'Abrir /dashboard.';
    if (kind === 'learning') return 'Revisar candidatos antes de promover comportamento futuro.';
    if (kind === 'diagnostics') return 'Ler o diagnostico e escolher a correcao guiada.';
    return 'Executar em modo governado e publicar timeline/receipt.';
  }

  private stepsFor(
    kind: ExperienceJourneyKind,
    requiresApproval: boolean,
    shouldExecuteAgent: boolean,
  ): ExperiencePlanStep[] {
    const steps = [
      step('intent', 'Entender intencao', `Rota selecionada: ${kind}.`, 'done'),
      step('context', 'Carregar contexto', 'Unificar runtime, memoria, approvals e receipts.'),
    ];
    if (requiresApproval) {
      steps.push(step('approval', 'Preparar aprovacao', 'Mostrar risco, escopo e alternativa em sandbox.', 'blocked'));
    }
    if (shouldExecuteAgent) {
      steps.push(step('execute', 'Executar agente', 'Usar loop LLM/tool governado quando necessario.'));
      steps.push(step('receipt', 'Emitir receipt', 'Registrar evidencias, resultados e aprendizado candidato.'));
    }
    if (kind === 'learning') {
      steps.push(step('learning', 'Revisar aprendizado', 'Promover apenas candidatos aprovados pelo usuario.'));
    }
    return steps;
  }

  private actionsFor(kind: ExperienceJourneyKind, text: string, command: ExperienceCommand): ExperienceAction[] {
    const requestText = String(text || '').trim();
    const actions: ExperienceAction[] = [
      makeAction({
        id: 'experience.ask',
        label: 'Continuar por linguagem natural',
        kind: 'natural',
        command: requestText ? `zavorth ask "${requestText.replace(/"/g, '\\"')}"` : 'zavorth ask "<pedido>"',
        reason: 'Mantem CLI e Dashboard na mesma rota de experiencia.',
      }),
    ];
    if (kind === 'dashboard') {
      actions.push(makeAction({
        id: 'dashboard.open',
        label: 'Abrir Dashboard',
        kind: 'navigation',
        command: 'zavorth open',
        route: '/dashboard',
        reason: 'O Dashboard e a superficie visual oficial.',
      }));
    }
    if (kind === 'diagnostics' || kind === 'explain-block') {
      actions.push(makeAction({
        id: 'runtime.doctor',
        label: 'Rodar diagnostico',
        kind: 'diagnostic',
        command: 'zavorth doctor',
        reason: 'Mostra readiness e proxima acao segura.',
      }));
    }
    if (kind === 'learning') {
      actions.push(makeAction({
        id: 'learning.review',
        label: 'Revisar aprendizados',
        kind: 'learning',
        command: 'zavorth learn',
        reason: 'Aprendizados so mudam comportamento apos revisao.',
      }));
    }
    if (kind === 'approval' && command.approval?.id) {
      actions.push(makeAction({
        id: `approval.${command.approval.decision}`,
        label: command.approval.decision === 'approve' ? 'Aprovar acao' : 'Rejeitar acao',
        kind: 'approval',
        command: `zavorth ${command.approval.decision} ${command.approval.id}`,
        reason: 'Resolve a aprovacao governada pelo runtime.',
        risk: 'attention',
      }));
    }
    return actions;
  }
}
