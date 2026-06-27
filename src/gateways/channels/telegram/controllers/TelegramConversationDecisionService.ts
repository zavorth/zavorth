// @ts-nocheck
import { Task } from '@zavorth/contracts/TaskContract.js';
import {
  classifyWorkspaceTaskProfile,
  type WorkspaceTaskKind,
  type WorkspaceResponseStyle,
  type WorkspaceTaskSubtype,
  resolveWorkspaceResponseStyle,
} from '@zavorth/services/WorkspaceTaskKind.js';

export type AutonomousExecutionDecision = {
  mode: 'direct' | 'autonomous';
  reason: string;
  taskKind: WorkspaceTaskKind;
  taskSubtype: WorkspaceTaskSubtype;
};

export class TelegramConversationDecisionService {
  public decideAutonomousExecution(
    task: Task,
    originalMessage: string,
    autonomousPayload: string,
  ): AutonomousExecutionDecision {
    const profile = classifyWorkspaceTaskProfile({
      text: autonomousPayload || originalMessage || '',
    });
    const workspaceSignal = this.hasWorkspaceSignal(task);
    const strongAutonomyIntent = this.hasStrongAutonomyIntent(originalMessage, autonomousPayload);
    const autonomyRecommendation = this.resolveAutonomyRecommendation(task, profile.kind, profile.subtype);

    if (profile.kind === 'automation') {
      return {
        mode: 'autonomous',
        reason: 'automation_requires_control',
        taskKind: profile.kind,
        taskSubtype: profile.subtype,
      };
    }

    if (autonomyRecommendation?.preferred_mode === 'direct' && autonomyRecommendation.confidence === 'high') {
      return {
        mode: 'direct',
        reason: `workspace_history_prefers_direct:${autonomyRecommendation.subtype}`,
        taskKind: profile.kind,
        taskSubtype: profile.subtype,
      };
    }

    if (
      autonomyRecommendation?.preferred_mode === 'autonomous'
      && (autonomyRecommendation.confidence === 'high' || autonomyRecommendation.approved_count >= 2)
    ) {
      return {
        mode: 'autonomous',
        reason: `workspace_history_prefers_autonomous:${autonomyRecommendation.subtype}`,
        taskKind: profile.kind,
        taskSubtype: profile.subtype,
      };
    }

    if (profile.kind === 'research') {
      return {
        mode: strongAutonomyIntent ? 'autonomous' : 'direct',
        reason: strongAutonomyIntent ? 'research_forced_by_user' : 'research_prefers_direct',
        taskKind: profile.kind,
        taskSubtype: profile.subtype,
      };
    }

    if (profile.kind === 'design') {
      return {
        mode: strongAutonomyIntent && workspaceSignal ? 'autonomous' : 'direct',
        reason:
          strongAutonomyIntent && workspaceSignal
            ? 'design_with_workspace_context'
            : 'design_prefers_direct',
        taskKind: profile.kind,
        taskSubtype: profile.subtype,
      };
    }

    if (profile.kind === 'code') {
      if (profile.subtype === 'review') {
        return {
          mode: workspaceSignal || strongAutonomyIntent ? 'autonomous' : 'direct',
          reason:
            workspaceSignal || strongAutonomyIntent
              ? 'review_with_context'
              : 'review_without_context_prefers_direct',
          taskKind: profile.kind,
          taskSubtype: profile.subtype,
        };
      }

      if (
        profile.subtype === 'implementation'
        || profile.subtype === 'debugging'
        || profile.subtype === 'testing'
      ) {
        return {
          mode: workspaceSignal || strongAutonomyIntent ? 'autonomous' : 'direct',
          reason:
            workspaceSignal || strongAutonomyIntent
              ? 'code_execution_with_context'
              : 'code_without_context_prefers_direct',
          taskKind: profile.kind,
          taskSubtype: profile.subtype,
        };
      }
    }

    if (strongAutonomyIntent && workspaceSignal) {
      return {
        mode: 'autonomous',
        reason: 'explicit_autonomy_with_workspace',
        taskKind: profile.kind,
        taskSubtype: profile.subtype,
      };
    }

    return {
      mode: 'direct',
      reason: 'direct_by_default',
      taskKind: profile.kind,
      taskSubtype: profile.subtype,
    };
  }

