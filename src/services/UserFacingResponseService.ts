import { Task } from '../contracts/TaskContract.js';

type ResponseToneOptions = {
  presentationMode?: boolean;
};

export class UserFacingResponseService {
  public static formatPlanReady(
    task: Task,
    plan: { objective: string; executor_recommendation: string; risk_level: number },
    warningText?: string,
    options: ResponseToneOptions = {},
  ): string {
    if (options.presentationMode) {
      return [
        'I prepared a plan for that.',
        '',
        `Short reference: ${task.task_id.substring(0, 8)}`,
        `Objective: ${plan.objective}`,
        warningText ? `Observations: ${warningText}` : null,
      ]
        .filter(Boolean)
        .join('\n');
    }

    return [
      'I prepared a plan to continue.',
      '',
      `Short reference: ${task.task_id.substring(0, 8)}`,
      `Objective: ${plan.objective}`,
      `Suggested path: ${this.describeExecutor(plan.executor_recommendation)}`,
      `Risk: ${this.describeRisk(plan.risk_level)}`,
      warningText ? `Observations: ${warningText}` : null,
    ]
      .filter(Boolean)
      .join('\n');
  }

  public static formatPlanBlocked(task: Task, violations: string[], options: ResponseToneOptions = {}): string {
    return [
      options.presentationMode ? 'Analyzed this and preferred to stop before continuing.'
        : 'I prepared a plan, but stopped before running it.',
      '',
      `Short reference: ${task.task_id.substring(0, 8)}`,
      'Reasons:',
      ...violations.map((violation) => `- ${violation}`),
    ].join('\n');
  }

  public static formatApprovalPrompt(
    task: Task,
    executorLabel: string,
    reason: string,
    options?: {
      operatorMode?: boolean;
      highRiskText?: string | null;
      routingReason?: string | null;
      presentationMode?: boolean;
    },
  ): string {
    const lines = options?.presentationMode
      ? options?.operatorMode
        ? ['Prepared the next step and waited for your confirmation.', `Reason: ${reason}`]
        : ['Before continuing, I need your confirmation.', `Reason: ${reason}`]
      : options?.operatorMode
        ? [
            'Operator mode active. I prepared everything and stopped before acting.',
            `I will use: ${executorLabel}`,
            options.routingReason ? `Selected this path because: ${reason || options.routingReason}`
              : `Reason: ${reason}`,
          ]
        : ['Before continuing, I need your confirmation.', `I will use: ${executorLabel}`, `Reason: ${reason}`];

    return [
      ...lines.filter(Boolean),
      '',
      `Full reference: ${task.task_id}`,
      options?.highRiskText || null,
      options?.operatorMode ? 'When you want to continue, use /approve, /approve 1, or tap Approve — not a long id.'
        : 'If you want to continue, use /approve, /approve 1, or tap Approve — not a long id.',
    ]
      .filter(Boolean)
      .join('\n');
  }

  public static formatExecutionOutput(// eslint-disable-next-line @typescript-eslint/no-explicit-any
    label: string, result: any, options: ResponseToneOptions = {}): string {
    if (
      String(label || '')
        .toLowerCase()
        .includes('stitch')
    ) {
      return this.formatStitchExecutionOutput(result, options);
    }

    const primaryOutput = String(
      result?.success
        ? result.stdout || result.stderr || result.error_message || 'All set.'
        : result.error_message || result.stderr || result.stdout || 'No additional details were provided.',
    ).trim();
    const suggestedFix = String(result?.metadata?.self_reflection?.suggested_fix || '').trim();
    const bodyTitle = result?.success ? 'Result' : 'Reason';

    return [
      options.presentationMode
        ? result?.success ? 'Managed to complete this.'
          : 'I could not complete this right now.'
        : result?.success ? `${label}: ready.`
          : `${label}: could not complete this right now.`,
      '',
      `${bodyTitle}:`,
      primaryOutput || 'without additional details.',
      suggestedFix ? '' : null,
      suggestedFix ? 'I can try this automatic correction:' : null,
      suggestedFix || null,
    ]
      .filter(Boolean)
      .join('\n');
  }

  public static formatStructuredResearchSuccess(query: string, result: string): string {
    const lead = this.extractResearchLead(result);
    const details = this.extractResearchDetails(result, lead);

    return [
      'Research completed.',
      `question: ${query}`,
      '',
      'Direct answer:',
      lead || result,
      details.length > 0 ? '' : null,
      details.length > 0 ? 'Useful details:' : null,
      ...(details.length > 0 ? details.map((line) => `- ${line}`) : []),
      '',
      'If you want, I can summarize more or go deeper.',
    ]
      .filter(Boolean)
      .join('\n');
  }

