import type {
  ConversationalPermissionRequest,
  NaturalClarificationPolicy,
  PermissionNarrative,
  TrustPostureSnapshot,
  UniversalIntentSafetyClassification,
  UserAbstractionProfile,
} from './UniversalIntentContracts.js';

export class PermissionNarrativeService {
  public build(input: {
    classification: UniversalIntentSafetyClassification;
    clarification: NaturalClarificationPolicy;
    permissionRequest: ConversationalPermissionRequest | null;
    trustPosture: TrustPostureSnapshot;
    userProfile: UserAbstractionProfile;
  }): PermissionNarrative {
    if (input.trustPosture.blocked) {
      return this.blocked(input.trustPosture);
    }
    if (input.clarification.askBeforeAssumption) {
      return this.clarification(input.clarification);
    }
    if (input.permissionRequest) {
      return input.permissionRequest.narrative;
    }
    return this.direct(input.classification, input.userProfile);
  }

  public forRequest(input: {
    classification: UniversalIntentSafetyClassification;
    where: string;
    permission: string;
    validity: string;
    technicalDetails: string[];
  }): PermissionNarrative {
    return {
      summary: this.summaryFor(input.classification),
      whatWillHappen: this.whatWillHappen(input.classification),
      where: input.where,
      permission: input.permission,
      risk: this.riskText(input.classification),
      review: this.reviewText(input.classification),
      validity: input.validity,
      technicalDetails: input.technicalDetails,
    };
  }

  private blocked(trustPosture: TrustPostureSnapshot): PermissionNarrative {
    return {
      summary: 'Nao vou executar isso neste modo.',
      whatWillHappen: 'A execucao fica parada ate o modo ou escopo ser ajustado.',
      where: 'Nenhum recurso sera alterado.',
      permission: 'Permissao nao foi solicitada porque a postura atual bloqueia a acao.',
      risk: trustPosture.blockReason || trustPosture.reason,
      review: 'Revise o pedido, reduza o escopo ou use um modo de maior confianca quando fizer sentido.',
      validity: 'Sem autorizacao ativa.',
      technicalDetails: [trustPosture.reason],
    };
  }

  private clarification(clarification: NaturalClarificationPolicy): PermissionNarrative {
    return {
      summary: 'Preciso confirmar o alvo antes de agir.',
      whatWillHappen: clarification.question || 'Vou fazer uma pergunta de esclarecimento.',
      where: 'Ainda nao ha alvo confirmado.',
      permission: 'Nenhuma permissao sera consumida antes da resposta.',
      risk: clarification.reason || 'Evita assumir um alvo errado.',
      review: 'Responda com o arquivo, pasta, recurso ou comando exato.',
      validity: 'There is no autorizacao ativa.',
      technicalDetails: clarification.missing.map((item) => `missing:${item}`),
    };
  }

  private direct(
    classification: UniversalIntentSafetyClassification,
    userProfile: UserAbstractionProfile,
  ): PermissionNarrative {
    return {
      summary: classification.intent === 'conversation'
        ? 'Posso responder diretamente.'
        : 'Posso seguir pelo runtime governado sem permissao extra.',
      whatWillHappen: classification.intent === 'conversation'
        ? 'Vou responder em texto.'
        : 'Vou executar somente leitura ou consulta governada.',
      where: 'Sem mudanca persistente no workspace.',
      permission: 'Nenhuma permissao adicional e necessaria.',
      risk: 'Risco baixo.',
      review: 'Voce pode pedir detalhes ou interromper antes de qualquer mutacao.',
      validity: 'Vale apenas para esta resposta.',
      technicalDetails: userProfile.shouldExposeTechnicalDetails
        ? [`intent:${classification.intent}`, `risk:${classification.risk}`]
        : [],
    };
  }

  private summaryFor(classification: UniversalIntentSafetyClassification): string {
    if (classification.intent === 'command_execution') {
      return 'Isso precisa de permissao para rodar comando.';
    }
    if (classification.intent === 'external_side_effect') {
      return 'Isso precisa de permissao antes de enviar ou publicar.';
    }
    if (classification.intent === 'automation') {
      return 'Isso precisa de permissao antes de ativar automacao.';
    }
    if (classification.intent === 'operator_control') {
      return 'Isso precisa de permissao de operador.';
    }
    return 'Isso precisa de permissao antes de alterar o workspace.';
  }

  private whatWillHappen(classification: UniversalIntentSafetyClassification): string {
    if (classification.intent === 'command_execution') {
      return 'Vou preparar o comando e mostrar o preview antes de executar.';
    }
    if (classification.intent === 'external_side_effect') {
      return 'Vou preparar o conteudo e pedir confirmacao antes de sair do workspace.';
    }
    if (classification.intent === 'automation') {
      return 'Vou preparar o plano e pedir confirmacao antes de ativar.';
    }
    if (classification.intent === 'operator_control') {
      return 'Vou pausar para autorizacao de operador antes de qualquer acao ampla.';
    }
    return 'Vou preparar um preview das mudancas antes de aplicar.';
  }

  private riskText(classification: UniversalIntentSafetyClassification): string {
    if (classification.sideEffect === 'destructive') {
      return 'Alto: pode apagar, substituir ou tornar dificil desfazer.';
    }
    if (classification.sideEffect === 'external') {
      return 'Alto: pode expor informacao fora do workspace.';
    }
    if (classification.sideEffect === 'system') {
      return 'Alto: pode executar comando ou acao de sistema.';
    }
    if (classification.sideEffect === 'local_workspace') {
      return 'Medio: pode alterar arquivos ou estado local.';
    }
    return 'Baixo.';
  }

  private reviewText(classification: UniversalIntentSafetyClassification): string {
    if (classification.sideEffect === 'external') {
      return 'Revise destino, conteudo e anexos antes de aprovar.';
    }
    if (classification.sideEffect === 'destructive') {
      return 'Revise backup, diff e plano de reversao antes de aprovar.';
    }
    return 'Revise o preview/diff antes de aprovar.';
  }
}
