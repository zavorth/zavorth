import type { GatewayCloudTtsStatus } from './GatewayCloudTtsService.js';

export type HybridTtsStatus = {
  available: boolean;
  method: string;
};

export interface HybridLocalTtsLike {
  speak(text: string): Promise<string>;
  speakEdge(text: string): Promise<string>;
  speakSystemFallback(text: string): Promise<string>;
  cleanup(filePath: string): void;
  isAvailable(): Promise<{ available: boolean; method: string }>;
}

export interface HybridCloudTtsLike {
  isConfigured(): boolean;
  isAvailable(): Promise<GatewayCloudTtsStatus>;
  speak(text: string): Promise<string>;
  cleanup(filePath: string): void;
}

export type HybridTtsOptions = {
  localTts: HybridLocalTtsLike;
  cloudTts?: HybridCloudTtsLike | null;
};

/**
 * Local-first TTS with optional cloud fallback.
 * Sequence: edge-tts -> cloud voice -> SAPI/system fallback.
 */
export class HybridTtsService {
  private readonly localTts: HybridLocalTtsLike;
  private readonly cloudTts: HybridCloudTtsLike | null;

  constructor(options: HybridTtsOptions) {
    this.localTts = options.localTts;
    this.cloudTts = options.cloudTts || null;
  }

  public async isAvailable(): Promise<HybridTtsStatus> {
    const local = await this.localTts.isAvailable();
    const cloud = this.cloudTts ? await this.cloudTts.isAvailable() : { available: false, method: 'cloud-disabled' };

    if (local.method === 'edge-tts' && cloud.available) {
      return { available: true, method: `edge-tts + ${cloud.method}` };
    }

    if (local.method === 'edge-tts') {
      return local;
    }

    if (cloud.available) {
      return { available: true, method: `${cloud.method} + ${local.method}` };
    }

    return local.available ? local : cloud;
  }

  public async speak(text: string): Promise<string> {
    let localError: Error | null = null;

    try {
      return await this.localTts.speakEdge(text);
    } catch (error: unknown) {
      localError = toError(error);
      console.warn(`[TTS] edge-tts unavailable, trying cloud fallback: ${localError.message}`);
    }

    if (this.cloudTts?.isConfigured()) {
      try {
        return await this.cloudTts.speak(text);
      } catch (error: unknown) {
        const cloudError = toError(error);
        console.warn(`[TTS] cloud fallback failed, resuming local fallback: ${cloudError.message}`);
      }
    }

    return await this.localTts.speakSystemFallback(text);
  }

  public cleanup(filePath: string): void {
    this.localTts.cleanup(filePath);
    this.cloudTts?.cleanup(filePath);
  }
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
