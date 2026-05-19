import { getEncoding } from 'js-tiktoken';

/**
 * TokenCounter — Guarda Costeira Preventiva (Etapa 4 do God-Mode).
 * Funciona medindo o peso semântico das conversas e do histórico do Agentic RAG
 * ANTES de enviá-los às APIs pagas (OpenAI / Anthropic / Gemini).
 * Se o limite for rompido, o Zavorth truncará o histórico defensivamente.
 */
export class TokenCounter {
  // Retorna o peso bruto de tokens para o modelo mais comum GPT-4 ou equivalente
  public static countTokens(text: string): number {
    try {
      // cl100k_base é o encoding oficial dos modelos gpt-4, gpt-3.5-turbo, text-embedding-ada-002
      // É a base matemática mais robusta atual para inferência universal.
      const encoding = getEncoding('cl100k_base');
      const tokens = encoding.encode(text);
      return tokens.length;
    } catch (e) {
      // Fallback otimista se por algum motivo bizarro a compilação do Wasm falhar na máquina 
      return Math.ceil(text.length / 4);
    }
  }

  /**
   * Avalia a saúde da janela de contexto.
   * Modela até 128k tokens, mas emitiremos avisos muito antes.
   */
  public static isApproachingLimit(text: string, warningThreshold = 64_000): boolean {
    const tokens = this.countTokens(text);
    return tokens >= warningThreshold;
  }
}
