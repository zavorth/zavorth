import { Task } from '../../../../contracts/TaskContract.js';
import type { ChatMessage } from '../../../../providers/ILlmProvider.js';
import { buildWorkspaceContinuityContext } from '../../../../runtime/context/WorkspaceContinuityContext.js';
import type { GatewaySessionSnapshot } from '../../../../services/GatewaySessionService.js';
import { classifyWorkspaceTaskProfile } from '../../../../services/WorkspaceTaskKind.js';

type ContinuityContext = ReturnType<typeof buildWorkspaceContinuityContext>;
type ContinuationIntentFn = (messageText: string) => boolean;
type WorkspaceProfileRecord = Record<string, unknown>;
type WorkspaceProfileCommand = { name?: unknown; template?: unknown };
type WorkspaceProfileHook = { event?: unknown; command?: unknown };
type ApprovedPathRecord = { path?: unknown };
type ExecutorRecommendation = {
  executor?: unknown;
  summary?: unknown;
  kind?: unknown;
  subtype?: unknown;
  preferred_executor?: unknown;
  repeated_failure_executor?: unknown;
  repeated_failure_summary?: unknown;
};

export type TelegramConversationContextServiceDeps = {
  isContinuationIntent: ContinuationIntentFn;
};

export class TelegramConversationContextService {
  constructor(private readonly deps: TelegramConversationContextServiceDeps) {}

