/**
 * Resolve embedding backend by memory.mode: local | hybrid | cloud.
 */

import { LocalEmbeddingService, type MemoryEmbeddingMode } from './LocalEmbeddingService.js';
import { VectorEmbeddingService } from './VectorEmbeddingService.js';
import { logger } from '../logger.js';

export type EmbeddingBackend = {
  generate: (text: string) => Promise<number[]>;
  generateBatch?: (texts: string[]) => Promise<number[][]>;
  mode: MemoryEmbeddingMode;
  backend: 'local' | 'gemini' | 'none';
};

export class MemoryModeRouter {
  public static resolveMode(env: NodeJS.ProcessEnv = process.env): MemoryEmbeddingMode {
    return LocalEmbeddingService.resolveMode(env);
  }

  /**
   * local → LocalEmbeddingService only
   * hybrid → local first, fall through to Gemini if configured and local fails (generate always local-first for hybrid)
   * cloud → Gemini only when configured
   */
  public static createEmbeddingBackend(env: NodeJS.ProcessEnv = process.env): EmbeddingBackend | null {
    const mode = this.resolveMode(env);

    if (mode === 'local') {
      const local = new LocalEmbeddingService();
      return {
        mode,
        backend: 'local',
        generate: (text) => local.generate(text),
        generateBatch: (texts) => local.generateBatch(texts),
      };
    }

    if (mode === 'cloud') {
      if (!VectorEmbeddingService.isConfigured()) {
        return null;
      }
      const cloud = new VectorEmbeddingService();
      return {
        mode,
        backend: 'gemini',
        generate: (text) => cloud.generate(text),
        generateBatch: (texts) => cloud.generateBatch(texts),
      };
    }

    // hybrid: prefer local always for determinism/offline, optionally try cloud if forced
    const preferCloud = String(env.ZAVORTH_MEMORY_HYBRID_PREFER || '').trim().toLowerCase() === 'cloud';
    if (preferCloud && VectorEmbeddingService.isConfigured()) {
      const cloud = new VectorEmbeddingService();
      const local = new LocalEmbeddingService();
      return {
        mode: 'hybrid',
        backend: 'gemini',
        generate: async (text) => {
          try {
            return await cloud.generate(text);
          } catch (error: unknown) {
            logger.warn('[MemoryModeRouter] cloud embedding failed; falling back to local', error);
            return local.generate(text);
          }
        },
        generateBatch: async (texts) => {
          try {
            return await cloud.generateBatch(texts);
          } catch (error: unknown) {
            logger.warn('[MemoryModeRouter] cloud batch embedding failed; falling back to local', error);
            return local.generateBatch(texts);
          }
        },
      };
    }

    const local = new LocalEmbeddingService();
    return {
      mode: 'hybrid',
      backend: 'local',
      generate: (text) => local.generate(text),
      generateBatch: (texts) => local.generateBatch(texts),
    };
  }
}
