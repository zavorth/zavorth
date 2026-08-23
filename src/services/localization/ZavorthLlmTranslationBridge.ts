import type { TranslationProviderBridge } from './ZavorthOnDemandTranslationService.js';
import { ZavorthLlmRuntimeService } from '../ZavorthLlmRuntimeService.js';

/**
 * Provider-agnostic bridge from the on-demand localization pipeline to the
 * governed LLM runtime. Keeps catalog synthesis decoupled from any single
 * vendor: routing, fallback, and credentials stay owned by the runtime.
 */
export class ZavorthLlmTranslationBridge implements TranslationProviderBridge {
  private readonly runtime: ZavorthLlmRuntimeService;

  public constructor(preferredProviderName?: string) {
    this.runtime = new ZavorthLlmRuntimeService(preferredProviderName);
  }

  public async completePrompt(prompt: string): Promise<string> {
    const result = await this.runtime.synthesize(
      'You are a precise localization engine. Follow the user instruction exactly and output only the requested payload.',
      prompt,
      { temperature: 0.2 },
    );
    return result.content;
  }
}
