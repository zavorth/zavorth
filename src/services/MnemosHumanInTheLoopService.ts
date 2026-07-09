import type { McpRuntimeService } from '../mcp/McpRuntimeService.js';
import type { LogRepository } from '../storage/LogRepository.js';
import { logger } from '../logger.js';

/**
 * MnemosCallbackPayload — Estrutura do callback embutido nos botões inline.
 *
 * FORMATO: mnemos:<action>:<encoded_data>
 *
 * Ações:
 *  - mnemos:index_confirm:<base64_filepath>  → Confirma indexação de um arquivo
 *  - mnemos:index_reject:<requestId>         → Rejeita indexação
 *  - mnemos:vault_status                     → Solicita status do cofre
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
 * MnemosHumanInTheLoopService
 *
 * Orquestra o fluxo de Human-in-the-Loop entre o motor de memória Mnemos e
 * o usuário, via botões inline do Telegram ou qualquer superfície compatível.
 *
 * Fluxo:
 *  1. O agente chama search_memory → sem resultados
 *  2. O agente chama scan_local_metadata → encontra candidatos
 *  3. Este service monta a mensagem com botões inline para o usuário
 *  4. O callback processa a resposta do botão e aciona index_file se confirmado
 */
export class MnemosHumanInTheLoopService {
  constructor(
    private readonly logRepo: LogRepository,
    private readonly toolInvoker: MnemosToolInvoker | null = null,
  ) {}

  /**
   * Monta a mensagem interativa com botões inline para o Telegram.
   * Retorna o texto formatado e o array de botões no formato InlineKeyboard do grammY.
   */
  public buildCandidatePrompt(context: MnemosHumanInTheLoopContext): {
    text: string;
    buttons: Array<{ text: string; callback_data: string }[]>;
  } {
    const { candidates, originalQuery } = context;

    if (candidates.length === 0) {
      return {
        text: [
          '🔍 **Busca no Cofre Mnemos**',
          '',
          `Procurei no cofre vetorial e nas pastas autorizadas do seu computador, mas não encontrei nenhum arquivo relacionado a "${originalQuery}".`,
          '',
          '💡 Você pode:',
          '• Enviar o arquivo diretamente neste chat',
          '• Me dizer o nome exato do arquivo',
          '• Adicionar o diretório correto nas configurações do Mnemos',
        ].join('\n'),
        buttons: [],
      };
    }

    const candidateList = candidates.slice(0, 5).map((c, i) => {
      const sizeMb = (c.size_bytes / (1024 * 1024)).toFixed(1);
      return `${i + 1}. 📄 \`${c.name}\` (${sizeMb} MB)`;
    }).join('\n');

    const text = [
      '🔍 **Busca no Cofre Mnemos**',
      '',
      `Não encontrei resultados no cofre para "${originalQuery}".`,
      `Porém, encontrei ${candidates.length} arquivo(s) potencial(is) nas suas pastas autorizadas:`,
      '',
      candidateList,
      '',
      '📌 Deseja que eu indexe algum deles para responder sua pergunta?',
    ].join('\n');

    const buttons: Array<{ text: string; callback_data: string }[]> = [];

    // Cada candidato gera uma linha de botões [Indexar] | [Pular]
    for (const candidate of candidates.slice(0, 3)) {
      const encodedPath = Buffer.from(candidate.path).toString('base64url');
      buttons.push([
        {
          text: `✅ Indexar "${candidate.name}"`,
          callback_data: `mnemos:index_confirm:${encodedPath}`,
        },
      ]);
    }

    // Botão de rejeição global
    buttons.push([
      {
        text: '❌ Nenhum desses é correto',
        callback_data: 'mnemos:index_reject:all',
      },
    ]);

    return { text, buttons };
  }

