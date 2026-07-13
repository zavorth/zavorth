
import type { McpRuntimeService } from '../mcp/McpRuntimeService.js';
import type { LogRepository } from '../storage/LogRepository.js';
import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';

/**
 * MnemosCallbackPayload — inline button callback payload structure.
 *
 * FORMAT: mnemos:<action>:<encoded_data>
 *
 * Actions:
 *  - mnemos:index_confirm:<base64_filepath>  → confirm file indexing
 *  - mnemos:index_reject:<requestId>         → reject indexing
 *  - mnemos:vault_status                     → request vault status
 */
export type MnemosCallbackAction = 'index_confirm' | 'index_reject' | 'vault_status';

export type MnemosCallbackResult = {
  handled: boolean;
  responseText: string;
  action: MnemosCallbackAction | 'unknown';
  error: string | null;
};

export type MnemosToolInvoker = {
  execute(toolName: string, args: Record<string, unknown>): Promise<string>;
};

export type MnemosIndexCandidate = {
  name: string;
  path: string;
  size_bytes: number;
  extension: string;
};

export type MnemosHumanInTheLoopContext = {
  chatId: string;
  userId: string;
  originalQuery: string;
  candidates: MnemosIndexCandidate[];
};

/**
 * Human-in-the-loop orchestration between Mnemos memory and the user
 * (Telegram inline buttons or any compatible surface).
 *
 * Flow:
 *  1. Agent calls search_memory → no results
 *  2. Agent calls scan_local_metadata → finds candidates
 *  3. This service builds the message with inline buttons
 *  4. Callback processes the button and runs index_file if confirmed
 */
export class MnemosHumanInTheLoopService {
  constructor(
    private readonly logRepo: LogRepository,
    private readonly toolInvoker: MnemosToolInvoker | null = null,
  ) {}

  /**
   * Build interactive prompt + inline keyboard rows for Telegram/grammY.
   */
  public buildCandidatePrompt(context: MnemosHumanInTheLoopContext): {
    text: string;
    buttons: Array<{ text: string; callback_data: string }[]>;
  } {
    const { candidates, originalQuery } = context;

    if (candidates.length === 0) {
      return {
        text: [
          '🔍 **Mnemos Vault Search**',
          '',
          `I searched the vector vault and your authorized folders, but found no file related to "${originalQuery}".`,
          '',
          '💡 You can:',
          '• Send the file directly in this chat',
          '• Tell me the exact file name',
          '• Add the correct directory in Mnemos settings',
        ].join('\n'),
        buttons: [],
      };
    }

    const candidateList = candidates.slice(0, 5).map((c, i) => {
      const sizeMb = (c.size_bytes / (1024 * 1024)).toFixed(1);
      return `${i + 1}. 📄 \`${c.name}\` (${sizeMb} MB)`;
    }).join('\n');

    const text = [
      '🔍 **Mnemos Vault Search**',
      '',
      `I found no vault results for "${originalQuery}".`,
      `However, I found ${candidates.length} potential file(s) in your authorized folders:`,
      '',
      candidateList,
      '',
      '📌 Should I index any of them so I can answer your question?',
    ].join('\n');

    const buttons: Array<{ text: string; callback_data: string }[]> = [];

    for (const candidate of candidates.slice(0, 3)) {
      const encodedPath = Buffer.from(candidate.path).toString('base64url');
      buttons.push([
        {
          text: `✅ Index "${candidate.name}"`,
          callback_data: `mnemos:index_confirm:${encodedPath}`,
        },
      ]);
    }

    buttons.push([
      {
        text: '❌ None of these are correct',
        callback_data: 'mnemos:index_reject:all',
      },
    ]);

    return { text, buttons };
  }

  /**
   * Process a callback from TelegramCallbackController.
   * Expected format: mnemos:<action>:<data>
   */
  public async processCallback(
    data: string,
    mcpRuntime: Pick<McpRuntimeService, 'readSnapshot'>,
  ): Promise<MnemosCallbackResult> {
    const parts = data.split(':');
    if (parts.length < 2 || parts[0] !== 'mnemos') {
      return {
        handled: false,
        responseText: '',
        action: 'unknown',
        error: 'Callback does not belong to Mnemos.',
      };
    }

    const action = parts[1] as MnemosCallbackAction;
    const payload = parts.slice(2).join(':');

    switch (action) {
      case 'index_confirm':
        return this.handleIndexConfirm(payload, mcpRuntime);
      case 'index_reject':
        return this.handleIndexReject(payload);
      case 'vault_status':
        return this.handleVaultStatus(mcpRuntime);
      default:
        return {
          handled: false,
          responseText: 'Unrecognized Mnemos action.',
          action: 'unknown',
          error: `Unknown action: ${action}`,
        };
    }
  }

