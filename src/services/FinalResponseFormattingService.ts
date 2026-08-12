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

    const lines = [`Permissions (${status})`, ''];
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
    return this.compose(`Permission details ${permissionId}`, sections);
  }

  public formatPermissionPrompt(options: PermissionPromptOptions): string {
    return this.compose(options.title, [
      {
        lines: [
          options.intro || 'Zavorth needs your decision before continuing this task.',
          `Short reference: ${options.shortId}`,
        ],
      },
      { title: 'Context', lines: options.summaryLines || [] },
      { title: 'Quick choices', lines: options.actionLines || [] },
      { title: 'Manual commands', lines: options.manualLines || [] },
      { title: 'Technical suggestions', lines: options.technicalLines || [] },
    ]);
  }

  public formatPermissionDecision(options: PermissionDecisionOptions): string {
    return this.compose(options.title, [
      {
        lines: [
          `Short reference: ${options.shortId}`,
          ...(options.summaryLines || []),
          options.nextStep || null,
        ],
      },
    ]);
  }

  public formatFileChoices(prompt: string): string {
    return this.compose('Found more than one option for this request', [
      {
        lines: [
          'Reply with the corresponding number to continue the delivery.',
        ],
      },
      {
        title: 'Options found',
        lines: this.splitLines(prompt),
      },
    ]);
  }

  public formatFilePreview(previewText: string, fileName?: string): string {
    const normalizedName = String(fileName || '').trim();
    const isArchive = normalizedName.toLowerCase().endsWith('.zip');

    return this.compose('Delivery ready', [
      {
        lines: [
          isArchive ? 'This package is ready for delivery.' : 'This file is ready for delivery.',
          normalizedName ? `File: ${normalizedName}` : null,
        ],
      },
      {
        title: 'Quick summary',
        lines: this.splitLines(previewText),
      },
      {
        lines: ['If you want, I can later search for another version, another folder, or compare related files.'],
      },
    ]);
  }

  public formatZavorthBridgeCompletion(options: ZavorthBridgeCompletionOptions): string {
    return this.compose('ZavorthBridge completed the task.', [
      {
        lines: [
          `Short reference: ${options.shortId}`,
          `Source: ${options.source}`,
          options.summary ? `Summary: ${options.summary}` : null,
        ],
      },
      {
        title: 'Result',
        lines: this.splitLines(options.content),
      },
    ]);
  }

  public formatZavorthBridgeDirectoryFallback(options: DirectoryFallbackOptions): string {
    return this.compose('ZavorthBridge completed the task.', [
      {
        lines: [
          'ZavorthBridge did not finish the response in chat, so it completed the local folder reading to avoid leaving you without a result.',
          `Short reference: ${options.shortId}`,
          `Folder: ${options.directoryPath}`,
          `Summary: ${options.summary}`,
        ],
      },
      {
        title: 'Content found',
        lines: options.previewLines.length > 0 ? options.previewLines : ['(Empty directory)'],
      },
      {
        lines: [
          options.hiddenCount && options.hiddenCount > 0
            ? `... and ${options.hiddenCount} more item(s).`
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
