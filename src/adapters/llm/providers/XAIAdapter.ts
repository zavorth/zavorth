/**
 * xAI Grok Wire Adapter for Zavorth.
 * Communicates with official xAI Grok endpoints.
 */

import { OpenAIAdapter } from './OpenAIAdapter.js';
import { AdapterCapabilities } from '../LLMAdapter.js';

export class XAIAdapter extends OpenAIAdapter {
  public override readonly name: string = 'xai';
  public override readonly capabilities: AdapterCapabilities = {
    streaming: true,
    toolCalling: true,
    vision: true,
    reasoning: true,
    jsonMode: true,
  };

  constructor(config: { apiKey?: string; defaultModel?: string } = {}) {
    super({
      apiKey: config.apiKey || process.env.XAI_API_KEY,
      baseURL: 'https://api.x.ai/v1',
      defaultModel: config.defaultModel || 'grok-2-latest',
    });
  }
}
