import type { IntelligenceFabricSnapshot } from '../contracts/IntelligenceFabricContract.js';
import type { ConversationalAgencyMessage } from '../contracts/PracticalAgencyContract.js';

const TERM_MAP = [
  { internal: 'Risk 3', human: 'previa de alteracao' },
  { internal: 'approval required', human: 'preciso da sua confirmacao' },
  { internal: 'Capability Hub ticket', human: 'vou preparar essa conexao' },
  { internal: 'Fabric degraded', human: 'modo inteligente em observacao' },
  { internal: 'Mutation Plane', human: 'rascunho reversivel' },
  { internal: 'Risk Gate', human: 'confirmacao de impacto' },
];

export class ConversationalAgencyPresenter {
  public present(input: {
    fabric: IntelligenceFabricSnapshot;
    context?: 'chat' | 'dashboard' | 'receipt';
  }): ConversationalAgencyMessage {
    const { fabric } = input;
    const capability = fabric.capabilityBuilder;
    const risk = fabric.executionProposal.riskLevel;

    if (capability.status === 'draft_ready') {
      return this.message(
        'Posso preparar isso para voce.',
        'Ainda nao ativei nada. Vou montar uma proposta com manifesto, testes e uma simulacao segura para a capacidade pedida.',
        'Depois voce revisa a proposta e confirma se quer ativar.',
      );
    }

    if (capability.status === 'existing_capability') {
      return this.message(
        'Encontrei essa capacidade no Zavorth.',
        'Posso guiar a configuracao e verificar o que falta sem expor segredo nem ativar nada sozinho.',
        'Quando estiver tudo pronto, eu peco sua confirmacao para ativar.',
      );
    }

    if (risk <= 1) {
      return this.message(
        'Entendi. Vou seguir pelo caminho direto.',
        'Posso responder, analisar ou inspecionar contexto permitido sem pedir confirmacao desnecessaria.',
        'Se aparecer alguma acao com impacto real, eu aviso antes.',
      );
    }

    if (risk === 2) {
      return this.message(
        'Vou preparar uma previa.',
        'Posso planejar, simular e montar rascunhos sem aplicar mudancas reais.',
        'Para aplicar qualquer impacto, eu volto com uma confirmacao clara.',
      );
    }

    if (risk === 3) {
      return this.message(
        'Vou deixar uma previa de alteracao pronta.',
        'A mudanca fica reversivel e visivel antes de ser aplicada.',
        'Voce aprova pelo chat ou pelo Dashboard quando quiser aplicar.',
      );
    }

    return this.message(
      'Isso pode causar impacto real.',
      'Antes de shell, instalacao, rede, segredo, envio externo, deploy ou apagamento, eu preciso de confirmacao ou sandbox.',
      'Posso preparar o plano seguro agora e aguardar sua decisao.',
    );
  }

  public humanize(text: string): string {
    return TERM_MAP.reduce(
      (current, entry) => current.replace(new RegExp(escapeRegExp(entry.internal), 'gi'), entry.human),
      String(text || ''),
    );
  }

  private message(headline: string, body: string, nextAction: string): ConversationalAgencyMessage {
    return {
      headline,
      body: this.humanize(body),
      nextAction: this.humanize(nextAction),
      detailsHiddenByDefault: true,
      dashboardDetailsAvailable: true,
      zavorthControlDetailsAvailable: true,
      internalTermsSuppressed: TERM_MAP.map((entry) => entry.internal),
    };
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