  public buildWorkspaceContext(task: Task, continuityContext?: ContinuityContext): string {
    const sections: string[] = [];
    if (task.workspace) {
      sections.push(`WORKSPACE ATUAL:\n- ${task.workspace}`);
    }

    const profileSummary = String(task.metadata?.workspace_profile_summary || '').trim();
    if (profileSummary) {
      sections.push(`PERFIL DO WORKSPACE:\n- ${profileSummary}`);
    }

    const workspaceProfile = asRecord(task.metadata?.workspace_profile);
    const profileScripts = workspaceProfile && !Array.isArray(workspaceProfile.scripts)
      ? Object.entries((workspaceProfile.scripts || {}) as Record<string, unknown>)
          .map(([key, value]) => `${key}: ${String(value || '').trim()}`)
          .filter((entry) => !entry.endsWith(':'))
          .slice(0, 4)
      : [];
    if (profileScripts.length > 0) {
      sections.push(`SCRIPTS PROVAVEIS DO PROJETO:\n- ${profileScripts.join('\n- ')}`);
    }

    const importantPaths = Array.isArray(workspaceProfile?.important_paths)
      ? workspaceProfile.important_paths
          .map((entry) => String(entry || '').trim())
          .filter(Boolean)
          .slice(0, 4)
      : [];
    if (importantPaths.length > 0) {
      sections.push(`CAMINHOS IMPORTANTES DO PROJETO:\n- ${importantPaths.join('\n- ')}`);
    }

    const instructionSummary = workspaceProfile
      ? String(workspaceProfile.instruction_summary || '').trim()
      : '';
    const instructionNotes = Array.isArray(workspaceProfile?.instruction_notes)
      ? workspaceProfile.instruction_notes
          .map((entry) => String(entry || '').trim())
          .filter(Boolean)
          .slice(0, 4)
      : [];
    if (instructionSummary || instructionNotes.length > 0) {
      const instructionLines = [instructionSummary, ...instructionNotes].filter(Boolean);
      sections.push(`INSTRUCOES DO WORKSPACE (ZAVORTH.md):\n- ${instructionLines.join('\n- ')}`);
    }

    const workspaceHooks = Array.isArray(workspaceProfile?.workspace_hooks)
      ? workspaceProfile.workspace_hooks
          .map((entry) => {
            const hook = asWorkspaceHook(entry);
            const event = String(hook?.event || '').trim();
            const command = String(hook?.command || '').trim();
            return event && command ? `${event}: ${command}` : '';
          })
          .filter(Boolean)
          .slice(0, 4)
      : [];
    if (workspaceHooks.length > 0) {
      sections.push(`HOOKS OPERACIONAIS DO WORKSPACE:\n- ${workspaceHooks.join('\n- ')}`);
    }

    const workspaceCommands = Array.isArray(workspaceProfile?.workspace_commands)
      ? workspaceProfile.workspace_commands
          .map((entry) => {
            const commandEntry = asWorkspaceCommand(entry);
            const name = String(commandEntry?.name || '').trim();
            const template = String(commandEntry?.template || '').trim();
            return name && template ? `/${name}: ${template}` : '';
          })
          .filter(Boolean)
          .slice(0, 4)
      : [];
    if (workspaceCommands.length > 0) {
      sections.push(`COMANDOS REUTILIZAVEIS DO WORKSPACE:\n- ${workspaceCommands.join('\n- ')}`);
    }

    const operationalSummary = String(task.metadata?.workspace_operational_memory_summary || '').trim();
    if (operationalSummary) {
      sections.push(`MEMORIA OPERACIONAL DO WORKSPACE:\n- ${operationalSummary}`);
    }

    const operationalInsight = String(continuityContext?.operationalInsight || '').trim();
    if (operationalInsight) {
      sections.push(`SINAIS OPERACIONAIS RECENTES:\n- ${operationalInsight}`);
    }

    const operationalMemory = asRecord(task.metadata?.workspace_operational_memory);
    const approvedPaths = Array.isArray(operationalMemory?.approved_paths)
      ? operationalMemory.approved_paths
          .map((entry) => String(asApprovedPath(entry)?.path || '').trim())
          .filter(Boolean)
          .slice(0, 3)
      : [];
    if (approvedPaths.length > 0) {
      sections.push(`PATHS JA APROVADOS RECENTEMENTE:\n- ${approvedPaths.join('\n- ')}`);
    }

    const continuityLines = [
      continuityContext?.titleHint ? `Contexto atual: ${continuityContext.titleHint}` : null,
      continuityContext?.workflowRecommendation?.label
        ? `Workflow sugerido: ${continuityContext.workflowRecommendation.label}`
        : null,
      continuityContext?.activeFocus?.reason
        ? `Foco em andamento: ${continuityContext.activeFocus.reason}`
        : null,
      continuityContext?.recentArtifact?.name
        ? `Entrega recente: ${continuityContext.recentArtifact.name}`
        : null,
      continuityContext?.followupPrompt
        ? `Proximo passo sugerido: ${continuityContext.followupPrompt}`
        : null,
      Array.isArray(continuityContext?.nextActions) && continuityContext!.nextActions.length > 0
        ? `Atalhos uteis: ${continuityContext!.nextActions
            .slice(0, 3)
            .map((entry) => `${entry.label} (${entry.command})`)
            .join(' | ')}`
        : null,
    ].filter(Boolean) as string[];
    if (continuityLines.length > 0) {
      sections.push(`CONTINUIDADE RECOMENDADA:\n- ${continuityLines.join('\n- ')}`);
    }

    return sections.join('\n\n');
  }

  public buildContinuationAwareMessage(messageText: string, continuityContext: ContinuityContext): string {
    const normalized = String(messageText || '').trim();
    if (!normalized || !continuityContext?.followupPrompt || !this.deps.isContinuationIntent(normalized)) {
      return normalized;
    }

    const lines = [
      'RETOMADA SOLICITADA PELO USUARIO: ele quer continuar o contexto anterior, nao iniciar um assunto novo.',
      continuityContext.titleHint ? `ASSUNTO EM FOCO: ${continuityContext.titleHint}` : null,
      continuityContext.recentArtifact?.name ? `ENTREGA RECENTE: ${continuityContext.recentArtifact.name}` : null,
      `SIGA ESTE PROXIMO PASSO SUGERIDO: ${continuityContext.followupPrompt}`,
      `PEDIDO ORIGINAL DO USUARIO: ${normalized}`,
    ].filter(Boolean);

    return lines.join('\n');
  }

