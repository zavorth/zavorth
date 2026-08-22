import { Task } from '../contracts/TaskContract.js';

type ResponseEnvelopeKind =
  | 'security_block'
  | 'approval_prompt'
  | 'preparation_failure'
  | 'plan_ready'
  | 'plan_blocked'
  | 'execution_result'
  | 'research_success'
  | 'research_failure';

type ResponseEnvelopeEntry = {
  kind: ResponseEnvelopeKind;
  at: string;
  user_facing_text: string;
  operational_text: string;
};

export class TaskResponseEnvelopeService {
  public static capture(
    task: Task,
    kind: ResponseEnvelopeKind,
    userFacingText: string,
    operationalText: string,
  ): ResponseEnvelopeEntry {
    const at = new Date().toISOString();
    const history = Array.isArray(task.metadata?.response_history) ? task.metadata.response_history : [];
    const entry: ResponseEnvelopeEntry = {
      kind,
      at,
      user_facing_text: userFacingText,
      operational_text: operationalText,
    };

    task.metadata = {
      ...(task.metadata || {}),
      last_user_facing_response: {
        kind,
        at,
        text: userFacingText,
      },
      last_operational_response: {
        kind,
        at,
        text: operationalText,
      },
      response_history: [
        ...history,
        {
          kind,
          at,
          user_facing_preview: this.truncate(userFacingText, 240),
          operational_preview: this.truncate(operationalText, 240),
        },
      ].slice(-30),
    };

    return entry;
  }

  public static buildSecurityBlock(task: Task, reason: string): string {
    return [
      `kind=security_block`,
      `task=${task.task_id}`,
      `command=${task.command_type}`,
      `workspace=${task.workspace || 'n/a'}`,
      `reason=${this.truncate(reason, 400)}`,
    ].join(' | ');
  }

  public static buildApprovalPrompt(
    task: Task,
    executorLabel: string,
    reason: string,
    options?: {
      operatorMode?: boolean;
      routingReason?: string | null;
      presentationMode?: boolean;
    },
  ): string {
    return [
      `kind=approval_prompt`,
      `task=${task.task_id}`,
      `command=${task.command_type}`,
      `executor=${executorLabel}`,
      `risk=${task.risk_level}`,
      `operator_mode=${options?.operatorMode ? 'true' : 'false'}`,
      `presentation_mode=${options?.presentationMode ? 'true' : 'false'}`,
      `reason=${this.truncate(reason, 240)}`,
      options?.routingReason ? `routing_reason=${this.truncate(options.routingReason, 240)}` : null,
    ].filter(Boolean).join(' | ');
  }

  public static buildPreparationFailure(task: Task, message: string): string {
    return [
      `kind=preparation_failure`,
      `task=${task.task_id}`,
      `command=${task.command_type}`,
      `message=${this.truncate(message, 400)}`,
    ].join(' | ');
  }

  public static buildPlanReady(
    task: Task,
    plan: { objective: string; executor_recommendation: string; risk_level: number },
    warningText?: string,
  ): string {
    return [
      `kind=plan_ready`,
      `task=${task.task_id}`,
      `command=${task.command_type}`,
      `executor=${plan.executor_recommendation || 'n/a'}`,
      `risk=${plan.risk_level}`,
      `workspace=${task.workspace || 'n/a'}`,
      `objective=${this.truncate(plan.objective, 240)}`,
      warningText ? `warnings=${this.truncate(warningText, 300)}` : null,
    ].filter(Boolean).join(' | ');
  }

  public static buildPlanBlocked(task: Task, violations: string[]): string {
    return [
      `kind=plan_blocked`,
      `task=${task.task_id}`,
      `command=${task.command_type}`,
      `risk=${task.risk_level}`,
      `violations=${this.truncate(violations.join(' ; '), 400)}`,
    ].join(' | ');
  }

  public static buildExecutionResult(task: Task, label: string, workspace: string, result: any): string { // eslint-disable-line @typescript-eslint/no-explicit-any
    return [
      `kind=execution_result`,
      `task=${task.task_id}`,
      `command=${task.command_type}`,
      `executor=${task.executor_used || label}`,
      `workspace=${workspace || 'n/a'}`,
      `success=${result?.success ? 'true' : 'false'}`,
      result?.error_code ? `error_code=${result.error_code}` : null,
      `details=${this.truncate(
        String(result?.stdout || result?.stderr || result?.error_message || result?.diff_summary || 'Sem detalhes.'),
        500,
      )}`,
    ].filter(Boolean).join(' | ');
  }

  public static buildExecutionTranscript(task: Task, userFacingText: string, success: boolean): string {
    return [
      `kind=execution_result`,
      `task=${task.task_id}`,
      `command=${task.command_type}`,
      `executor=${task.executor_used || 'n/a'}`,
      `workspace=${task.workspace || 'n/a'}`,
      `success=${success ? 'true' : 'false'}`,
      `stdout=${this.truncate(task.stdout_summary || task.result_summary || '', 300)}`,
      `stderr=${this.truncate(task.stderr_summary || task.error_summary || '', 300)}`,
      `user_facing=${this.truncate(userFacingText, 300)}`,
    ].join(' | ');
  }

  public static buildResearchSuccess(task: Task, query: string, result: string): string {
    return [
      `kind=research_success`,
      `task=${task.task_id}`,
      `command=${task.command_type}`,
      `query=${this.truncate(query, 240)}`,
      `result=${this.truncate(result, 500)}`,
    ].join(' | ');
  }

  public static buildResearchFailure(task: Task, query: string, message: string): string {
    return [
      `kind=research_failure`,
      `task=${task.task_id}`,
      `command=${task.command_type}`,
      `query=${this.truncate(query, 240)}`,
      `message=${this.truncate(message, 400)}`,
    ].join(' | ');
  }

  private static truncate(value: string, maxLength: number): string {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    if (!normalized) {
      return '';
    }

    return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength)}...`;
  }
}
