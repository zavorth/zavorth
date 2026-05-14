import type { ToolDefinition } from '../../providers/ILlmProvider.js';
import type { WorkspaceTaskKind, WorkspaceTaskSubtype } from '../WorkspaceTaskKind.js';
import type { GraphExecutionProfile, GraphRuntimeDecisionTrace } from './GraphRuntimeTypes.js';

export function toGraphRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

export function buildTaskQualityGuidance(
  taskKind: WorkspaceTaskKind,
  taskSubtype: WorkspaceTaskSubtype,
): string[] {
  if (taskKind === 'research') {
    if (taskSubtype === 'comparison') {
      return [
        '- Estruture a entrega como comparacao clara, com criterios explicitos, tradeoffs, riscos e recomendacao final.',
        '- Quando houver opcoes concorrentes, destaque o melhor encaixe para o objetivo em vez de apenas listar caracteristicas.',
      ];
    }

    if (taskSubtype === 'summarization') {
      return [
        '- Entregue uma sintese curta e hierarquizada, abrindo com resumo executivo e depois pontos-chave acionaveis.',
        '- Preserve contexto suficiente para decisao, mas corte redundancia e deixe incertezas explicitas quando existirem.',
      ];
    }

    return [
      '- Priorize fontes confiaveis e recentes, usando datas absolutas quando houver informacao temporal.',
      '- Se encontrar sinais conflitantes, explicite o conflito e aponte a leitura mais provavel.',
    ];
  }

  if (taskKind === 'code') {
    if (taskSubtype === 'review') {
      return [
        '- Faca review orientado a achados concretos: bugs, regressao, risco e testes faltantes antes de qualquer resumo.',
      ];
    }

    if (taskSubtype === 'testing') {
      return [
        '- Priorize validacao objetiva: comandos de teste, resultado esperado e risco residual se algo nao puder ser verificado.',
      ];
    }

    if (taskSubtype === 'debugging') {
      return [
        '- Estruture a resposta com hipotese principal, evidencia observavel e proximo experimento mais informativo.',
      ];
    }
  }

  if (taskKind === 'automation') {
    return [
      '- Organize a execucao em passos curtos com checkpoints claros antes de confirmar sucesso.',
    ];
  }

  return [];
}

export function buildExecutionProfileGuidance(profile: GraphExecutionProfile): string[] {
  const lines: string[] = [];

  switch (profile.deliveryProfile) {
    case 'summary_first':
      lines.push('- Abra com um resumo executivo curto antes de detalhar pontos-chave e proximos passos.');
      break;
    case 'findings_first':
      lines.push('- Comece pelos achados mais importantes e deixe contexto secundario ou resumo geral depois.');
      break;
    case 'decision_brief':
      lines.push('- Entregue em formato orientado a decisao: recomendacao final, criterios, tradeoffs e risco residual.');
      break;
    case 'checkpointed':
      lines.push('- Organize a saida por checkpoints e estado atual antes de declarar conclusao final.');
      break;
    case 'diagnostic':
      lines.push('- Formate a entrega como diagnostico: hipotese principal, evidencia observavel e proximo experimento.');
      break;
    case 'implementation_ready':
      lines.push('- Entregue algo pronto para implementacao, com passos objetivos, impacto esperado e validacao sugerida.');
      break;
    default:
      lines.push('- Mantenha a entrega direta, proporcional e facil de agir.');
      break;
  }

  if (profile.toolingProfile === 'evidence_heavy') {
    lines.push('- Antes de concluir, use ferramentas suficientes para reunir evidencia verificavel quando elas estiverem disponiveis.');
    lines.push('- Nao feche a resposta sem pelo menos uma checagem concreta do material mais relevante para a decisao.');
    return lines;
  }

  if (profile.toolingProfile === 'minimal') {
    lines.push('- Evite rodadas extras de ferramenta quando o contexto ja for suficiente para uma boa sintese.');
    return lines;
  }

  if (profile.toolingProfile === 'checkpointed') {
    lines.push('- Use ferramentas em etapas curtas, confirmando checkpoint e progresso antes de seguir para a proxima acao.');
    return lines;
  }

  lines.push('- Use ferramentas de forma direcionada, apenas quando elas melhorarem confianca, verificacao ou completude.');
  return lines;
}

