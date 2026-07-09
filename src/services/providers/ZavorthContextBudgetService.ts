import type {
  ZavorthProviderRouterContextBudgetReceipt,
  ZavorthProviderRouterCompressedContext,
  ZavorthProviderRouterMessage,
} from '../../contracts/ZavorthProviderRouterContract.js';

const MODEL_TOKEN_FACTORS: Array<{ pattern: RegExp; factor: number }> = [
  { pattern: /claude/i, factor: 3.8 },
  { pattern: /gpt-?4/i, factor: 3.5 },
  { pattern: /gpt-?3\.?5/i, factor: 3.5 },
  { pattern: /o[1-4]/i, factor: 3.5 },
  { pattern: /gemini/i, factor: 3.6 },
  { pattern: /llama/i, factor: 3.2 },
  { pattern: /mistral/i, factor: 3.3 },
  { pattern: /deepseek/i, factor: 3.0 },
  { pattern: /command/i, factor: 3.4 },
  { pattern: /qwen/i, factor: 2.8 },
];

const DEFAULT_ENGLISH_FACTOR = 3.5;
const DEFAULT_MIXED_FACTOR = 2.5;
const MIXED_CONTENT_THRESHOLD = 0.15;

const RECENT_MESSAGES_TO_PRESERVE = 4;
const SUMMARY_PREFIX = '[Resumo de contexto anterior] ';

function detectMixedContentRatio(text: string): number {
  if (text.length === 0) return 0;
  let nonAscii = 0;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) > 127) nonAscii++;
  }
  return nonAscii / text.length;
}

function resolveTokenFactor(model?: string | null): { english: number; mixed: number } {
  if (model) {
    for (const entry of MODEL_TOKEN_FACTORS) {
      if (entry.pattern.test(model)) {
        return { english: entry.factor, mixed: Math.max(entry.factor - 1.0, 2.0) };
      }
    }
  }
  return { english: DEFAULT_ENGLISH_FACTOR, mixed: DEFAULT_MIXED_FACTOR };
}

export class ZavorthContextBudgetService {
  /**
   * Estima o número de tokens de um texto usando heurística baseada em caracteres.
   * Não depende de tokenizador externo.
   */
  public estimateTokens(text: string, model?: string | null): number {
    if (!text || text.length === 0) return 0;
    const factors = resolveTokenFactor(model);
    const mixedRatio = detectMixedContentRatio(text);
    const factor = mixedRatio > MIXED_CONTENT_THRESHOLD ? factors.mixed : factors.english;
    return Math.ceil(text.length / factor);
  }

  /**
   * Estima tokens de um array de mensagens.
   */
  public estimateMessagesTokens(
    messages: ZavorthProviderRouterMessage[],
    model?: string | null,
  ): number {
    let total = 0;
    for (const msg of messages) {
      // ~4 tokens de overhead por mensagem (role, delimitadores)
      total += 4 + this.estimateTokens(msg.content, model);
    }
    return total;
  }

  /**
   * Comprime o contexto para caber dentro do orçamento de tokens.
   *
   * Estratégia:
   * 1. System prompt preservado integralmente
   * 2. Últimas N mensagens user/assistant preservadas
   * 3. Mensagens mais antigas resumidas em uma única mensagem de resumo
   */
  public compress(input: {
    messages: ZavorthProviderRouterMessage[];
    maxTokens: number;
    model?: string | null;
  }): ZavorthProviderRouterCompressedContext {
    const { messages, maxTokens, model } = input;

    if (messages.length === 0) {
      return {
        messages: [],
        receipt: this.buildReceipt(0, 0, false, 0, true, 0, 0),
      };
    }

    const originalTokens = this.estimateMessagesTokens(messages, model);

    // Se já cabe, retorna sem compressão
    if (originalTokens <= maxTokens) {
      return {
        messages: [...messages],
        receipt: this.buildReceipt(originalTokens, originalTokens, false, 0, true, messages.length, 0),
      };
    }

    // Separa system prompt das demais mensagens
    const systemMessages: ZavorthProviderRouterMessage[] = [];
    const conversationMessages: ZavorthProviderRouterMessage[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemMessages.push(msg);
      } else {
        conversationMessages.push(msg);
      }
    }

    // Calcula tokens do system prompt (sempre preservado)
    const systemTokens = this.estimateMessagesTokens(systemMessages, model);
    const budgetForConversation = maxTokens - systemTokens;

    if (budgetForConversation <= 0) {
      // Só cabe o system prompt — trunca tudo
      return {
        messages: [...systemMessages],
        receipt: this.buildReceipt(
          originalTokens,
          systemTokens,
          true,
          conversationMessages.length,
          true,
          0,
          conversationMessages.length,
        ),
      };
    }

