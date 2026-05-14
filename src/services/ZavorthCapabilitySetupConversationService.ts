import {
  CAPABILITY_SETUP_CONVERSATION_CONTRACT_VERSION,
  type CapabilitySetupAudience,
  type CapabilitySetupConversationInput,
  type CapabilitySetupConversationSnapshot,
  type CapabilitySetupConversationStatus,
  type CapabilitySetupExplanationCard,
  type CapabilitySetupSecureRequest,
  type CapabilitySetupTask,
} from '../contracts/CapabilitySetupConversationContract.js';
import type {
  CapabilityActivationFlowSnapshot,
  CapabilityActivationFlowStatus,
} from '../contracts/CapabilityActivationFlowContract.js';
import type {
  CapabilityPackReadinessCheck,
  CapabilityPackReadinessCheckKind,
} from '../contracts/CapabilityPackReadinessContract.js';
import {
  ZavorthCapabilityActivationFlowService,
  type ZavorthCapabilityActivationFlowRuntime,
} from './ZavorthCapabilityActivationFlowService.js';

export type ZavorthCapabilitySetupConversationRuntime =
  ZavorthCapabilityActivationFlowRuntime
  & {
    now?: () => Date;
  };

const SECRET_PATTERNS: RegExp[] = [
  /\bxox[baprs]-[A-Za-z0-9-]{8,}\b/g,
  /\bsk-[A-Za-z0-9_-]{12,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9_]{12,}\b/g,
  /\bAIza[0-9A-Za-z_-]{12,}\b/g,
  /\b[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g,
  /\b(?:token|api[_ -]?key|secret|senha|password|chave)\s*[:=]\s*([^\s,;]+)/gi,
];

export class ZavorthCapabilitySetupConversationService {
  private readonly now: () => Date;
  private readonly activationFlow: ZavorthCapabilityActivationFlowService;

  constructor(runtime: ZavorthCapabilitySetupConversationRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.activationFlow = new ZavorthCapabilityActivationFlowService(runtime);
  }

  public buildSnapshot(input: CapabilitySetupConversationInput = {}): CapabilitySetupConversationSnapshot {
    const redactedText = input.text ? this.redact(input.text) : null;
    const flowSnapshot = this.activationFlow.buildSnapshot({
      ...input,
      text: redactedText || input.text || null,
    });
    const audience = input.audience || 'everyday';
    const status = this.toConversationStatus(flowSnapshot.status);
    const secureRequests = this.buildSecureRequests(flowSnapshot);
    const tasks = this.buildTasks(flowSnapshot, status);
    const explanationCards = this.buildExplanationCards(flowSnapshot, audience);

    return {
      contractVersion: CAPABILITY_SETUP_CONVERSATION_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      audience,
      status,
      request: {
        redactedText,
        packId: input.packId || null,
        targetItemId: input.targetItemId || null,
      },
      reply: this.buildReply(flowSnapshot, status, secureRequests, audience),
      tasks,
      secureRequests,
      explanationCards,
      flowSnapshot,
      safety: {
        noJargonByDefault: true,
        rawSecretsSerialized: false,
        liveActivationApplied: false,
        approvalStillRequired: flowSnapshot.status === 'waiting_approval',
        receiptsAvailable: flowSnapshot.receipts.length > 0,
      },
    };
  }

  public renderReply(input: CapabilitySetupConversationInput = {}): string {
    const snapshot = this.buildSnapshot(input);
    const lines = [
      snapshot.reply.headline,
      '',
      snapshot.reply.body,
      '',
      snapshot.reply.nextQuestion,
    ];

    if (snapshot.tasks.length > 0) {
      lines.push('', 'Agora:');
      for (const task of snapshot.tasks.slice(0, 5)) {
        lines.push(`- ${this.statusLabel(task.status)}: ${task.label} - ${task.plainSummary}`);
      }
    }

    if (snapshot.secureRequests.length > 0) {
      lines.push('', 'Entradas seguras:');
      for (const request of snapshot.secureRequests) {
        lines.push(`- ${request.label}: ${request.plainPrompt}`);
      }
    }

    lines.push('', snapshot.reply.reassurance);
    return lines.join('\n');
  }

  private toConversationStatus(status: CapabilityActivationFlowStatus): CapabilitySetupConversationStatus {
    if (status === 'blocked') {
      return 'blocked';
    }
    if (status === 'waiting_target') {
      return 'needs_choice';
    }
    if (status === 'waiting_secret_input') {
      return 'needs_secret';
    }
    if (status === 'waiting_readiness') {
      return 'needs_readiness';
    }
    if (status === 'waiting_approval') {
      return 'needs_approval';
    }
    return 'ready_for_owner';
  }

  private buildReply(
    flow: CapabilityActivationFlowSnapshot,
    status: CapabilitySetupConversationStatus,
    secureRequests: CapabilitySetupSecureRequest[],
    audience: CapabilitySetupAudience,
  ): CapabilitySetupConversationSnapshot['reply'] {
    const target = flow.target?.label || 'esse recurso';
    if (status === 'needs_choice') {
      return {
        headline: 'Me diga o que voce quer configurar.',
        body: 'Eu posso preparar canais, modelos, ferramentas e habilidades. Vou mostrar o que falta e nao vou ligar nada sozinho.',
        nextQuestion: 'Qual recurso voce quer usar?',
        reassurance: this.reassurance(audience),
      };
    }
    if (status === 'blocked') {
      return {
        headline: `Nao consigo continuar com ${target} ainda.`,
        body: 'Encontrei um bloqueio de seguranca ou configuracao. Antes de tentar de novo, precisamos corrigir o item apontado nos passos.',
        nextQuestion: 'Quer que eu mostre apenas o primeiro bloqueio para resolvermos um por vez?',
        reassurance: this.reassurance(audience),
      };
    }
    if (status === 'needs_secret') {
      const secretRequestCount = secureRequests.filter((request) => request.inputMode === 'secure-secret-entry').length;
      const missingText = secretRequestCount === 1
        ? 'Falta 1 credencial ou permissao'
        : `Faltam ${secretRequestCount || 'algumas'} credenciais ou permissoes`;
      return {
        headline: `${target} precisa de uma entrada segura.`,
        body: `${missingText}. Eu nao quero que voce cole valor sensivel em conversa comum; use entrada segura.`,
        nextQuestion: secureRequests[0]?.plainPrompt || 'Pode fornecer a credencial usando a entrada segura?',
        reassurance: this.reassurance(audience),
      };
    }
    if (status === 'needs_readiness') {
      return {
        headline: `${target} precisa passar por uma verificacao simples.`,
        body: 'As credenciais e o plano ja foram preparados, mas ainda falta confirmar algum passo local, permissao ou teste de funcionamento.',
        nextQuestion: 'Quer que eu liste o primeiro teste pendente em linguagem simples?',
        reassurance: this.reassurance(audience),
      };
    }
    if (status === 'needs_approval') {
      return {
        headline: `${target} esta pronto para voce aprovar.`,
        body: 'Tudo necessario foi planejado e registrado. A proxima etapa e uma aprovacao explicita do dono antes de qualquer uso real.',
        nextQuestion: 'Voce quer revisar o resumo antes de aprovar?',
        reassurance: this.reassurance(audience),
      };
    }
    return {
      headline: `${target} esta pronto para pedido controlado.`,
      body: 'O fluxo chegou ao estado esperado. Mesmo assim, nada foi ativado automaticamente; o proximo passo e enviar o pedido ao controle do dono.',
      nextQuestion: 'Quer que eu gere o pedido final de ativacao controlada?',
      reassurance: this.reassurance(audience),
    };
  }

  private buildTasks(
    flow: CapabilityActivationFlowSnapshot,
    status: CapabilitySetupConversationStatus,
  ): CapabilitySetupTask[] {
    return flow.steps.map((step) => ({
      id: step.id,
      label: this.humanStepLabel(step.id),
      status: step.status === 'done'
        ? 'done'
        : step.status === 'blocked'
          ? 'blocked'
          : step.status === 'next'
            ? 'next'
            : 'later',
      plainSummary: this.humanizeSummary(step.summary),
      whyItMatters: this.whyStepMatters(step.id, status),
    }));
  }

  private buildSecureRequests(flow: CapabilityActivationFlowSnapshot): CapabilitySetupSecureRequest[] {
    const secretRefs = flow.setupSnapshot?.secretPlan.missingRefs || [];
    const readinessChecks = flow.packReadinessSnapshot?.items
      .flatMap((item) => item.checks)
      .filter((check) => check.status !== 'passed') || [];
    const secretRequests = secretRefs.map((ref) => ({
      id: `secret:${ref}`,
      label: this.humanRef(ref),
      inputMode: 'secure-secret-entry' as const,
      rawValueAcceptedInChat: false as const,
      plainPrompt: `Informe ${this.humanRef(ref)} pela entrada segura. Nao cole o valor em texto normal.`,
    }));
    const readinessSecretRequests = readinessChecks
      .filter((check) => check.kind === 'secret-ref' || check.kind === 'env-key')
      .map((check) => ({
        id: check.id,
        label: this.checkTitle(check),
        inputMode: 'secure-secret-entry' as const,
        rawValueAcceptedInChat: false as const,
        plainPrompt: `${this.checkExplanation(check, 'everyday')} Use entrada segura; nao cole valores em texto normal.`,
      }));
    const confirmationRequests = readinessChecks
      .filter((check) => check.kind === 'manual-step' || check.kind === 'readiness-check' || check.kind === 'local-route')
      .slice(0, 4)
      .map((check) => ({
        id: check.id,
        label: this.checkTitle(check),
        inputMode: check.kind === 'local-route' ? 'local-check' as const : 'confirmation' as const,
        rawValueAcceptedInChat: false as const,
        plainPrompt: this.checkPrompt(check),
      }));
    return [...secretRequests, ...readinessSecretRequests, ...confirmationRequests];
  }

  private buildExplanationCards(
    flow: CapabilityActivationFlowSnapshot,
    audience: CapabilitySetupAudience,
  ): CapabilitySetupExplanationCard[] {
    const checks = flow.packReadinessSnapshot?.items.flatMap((item) => item.checks) || [];
    const cards: CapabilitySetupExplanationCard[] = checks
      .filter((check) => check.status !== 'passed')
      .slice(0, audience === 'everyday' ? 4 : 8)
      .map((check) => ({
        id: check.id,
        kind: check.kind,
        title: this.checkTitle(check),
        plainText: this.checkExplanation(check, audience),
      }));
    if (flow.status === 'waiting_approval') {
      cards.push({
        id: 'approval',
        kind: 'approval',
        title: 'Aprovacao final',
        plainText: 'Essa etapa existe para garantir que o Zavorth so use o recurso quando o dono confirmar.',
      });
    }
    if (!flow.target) {
      cards.push({
        id: 'target',
        kind: 'target',
        title: 'Escolha do recurso',
        plainText: 'Primeiro eu preciso saber qual canal, modelo, ferramenta ou habilidade voce quer configurar.',
      });
    }
    return cards;
  }

  private checkTitle(check: CapabilityPackReadinessCheck): string {
    const titles: Record<CapabilityPackReadinessCheckKind, string> = {
      'secret-ref': 'Credencial segura',
      'env-key': 'Configuracao do sistema',
      binary: 'Programa necessario',
      'manual-step': 'Confirmacao manual',
      'local-route': 'Teste local',
      'readiness-check': 'Teste de funcionamento',
      policy: 'Regra de seguranca',
    };
    return titles[check.kind];
  }

  private checkPrompt(check: CapabilityPackReadinessCheck): string {
    if (check.kind === 'local-route') {
      return 'Confirme se o servico local esta aberto e respondendo.';
    }
    if (check.kind === 'manual-step') {
      return 'Confirme quando esse passo manual estiver concluido.';
    }
    return 'Confirme quando esse teste estiver concluido.';
  }

  private checkExplanation(
    check: CapabilityPackReadinessCheck,
    audience: CapabilitySetupAudience,
  ): string {
    if (check.kind === 'secret-ref') {
      return 'E uma chave ou permissao guardada em local seguro. Eu so verifico se ela existe, sem ler o valor.';
    }
    if (check.kind === 'env-key') {
      return 'E uma configuracao que o programa precisa encontrar no ambiente. O valor nao aparece no relatorio.';
    }
    if (check.kind === 'local-route') {
      return 'E um teste para ver se um servico local esta acessivel nesta maquina.';
    }
    if (check.kind === 'policy') {
      return 'E a regra que diz o que o recurso pode ou nao pode fazer.';
    }
    if (audience === 'technical') {
      return check.summary;
    }
    return 'E uma confirmacao simples antes de permitir que o recurso avance.';
  }

  private humanStepLabel(id: string): string {
    const labels: Record<string, string> = {
      import: 'Preparar recurso',
      target: 'Escolher o que usar',
      'natural-setup': 'Montar plano simples',
      secrets: 'Guardar acessos com seguranca',
      governance: 'Aplicar regras de uso',
      'pack-readiness': 'Verificar se esta pronto',
      approval: 'Pedir aprovacao',
      activation: 'Enviar pedido final',
    };
    return labels[id] || id;
  }

  private whyStepMatters(id: string, status: CapabilitySetupConversationStatus): string {
    if (id === 'secrets') {
      return 'Sem isso, o recurso nao consegue acessar a conta certa.';
    }
    if (id === 'approval') {
      return 'Isso impede ativacao sem consentimento.';
    }
    if (id === 'pack-readiness') {
      return 'Isso evita ligar algo que ainda nao foi testado.';
    }
    if (status === 'blocked') {
      return 'Resolver esse ponto destrava o restante.';
    }
    return 'Isso mantem o setup rastreavel e seguro.';
  }

  private humanizeSummary(summary: string): string {
    return summary
      .replace(/secret ref\(s\)/gi, 'entrada(s) segura(s)')
      .replace(/Manifest items were normalized into Capability Hub contract\./gi, 'O recurso foi preparado no catalogo do Zavorth.')
      .replace(/Governance recipe is required before activation\./gi, 'As regras de uso precisam ser aplicadas antes.')
      .replace(/Live activation is not applied by this flow; it only prepares the governed request\./gi, 'Nada foi ligado automaticamente; so o pedido foi preparado.')
      .replace(/No raw secret is serialized by the activation flow\./gi, 'Nenhum segredo bruto foi gravado no texto.')
      .replace(/Missing ([0-9]+) entrada\(s\) segura\(s\)\./gi, 'Faltam $1 entrada(s) segura(s).')
      .replace(/[a-z0-9-]+ planned with dry-run receipts\./gi, 'As regras de uso foram planejadas com registros de auditoria.')
      .replace(/^(.+) selected\.$/gi, 'Recurso escolhido: $1.')
      .replace(/Pack readiness status is /gi, 'Estado da verificacao: ');
  }

  private statusLabel(status: CapabilitySetupTask['status']): string {
    if (status === 'done') {
      return 'feito';
    }
    if (status === 'next') {
      return 'proximo';
    }
    if (status === 'blocked') {
      return 'bloqueado';
    }
    return 'depois';
  }

  private humanRef(ref: string): string {
    return ref
      .replace(/[_-]/g, ' ')
      .replace(/\./g, ' ')
      .replace(/\boauth\b/gi, 'acesso')
      .replace(/\btoken\b/gi, 'token')
      .replace(/\bapiKey\b/gi, 'chave de API');
  }

  private reassurance(audience: CapabilitySetupAudience): string {
    if (audience === 'technical') {
      return 'Seguranca: dry-run, receipts, sem secrets brutos e sem ativacao live automatica.';
    }
    return 'Eu nao vou guardar valores sensiveis no texto nem ativar nada sem aprovacao.';
  }

  private redact(text: string): string {
    let redacted = text;
    for (const pattern of SECRET_PATTERNS) {
      redacted = redacted.replace(pattern, (match, group) => {
        if (typeof group === 'string' && group.length > 0) {
          return match.replace(group, '[SECRET_REDACTED]');
        }
        return '[SECRET_REDACTED]';
      });
    }
    return redacted;
  }
}