  public static formatStructuredResearchFailure(query: string, message: string): string {
    return [
      'I could not complete this search right now.',
      `question: ${query}`,
      '',
      'What happened:',
      message,
      '',
      'I can try again through another route.',
    ]
      .filter(Boolean)
      .join('\n');
  }

  public static formatPreparationFailure(message: string): string {
    return ['I hit an internal problem while organizing this request.', '', `Reason: ${message}`].join('\n');
  }

  public static describeExecutor(executor: string | null | undefined): string {
    switch (
      String(executor || '')
        .trim()
        .toLowerCase()
    ) {
      case 'codex':
        return 'Codex';
      case 'external_executor':
        return 'ExternalExecutor';
      case 'gemini_cli':
      case 'gemini':
        return 'Gemini CLI';
      case 'web_research':
        return 'structured web research';
      case 'aistudio':
        return 'Google AI Studio';
      case 'jules':
        return 'Jules';
      case 'stitch':
        return 'Google Stitch';
      case 'zavorthBridge':
        return 'ZavorthBridge';
      case 'local':
      case 'local_executor':
        return 'local shell';
      default:
        if (String(executor || '').startsWith('workflow:')) {
          return `workflow ${String(executor)
            .replace(/^workflow:/, '')
            .trim()}`;
        }
        return String(executor || 'the default path');
    }
  }

  public static describeRisk(riskLevel: number): string {
    if (riskLevel >= 3) {
      return 'high';
    }
    if (riskLevel === 2) {
      return 'medium';
    }
    return 'low';
  }

  private static extractResearchLead(result: string): string {
    const lines = this.toNonEmptyLines(result);
    return lines[0] || String(result || '').trim();
  }

  private static extractResearchDetails(result: string, lead: string): string[] {
    return this.toNonEmptyLines(result)
      .filter((line, index) => !(index === 0 && line === lead))
      .slice(0, 4)
      .map((line) => line.replace(/^[-*]\s*/, '').trim())
      .filter(Boolean);
  }

  private static toNonEmptyLines(text: string): string[] {
    return String(text || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  private static formatStitchExecutionOutput(// eslint-disable-next-line @typescript-eslint/no-explicit-any
    result: any, options: ResponseToneOptions = {}): string {
    const artifacts = Array.isArray(result?.artifacts) ? result.artifacts : [];
    const imageCount = artifacts.filter((artifact: { kind?: string }) =>
      ['stitch_screenshot', 'stitch_image_url', 'image_preview'].includes(String(artifact?.kind || '').trim()),
    ).length;
    const htmlCount = artifacts.filter((artifact: { kind?: string }) =>
      ['stitch_html', 'stitch_html_url', 'html_export'].includes(String(artifact?.kind || '').trim()),
    ).length;

    if (result?.success) {
      const totalDeliveries = [imageCount, htmlCount].reduce((sum, value) => sum + (value > 0 ? 1 : 0), 0);
      return [
        options.presentationMode ? 'The interface is ready.' : 'Google Stitch: generation completed.',
        '',
        'Generated output:',
        imageCount > 0
          ? `- Image preview: ${imageCount}`
          : '- Image preview: available if generation produced this file.',
        htmlCount > 0
          ? `- Exported HTML: ${htmlCount}`
          : '- Exported HTML: available if generation produced this file.',
        totalDeliveries > 0 ? `- Main deliveries: ${totalDeliveries}` : null,
        '',
        'How this reaches you:',
        '- The image appears here in the conversation when it is available.',
        '- Generated files and links appear next.',
        '',
        'Ideal for showing:',
        '- The preview is for presenting the interface quickly.',
        '- HTML helps open, review, or adapt the result later.',
        '',
        'Afterward, I can suggest improvements, vary the style, or adapt this interface to another format.',
      ]
        .filter(Boolean)
        .join('\n');
    }

    const reason = String(
      result?.error_message || result?.stderr || result?.stdout || 'No additional details were provided.',
    ).trim();
    const suggestedFix = String(
      result?.metadata?.suggestion || result?.metadata?.self_reflection?.suggested_fix || '',
    ).trim();

    return [
      options.presentationMode ? 'I could not complete this image generation right now.'
        : 'Google Stitch: I could not complete this generation right now.',
      '',
      'What happened:',
      reason || 'without additional details.',
      suggestedFix ? '' : null,
      suggestedFix ? 'I can try again following this suggestion:' : null,
      suggestedFix || null,
      '',
      'If you prefer, I can simplify the brief and try a leaner version.',
    ]
      .filter(Boolean)
      .join('\n');
  }
}
