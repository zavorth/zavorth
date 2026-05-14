import type { WebComposerMention } from '../contracts/WebComposer.js';

const CONTEXT_ACTIONS = new Set([
  'attach_file_context',
  'attach_artifact_context',
]);

export class ComposerContextService {
  public hasContextualMentions(mentions: WebComposerMention[]): boolean {
    return this.getContextualMentions(mentions).length > 0;
  }

  public hasPendingFollowupActionWithoutMessage(
    message: string,
    mentions: WebComposerMention[],
  ): boolean {
    const normalizedMessage = String(message || '').trim();
    if (normalizedMessage) {
      return false;
    }

    return this.hasContextualMentions(mentions);
  }

  public buildExecutionText(
    message: string,
    mentions: WebComposerMention[],
  ): string {
    const normalizedMessage = String(message || '').trim();
    const contextBlocks = this.getContextualMentions(mentions)
      .map((mention) => this.buildContextBlock(mention))
      .filter(Boolean);

    if (!contextBlocks.length) {
      return normalizedMessage;
    }

    const contextSection = [
      '[Contexto do composer]',
      ...contextBlocks,
    ].join('\n');

    return [normalizedMessage, contextSection].filter(Boolean).join('\n\n').trim();
  }

  private getContextualMentions(mentions: WebComposerMention[]): WebComposerMention[] {
    return (Array.isArray(mentions) ? mentions : []).filter((mention) => {
      const action = String(mention?.payload?.action || '').trim();
      return mention?.type === 'action' && CONTEXT_ACTIONS.has(action);
    });
  }

  private buildContextBlock(mention: WebComposerMention): string | null {
    const action = String(mention.payload?.action || '').trim();
    switch (action) {
      case 'attach_file_context':
        return this.buildFileContextBlock(mention);
      case 'attach_artifact_context':
        return this.buildArtifactContextBlock(mention);
      default:
        return null;
    }
  }

  private buildFileContextBlock(mention: WebComposerMention): string {
    const lines = [
      'Arquivo selecionado para este pedido:',
      this.buildDetailLine('Nome', mention.payload?.fileName),
      this.buildDetailLine('Caminho', mention.payload?.path),
      this.buildDetailLine('Workspace', mention.payload?.workspace),
      this.buildDetailLine('Tarefa de origem', this.shortTaskRef(mention.payload?.taskId)),
      'Use este arquivo como contexto principal para a execucao.',
    ].filter(Boolean);

    return lines.join('\n');
  }

  private buildArtifactContextBlock(mention: WebComposerMention): string {
    const lines = [
      'Artefato selecionado para este pedido:',
      this.buildDetailLine('Nome', mention.payload?.name || mention.payload?.key),
      this.buildDetailLine(
        'Tipo',
        [mention.payload?.kind, mention.payload?.type].filter(Boolean).join(' / '),
      ),
      this.buildDetailLine('Caminho', mention.payload?.path),
      this.buildDetailLine('URL', mention.payload?.url),
      this.buildDetailLine('Resumo', mention.payload?.summary || mention.payload?.description),
      this.buildDetailLine('Tarefa de origem', this.shortTaskRef(mention.payload?.taskId)),
      'Use este artefato como referencia principal para a execucao.',
    ].filter(Boolean);

    return lines.join('\n');
  }

  private buildDetailLine(label: string, value: unknown): string | null {
    const normalized = String(value || '').trim();
    if (!normalized) {
      return null;
    }

    return `- ${label}: ${normalized}`;
  }

  private shortTaskRef(taskId: unknown): string | null {
    const normalized = String(taskId || '').trim();
    if (!normalized) {
      return null;
    }

    return normalized.substring(0, 8);
  }
}