  public buildContinuityResponseHint(messageText: string, continuityContext: ContinuityContext): string {
    if (!continuityContext?.followupPrompt || !this.deps.isContinuationIntent(messageText)) {
      return '';
    }

    return [
      'ORIENTACAO DE RESPOSTA PARA RETOMADA:',
      '- Comece deixando explicito o que esta sendo retomado.',
      '- Em seguida diga qual e o proximo passo util.',
      '- Mantenha a resposta natural, como continuidade da mesma conversa.',
      Array.isArray(continuityContext?.nextActions) && continuityContext.nextActions.length > 0
        ? `- Quando fizer sentido, cite um atalho direto do operador: ${continuityContext.nextActions
            .slice(0, 2)
            .map((entry) => entry.command)
            .join(' | ')}.`
        : null,
    ].filter(Boolean).join('\n');
  }

  public buildGraphContextMessages(task: Task): ChatMessage[] {
    const workspaceContext = this.buildWorkspaceContext(
      task,
      buildWorkspaceContinuityContext(task, String(task.source || 'telegram').trim()),
    );
    if (!workspaceContext) {
      return [];
    }

    return [
      {
        role: 'system',
        content: [
          'Contexto adicional para a tarefa autonoma.',
          workspaceContext,
          'Use esse contexto como guia operacional do workspace e evite repetir erros ja observados.',
        ].join('\n\n'),
      },
    ];
  }

  public buildCanonicalSessionContext(snapshot: GatewaySessionSnapshot | null | undefined): string {
    if (!snapshot) {
      return '';
    }

    const sections: string[] = [];
    const replayLines = [
      String(snapshot.replay?.headline || '').trim(),
      String(snapshot.replay?.operatorSummary || '').trim(),
    ].filter(Boolean);
    if (replayLines.length > 0) {
      sections.push(`REPLAY CANONICO DA SESSAO:\n- ${replayLines.join('\n- ')}`);
    }

    const handoffLines = [
      String(snapshot.handoff?.headline || '').trim(),
      String(snapshot.handoff?.handoffPrompt || '').trim(),
      String(snapshot.handoff?.handoffCommand || '').trim(),
    ].filter(Boolean);
    if (handoffLines.length > 0) {
      sections.push(`HANDOFF E PROXIMO PASSO:\n- ${handoffLines.join('\n- ')}`);
    }

    const continuityLines = [
      String(snapshot.continuity?.suggestedAction?.label || '').trim(),
      String(snapshot.continuity?.suggestedAction?.reason || '').trim(),
      String(snapshot.continuity?.suggestedAction?.prompt || '').trim(),
    ].filter(Boolean);
    if (continuityLines.length > 0) {
      sections.push(`SINAL DE CONTINUIDADE DA SESSAO:\n- ${continuityLines.join('\n- ')}`);
    }

    const transcriptLines = Array.isArray(snapshot.transcript)
      ? snapshot.transcript
          .slice(-6)
          .map((entry) => {
            const roleLabel =
              entry.role === 'assistant'
                ? 'Assistente'
                : (entry.role === 'system' ? 'Sistema' : 'Usuario');
            const content = String(entry.content || '')
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, 220);
            return content ? `${roleLabel}: ${content}` : '';
          })
          .filter(Boolean)
      : [];
    if (transcriptLines.length > 0) {
      sections.push(`TRANSCRIPT CANONICO RECENTE:\n- ${transcriptLines.join('\n- ')}`);
    }

    const artifactLines = Array.isArray(snapshot.artifacts)
      ? snapshot.artifacts
          .slice(0, 4)
          .map((artifact) => {
            const name = String(artifact?.name || artifact?.path || artifact?.id || '').trim();
            const kind = String(artifact?.kind || artifact?.type || '').trim();
            return name ? (kind ? `${name} (${kind})` : name) : '';
          })
          .filter(Boolean)
      : [];
    if (artifactLines.length > 0) {
      sections.push(`ARTEFATOS RECENTES DA SESSAO:\n- ${artifactLines.join('\n- ')}`);
    }