  /**
   * Processa um callback vindo do TelegramCallbackController.
   * Formato esperado: mnemos:<action>:<data>
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
        error: 'Callback não pertence ao Mnemos.',
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
          responseText: 'Ação do Mnemos não reconhecida.',
          action: 'unknown',
          error: `Ação desconhecida: ${action}`,
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
    } catch (error: unknown) {logger.warn('[Mnemos Human In The Loop] encoding failed', error);
    return {
        handled: true,
        responseText: '❌ Caminho do arquivo corrompido.',
        action: 'index_confirm',
        error: 'Base64 decode failure',
      };
  }

    const fileName = filePath.split('/').pop() || filePath;
    this.logRepo.log('info', 'Mnemos', `Indexação confirmada pelo usuário: ${fileName}`);

    // Verificar se o Mnemos está conectado
    const snapshot = mcpRuntime.readSnapshot();
    const mnemosEntry = snapshot.entries.find((e) => e.id === 'mnemos');
    if (!mnemosEntry || mnemosEntry.status !== 'connected') {
      return {
        handled: true,
        responseText: [
          '⚠️ O motor Mnemos não está conectado no momento.',
          'Verifique se o container Docker está rodando.',
        ].join('\n'),
        action: 'index_confirm',
        error: 'Mnemos not connected',
      };
    }

    if (!this.toolInvoker) {
      return {
        handled: true,
        responseText: [
          '⚠️ O runtime de tools do Mnemos não está disponível nesta sessão.',
          'Reinicie o Zavorth ou recarregue o runtime antes de confirmar indexações.',
        ].join('\n'),
        action: 'index_confirm',
        error: 'Mnemos tool runtime not available',
      };
    }

    let toolResult: string;
    try {
      toolResult = await this.toolInvoker.execute('index_file', { file_path: filePath });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logRepo.log('error', 'Mnemos', `Falha ao indexar ${fileName}: ${message}`);
      return {
        handled: true,
        responseText: `❌ Falha ao indexar **${fileName}**: ${message}`,
        action: 'index_confirm',
        error: message,
      };
    }

    const parsed = this.parseToolResult(toolResult);
    if (parsed.error) {
      this.logRepo.log('error', 'Mnemos', `Falha retornada pelo index_file para ${fileName}: ${parsed.error}`);
      return {
        handled: true,
        responseText: `❌ Falha ao indexar **${fileName}**: ${parsed.error}`,
        action: 'index_confirm',
        error: parsed.error,
      };
    }

    const chunks = typeof parsed.chunksIndexed === 'number'
      ? ` (${parsed.chunksIndexed} fragmento(s))`
      : '';
    return {
      handled: true,
      responseText: [
        `✅ **${fileName}** foi indexado no Mnemos${chunks}.`,
        '',
        'Você já pode repetir sua pergunta original; agora vou conseguir consultar esse conteúdo pelo cofre local.',
      ].join('\n'),
      action: 'index_confirm',
      error: null,
    };
  }

  private parseToolResult(raw: string): { error: string | null; chunksIndexed: number | null } {
    const text = String(raw || '').trim();
    if (!text) {
      return { error: 'index_file retornou uma resposta vazia.', chunksIndexed: null };
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
        return { error: `index_file retornou status inesperado: ${String(parsed.status)}`, chunksIndexed: null };
      }
      return {
        error: null,
        chunksIndexed: typeof parsed.chunks_indexed === 'number' ? parsed.chunks_indexed : null,
      };
    } catch (error: unknown) {if (/error executing tool|erro/i.test(text)) {
        return { error: text, chunksIndexed: null };
      }
      return { error: null, chunksIndexed: null };
    }
  }

  private async handleIndexReject(payload: string): Promise<MnemosCallbackResult> {
    this.logRepo.log('info', 'Mnemos', `Indexação rejeitada pelo usuário: ${payload}`);

    return {
      handled: true,
      responseText: [
        '👌 Entendido! Não vou indexar esses arquivos.',
        '',
        'Você pode me enviar o documento correto diretamente neste chat ou me dizer o nome exato do arquivo.',
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
        responseText: '⚠️ Mnemos desconectado. Não é possível obter o status do cofre.',
        action: 'vault_status',
        error: 'Mnemos not connected',
      };
    }

    return {
      handled: true,
      responseText: [
        '📦 Status do Cofre Mnemos:',
        `• Status: ${mnemosEntry.status}`,
        `• Tools disponíveis: ${mnemosEntry.toolCount}`,
        `• Tools: ${mnemosEntry.toolNames.join(', ')}`,
      ].join('\n'),
      action: 'vault_status',
      error: null,
    };
  }
}