    // Preserva as últimas N mensagens
    const recentCount = Math.min(RECENT_MESSAGES_TO_PRESERVE, conversationMessages.length);
    const recentMessages = conversationMessages.slice(-recentCount);
    const recentTokens = this.estimateMessagesTokens(recentMessages, model);

    // Se as recentes já estouram o orçamento, vai cortando do final das recentes
    if (recentTokens > budgetForConversation) {
      const trimmedRecent: ZavorthProviderRouterMessage[] = [];
      let runningTokens = 0;
      for (let i = recentMessages.length - 1; i >= 0; i--) {
        const msgTokens = 4 + this.estimateTokens(recentMessages[i]!.content, model);
        if (runningTokens + msgTokens > budgetForConversation) break;
        runningTokens += msgTokens;
        trimmedRecent.unshift(recentMessages[i]!);
      }
      const compressedTokens = systemTokens + runningTokens;
      return {
        messages: [...systemMessages, ...trimmedRecent],
        receipt: this.buildReceipt(
          originalTokens,
          compressedTokens,
          true,
          conversationMessages.length - trimmedRecent.length,
          true,
          trimmedRecent.length,
          conversationMessages.length - trimmedRecent.length,
        ),
      };
    }

    // Mensagens mais antigas para sumarizar
    const olderMessages = conversationMessages.slice(0, -recentCount);
    const budgetForSummary = budgetForConversation - recentTokens;

    if (olderMessages.length === 0 || budgetForSummary <= 20) {
      const compressedTokens = systemTokens + recentTokens;
      return {
        messages: [...systemMessages, ...recentMessages],
        receipt: this.buildReceipt(
          originalTokens,
          compressedTokens,
          true,
          olderMessages.length,
          true,
          recentMessages.length,
          olderMessages.length,
        ),
      };
    }

    // Cria resumo das mensagens antigas (heurístico, sem LLM)
    const summaryText = this.buildHeuristicSummary(olderMessages, budgetForSummary, model);
    const summaryMessage: ZavorthProviderRouterMessage = {
      role: 'assistant',
      content: summaryText,
    };
    const summaryTokens = 4 + this.estimateTokens(summaryText, model);

    const finalMessages = [...systemMessages, summaryMessage, ...recentMessages];
    const compressedTokens = systemTokens + summaryTokens + recentTokens;

    return {
      messages: finalMessages,
      receipt: this.buildReceipt(
        originalTokens,
        compressedTokens,
        true,
        olderMessages.length,
        true,
        recentMessages.length,
        olderMessages.length,
      ),
    };
  }

  /**
   * Gera um receipt de context budget para rastreabilidade.
   */
  public buildReceipt(
    originalTokens: number,
    compressedTokens: number,
    compressionApplied: boolean,
    truncatedMessages: number,
    systemPromptPreserved: boolean,
    recentMessagesPreserved: number,
    summarizedMessages: number,
  ): ZavorthProviderRouterContextBudgetReceipt {
    return {
      originalTokens,
      compressedTokens,
      compressionApplied,
      truncatedMessages,
      systemPromptPreserved,
      recentMessagesPreserved,
      summarizedMessages,
    };
  }

  private buildHeuristicSummary(
    messages: ZavorthProviderRouterMessage[],
    maxTokensBudget: number,
    model?: string | null,
  ): string {
    // Extrai fragmentos-chave de cada mensagem
    const fragments: string[] = [];
    for (const msg of messages) {
      const trimmed = msg.content.trim();
      if (trimmed.length === 0) continue;
      // Pega a primeira sentença ou os primeiros 120 caracteres
      const firstSentenceEnd = trimmed.search(/[.!?]\s/);
      const fragment =
        firstSentenceEnd > 0 && firstSentenceEnd < 150
          ? trimmed.slice(0, firstSentenceEnd + 1)
          : trimmed.slice(0, 120) + (trimmed.length > 120 ? '...' : '');
      fragments.push(`[${msg.role}] ${fragment}`);
    }

    let summary = SUMMARY_PREFIX + fragments.join(' | ');

    // Trunca se o resumo exceder o orçamento
    const estimatedTokens = this.estimateTokens(summary, model);
    if (estimatedTokens > maxTokensBudget) {
      const factors = resolveTokenFactor(model);
      const maxChars = Math.floor(maxTokensBudget * factors.english);
      summary = summary.slice(0, maxChars - 3) + '...';
    }

    return summary;
  }
}
