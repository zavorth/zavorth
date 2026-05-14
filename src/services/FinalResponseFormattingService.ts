type MessageSection = {
  title?: string | null;
  lines?: Array<string | null | undefined>;
};

type PermissionListItem = {
  marker: string;
  headline: string;
  details?: string[];
};

type PermissionPromptOptions = {
  title: string;
  shortId: string;
  intro?: string | null;
  summaryLines?: Array<string | null | undefined>;
  actionLines?: Array<string | null | undefined>;
  manualLines?: Array<string | null | undefined>;
  technicalLines?: Array<string | null | undefined>;
};

type PermissionDecisionOptions = {
  title: string;
  shortId: string;
  summaryLines?: Array<string | null | undefined>;
  nextStep?: string | null;
};

type ZavorthBridgeCompletionOptions = {
  shortId: string;
  source: string;
  content: string;
  summary?: string | null;
};

type DirectoryFallbackOptions = {
  shortId: string;
  directoryPath: string;
  summary: string;
  previewLines: string[];
  hiddenCount?: number;
};

export class FinalResponseFormattingService {
  public formatPermissionList(
    status: string,
    items: PermissionListItem[],
    emptyText: string,
  ): string {
    if (items.length === 0) {
      return emptyText;
    }

    const lines = [`Permissoes (${status})`, ''];
    for (const item of items) {
      lines.push(`${item.marker} ${item.headline}`);
      for (const detail of item.details || []) {
        lines.push(`  - ${detail}`);
      }
      lines.push('');
    }

    return lines.join('\n').trim();
  }

  public formatPermissionDetails(
    permissionId: string,
    sections: MessageSection[],
  ): string {
    return this.compose(`Detalhes da permissao ${permissionId}`, sections);
  }

  public formatPermissionPrompt(options: PermissionPromptOptions): string {
    return this.compose(options.title, [
      {
        lines: [
          options.intro || 'O Zavorth precisa da sua decisao antes de continuar esta tarefa.',
          `Referencia curta: ${options.shortId}`,
        ],
      },
      { title: 'Contexto', lines: options.summaryLines || [] },
      { title: 'Escolhas rapidas', lines: options.actionLines || [] },
      { title: 'Comandos manuais', lines: options.manualLines || [] },
      { title: 'Sugestoes tecnicas', lines: options.technicalLines || [] },
    ]);
  }

  public formatPermissionDecision(options: PermissionDecisionOptions): string {
    return this.compose(options.title, [
      {
        lines: [
          `Referencia curta: ${options.shortId}`,
          ...(options.summaryLines || []),
          options.nextStep || null,
        ],
      },
    ]);
  }

  public formatFileChoices(prompt: string): string {
    return this.compose('Encontrei mais de uma opcao para esse pedido', [
      {
        lines: [
          'Responda com o numero correspondente para eu continuar o envio.',
        ],
      },
      {
        title: 'Opcoes encontradas',
        lines: this.splitLines(prompt),
      },
    ]);
  }

  public formatFilePreview(previewText: string, fileName?: string): string {
    const normalizedName = String(fileName || '').trim();
    const isArchive = normalizedName.toLowerCase().endsWith('.zip');

    return this.compose('Envio pronto', [
      {
        lines: [
          isArchive ? 'Ja deixei este pacote preparado para envio.' : 'Ja deixei este arquivo preparado para envio.',
          normalizedName ? `Arquivo: ${normalizedName}` : null,
        ],
      },
      {
        title: 'Resumo rapido',
        lines: this.splitLines(previewText),
      },
      {
        lines: ['Se quiser, depois eu posso procurar outra versao, outra pasta ou comparar arquivos relacionados.'],
      },
    ]);
  }

  public formatZavorthBridgeCompletion(options: ZavorthBridgeCompletionOptions): string {
    return this.compose('ZavorthBridge concluiu a tarefa.', [
      {
        lines: [
          `Referencia curta: ${options.shortId}`,
          `Fonte: ${options.source}`,
          options.summary ? `Resumo: ${options.summary}` : null,
        ],
      },
      {
        title: 'Resultado',
        lines: this.splitLines(options.content),
      },
    ]);
  }

  public formatZavorthBridgeDirectoryFallback(options: DirectoryFallbackOptions): string {
    return this.compose('ZavorthBridge concluiu a tarefa.', [
      {
        lines: [
          'O ZavorthBridge nao fechou a resposta final no chat, entao conclui a leitura local da pasta para nao te deixar sem retorno.',
          `Referencia curta: ${options.shortId}`,
          `Pasta: ${options.directoryPath}`,
          `Resumo: ${options.summary}`,
        ],
      },
      {
        title: 'Conteudo encontrado',
        lines: options.previewLines.length > 0 ? options.previewLines : ['(Diretorio vazio)'],
      },
      {
        lines: [
          options.hiddenCount && options.hiddenCount > 0
            ? `... e mais ${options.hiddenCount} item(ns).`
            : null,
        ],
      },
    ]);
  }

  public compose(title: string, sections: MessageSection[]): string {
    const lines = [title];

    for (const section of sections) {
      const normalized = (section.lines || [])
        .map((line) => String(line || '').trim())
        .filter(Boolean);
      if (normalized.length === 0) {
        continue;
      }

      lines.push('');
      if (section.title) {
        lines.push(`${section.title}:`);
      }
      lines.push(...normalized);
    }

    return lines.join('\n').trim();
  }

  private splitLines(text: string): string[] {
    return String(text || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }
}