export function resolveToolSelectionStrategy(
  profile: GraphExecutionProfile['toolSelectionProfile'],
): { preferredToolNames: string[]; blockedToolNames: string[] } {
  switch (profile) {
    case 'research':
      return {
        preferredToolNames: [
          'web_search',
          'query_external_ai',
          'read_file',
          'list_directory',
          'get_datetime',
          'semantic_memory',
        ],
        blockedToolNames: ['create_file', 'remote_shell'],
      };
    case 'research_summary':
      return {
        preferredToolNames: [
          'read_file',
          'web_search',
          'list_directory',
          'get_datetime',
          'semantic_memory',
        ],
        blockedToolNames: ['create_file', 'remote_shell', 'run_sandbox_code'],
      };
    case 'code_readonly':
      return {
        preferredToolNames: [
          'read_file',
          'list_directory',
          'run_sandbox_code',
          'semantic_memory',
        ],
        blockedToolNames: ['create_file', 'remote_shell'],
      };
    case 'code_write':
      return {
        preferredToolNames: [
          'read_file',
          'list_directory',
          'create_file',
          'run_sandbox_code',
          'semantic_memory',
        ],
        blockedToolNames: ['remote_shell'],
      };
    case 'automation':
      return {
        preferredToolNames: [
          'remote_shell',
          'run_sandbox_code',
          'read_file',
          'list_directory',
          'create_file',
          'get_datetime',
        ],
        blockedToolNames: [],
      };
    default:
      return {
        preferredToolNames: [
          'read_file',
          'list_directory',
          'web_search',
          'run_sandbox_code',
          'semantic_memory',
        ],
        blockedToolNames: [],
      };
  }
}

export function selectToolDefinitionsForProfile(
  definitions: ToolDefinition[],
  profile: GraphExecutionProfile,
): ToolDefinition[] {
  const blocked = new Set(profile.blockedToolNames.map((name) => String(name || '').trim()));
  const preferredOrder = new Map(
    profile.preferredToolNames.map((name, index) => [String(name || '').trim(), index] as const),
  );
  const selected = definitions.filter((definition) => !blocked.has(String(definition.name || '').trim()));

  return [...selected].sort((left, right) => {
    const leftName = String(left.name || '').trim();
    const rightName = String(right.name || '').trim();
    const leftRank = preferredOrder.has(leftName) ? preferredOrder.get(leftName)! : Number.MAX_SAFE_INTEGER;
    const rightRank = preferredOrder.has(rightName) ? preferredOrder.get(rightName)! : Number.MAX_SAFE_INTEGER;

    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    return leftName.localeCompare(rightName);
  });
}