  public buildDirectResponseStyleHints(
    task: Task,
    taskKind: WorkspaceTaskKind,
    taskSubtype: WorkspaceTaskSubtype,
  ): string[] {
    const recommendation = this.resolveDirectStyleRecommendation(task, taskKind, taskSubtype);
    const preferredStyle = recommendation?.preferred_style || resolveWorkspaceResponseStyle(taskKind, taskSubtype);
    const taskLabel = taskSubtype !== 'general' && taskSubtype !== 'unknown' ? taskSubtype : taskKind;
    const hints: string[] = [];

    if (recommendation) {
      hints.push(
        `Siga o formato que este workspace tende a preferir para ${taskLabel}: ${preferredStyle} (${recommendation.rationale}).`,
      );
    }

    switch (preferredStyle) {
      case 'summary_first':
        hints.push(
          'Abra com um resumo executivo curto antes dos detalhes.',
          'Depois do resumo, organize os pontos por prioridade e proximos passos.',
        );
        break;
      case 'findings_first':
        hints.push(
          'Comece pelos achados, riscos ou falhas mais importantes.',
          'Deixe contexto secundario e explicacoes complementares depois dos achados principais.',
        );
        break;
      case 'decision_brief':
        hints.push(
          'Estruture a resposta como comparacao objetiva com criterios explicitos.',
          'Termine com recomendacao final clara, tradeoffs e risco principal.',
        );
        break;
      case 'checkpointed':
        hints.push(
          'Estruture a resposta em passos ou checkpoints claros.',
          'Deixe explicito o estado atual, o que ja foi feito e o proximo passo.',
        );
        break;
      case 'diagnostic':
        hints.push(
          'Responda como diagnostico: sintomas, causa provavel, evidencias e proximo teste recomendado.',
        );
        break;
      case 'implementation_ready':
        hints.push(
          'Responda de forma operacional e pronta para execucao.',
          'Inclua proposta concreta, impacto esperado e proximos passos praticos.',
        );
        break;
      default:
        hints.push('Responda de forma direta, economica e facil de aplicar.');
        break;
    }

    return Array.from(new Set(hints.map((hint) => hint.trim()).filter(Boolean)));
  }

  public isContinuationIntent(messageText: string): boolean {
    const normalized = String(messageText || '').trim().toLowerCase();
    if (!normalized) {
      return false;
    }

    if (normalized.length <= 24 && /^(continue|continua|continuar|segue|seguir|siga|retome|retomar|prossegue|prossiga|avanca|avance|manda ver|pode seguir|pode continuar|use isso|use isso como base|com base nisso)$/i.test(normalized)) {
      return true;
    }

    return /(continue|continua|continuar|segue|seguir|retome|retomar|prossegue|prossiga|avance|avanca|com base nisso|use isso como base|de onde parou|de onde paramos)/i.test(normalized);
  }

  private resolveAutonomyRecommendation(
    task: Task,
    taskKind: WorkspaceTaskKind,
    taskSubtype: WorkspaceTaskSubtype,
  ): {
    kind: WorkspaceTaskKind;
    subtype: WorkspaceTaskSubtype | 'general';
    preferred_mode: 'autonomous' | 'direct';
    approved_count: number;
    failed_count: number;
    confidence: 'low' | 'medium' | 'high';
  } | null {
    const workspaceMemory = task.metadata?.workspace_operational_memory;
    const recommendations = Array.isArray(workspaceMemory?.autonomous_mode_recommendations)
      ? workspaceMemory.autonomous_mode_recommendations
      : [];

    const subtypeRecommendation = recommendations.find((entry: unknown) => {
      return String(entry?.kind || '').trim().toLowerCase() === taskKind
        && String(entry?.subtype || '').trim().toLowerCase() === taskSubtype;
    });
    if (subtypeRecommendation) {
      return subtypeRecommendation;
    }

    const kindRecommendation = recommendations.find((entry: unknown) => {
      return String(entry?.kind || '').trim().toLowerCase() === taskKind
        && String(entry?.subtype || '').trim().toLowerCase() === 'general';
    });

    return kindRecommendation || null;
  }

  private resolveDirectStyleRecommendation(
    task: Task,
    taskKind: WorkspaceTaskKind,
    taskSubtype: WorkspaceTaskSubtype,
  ): {
    kind: WorkspaceTaskKind;
    subtype: WorkspaceTaskSubtype | 'general';
    preferred_style: WorkspaceResponseStyle;
    success_count: number;
    confidence: 'low' | 'medium' | 'high';
    rationale: string;
  } | null {
    const workspaceMemory = task.metadata?.workspace_operational_memory;
    const recommendations = Array.isArray(workspaceMemory?.direct_response_style_recommendations)
      ? workspaceMemory.direct_response_style_recommendations
      : [];

    const subtypeRecommendation = recommendations.find((entry: unknown) => {
      return String(entry?.kind || '').trim().toLowerCase() === taskKind
        && String(entry?.subtype || '').trim().toLowerCase() === taskSubtype;
    });
    if (subtypeRecommendation) {
      return subtypeRecommendation;
    }

    const kindRecommendation = recommendations.find((entry: unknown) => {
      return String(entry?.kind || '').trim().toLowerCase() === taskKind
        && String(entry?.subtype || '').trim().toLowerCase() === 'general';
    });

    return kindRecommendation || null;
  }

  private hasWorkspaceSignal(task: Task): boolean {
    if (String(task.workspace || '').trim()) {
      return true;
    }

    const metadata = task.metadata || {};
    return Boolean(
      metadata.workspace_profile
      || metadata.workspace_profile_summary
      || metadata.workspace_operational_memory
      || metadata.workspace_operational_memory_summary,
    );
  }

  private hasStrongAutonomyIntent(originalMessage: string, autonomousPayload: string): boolean {
    const combined = `${String(originalMessage || '')}\n${String(autonomousPayload || '')}`.toLowerCase();

    return /(arrume|corrija|conserte|modifique|altere|implante|implemente|crie|gere arquivo|rode|execute|automatize|fa[cç]a sozinho|pode seguir|pode fazer|aplique|mude o sistema|edite|fix|repair|modify|change|implement|create|generate file|run|execute|automate|do it yourself|go ahead|apply|edit)/i.test(
      combined,
    );
  }
}
