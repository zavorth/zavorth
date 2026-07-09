import { LlmRuntimeService } from '../../../services/llm/LlmRuntimeService.js';
import type { ChatMessage } from '../../../providers/ILlmProvider.js';
import { logger } from '../../../logger.js';

export type EchoVisionScreenAnalysis = {
  ok: boolean;
  providerName: string | null;
  summary: string;
  responseText: string;
  observedTexts: string[];
  suggestedNextAction: string | null;
  confidence: number;
  rawResponse: string | null;
  error: string | null;
};

export type EchoBrowserRepairSuggestion = {
  ok: boolean;
  providerName: string | null;
  healed: boolean;
  selector: string | null;
  textHint: string | null;
  reason: string | null;
  confidence: number;
  rawResponse: string | null;
  error: string | null;
};

type VisionPayload = {
  summary?: string;
  responseText?: string;
  observedTexts?: string[];
  suggestedNextAction?: string | null;
  confidence?: number;
};

type BrowserRepairPayload = {
  healed?: boolean;
  selector?: string | null;
  textHint?: string | null;
  reason?: string | null;
  confidence?: number;
};

/**
 * Shared multimodal analysis service used by Echo capabilities that need to
 * reason over screenshots without creating a second runtime path.
 */
export class EchoVisionAnalysisService {
  private readonly runtime: Pick<LlmRuntimeService, 'chatDetailed'>;

  constructor(runtime?: Pick<LlmRuntimeService, 'chatDetailed'>) {
    this.runtime = runtime || new LlmRuntimeService('gemini');
  }