export function buildGeneratorDirectives(profile: GraphExecutionProfile): string[] {
  const directives: string[] = [];

  if (profile.skillDecision.primarySkill) {
    directives.push(
      `Use a skill @${profile.skillDecision.primarySkill.name} como workflow preferencial desta execucao, adaptando o que for necessario ao contexto atual.`,
    );
  }
  if (profile.preferredToolNames.length > 0) {
    directives.push(
      `Prefira estas ferramentas quando precisar verificar ou agir: ${profile.preferredToolNames.join(', ')}.`,
    );
  }
  if (profile.blockedToolNames.length > 0) {
    directives.push(
      `Nao tente depender destas tools nesta tarefa: ${profile.blockedToolNames.join(', ')}.`,
    );
  }

  switch (profile.deliveryProfile) {
    case 'summary_first':
      directives.push(
        'Abra com um resumo executivo curto antes de entrar nos detalhes.',
        'Depois do resumo, organize os pontos por prioridade e proximos passos.',
      );
      break;
    case 'findings_first':
      directives.push(
        'Comece pelos achados concretos mais importantes antes de qualquer resumo geral.',
        'Nao esconda risco, regressao, falha ou lacuna relevante atras de contexto introdutorio.',
      );
      break;
    case 'decision_brief':
      directives.push(
        'Entregue em formato de decisao: recomendacao final, criterios usados, tradeoffs e risco residual.',
        'Se houver varias opcoes, deixe claro por que a melhor opcao vence as demais.',
      );
      break;
    case 'checkpointed':
      directives.push(
        'Organize a saida por checkpoints claros e estado atual antes de declarar a tarefa como concluida.',
        'Se houver execucao em varias etapas, deixe o proximo passo explicito.',
      );
      break;
    case 'diagnostic':
      directives.push(
        'Estruture como diagnostico: hipotese principal, evidencia observavel e proximo experimento.',
      );
      break;
    case 'implementation_ready':
      directives.push(
        'Entregue algo pronto para execucao ou implementacao, com passos objetivos, impacto esperado e validacao sugerida.',
      );
      break;
    default:
      directives.push(
        'Mantenha a entrega direta, proporcional e facil de agir.',
      );
      break;
  }

  return directives;
}

export function buildCriticDirectives(profile: GraphExecutionProfile): string[] {
  const directives: string[] = [];

  switch (profile.verificationProfile) {
    case 'strict':
      directives.push('So aprove quando a resposta cobrir riscos, impacto e verificacoes esperadas sem ambiguidades relevantes.');
      break;
    case 'evidence_required':
      directives.push('So aprove quando houver evidencia concreta suficiente, checagem observavel ou base verificavel para a conclusao.');
      break;
    case 'stepwise':
      directives.push('So aprove quando os checkpoints estiverem coerentes, o estado atual estiver claro e o proximo passo estiver explicitado.');
      break;
    default:
      directives.push('Aprove quando a resposta estiver clara, coerente e sem lacunas relevantes para o objetivo.');
      break;
  }

  if (profile.deliveryProfile === 'findings_first') {
    directives.push('Se a tarefa for review ou testing, rejeite respostas que escondam os principais achados atras de resumo generico.');
  } else if (profile.deliveryProfile === 'decision_brief') {
    directives.push('Para comparacoes, rejeite respostas que nao terminem com recomendacao clara e tradeoffs explicitos.');
  } else if (profile.deliveryProfile === 'checkpointed') {
    directives.push('Para automacao, rejeite respostas que pulam de execucao para conclusao sem checkpoint ou estado final claro.');
  }

  return directives;
}

export function buildDecisionTrace(profile: GraphExecutionProfile): GraphRuntimeDecisionTrace {
  return {
    executionRoute: profile.intentDecision.executionRoute,
    taskKind: profile.intentDecision.taskKind,
    taskSubtype: profile.intentDecision.taskSubtype,
    responseStyle: profile.intentDecision.responseStyle,
    provider: {
      providerName: profile.providerDecision.providerName,
      modelName: profile.providerDecision.modelName,
      profileId: profile.providerDecision.profileId,
      profileLabel: profile.providerDecision.profileLabel,
      selectionSource: profile.providerDecision.selectionSource,
      fallbackOrder: profile.providerDecision.fallbackOrder.slice(),
    },
    skills: {
      primarySkillName: profile.skillDecision.primarySkill?.name || null,
      supportingSkillNames: profile.skillDecision.supportingSkills.map((entry) => entry.name),
      matchedBundleTags: profile.skillDecision.matchedBundleTags.slice(),
    },
    rationale: [
      ...profile.intentDecision.rationale,
      ...profile.providerDecision.rationale,
      ...profile.skillDecision.rationale,
    ],
  };
}
