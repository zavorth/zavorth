import {
  classifyWorkspaceTaskProfile,
  resolveWorkspaceResponseStyle,
  type WorkspaceResponseStyle,
  type WorkspaceTaskKind,
  type WorkspaceTaskSubtype,
} from './WorkspaceTaskKind.js';

export type ExecutionModeHint = 'planner' | 'graph' | 'conversation';

export type ExecutionIntentRoute =
  | 'planner.structured'
  | 'graph.code'
  | 'graph.research'
  | 'graph.research.summary'
  | 'graph.design'
  | 'graph.automation'
  | 'graph.general'
  | 'conversation.direct'
  | 'conversation.assist';

export type ExecutionIntentClassification = {
  taskKind: WorkspaceTaskKind;
  taskSubtype: WorkspaceTaskSubtype;
  responseStyle: WorkspaceResponseStyle;
  executionMode: ExecutionModeHint;
  executionRoute: ExecutionIntentRoute;
  confidence: 'low' | 'medium' | 'high';
  rationale: string[];
};

type ClassifyExecutionIntentInput = {
  text?: string | null;
  commandType?: string | null;
  intent?: string | null;
  executor?: string | null;
  taskKind?: WorkspaceTaskKind | null;
  taskSubtype?: WorkspaceTaskSubtype | null;
  modeHint?: ExecutionModeHint;
};

const WORKSPACE_TASK_KINDS = new Set<WorkspaceTaskKind>([
  'code',
  'research',
  'design',
  'automation',
  'unknown',
]);

const WORKSPACE_TASK_SUBTYPES = new Set<WorkspaceTaskSubtype>([
  'implementation',
  'debugging',
  'review',
  'testing',
  'web_research',
  'comparison',
  'summarization',
  'ui_design',
  'figma_design',
  'navigation',
  'form_fill',
  'app_control',
  'general',
  'unknown',
]);

export class ExecutionIntentClassifierService {
  public classify(input: ClassifyExecutionIntentInput): ExecutionIntentClassification {
    const modeHint = input.modeHint || 'graph';
    const explicitKind = this.normalizeKind(input.taskKind);
    const explicitSubtype = this.normalizeSubtype(input.taskSubtype);
    const normalizedText = String(input.text || '').trim();
    const normalizedCommandType = String(input.commandType || '').trim().toLowerCase();
    const normalizedIntent = String(input.intent || '').trim().toLowerCase();
    const normalizedExecutor = String(input.executor || '').trim().toLowerCase();
    const rationale: string[] = [];

    let taskKind = explicitKind;
    let taskSubtype = explicitSubtype;
    let confidence: ExecutionIntentClassification['confidence'] = 'low';

    if (taskKind && taskSubtype) {
      confidence = 'high';
      rationale.push(`Classificacao explicita recebida: ${taskKind}/${taskSubtype}.`);
    } else {
      const classified = classifyWorkspaceTaskProfile({
        text: normalizedText,
        commandType: normalizedCommandType,
        intent: normalizedIntent,
        executor: normalizedExecutor,
      });
      taskKind = taskKind || classified.kind;
      taskSubtype = taskSubtype || classified.subtype;

      if (normalizedCommandType) {
        rationale.push(`O comando ${normalizedCommandType} ajudou a orientar a classificacao.`);
      }
      if (normalizedIntent) {
        rationale.push(`A intencao declarada (${normalizedIntent}) foi usada como sinal complementar.`);
      }
      if (normalizedExecutor) {
        rationale.push(`A preferencia de executor (${normalizedExecutor}) influenciou a rota sugerida.`);
      }
      if (normalizedText) {
        rationale.push('O texto principal da tarefa foi analisado para inferir tipo e subtipo.');
      }

      if (taskKind !== 'unknown') {
        confidence = explicitKind || explicitSubtype ? 'high' : 'medium';
      }
    }

    const safeTaskKind = taskKind || 'unknown';
    const safeTaskSubtype = taskSubtype || (safeTaskKind === 'unknown' ? 'unknown' : 'general');

    if (rationale.length === 0) {
      rationale.push('Nao houve sinal forte; a classificacao ficou no fallback padrao.');
    }

    return {
      taskKind: safeTaskKind,
      taskSubtype: safeTaskSubtype,
      responseStyle: resolveWorkspaceResponseStyle(safeTaskKind, safeTaskSubtype),
      executionMode: modeHint,
      executionRoute: this.resolveExecutionRoute(safeTaskKind, safeTaskSubtype, modeHint),
      confidence,
      rationale,
    };
  }

  private normalizeKind(value: WorkspaceTaskKind | null | undefined): WorkspaceTaskKind | null {
    const normalized = String(value || '').trim().toLowerCase() as WorkspaceTaskKind;
    return WORKSPACE_TASK_KINDS.has(normalized) ? normalized : null;
  }

  private normalizeSubtype(value: WorkspaceTaskSubtype | null | undefined): WorkspaceTaskSubtype | null {
    const normalized = String(value || '').trim().toLowerCase() as WorkspaceTaskSubtype;
    return WORKSPACE_TASK_SUBTYPES.has(normalized) ? normalized : null;
  }

  private resolveExecutionRoute(
    taskKind: WorkspaceTaskKind,
    taskSubtype: WorkspaceTaskSubtype,
    modeHint: ExecutionModeHint,
  ): ExecutionIntentRoute {
    if (modeHint === 'planner') {
      return 'planner.structured';
    }

    if (modeHint === 'conversation') {
      return taskKind === 'unknown' ? 'conversation.direct' : 'conversation.assist';
    }

    if (taskKind === 'research') {
      return taskSubtype === 'summarization' ? 'graph.research.summary' : 'graph.research';
    }
    if (taskKind === 'code') {
      return 'graph.code';
    }
    if (taskKind === 'design') {
      return 'graph.design';
    }
    if (taskKind === 'automation') {
      return 'graph.automation';
    }

    return 'graph.general';
  }
}
