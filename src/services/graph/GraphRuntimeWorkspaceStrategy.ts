import type { ChatMessage } from '../../providers/ILlmProvider.js';
import {
  buildExecutionProfileGuidance,
  buildTaskQualityGuidance,
  toGraphRecord,
} from './GraphRuntimeDirectives.js';
import type { GraphExecutionProfile } from './GraphRuntimeTypes.js';

export function buildWorkspaceStrategyMessage(
  taskGoal: string,
  metadata: Record<string, unknown> | undefined,
  executionProfile: GraphExecutionProfile,
): ChatMessage | null {
  void taskGoal;
  const payload = metadata || {};
  const workspace = String(payload.workspace || '').trim();
  const workspaceProfile = toGraphRecord(payload.workspaceProfile);
  const workspaceOperationalMemory = toGraphRecord(payload.workspaceOperationalMemory);
  const taskKind = executionProfile.taskKind;
  const taskSubtype = executionProfile.taskSubtype;
  const lines: string[] = ['Heuristicas operacionais do workspace:'];

  if (workspace) {
    lines.push(`- Workspace alvo: ${workspace}`);
  }

  if (taskKind !== 'unknown') {
    lines.push(`- Tipo estimado da tarefa atual: ${taskKind}.`);
  }
  if (taskSubtype !== 'unknown' && taskSubtype !== 'general') {
    lines.push(`- Subtipo estimado da tarefa atual: ${taskSubtype}.`);
  }
  lines.push(`- Rota operacional desta execucao: ${executionProfile.intentDecision.executionRoute}.`);
  lines.push(
    `- Provider preferencial desta tarefa: ${executionProfile.providerName}${executionProfile.allowFallback && executionProfile.fallbackOrder.length > 0 ? ` | fallback: ${executionProfile.fallbackOrder.join(', ')}` : ''}.`,
  );
  if (executionProfile.modelName) {
    lines.push(`- Modelo preferencial desta tarefa: ${executionProfile.modelName}.`);
  }
  lines.push(
    `- Perfil de profundidade: ${executionProfile.depthProfile}; intensidade de ferramentas: ${executionProfile.toolingProfile}.`,
  );
  lines.push(`- Curadoria de ferramentas: ${executionProfile.toolSelectionProfile}.`);
  lines.push(`- Formato de entrega esperado: ${executionProfile.deliveryProfile}.`);
  lines.push(`- Rigor de verificacao final: ${executionProfile.verificationProfile}.`);
  if (executionProfile.preferredToolNames.length > 0) {
    lines.push(`- Ferramentas priorizadas para esta tarefa: ${executionProfile.preferredToolNames.join(', ')}.`);
  }
  if (executionProfile.blockedToolNames.length > 0) {
    lines.push(`- Evite ou nao tente usar estas tools nesta tarefa: ${executionProfile.blockedToolNames.join(', ')}.`);
  }
  if (executionProfile.skillDecision.primarySkill) {
    lines.push(
      `- Skill sugerida para conduzir a tarefa: @${executionProfile.skillDecision.primarySkill.name} -> ${executionProfile.skillDecision.primarySkill.description}.`,
    );
  }
  if (executionProfile.skillDecision.supportingSkills.length > 0) {
    lines.push(
      `- Skills de apoio desta execucao: ${executionProfile.skillDecision.supportingSkills.map((entry) => `@${entry.name}`).join(', ')}.`,
    );
  }
  if (executionProfile.skillDecision.rationale.length > 0) {
    lines.push(
      ...executionProfile.skillDecision.rationale
        .slice(0, 3)
        .map((entry) => `- Skill routing: ${entry}`),
    );
  }
  lines.push(...buildTaskQualityGuidance(taskKind, taskSubtype));
  lines.push(...buildExecutionProfileGuidance(executionProfile));

  const taskKindRecommendations = Array.isArray(workspaceOperationalMemory.task_kind_recommendations)
    ? workspaceOperationalMemory.task_kind_recommendations
    : [];
  const taskSubtypeRecommendations = Array.isArray(workspaceOperationalMemory.task_subtype_recommendations)
    ? workspaceOperationalMemory.task_subtype_recommendations
    : [];
  const subtypeRecommendation = toGraphRecord(
    taskSubtypeRecommendations.find((entry) => {
      const current = toGraphRecord(entry);
      return String(current.kind || '').trim().toLowerCase() === taskKind
        && String(current.subtype || '').trim().toLowerCase() === taskSubtype;
    }),
  );
  const subtypePreferredExecutor = String(subtypeRecommendation.preferred_executor || '').trim();
  if (subtypePreferredExecutor) {
    lines.push(
      `- Para o subtipo ${taskSubtype}, priorize ${subtypePreferredExecutor} como melhor aposta (${String(subtypeRecommendation.success_count || 0)} sucesso(s) recentes).`,
    );
  }
  if (subtypeRecommendation.repeated_failure_executor && subtypeRecommendation.repeated_failure_summary) {
    lines.push(
      `- Para o subtipo ${taskSubtype}, evite repetir ${String(subtypeRecommendation.repeated_failure_executor)} quando o contexto lembrar a falha: ${String(subtypeRecommendation.repeated_failure_summary)}.`,
    );
  }
  const kindRecommendation = toGraphRecord(
    taskKindRecommendations.find((entry) => {
      return String(toGraphRecord(entry).kind || '').trim().toLowerCase() === taskKind;
    }),
  );
  const kindPreferredExecutor = String(kindRecommendation.preferred_executor || '').trim();
  if (kindPreferredExecutor && !subtypePreferredExecutor) {
    lines.push(
      `- Para tarefas do tipo ${taskKind}, priorize ${kindPreferredExecutor} como ponto de partida (${String(kindRecommendation.success_count || 0)} sucesso(s) recentes).`,
    );
  }
  if (
    kindRecommendation.repeated_failure_executor &&
    kindRecommendation.repeated_failure_summary &&
    !subtypeRecommendation.repeated_failure_executor
  ) {
    lines.push(
      `- Para esse tipo de tarefa, evite repetir ${String(kindRecommendation.repeated_failure_executor)} quando o contexto estiver parecido com a falha: ${String(kindRecommendation.repeated_failure_summary)}.`,
    );
  }

  const successfulExecutors = Array.isArray(workspaceOperationalMemory.successful_executors)
    ? workspaceOperationalMemory.successful_executors
    : [];
  const topExecutor = toGraphRecord(successfulExecutors[0]);
  if (topExecutor.executor && !kindPreferredExecutor) {
    lines.push(
      `- Se nao houver sinal especifico para esta tarefa, priorize a estrategia associada a ${String(topExecutor.executor)} (${String(topExecutor.count || 0)} sucesso(s) recentes).`,
    );
  }

  const repeatedFailures = Array.isArray(workspaceOperationalMemory.repeated_failures)
    ? workspaceOperationalMemory.repeated_failures
    : [];
  const topFailure = toGraphRecord(repeatedFailures[0]);
  if (topFailure.executor && topFailure.summary && !kindRecommendation.repeated_failure_executor) {
    lines.push(
      `- Se nao houver historico especifico desta tarefa, evite repetir a abordagem que falhou recentemente: ${String(topFailure.executor)} -> ${String(topFailure.summary)}.`,
    );
  }

  const approvedPaths = Array.isArray(workspaceOperationalMemory.approved_paths)
    ? workspaceOperationalMemory.approved_paths
        .map((entry) => String(toGraphRecord(entry).path || '').trim())
        .filter(Boolean)
        .slice(0, 3)
    : [];
  if (approvedPaths.length > 0) {
    lines.push(`- Se precisar operar em arquivos, prefira primeiro estes caminhos ja aprovados: ${approvedPaths.join(', ')}.`);
  }

  const scripts = toGraphRecord(workspaceProfile.scripts);
  const scriptPairs = ['build', 'test', 'dev', 'start']
    .map((key) => {
      const value = String(scripts[key] || '').trim();
      return value ? `${key}=${value}` : '';
    })
    .filter(Boolean)
    .slice(0, 4);
  if (scriptPairs.length > 0) {
    lines.push(`- Scripts provaveis do projeto: ${scriptPairs.join(' | ')}.`);
  }

  const importantPaths = Array.isArray(workspaceProfile.important_paths)
    ? workspaceProfile.important_paths
        .map((entry) => String(entry || '').trim())
        .filter(Boolean)
        .slice(0, 4)
    : [];
  if (importantPaths.length > 0) {
    lines.push(`- Caminhos importantes do projeto: ${importantPaths.join(', ')}.`);
  }

  const instructionFile = String(workspaceProfile.instruction_file || '').trim();
  const instructionSummary = String(workspaceProfile.instruction_summary || '').trim();
  const instructionNotes = Array.isArray(workspaceProfile.instruction_notes)
    ? workspaceProfile.instruction_notes
        .map((entry) => String(entry || '').trim())
        .filter(Boolean)
        .slice(0, 4)
    : [];
  if (instructionFile) {
    lines.push(`- O workspace possui um ZAVORTH.md ativo em ${instructionFile}.`);
  }
  if (instructionSummary) {
    lines.push(`- Resumo do ZAVORTH.md: ${instructionSummary}.`);
  }
  if (instructionNotes.length > 0) {
    lines.push(`- Regras-chave do ZAVORTH.md: ${instructionNotes.join(' | ')}.`);
  }

  const workspaceHooks = Array.isArray(workspaceProfile.workspace_hooks)
    ? workspaceProfile.workspace_hooks
        .map((entry) => {
          const current = toGraphRecord(entry);
          const event = String(current.event || '').trim();
          const command = String(current.command || '').trim();
          return event && command ? `${event} -> ${command}` : '';
        })
        .filter(Boolean)
        .slice(0, 4)
    : [];
  if (workspaceHooks.length > 0) {
    lines.push(`- Hooks operacionais declarados no workspace: ${workspaceHooks.join(' | ')}.`);
    lines.push('- Antes de concluir tarefas estruturais, considere respeitar os hooks before-complete e before-publish quando eles existirem.');
  }

  const workspaceCommands = Array.isArray(workspaceProfile.workspace_commands)
    ? workspaceProfile.workspace_commands
        .map((entry) => {
          const current = toGraphRecord(entry);
          const name = String(current.name || '').trim();
          const template = String(current.template || '').trim();
          return name && template ? `/${name} -> ${template}` : '';
        })
        .filter(Boolean)
        .slice(0, 4)
    : [];
  if (workspaceCommands.length > 0) {
    lines.push(`- Comandos reutilizaveis do workspace: ${workspaceCommands.join(' | ')}.`);
    lines.push('- Se um comando reutilizavel do workspace encaixar bem no objetivo, prefira manter a intencao e o formato desse atalho.');
  }

  if (lines.length === 1) {
    return null;
  }

  lines.push('- Use essas heuristicas para escolher ferramentas, escopo e verificacoes antes de responder.');
  return {
    role: 'system',
    content: lines.join('\n'),
  };
}