    const touchedFiles = Array.isArray(snapshot.filesTouched)
      ? snapshot.filesTouched.map((entry) => String(entry || '').trim()).filter(Boolean).slice(0, 4)
      : [];
    if (touchedFiles.length > 0) {
      sections.push(`ARQUIVOS TOCADOS RECENTEMENTE:\n- ${touchedFiles.join('\n- ')}`);
    }

    return sections.join('\n\n');
  }

  public buildWorkspaceStrategySnapshot(task: Task, taskGoal?: string): Record<string, unknown> {
    const operationalMemory = asRecord(task.metadata?.workspace_operational_memory) || {};
    const successfulExecutors = Array.isArray(operationalMemory.successful_executors)
      ? operationalMemory.successful_executors.map(asExecutorRecommendation).filter(Boolean)
      : [];
    const repeatedFailures = Array.isArray(operationalMemory.repeated_failures)
      ? operationalMemory.repeated_failures.map(asExecutorRecommendation).filter(Boolean)
      : [];
    const taskKindRecommendations = Array.isArray(operationalMemory.task_kind_recommendations)
      ? operationalMemory.task_kind_recommendations.map(asExecutorRecommendation).filter(Boolean)
      : [];
    const taskSubtypeRecommendations = Array.isArray(operationalMemory.task_subtype_recommendations)
      ? operationalMemory.task_subtype_recommendations.map(asExecutorRecommendation).filter(Boolean)
      : [];
    const taskProfile = classifyWorkspaceTaskProfile({ text: taskGoal || task.normalized_message || task.raw_message || '' });
    const taskKind = taskProfile.kind;
    const taskSubtype = taskProfile.subtype;
    const kindRecommendation = taskKindRecommendations.find((entry) => {
      return String(entry?.kind || '').trim().toLowerCase() === taskKind;
    }) || null;
    const subtypeRecommendation = taskSubtypeRecommendations.find((entry) => {
      return String(entry?.kind || '').trim().toLowerCase() === taskKind
        && String(entry?.subtype || '').trim().toLowerCase() === taskSubtype;
    }) || null;

    return {
      taskKind,
      taskSubtype,
      preferredExecutor: successfulExecutors[0]?.executor || null,
      repeatedFailureExecutor: repeatedFailures[0]?.executor || null,
      repeatedFailureSummary: repeatedFailures[0]?.summary || null,
      taskKindPreferredExecutor: kindRecommendation?.preferred_executor || null,
      taskKindRepeatedFailureExecutor: kindRecommendation?.repeated_failure_executor || null,
      taskKindRepeatedFailureSummary: kindRecommendation?.repeated_failure_summary || null,
      taskSubtypePreferredExecutor: subtypeRecommendation?.preferred_executor || null,
      taskSubtypeRepeatedFailureExecutor: subtypeRecommendation?.repeated_failure_executor || null,
      taskSubtypeRepeatedFailureSummary: subtypeRecommendation?.repeated_failure_summary || null,
    };
  }
}

function asRecord(value: unknown): WorkspaceProfileRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as WorkspaceProfileRecord
    : null;
}

function asWorkspaceHook(value: unknown): WorkspaceProfileHook | null {
  return asRecord(value) as WorkspaceProfileHook | null;
}

function asWorkspaceCommand(value: unknown): WorkspaceProfileCommand | null {
  return asRecord(value) as WorkspaceProfileCommand | null;
}

function asApprovedPath(value: unknown): ApprovedPathRecord | null {
  return asRecord(value) as ApprovedPathRecord | null;
}

function asExecutorRecommendation(value: unknown): ExecutorRecommendation | null {
  return asRecord(value) as ExecutorRecommendation | null;
}
