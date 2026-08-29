import type { ChatMessage, ToolCall } from '../../providers/ILlmProvider.js';

export interface PruneToolHistoryOptions {
  readonly keepRecent?: number;
  readonly maxPreviewChars?: number;
  readonly enableFileDeduplication?: boolean;
}

export interface PruneToolHistoryResult {
  readonly messages: ChatMessage[];
  readonly toolsPrunedCount: number;
  readonly tokensSavedEstimate: number;
  readonly deduplicatedReadsCount: number;
}

interface ParsedToolInvocation {
  readonly toolName: string;
  readonly command?: string;
  readonly targetPath?: string;
  readonly query?: string;
}

export class ToolResultPruningService {
  private readonly defaultKeepRecent = 3;
  private readonly defaultMaxPreviewChars = 240;

  /**
   * Deterministically prunes older tool result messages in a conversation history,
   * replacing verbose outputs with concise 1-line semantic summaries and deduplicating
   * older reads of the same file path.
   *
   * Preserves tool-pair integrity and never mutates the original messages array.
   */
  public pruneOlderToolResults(
    messages: readonly ChatMessage[],
    options: PruneToolHistoryOptions = {},
  ): PruneToolHistoryResult {
    if (!messages || messages.length === 0) {
      return {
        messages: [],
        toolsPrunedCount: 0,
        tokensSavedEstimate: 0,
        deduplicatedReadsCount: 0,
      };
    }

    const keepRecent = Math.max(0, options.keepRecent ?? this.defaultKeepRecent);
    const maxPreview = Math.max(50, options.maxPreviewChars ?? this.defaultMaxPreviewChars);
    const enableDedup = options.enableFileDeduplication !== false;

    // Index all assistant tool calls by id and index
    const toolCallIndex = this.buildToolCallIndex(messages);

    // Identify all tool message indexes
    const toolMessageIndices: number[] = [];
    for (let i = 0; i < messages.length; i += 1) {
      if (messages[i]?.role === 'tool') {
        toolMessageIndices.push(i);
      }
    }

    if (toolMessageIndices.length === 0) {
      return {
        messages: messages.map((m) => ({ ...m })),
        toolsPrunedCount: 0,
        tokensSavedEstimate: 0,
        deduplicatedReadsCount: 0,
      };
    }

    // Set of indices to keep recent unpruned
    const recentIndexThreshold = toolMessageIndices.length - keepRecent;
    const protectedIndices = new Set<number>(
      toolMessageIndices.slice(Math.max(0, recentIndexThreshold)),
    );

    // Identify duplicate file reads across all tool calls
    const supersededIndices = new Set<number>();
    if (enableDedup) {
      const latestReadByPath = new Map<string, number>();
      // Traverse backwards to register the newest read index for each file path
      for (let i = toolMessageIndices.length - 1; i >= 0; i -= 1) {
        const msgIdx = toolMessageIndices[i];
        const msg = messages[msgIdx];
        const invocation = this.resolveInvocation(msg, toolCallIndex);
        const path = invocation.targetPath;
        if (path && this.isFileReadTool(invocation.toolName)) {
          if (latestReadByPath.has(path)) {
            // An earlier read exists for this same path, mark this older one as superseded
            supersededIndices.add(msgIdx);
          } else {
            latestReadByPath.set(path, msgIdx);
          }
        }
      }
    }

    let toolsPrunedCount = 0;
    let tokensSavedEstimate = 0;
    let deduplicatedReadsCount = 0;

    const clonedMessages: ChatMessage[] = messages.map((msg, idx) => {
      if (msg.role !== 'tool') {
        return { ...msg };
      }

      const isProtected = protectedIndices.has(idx);
      const isSuperseded = supersededIndices.has(idx);

      // Protected recent tools remain intact unless superseded by a newer duplicate read
      if (isProtected && !isSuperseded) {
        return { ...msg };
      }

      const rawContent = String(msg.content ?? '');
      if (rawContent.startsWith('[compacted tool]') || rawContent.startsWith('[read_file] superseded')) {
        return { ...msg };
      }

      const invocation = this.resolveInvocation(msg, toolCallIndex);
      let prunedContent = '';

      if (isSuperseded && invocation.targetPath) {
        deduplicatedReadsCount += 1;
        prunedContent = `[read_file] ${invocation.targetPath} (superseded by newer read in subsequent turn)`;
      } else {
        prunedContent = this.formatSingleLineSummary(invocation, rawContent, maxPreview);
      }

      const charsSaved = Math.max(0, rawContent.length - prunedContent.length);
      const tokensSaved = Math.floor(charsSaved / 4);

      if (charsSaved > 0) {
        toolsPrunedCount += 1;
        tokensSavedEstimate += tokensSaved;
      }

      return {
        ...msg,
        content: prunedContent,
      };
    });

    return {
      messages: clonedMessages,
      toolsPrunedCount,
      tokensSavedEstimate,
      deduplicatedReadsCount,
    };
  }