  public async analyzeScreenshot(input: {
    instruction: string;
    base64: string;
    mimeType: string;
    sourceLabel?: string | null;
  }): Promise<EchoVisionScreenAnalysis> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          'Voce analisa screenshots para o Zavorth Echo. Responda apenas com JSON puro. ' +
          'Campos obrigatorios: summary, responseText, observedTexts, suggestedNextAction, confidence. ' +
          'summary deve resumir o que importa na tela em uma frase curta. ' +
          'responseText deve ser a resposta falada pelo agent para o operador. ' +
          'observedTexts deve listar no maximo 5 textos curtos importantes observados. ' +
          'suggestedNextAction deve sugerir o proximo passo ou null se nao houver. ' +
          'confidence deve ser um numero entre 0 e 1.',
      },
      {
        role: 'user',
        content: [
          input.sourceLabel ? `Origem: ${String(input.sourceLabel).trim()}.` : null,
          `Instrucao: ${String(input.instruction || '').trim()}.`,
          'Analise a imagem anexada e retorne apenas JSON.',
        ].filter(Boolean).join('\n'),
        inlineData: [{
          mimeType: input.mimeType,
          data: input.base64,
        }],
      },
    ];

    try {
      const result = await this.runtime.chatDetailed(messages, undefined, {
        providerName: 'gemini',
        allowFallback: true,
        fallbackOrder: ['openai', 'qwen', 'aigateway', 'openrouter', 'minimax', 'ollama'],
      });
      const parsed = this.parseVisionPayload(result.response.content || '');
      if (!parsed) {
        return {
          ok: false,
          providerName: result.providerName,
          summary: 'Nao foi possivel interpretar a tela com JSON estruturado.',
          responseText: 'Capturei a tela, mas nao consegui interpretar a imagem com seguranca.',
          observedTexts: [],
          suggestedNextAction: null,
          confidence: 0,
          rawResponse: result.response.content || null,
          error: 'vision_parse_failed',
        };
      }

      const observedTexts = Array.isArray(parsed.observedTexts)
        ? parsed.observedTexts.map((entry) => String(entry || '').trim()).filter(Boolean).slice(0, 5)
        : [];

      return {
        ok: true,
        providerName: result.providerName,
        summary: String(parsed.summary || '').trim() || 'Tela analisada.',
        responseText:
          String(parsed.responseText || '').trim()
          || String(parsed.summary || '').trim()
          || 'Tela analisada.',
        observedTexts,
        suggestedNextAction: this.optionalText(parsed.suggestedNextAction),
        confidence: this.normalizeConfidence(parsed.confidence),
        rawResponse: result.response.content || null,
        error: null,
      };
    } catch (error: any) { const err = error; const e = error;
    logger.warn('[Vision Analysis] parsing failed', error);
    return {
        ok: false,
        providerName: null,
        summary: 'Nenhum provider multimodal conseguiu analisar a tela.',
        responseText: 'Capturei a tela, mas nenhum provider multimodal respondeu.',
        observedTexts: [],
        suggestedNextAction: null,
        confidence: 0,
        rawResponse: null,
        error: error instanceof Error ? error.message : String(error),
      };
  }
  }

  public async suggestBrowserRepair(input: {
    action: string;
    failedSelector: string;
    base64: string;
    mimeType: string;
    currentUrl?: string | null;
    pageTitle?: string | null;
    candidateHints?: string[];
  }): Promise<EchoBrowserRepairSuggestion> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          'Voce repara seletores quebrados para automacao web do Zavorth. Responda apenas com JSON puro. ' +
          'Campos obrigatorios: healed, selector, textHint, reason, confidence. ' +
          'healed deve ser true somente se houver um alvo plausivel. ' +
          'selector deve preferir CSS robusto (#id, [name], [aria-label], [data-testid]) e nunca nth-child. ' +
          'textHint deve trazer o texto visivel do alvo quando isso for mais robusto do que CSS. ' +
          'reason deve explicar por que o alvo parece correto. ' +
          'confidence deve ser um numero entre 0 e 1.',
      },
      {
        role: 'user',
        content: [
          `Acao desejada: ${String(input.action || '').trim()}.`,
          `Selector que falhou: ${String(input.failedSelector || '').trim()}.`,
          input.pageTitle ? `Titulo atual: ${String(input.pageTitle).trim()}.` : null,
          input.currentUrl ? `URL atual: ${String(input.currentUrl).trim()}.` : null,
          input.candidateHints && input.candidateHints.length > 0
            ? `Candidatos heuristicos locais: ${input.candidateHints.join(' | ')}.`
            : null,
          'Analise a screenshot e responda apenas com JSON.',
        ].filter(Boolean).join('\n'),
        inlineData: [{
          mimeType: input.mimeType,
          data: input.base64,
        }],
      },
    ];

    try {
      const result = await this.runtime.chatDetailed(messages, undefined, {
        providerName: 'gemini',
        allowFallback: true,
        fallbackOrder: ['openai', 'qwen', 'aigateway', 'openrouter', 'minimax', 'ollama'],
      });
      const parsed = this.parseBrowserRepairPayload(result.response.content || '');
      if (!parsed) {
        return {
          ok: false,
          providerName: result.providerName,
          healed: false,
          selector: null,
          textHint: null,
          reason: 'Provider multimodal retornou payload nao interpretavel.',
          confidence: 0,
          rawResponse: result.response.content || null,
          error: 'browser_repair_parse_failed',
        };
      }

      return {
        ok: Boolean(parsed.healed) || Boolean(this.optionalText(parsed.selector) || this.optionalText(parsed.textHint)),
        providerName: result.providerName,
        healed: Boolean(parsed.healed) || Boolean(this.optionalText(parsed.selector) || this.optionalText(parsed.textHint)),
        selector: this.optionalText(parsed.selector),
        textHint: this.optionalText(parsed.textHint),
        reason: this.optionalText(parsed.reason),
        confidence: this.normalizeConfidence(parsed.confidence),
        rawResponse: result.response.content || null,
        error: null,
      };
    } catch (error: any) { const err = error; const e = error;
    logger.warn('[Vision Analysis] parsing failed', error);
    return {
        ok: false,
        providerName: null,
        healed: false,
        selector: null,
        textHint: null,
        reason: null,
        confidence: 0,
        rawResponse: null,
        error: error instanceof Error ? error.message : String(error),
      };
  }
  }

  private parseVisionPayload(raw: string): VisionPayload | null {
    const parsed = this.parseJsonPayload(raw);
    return parsed && typeof parsed === 'object' ? parsed as VisionPayload : null;
  }

  private parseBrowserRepairPayload(raw: string): BrowserRepairPayload | null {
    const parsed = this.parseJsonPayload(raw);
    return parsed && typeof parsed === 'object' ? parsed as BrowserRepairPayload : null;
  }

  private parseJsonPayload(raw: string): Record<string, unknown> | null {
    const candidate = String(raw || '').trim();
    if (!candidate) {
      return null;
    }

    const direct = this.tryParseJson(candidate);
    if (direct) {
      return direct;
    }

    const fencedMatch = candidate.match(/```(?:json)?\s*([\s\S]+?)```/i);
    if (fencedMatch) {
      const fenced = this.tryParseJson(fencedMatch[1]);
      if (fenced) {
        return fenced;
      }
    }

    const firstBrace = candidate.indexOf('{');
    const lastBrace = candidate.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return this.tryParseJson(candidate.slice(firstBrace, lastBrace + 1));
    }

    return null;
  }

  private tryParseJson(raw: string): Record<string, unknown> | null {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : null;
    } catch (error: any) { const err = error; const e = error; logger.warn('[Vision Analysis] JSON parse failed', error); return null; }
  }

  private normalizeConfidence(value: unknown): number {
    const numeric = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numeric)) {
      return 0;
    }
    return Math.max(0, Math.min(1, numeric));
  }

  private optionalText(value: unknown): string | null {
    const normalized = String(value || '').trim();
    return normalized.length > 0 ? normalized : null;
  }
}