  private async handleIndexConfirm(
    encodedPath: string,
    mcpRuntime: Pick<McpRuntimeService, 'readSnapshot'>,
  ): Promise<MnemosCallbackResult> {
    let filePath: string;
    try {
      filePath = Buffer.from(encodedPath, 'base64url').toString('utf-8');
    } catch (error: unknown) {
      logger.warn('[Mnemos Human In The Loop] encoding failed', error);
      return {
        handled: true,
        responseText: '❌ Corrupted file path.',
        action: 'index_confirm',
        error: 'Base64 decode failure',
      };
    }

    const fileName = filePath.split('/').pop() || filePath;
    this.logRepo.log('info', 'Mnemos', `Indexing confirmed by user: ${fileName}`);

    const snapshot = mcpRuntime.readSnapshot();
    const mnemosEntry = snapshot.entries.find((e) => e.id === 'mnemos');
    if (!mnemosEntry || mnemosEntry.status !== 'connected') {
      return {
        handled: true,
        responseText: [
          '⚠️ The Mnemos engine is not connected right now.',
          'Check that the Docker container is running.',
        ].join('\n'),
        action: 'index_confirm',
        error: 'Mnemos not connected',
      };
    }

    if (!this.toolInvoker) {
      return {
        handled: true,
        responseText: [
          '⚠️ Mnemos tool runtime is not available in this session.',
          'Restart Zavorth or reload the runtime before confirming indexing.',
        ].join('\n'),
        action: 'index_confirm',
        error: 'Mnemos tool runtime not available',
      };
    }

    let toolResult: string;
    try {
      toolResult = await this.toolInvoker.execute('index_file', { file_path: filePath });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const message = error instanceof Error ? err.message : String(error);
      this.logRepo.log('error', 'Mnemos', `Failed to index ${fileName}: ${message}`);
      return {
        handled: true,
        responseText: `❌ Failed to index **${fileName}**: ${message}`,
        action: 'index_confirm',
        error: message,
      };
    }

    const parsed = this.parseToolResult(toolResult);
    if (parsed.error) {
      this.logRepo.log('error', 'Mnemos', `index_file returned failure for ${fileName}: ${parsed.error}`);
      return {
        handled: true,
        responseText: `❌ Failed to index **${fileName}**: ${parsed.error}`,
        action: 'index_confirm',
        error: parsed.error,
      };
    }

    const chunks = typeof parsed.chunksIndexed === 'number'
      ? ` (${parsed.chunksIndexed} chunk(s))`
      : '';
    return {
      handled: true,
      responseText: [
        `✅ **${fileName}** was indexed in Mnemos${chunks}.`,
        '',
        'You can repeat your original question; I can now look that content up in the local vault.',
      ].join('\n'),
      action: 'index_confirm',
      error: null,
    };
  }

  private parseToolResult(raw: string): { error: string | null; chunksIndexed: number | null } {
    const text = String(raw || '').trim();
    if (!text) {
      return { error: 'index_file returned an empty response.', chunksIndexed: null };
    }

    try {
      const parsed = JSON.parse(text) as {
        error?: unknown;
        status?: unknown;
        chunks_indexed?: unknown;
      };
      if (parsed.error) {
        return { error: String(parsed.error), chunksIndexed: null };
      }
      if (parsed.status && parsed.status !== 'success') {
        return { error: `index_file returned unexpected status: ${String(parsed.status)}`, chunksIndexed: null };
      }
      return {
        error: null,
        chunksIndexed: typeof parsed.chunks_indexed === 'number' ? parsed.chunks_indexed : null,
      };
    } catch (error: unknown) {
      if (/error executing tool|erro/i.test(text)) {
        return { error: text, chunksIndexed: null };
      }
      return { error: null, chunksIndexed: null };
    }
  }

  private async handleIndexReject(payload: string): Promise<MnemosCallbackResult> {
    this.logRepo.log('info', 'Mnemos', `Indexing rejected by user: ${payload}`);

    return {
      handled: true,
      responseText: [
        '👌 Understood — I will not index those files.',
        '',
        'You can send the correct document in this chat or tell me the exact file name.',
      ].join('\n'),
      action: 'index_reject',
      error: null,
    };
  }

  private async handleVaultStatus(mcpRuntime: Pick<McpRuntimeService, 'readSnapshot'>): Promise<MnemosCallbackResult> {
    const snapshot = mcpRuntime.readSnapshot();
    const mnemosEntry = snapshot.entries.find((e) => e.id === 'mnemos');

    if (!mnemosEntry || mnemosEntry.status !== 'connected') {
      return {
        handled: true,
        responseText: '⚠️ Mnemos is disconnected. Cannot fetch vault status.',
        action: 'vault_status',
        error: 'Mnemos not connected',
      };
    }

    return {
      handled: true,
      responseText: [
        '📦 Mnemos Vault Status:',
        `• Status: ${mnemosEntry.status}`,
        `• Available tools: ${mnemosEntry.toolCount}`,
        `• Tools: ${mnemosEntry.toolNames.join(', ')}`,
      ].join('\n'),
      action: 'vault_status',
      error: null,
    };
  }
}