  private buildToolCallIndex(messages: readonly ChatMessage[]): Map<string, ToolCall> {
    const index = new Map<string, ToolCall>();
    for (const msg of messages) {
      if (msg.role === 'assistant' && Array.isArray(msg.toolCalls)) {
        for (const tc of msg.toolCalls) {
          if (tc.id) {
            index.set(tc.id, tc);
          }
          if (tc.name && !index.has(tc.name)) {
            index.set(tc.name, tc);
          }
        }
      }
    }
    return index;
  }

  private resolveInvocation(
    toolMessage: ChatMessage,
    toolCallIndex: Map<string, ToolCall>,
  ): ParsedToolInvocation {
    const matchingCall = toolMessage.toolCallId ? toolCallIndex.get(toolMessage.toolCallId) : undefined;
    const toolName = toolMessage.toolName || matchingCall?.name || 'tool';

    const rawArgs: unknown = matchingCall?.arguments;
    let parsedArgs: Record<string, unknown> | null = null;

    if (typeof rawArgs === 'object' && rawArgs !== null) {
      parsedArgs = rawArgs as Record<string, unknown>;
    } else if (typeof rawArgs === 'string') {
      const trimmed = (rawArgs as string).trim();
      if (trimmed.length > 0) {
        try {
          const parsed: unknown = JSON.parse(trimmed);
          if (typeof parsed === 'object' && parsed !== null) {
            parsedArgs = parsed as Record<string, unknown>;
          }
        } catch {
          // Safe fallback for unparseable arguments
        }
      }
    }

    const command = this.extractCommand(parsedArgs);
    const targetPath = this.extractTargetPath(parsedArgs);
    const query = this.extractQuery(parsedArgs);

    return {
      toolName,
      command,
      targetPath,
      query,
    };
  }

  private extractCommand(args: Record<string, unknown> | null): string | undefined {
    if (!args) return undefined;
    const val = args.command ?? args.CommandLine ?? args.cmd ?? args.input;
    return typeof val === 'string' && val.trim().length > 0 ? val.trim() : undefined;
  }

  private extractTargetPath(args: Record<string, unknown> | null): string | undefined {
    if (!args) return undefined;
    const val =
      args.path ??
      args.AbsolutePath ??
      args.TargetFile ??
      args.filePath ??
      args.targetPath ??
      args.file;
    return typeof val === 'string' && val.trim().length > 0 ? val.trim() : undefined;
  }

  private extractQuery(args: Record<string, unknown> | null): string | undefined {
    if (!args) return undefined;
    const val = args.query ?? args.Pattern ?? args.pattern ?? args.searchTerm;
    return typeof val === 'string' && val.trim().length > 0 ? val.trim() : undefined;
  }

  private isFileReadTool(name: string): boolean {
    const lower = name.toLowerCase();
    return lower === 'read_file' || lower === 'view_file' || lower === 'cat';
  }

  private isExecutionTool(name: string): boolean {
    const lower = name.toLowerCase();
    return (
      lower === 'terminal' ||
      lower === 'run_command' ||
      lower === 'bash' ||
      lower === 'execute_command' ||
      lower === 'cmd'
    );
  }

  private isSearchTool(name: string): boolean {
    const lower = name.toLowerCase();
    return lower === 'grep_search' || lower === 'find_by_name' || lower === 'search' || lower === 'ripgrep';
  }

  private isFileWriteTool(name: string): boolean {
    const lower = name.toLowerCase();
    return lower === 'write_to_file' || lower === 'replace_file_content';
  }

  private formatSingleLineSummary(
    invocation: ParsedToolInvocation,
    rawContent: string,
    maxPreview: number,
  ): string {
    const name = invocation.toolName;
    const charCount = rawContent.length;

    if (this.isExecutionTool(name) && invocation.command) {
      const lineCount = rawContent.split('\n').filter((l) => l.trim().length > 0).length;
      return `[compacted tool] [terminal] ran "${invocation.command}" -> ${lineCount} lines output (${charCount} chars)`;
    }

    if (this.isFileReadTool(name) && invocation.targetPath) {
      return `[compacted tool] [read_file] read ${invocation.targetPath} (${charCount} chars)`;
    }

    if (this.isSearchTool(name) && invocation.query) {
      const lineCount = rawContent.split('\n').filter((l) => l.trim().length > 0).length;
      return `[compacted tool] [search] query "${invocation.query}" -> ${lineCount} results (${charCount} chars)`;
    }

    if (this.isFileWriteTool(name) && invocation.targetPath) {
      return `[compacted tool] [write] updated ${invocation.targetPath}`;
    }

    // Clean preview without regex
    const cleanPreview = rawContent
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join(' ')
      .slice(0, maxPreview);

    return `[compacted tool] tool=${name} (${charCount} chars): ${cleanPreview}${charCount > maxPreview ? '...' : ''}`;
  }
}
