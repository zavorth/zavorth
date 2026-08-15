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
    lines.push(`- Tipo estimado da task current: ${taskKind}.`);
  }
  if (taskSubtype !== 'unknown' && taskSubtype !== 'general') {
    lines.push(`- Subtipo estimado da task current: ${taskSubtype}.`);
  }
  lines.push(`- Operational route for this execution: ${executionProfile.intentDecision.executionRoute}.`);
  lines.push(
    `- Provider preferencel desta task: ${executionProfile.providerName}${executionProfile.allowFallback && executionProfile.fallbackOrder.length > 0 ? ` | fallback: ${executionProfile.fallbackOrder.join(', ')}` : ''}.`,
  );
  if (executionProfile.modelName) {
    lines.push(`- Modelo preferencel desta task: ${executionProfile.modelName}.`);
  }
  lines.push(
    `- Perfil de profundidade: ${executionProfile.depthProfile}; intensidade de tools: ${executionProfile.toolingProfile}.`,
  );
  lines.push(`- Curadoria de tools: ${executionProfile.toolSelectionProfile}.`);
  lines.push(`- Expected delivery format: ${executionProfile.deliveryProfile}.`);
  lines.push(`- Final verification rigor: ${executionProfile.verificationProfile}.`);
  if (executionProfile.preferredToolNames.length > 0) {
    lines.push(`- Tools priorizadas para this task: ${executionProfile.preferredToolNames.join(', ')}.`);
  }
  if (executionProfile.blockedToolNames.length > 0) {
    lines.push(`- Avoid or do not try to use these tools in this task: ${executionProfile.blockedToolNames.join(', ')}.`);
  }
  if (executionProfile.skillDecision.primarySkill) {
    lines.push(
      `- Skill sugerida para conduzir a task: @${executionProfile.skillDecision.primarySkill.name} -> ${executionProfile.skillDecision.primarySkill.description}.`,
    );
  }
  if (executionProfile.skillDecision.supportingSkills.length > 0) {
    lines.push(
      `- Supporting skills for this execution: ${executionProfile.skillDecision.supportingSkills.map((entry) => `@${entry.name}`).join(', ')}.`,
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
      `- Para o subtipo ${taskSubtype}, priorize ${subtypePreferredExecutor} como melhor afterta (${String(subtypeRecommendation.success_count || 0)} recent success(es)).`,
    );
  }
  if (subtypeRecommendation.repeated_failure_executor && subtypeRecommendation.repeated_failure_summary) {
    lines.push(
      `- Para o subtipo ${taskSubtype}, evite repetir ${String(subtypeRecommendation.repeated_failure_executor)} when o contexto lembrar a failure: ${String(subtypeRecommendation.repeated_failure_summary)}.`,
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
      `- Para tarefas do tipo ${taskKind}, priorize ${kindPreferredExecutor} como ponto de partida (${String(kindRecommendation.success_count || 0)} recent success(es)).`,
    );
  }
  if (
    kindRecommendation.repeated_failure_executor &&
    kindRecommendation.repeated_failure_summary &&
    !subtypeRecommendation.repeated_failure_executor
  ) {
    lines.push(
      `- Para esse tipo de task, evite repetir ${String(kindRecommendation.repeated_failure_executor)} when o contexto estiver parecido com a failure: ${String(kindRecommendation.repeated_failure_summary)}.`,
    );
  }

  const successfulExecutors = Array.isArray(workspaceOperationalMemory.successful_executors)
    ? workspaceOperationalMemory.successful_executors
    : [];
  const topExecutor = toGraphRecord(successfulExecutors[0]);
  if (topExecutor.executor && !kindPreferredExecutor) {
    lines.push(
      `- If there is no specific signal for this task, prioritize the strategy associated with ${String(topExecutor.executor)} (${String(topExecutor.count || 0)} recent success(es)).`,
    );
  }

  const repeatedFailures = Array.isArray(workspaceOperationalMemory.repeated_failures)
    ? workspaceOperationalMemory.repeated_failures
    : [];
  const topFailure = toGraphRecord(repeatedFailures[0]);
  if (topFailure.executor && topFailure.summary && !kindRecommendation.repeated_failure_executor) {
    lines.push(
      `- If there is no specific history for this task, avoid repeating the recently failed approach: ${String(topFailure.executor)} -> ${String(topFailure.summary)}.`,
    );
  }

  const approvedPaths = Array.isArray(workspaceOperationalMemory.approved_paths)
    ? workspaceOperationalMemory.approved_paths
        .map((entry) => String(toGraphRecord(entry).path || '').trim())
        .filter(Boolean)
        .slice(0, 3)
    : [];
  if (approvedPaths.length > 0) {
    lines.push(`- If file operations are needed, prefer these already-approved paths first: ${approvedPaths.join(', ')}.`);
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
    lines.push(`- O workspace possui um ZAVORTH.md active em ${instructionFile}.`);
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
    lines.push(`- Operational hooks declared in the workspace: ${workspaceHooks.join(' | ')}.`);
    lines.push('- before de concluir tarefas estruturais, considere respeitar os hooks before-complete e before-publish when eles existirem.');
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
    lines.push(`- Reusable workspace commands: ${workspaceCommands.join(' | ')}.`);
    lines.push('- If a reusable workspace command fits the objective well, prefer preserving the intent and format of that shortcut.');
  }

  if (lines.length === 1) {
    return null;
  }

  lines.push('- Use structured workspace signals to choose tools, scope, and verification before responding.');
  return {
    role: 'system',
    content: lines.join('\n'),
  };
}
