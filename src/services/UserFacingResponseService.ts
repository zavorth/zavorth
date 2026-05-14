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
        'Montei um plano para isso.',
        '',
        `Referencia curta: ${task.task_id.substring(0, 8)}`,
        `Objetivo: ${plan.objective}`,
        warningText ? `Observacoes: ${warningText}` : null,
      ].filter(Boolean).join('\n');
    }

    return [
      'Montei um plano para seguir com isso.',
      '',
      `Referencia curta: ${task.task_id.substring(0, 8)}`,
      `Objetivo: ${plan.objective}`,
      `Caminho sugerido: ${this.describeExecutor(plan.executor_recommendation)}`,
      `Risco: ${this.describeRisk(plan.risk_level)}`,
      warningText ? `Observacoes: ${warningText}` : null,
    ].filter(Boolean).join('\n');
  }

  public static formatPlanBlocked(task: Task, violations: string[], options: ResponseToneOptions = {}): string {
    return [
      options.presentationMode ? 'Analisei isso e preferi parar antes de seguir.' : 'Montei um plano, mas preferi parar antes de executar.',
      '',
      `Referencia curta: ${task.task_id.substring(0, 8)}`,
      'Motivos:',
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
        ? [
            'Preparei a proxima etapa e fiquei aguardando sua confirmacao.',
            `Motivo: ${reason}`,
          ]
        : [
            'Antes de continuar, preciso da sua confirmacao.',
            `Motivo: ${reason}`,
          ]
      : options?.operatorMode
        ? [
            'Modo operador ativo. Eu preparei tudo e parei antes de agir.',
            `Vou usar: ${executorLabel}`,
            options.routingReason ? `Escolhi esse caminho porque: ${reason || options.routingReason}` : `Motivo: ${reason}`,
          ]
        : [
            'Antes de continuar, preciso da sua confirmacao.',
            `Vou usar: ${executorLabel}`,
            `Motivo: ${reason}`,
          ];

    return [
      ...lines.filter(Boolean),
      '',
      `Referencia completa: ${task.task_id}`,
      options?.highRiskText || null,
      options?.operatorMode
        ? `Quando quiser seguir, use /approve ${task.task_id}${task.metadata?.requiresHighRiskPin ? ' pin=<codigo>' : ''}.`
        : `Se quiser continuar, use /approve ${task.task_id}${task.metadata?.requiresHighRiskPin ? ' pin=<codigo>' : ''}.`,
    ].filter(Boolean).join('\n');
  }

  public static formatExecutionOutput(label: string, result: any, options: ResponseToneOptions = {}): string {
    if (String(label || '').toLowerCase().includes('stitch')) {
      return this.formatStitchExecutionOutput(result, options);
    }

    const primaryOutput = String(
      result?.success
        ? (result.stdout || result.stderr || result.error_message || 'Tudo certo.')
        : (result.error_message || result.stderr || result.stdout || 'Nao houve detalhe adicional.'),
    ).trim();
    const suggestedFix = String(result?.metadata?.self_reflection?.suggested_fix || '').trim();
    const bodyTitle = result?.success ? 'Resultado' : 'Motivo';

    return [
      options.presentationMode
        ? (result?.success ? 'Consegui concluir isso.' : 'Nao consegui concluir isso agora.')
        : (result?.success ? `${label}: pronto.` : `${label}: nao consegui concluir agora.`),
      '',
      `${bodyTitle}:`,
      primaryOutput || 'Sem detalhes adicionais.',
      suggestedFix ? '' : null,
      suggestedFix ? 'Se quiser, eu posso tentar esta correcao automatica:' : null,
      suggestedFix || null,
    ].filter(Boolean).join('\n');
  }

  public static formatStructuredResearchSuccess(query: string, result: string): string {
    const lead = this.extractResearchLead(result);
    const details = this.extractResearchDetails(result, lead);

    return [
      'Pesquisa concluida.',
      `Pergunta: ${query}`,
      '',
      'Resposta direta:',
      lead || result,
      details.length > 0 ? '' : null,
      details.length > 0 ? 'Detalhes uteis:' : null,
      ...(details.length > 0 ? details.map((line) => `- ${line}`) : []),
      '',
      'Se quiser, eu posso resumir mais ou aprofundar a resposta.',
    ].filter(Boolean).join('\n');
  }

  public static formatStructuredResearchFailure(query: string, message: string): string {
    return [
      'Nao consegui concluir essa pesquisa agora.',
      `Pergunta: ${query}`,
      '',
      'O que aconteceu:',
      message,
      '',
      'Se quiser, eu posso tentar de novo por outra rota.',
    ].filter(Boolean).join('\n');
  }

  public static formatPreparationFailure(message: string): string {
    return [
      'Tive um problema interno enquanto eu organizava esse pedido.',
      '',
      `Motivo: ${message}`,
    ].join('\n');
  }

  public static describeExecutor(executor: string | null | undefined): string {
    switch (String(executor || '').trim().toLowerCase()) {
      case 'codex':
        return 'Codex';
      case 'external_executor':
        return 'ExternalExecutor';
      case 'gemini_cli':
      case 'gemini':
        return 'Gemini CLI';
      case 'web_research':
        return 'pesquisa web estruturada';
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
        return 'shell local';
      default:
        if (String(executor || '').startsWith('workflow:')) {
          return `workflow ${String(executor).replace(/^workflow:/, '').trim()}`;
        }
        return String(executor || 'o caminho padrao');
    }
  }

  public static describeRisk(riskLevel: number): string {
    if (riskLevel >= 3) {
      return 'alto';
    }
    if (riskLevel === 2) {
      return 'medio';
    }
    return 'baixo';
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

  private static formatStitchExecutionOutput(result: any, options: ResponseToneOptions = {}): string {
    const artifacts = Array.isArray(result?.artifacts) ? result.artifacts : [];
    const imageCount = artifacts.filter((artifact: any) =>
      ['stitch_screenshot', 'stitch_image_url', 'image_preview'].includes(String(artifact?.kind || '').trim()),
    ).length;
    const htmlCount = artifacts.filter((artifact: any) =>
      ['stitch_html', 'stitch_html_url', 'html_export'].includes(String(artifact?.kind || '').trim()),
    ).length;

    if (result?.success) {
      const totalDeliveries = [imageCount, htmlCount].reduce((sum, value) => sum + (value > 0 ? 1 : 0), 0);
      return [
        options.presentationMode ? 'A interface ficou pronta.' : 'Google Stitch: geracao concluida.',
        '',
        'O que foi gerado:',
        imageCount > 0 ? `- Preview em imagem: ${imageCount}` : '- Preview em imagem: disponivel se a geracao tiver produzido esse arquivo.',
        htmlCount > 0 ? `- HTML exportado: ${htmlCount}` : '- HTML exportado: disponivel se a geracao tiver produzido esse arquivo.',
        totalDeliveries > 0 ? `- Entregas principais: ${totalDeliveries}` : null,
        '',
        'Como isso chega para voce:',
        '- A imagem aparece aqui na conversa quando estiver disponivel.',
        '- Os arquivos e links gerados aparecem logo em seguida.',
        '',
        'Ideal para mostrar:',
        '- O preview serve para apresentar a interface rapidamente.',
        '- O HTML ajuda a abrir, revisar ou adaptar o resultado depois.',
        '',
        'Se quiser, depois eu posso sugerir melhorias, variar o estilo ou adaptar essa interface para outro formato.',
      ].filter(Boolean).join('\n');
    }

    const reason = String(result?.error_message || result?.stderr || result?.stdout || 'Nao houve detalhe adicional.').trim();
    const suggestedFix = String(result?.metadata?.suggestion || result?.metadata?.self_reflection?.suggested_fix || '').trim();

    return [
      options.presentationMode ? 'Nao consegui concluir essa geracao visual agora.' : 'Google Stitch: nao consegui concluir essa geracao agora.',
      '',
      'O que aconteceu:',
      reason || 'Sem detalhes adicionais.',
      suggestedFix ? '' : null,
      suggestedFix ? 'Se quiser, eu posso tentar de novo seguindo esta sugestao:' : null,
      suggestedFix || null,
      '',
      'Se preferir, eu tambem posso simplificar o briefing e tentar uma versao mais enxuta.',
    ].filter(Boolean).join('\n');
  }
}
