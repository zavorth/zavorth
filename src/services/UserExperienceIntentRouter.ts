export type UserExperienceIntentKind =
  | 'chat'
  | 'answer'
  | 'explain'
  | 'plan'
  | 'preview'
  | 'execute'
  | 'approve'
  | 'configure'
  | 'diagnose';

export type UserExperienceIntentDecision = {
  source: 'UserExperienceIntentRouter';
  contractVersion: 'user-experience-intent-router/1';
  kind: UserExperienceIntentKind;
  confidence: 'low' | 'medium' | 'high';
  shouldUseTools: boolean;
  shouldAskApproval: boolean;
  explicitAction: boolean;
  explicitTarget: boolean;
  reason: string;
  signals: string[];
};

export type UserExperienceIntentInput = {
  text: string;
  explicitExecution?: boolean | null;
  hasAttachments?: boolean | null;
  hasContextualMentions?: boolean | null;
};

function normalizeText(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function hasUrl(text: string): boolean {
  return /https?:\/\/|www\./i.test(text);
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

const GREETING_PATTERNS = [
  /^(oi|ola|hey|hello|bom dia|boa tarde|boa noite|tudo bem)[!.?\s]*$/i,
  /^(valeu|obrigado|obrigada|thanks|ok|beleza|show|perfeito)[!.?\s]*$/i,
];

const QUESTION_PATTERNS = [
  /\?$/,
  /\b(o que|como|por que|porque|qual|quais|quando|onde|me diga|me explica|explique|entendi|nao entendi)\b/i,
];

const CONCEPTUAL_PATTERNS = [
  /\b(ideia|opiniao|acha|pense|brainstorm|estrategia|conceito|explicacao|duvida)\b/i,
];

const PLAN_PATTERNS = [
  /\b(plano|planeje|arquitetura|roadmap|fases|etapas|como implementaria|como faria|desenhe)\b/i,
];

const CONFIGURE_PATTERNS = [
  /\b(configure|configurar|setup|instalar|conectar|habilitar|ativar|provider|modelo|telegram|discord|slack|whatsapp|canal|mnemos|memoria)\b/i,
];

const DIAGNOSE_PATTERNS = [
  /\b(status|doctor|diagnostico|verifique saude|verificar saude|health|readiness|pronto|funcionando|falhando|erro|bug)\b/i,
];

const APPROVAL_PATTERNS = [
  /\b(aprovo|aprovado|autoriza|autorizo|permito|pode continuar|continue|sim pode|confirmo|aceito)\b/i,
];

const PREVIEW_PATTERNS = [
  /\b(preview|previsualize|simule|dry run|dry-run|antes de aplicar|sem aplicar|sem executar|me mostre antes)\b/i,
];

const EXECUTION_VERB_PATTERNS = [
  /\b(rode|rodar|execute|executar|corrija|corrigir|edite|editar|altere|alterar|crie|criar|apague|apagar|delete|remova|remover|salve|aplique|faca|implemente|instale|install|publique|publicar|push|commit|deploy)\b/i,
];

const EXPLICIT_TARGET_PATTERNS = [
  /\b(arquivo|file|pasta|folder|workspace|repo|repositorio|codigo|package\.json|\.ts\b|\.tsx\b|\.js\b|\.json\b|terminal|shell|powershell|npm|pnpm|yarn|git|docker|build|testes?|api|endpoint|database|banco)\b/i,
  /\b(link|url|site|pagina|website)\b/i,
];

const WEB_OPERATION_PATTERNS = [
  /\b(pesquise|pesquisar|buscar|busque|procure|acesse|acessar|abra|abrir|navegue|fetch|baixe|download)\b/i,
  /\b(leia|ler|resuma|resumir|analise|analisar|verifique|verificar|extraia|extrair)\b[\s\S]{0,120}\b(link|url|site|pagina|website)\b/i,
  /\b(link|url|site|pagina|website)\b[\s\S]{0,120}\b(leia|ler|resuma|resumir|analise|analisar|verifique|verificar|extraia|extrair)\b/i,
];

export class UserExperienceIntentRouter {
  public decide(input: UserExperienceIntentInput): UserExperienceIntentDecision {
    const rawText = String(input.text || '').trim();
    const text = normalizeText(rawText);
    const signals: string[] = [];

    if (!text) {
      return this.decision('chat', 'high', false, false, false, false, 'Mensagem vazia fica em conversa leve.', ['empty']);
    }

    const explicitExecution = input.explicitExecution === true;
    const attachmentPresent = input.hasAttachments === true;
    const contextualMentions = input.hasContextualMentions === true;
    const hasLink = hasUrl(rawText);
    const explicitAction = explicitExecution || matchesAny(text, EXECUTION_VERB_PATTERNS);
    const explicitTarget = attachmentPresent || matchesAny(text, EXPLICIT_TARGET_PATTERNS);
    const explicitWebOperation = matchesAny(text, WEB_OPERATION_PATTERNS)
      || (hasLink && matchesAny(text, WEB_OPERATION_PATTERNS));

    if (explicitExecution) signals.push('explicit-execution');
    if (attachmentPresent) signals.push('attachment');
    if (contextualMentions) signals.push('contextual-mention');
    if (hasLink) signals.push('link-present');
    if (explicitAction) signals.push('explicit-action');
    if (explicitTarget) signals.push('explicit-target');
    if (explicitWebOperation) signals.push('explicit-web-operation');

    if (matchesAny(text, APPROVAL_PATTERNS)) {
      return this.decision('approve', 'high', true, false, true, explicitTarget, 'Mensagem parece aceitar ou continuar uma decisao pendente.', signals);
    }

    if (matchesAny(text, GREETING_PATTERNS)) {
      return this.decision('chat', 'high', false, false, false, false, 'Saudacao ou resposta curta deve ser conversa direta.', signals);
    }

    if (hasLink && !explicitWebOperation) {
      return this.decision('answer', 'high', false, false, false, false, 'Link compartilhado sem pedido de abrir, ler ou pesquisar deve ser tratado como conversa natural.', signals);
    }

    if (matchesAny(text, PREVIEW_PATTERNS)) {
      return this.decision('preview', 'high', true, false, explicitAction, explicitTarget, 'Usuario pediu preview/simulacao antes de aplicar.', signals);
    }

    if (attachmentPresent) {
      return this.decision('preview', 'high', true, false, true, true, 'Anexo exige leitura governada ou preview antes de acao.', signals);
    }

    if (explicitWebOperation) {
      return this.decision('preview', 'high', true, false, true, true, 'Pedido web explicito deve virar operacao governada.', signals);
    }

    if (explicitExecution || (explicitAction && explicitTarget)) {
      const approval = matchesAny(text, [/\b(apague|apagar|delete|remova|remover|publique|publicar|push|commit|deploy|sudo|senha|token|secret|pagamento|pagar|comprar|vender)\b/i]);
      return this.decision(approval ? 'execute' : 'preview', 'high', true, approval, true, true, approval
        ? 'Acao concreta e sensivel exige approval antes de execucao.'
        : 'Acao concreta com alvo real deve entrar no runtime governado.', signals);
    }

    if (matchesAny(text, CONFIGURE_PATTERNS)) {
      return this.decision('configure', 'medium', true, false, true, explicitTarget, 'Pedido de configuracao deve abrir fluxo guiado quando houver alvo concreto.', signals);
    }

    if (matchesAny(text, DIAGNOSE_PATTERNS)) {
      return this.decision('diagnose', 'medium', true, false, true, explicitTarget, 'Pedido de diagnostico/status pode usar readiness sem parecer erro tecnico.', signals);
    }

    if (matchesAny(text, PLAN_PATTERNS)) {
      return this.decision('plan', 'high', false, false, false, false, 'Pedido de plano ou arquitetura deve responder com LLM antes de executar.', signals);
    }

    if (matchesAny(text, QUESTION_PATTERNS) || matchesAny(text, CONCEPTUAL_PATTERNS)) {
      return this.decision('explain', 'high', false, false, false, false, 'Pergunta, duvida ou pedido de opiniao deve ir para resposta natural.', signals);
    }

    return this.decision('answer', 'medium', false, false, false, false, 'Sem alvo operacional claro; manter conversa natural.', signals);
  }

  private decision(
    kind: UserExperienceIntentKind,
    confidence: UserExperienceIntentDecision['confidence'],
    shouldUseTools: boolean,
    shouldAskApproval: boolean,
    explicitAction: boolean,
    explicitTarget: boolean,
    reason: string,
    signals: string[],
  ): UserExperienceIntentDecision {
    return {
      source: 'UserExperienceIntentRouter',
      contractVersion: 'user-experience-intent-router/1',
      kind,
      confidence,
      shouldUseTools,
      shouldAskApproval,
      explicitAction,
      explicitTarget,
      reason,
      signals: Array.from(new Set(signals)),
    };
  }
}
