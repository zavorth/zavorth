import { LlmRuntimeService } from '../../../services/llm/LlmRuntimeService.js';
import type { ChatMessage } from '../../../providers/ILlmProvider.js';
import { logger } from '../../../logger.js';
import { asErrorLike } from '../../../utils/errorLike.js';

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
    this.runtime = runtime || new LlmRuntimeService();
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
          'You analyze screenshots for Zavorth Echo. Respond only with plain JSON. ' +
          'Required fields: summary, responseText, observedTexts, suggestedNextAction, confidence. ' +
          'summary should summarize what matters on the screen in a short sentence. ' +
          'responseText should be the spoken response from the agent to the operator. ' +
          'observedTexts should list up to 5 short important texts observed. ' +
          'suggestedNextAction should suggest the next step or null if none. ' +
          'confidence should be a number between 0 and 1.',
      },
      {
        role: 'user',
        content: [
          input.sourceLabel ? `Source: ${String(input.sourceLabel).trim()}.` : null,
          `Instruction: ${String(input.instruction || '').trim()}.`,
          'Analyze the attached image and return only JSON.',
        ].filter(Boolean).join('\n'),
        inlineData: [{
          mimeType: input.mimeType,
          data: input.base64,
        }],
      },
    ];

    try {
      const result = await this.runtime.chatDetailed(messages, undefined, {
        allowFallback: true,
      });
      const parsed = this.parseVisionPayload(result.response.content || '');
      if (!parsed) {
        return {
          ok: false,
          providerName: result.providerName,
          summary: 'It was not possible to interpret the screen with structured JSON.',
          responseText: 'I captured the screen, but I could not interpret the image with confidence.',
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
        summary: String(parsed.summary || '').trim() || 'Screen analyzed.',
        responseText:
          String(parsed.responseText || '').trim()
          || String(parsed.summary || '').trim()
          || 'Screen analyzed.',
        observedTexts,
        suggestedNextAction: this.optionalText(parsed.suggestedNextAction),
        confidence: this.normalizeConfidence(parsed.confidence),
        rawResponse: result.response.content || null,
        error: null,
      };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Vision Analysis] parsing failed', error);
    return {
        ok: false,
        providerName: null,
        summary: 'No multimodal provider could analyze the screen.',
        responseText: 'Captured the screen, but no multimodal provider responded.',
        observedTexts: [],
        suggestedNextAction: null,
        confidence: 0,
        rawResponse: null,
        error: error instanceof Error ? err.message : String(error),
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
          'Repair broken selectors for Zavorth web automation. Respond with pure JSON only. ' +
          'Required fields: healed, selector, textHint, reason, confidence. ' +
          'healed must be true only when there is a plausible target. ' +
          'selector should prefer robust CSS (#id, [name], [aria-label], [data-testid]) and never nth-child. ' +
          'textHint should include the target visible text when that is more robust than CSS. ' +
          'reason should explain why the target seems correct. ' +
          'confidence should be a number between 0 and 1.',
      },
      {
        role: 'user',
        content: [
          `Desired action: ${String(input.action || '').trim()}.`,
          `Failed selector: ${String(input.failedSelector || '').trim()}.`,
          input.pageTitle ? `Current title: ${String(input.pageTitle).trim()}.` : null,
          input.currentUrl ? `Current URL: ${String(input.currentUrl).trim()}.` : null,
          input.candidateHints && input.candidateHints.length > 0
            ? `Local candidate hints: ${input.candidateHints.join(' | ')}.`
            : null,
          'Analyze the screenshot and reply only with JSON.',
        ].filter(Boolean).join('\n'),
        inlineData: [{
          mimeType: input.mimeType,
          data: input.base64,
        }],
      },
    ];

    try {
      const result = await this.runtime.chatDetailed(messages, undefined, {
        allowFallback: true,
      });
      const parsed = this.parseBrowserRepairPayload(result.response.content || '');
      if (!parsed) {
        return {
          ok: false,
          providerName: result.providerName,
          healed: false,
          selector: null,
          textHint: null,
          reason: 'Multimodal provider returned an uninterpretable payload.',
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
    } catch (error: unknown) {
      const err = asErrorLike(error);
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
        error: error instanceof Error ? err.message : String(error),
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
    } catch (error: unknown) {logger.warn('[Vision Analysis] JSON parse failed', error); return null; }
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
