/**
 * LM Studio Local-First Wire Adapter for Zavorth.
 * Communicates with local LM Studio OpenAI-compatible server.
 */

import { OpenAIAdapter } from './OpenAIAdapter.js';
import { AdapterCapabilities } from '../LLMAdapter.js';

export class LMStudioAdapter extends OpenAIAdapter {
  public override readonly name: string = 'lmstudio';
  public override readonly capabilities: AdapterCapabilities = {
    streaming: true,
    toolCalling: true,
    vision: true,
    reasoning: true,
    jsonMode: true,
  };

  constructor(config: { baseUrl?: string; defaultModel?: string } = {}) {
    super({
      apiKey: 'lm-studio',
      baseURL: config.baseUrl || process.env.LMSTUDIO_BASE_URL || 'http://127.0.0.1:1234/v1',
      defaultModel: config.defaultModel || 'local-model',
    });
  }
}
