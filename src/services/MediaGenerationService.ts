import { asErrorLike } from '../utils/errorLike';
import {
  AiGatewayImageGenerationAdapter,
  MediaAdapterNetworkError,
  MediaAdapterProviderError,
} from '../adapters/media/AiGatewayImageGenerationAdapter.js';
import { safeFetch } from '../security/SafeFetchService.js';
/**
 * MediaGenerationService - Zavorth-native media generation orchestration service.
 *
 * This service is the core of the `media.generate` capability. It is responsible for:
 *
 * 1. Validating the request against content policy.
 * 2. Selecionar e invocar o adapter correto para a modalidade solicitada.
 * 3. Converting adapter output into ZavorthArtifacts.
 * 4. Persistir os artefatos no storage local do Zavorth.
 * 5. Retornar um MediaGenerationResult estruturado.
 *
 * The service NEVER:
 * - Returns a loose URL as the canonical result.
 * - Accepts provider output paths as authority.
 * - Carrega SDKs externos diretamente.
 *
 * Architectural references:
 * - docs/native-absorption-execution-plan.md
 * - docs/product-direction roadmap (Section 6: Media Generation)
 * - src/contracts/MediaGenerationContract.ts
 *
 * @module services/MediaGenerationService
 * @since 2026-05-03
 * @author Zavorth Core Team
 */

import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { logger } from '../logger.js';
import type {
  MediaGenerationRequest,
  MediaGenerationResult,
  MediaGenerationPolicyDecision,
  GeneratedMediaArtifact,
  IMediaGenerationAdapter,
  AdapterGenerationOutput,
  MediaGenerationError,
  MediaGenerationModality,
} from '../contracts/MediaGenerationContract.js';


/** Terms blocked by content safety policy. */
const BLOCKED_TERMS = [
  'explicit',
  'pornographic',
  'gore',
  'violent death',
  'child abuse',
  'csam',
];

/** Default unit limit per request. */
const MAX_COUNT_PER_REQUEST = 4;

export class MediaGenerationService {
  private readonly adapters: Map<string, IMediaGenerationAdapter>;
  private readonly artifactDir: string;

  constructor(options?: {
    adapters?: IMediaGenerationAdapter[];
    artifactDir?: string;
  }) {
    this.adapters = new Map();
    this.artifactDir = options?.artifactDir || path.join(config.dataDir, 'artifacts', 'media');

    // Registra adapters fornecidos ou cria o default.
    const adapterList = options?.adapters || [new AiGatewayImageGenerationAdapter()];
    for (const adapter of adapterList) {
      this.adapters.set(adapter.adapterId, adapter);
    }
  }

  /**
   * Runs media generation end to end.
   *
   * Flow: request -> policy -> adapter -> artifact storage -> result
   */
  public async generate(request: MediaGenerationRequest): Promise<MediaGenerationResult> {
    const processedAt = new Date().toISOString();

    // 1. Basic request validation.
    const validationError = this.validateRequest(request);
    if (validationError) {
      return this.buildErrorResult(validationError, processedAt);
    }

    // 2. Content policy evaluation.
    const policyDecision = this.evaluatePolicy(request);
    if (!policyDecision.allowed) {
      return this.buildPolicyBlockedResult(policyDecision, processedAt);
    }

    // 3. Select the adapter for the modality.
    const modality = request.modality || 'image';
    const adapter = this.selectAdapter(modality);
    if (!adapter) {
      return this.buildErrorResult(
        {
          code: 'PROVIDER_UNAVAILABLE',
          message: `No adapter available for modality '${modality}'.`,
        },
        processedAt,
      );
    }

    // 4. Invoca o adapter.
    let adapterOutputs: AdapterGenerationOutput[];
    try {
      const effectiveRequest = policyDecision.promptModified && policyDecision.sanitizedPrompt
        ? { ...request, prompt: policyDecision.sanitizedPrompt }
        : request;

      adapterOutputs = await adapter.generate(effectiveRequest);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Media Generation] creation failed', error);
    return this.buildAdapterErrorResult(err, processedAt, policyDecision);
  }

    // 5. Converte outputs do adapter em artefatos Zavorth e persiste.
    const artifacts: GeneratedMediaArtifact[] = [];
    for (const output of adapterOutputs) {
      try {
        const artifact = await this.storeAsArtifact(output, modality, request);
        artifacts.push(artifact);
      } catch (error: unknown) {
        const err = asErrorLike(error);
        logger.error(`[MediaGenerationService] Artifact storage failed: ${err instanceof Error ? err.message : String(err)}`);
        // Continue with other artifacts; do not fail the whole request.
      }
    }

    if (artifacts.length === 0 && adapterOutputs.length > 0) {
      return this.buildErrorResult(
        {
          code: 'ARTIFACT_STORAGE_FAILED',
          message: 'The adapter returned data, but no artifact could be stored.',
        },
        processedAt,
        policyDecision,
      );
    }

    // 6. Monta resultado final.
    return {
      ok: true,
      artifacts,
      policyDecision,
      summary: `${artifacts.length} ${modality}(s) generated successfully.`,
      processedAt,
    };
  }

  private validateRequest(request: MediaGenerationRequest): MediaGenerationError | null {
    if (!request.prompt || typeof request.prompt !== 'string' || request.prompt.trim().length === 0) {
      return {
        code: 'INVALID_REQUEST',
        message: 'The prompt field is required and must be a non-empty string.',
      };
    }

    if (request.count !== undefined && (typeof request.count !== 'number' || request.count < 1)) {
      return {
        code: 'INVALID_REQUEST',
        message: 'The count field must be a number >= 1.',
      };
    }

    if (request.count && request.count > MAX_COUNT_PER_REQUEST) {
      return {
        code: 'INVALID_REQUEST',
        message: `Maximum of ${MAX_COUNT_PER_REQUEST} units per request.`,
      };
    }

    return null;
  }

  private evaluatePolicy(request: MediaGenerationRequest): MediaGenerationPolicyDecision {
    const promptLower = request.prompt.toLowerCase();

    for (const term of BLOCKED_TERMS) {
      if (promptLower.includes(term)) {
        return {
          allowed: false,
          reason: `Prompt blocked by content safety policy (term: "${term}").`,
          policySource: 'content-safety',
          promptModified: false,
        };
      }
    }

    return {
      allowed: true,
      reason: 'Prompt approved by content safety policy.',
      policySource: 'content-safety',
      promptModified: false,
    };
  }

  private selectAdapter(modality: MediaGenerationModality): IMediaGenerationAdapter | null {
    for (const adapter of this.adapters.values()) {
      if (adapter.supportedModalities.includes(modality)) {
        return adapter;
      }
    }
    return null;
  }

  private async storeAsArtifact(
    output: AdapterGenerationOutput,
    modality: MediaGenerationModality,
    request: MediaGenerationRequest,
  ): Promise<GeneratedMediaArtifact> {
    const artifactId = randomUUID();
    const ext = this.inferExtension(output.contentType);
    const filename = `${modality}-${artifactId}${ext}`;
    const artifactPath = path.join(this.artifactDir, filename);

    // Ensure the artifacts directory exists.
    await fs.promises.mkdir(this.artifactDir, { recursive: true });

    // If binary data is available, save it directly.
    if (output.data) {
      await fs.promises.writeFile(artifactPath, output.data);
    } else if (output.sourceUrl) {
      // Download from the provider URL for local storage.
      await this.downloadToFile(output.sourceUrl, artifactPath);
    } else {
      throw new Error('Adapter output has no data and no sourceUrl.');
    }

    // Verify if file was saved correctly.
    const stats = await fs.promises.stat(artifactPath);

    return {
      artifactId,
      modality,
      contentType: output.contentType,
      storageRef: artifactPath,
      sizeBytes: stats.size,
      generatedAt: new Date().toISOString(),
      providerEvidence: output.providerEvidence,
    };
  }

  private async downloadToFile(url: string, targetPath: string): Promise<void> {
    const response = await safeFetch(url, {
      signal: AbortSignal.timeout(60_000),
    }, {
      serviceName: 'Media artifact download',
    });

    if (!response.ok) {
      throw new Error(`Download failed: HTTP ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.promises.writeFile(targetPath, buffer);
  }

  private inferExtension(contentType: string): string {
    const map: Record<string, string> = {
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'video/mp4': '.mp4',
      'audio/mpeg': '.mp3',
      'audio/wav': '.wav',
    };
    return map[contentType] || '.bin';
  }

  private buildErrorResult(
    error: MediaGenerationError,
    processedAt: string,
    policyDecision?: MediaGenerationPolicyDecision,
  ): MediaGenerationResult {
    return {
      ok: false,
      artifacts: [],
      policyDecision: policyDecision || {
        allowed: true,
        reason: 'Policy was not evaluated because of a previous error.',
        policySource: 'content-safety',
        promptModified: false,
      },
      error,
      summary: error.message,
      processedAt,
    };
  }

  private buildPolicyBlockedResult(
    policyDecision: MediaGenerationPolicyDecision,
    processedAt: string,
  ): MediaGenerationResult {
    return {
      ok: false,
      artifacts: [],
      policyDecision,
      error: {
        code: 'POLICY_BLOCKED',
        message: policyDecision.reason,
      },
      summary: policyDecision.reason,
      processedAt,
    };
  }

  private buildAdapterErrorResult(
    err: unknown,
    processedAt: string,
    policyDecision: MediaGenerationPolicyDecision,
  ): MediaGenerationResult {
    if (err instanceof MediaAdapterNetworkError) {
      return {
        ok: false,
        artifacts: [],
        policyDecision,
        error: {
          code: 'PROVIDER_UNAVAILABLE',
          message: 'The media generation provider is unavailable.',
          providerDetail: err.message,
        },
        summary: 'Provider unavailable.',
        processedAt,
      };
    }

    if (err instanceof MediaAdapterProviderError) {
      return {
        ok: false,
        artifacts: [],
        policyDecision,
        error: {
          code: 'PROVIDER_ERROR',
          message: 'The provider returned an error during generation.',
          providerDetail: err.message,
        },
        summary: 'Media generation provider error.',
        processedAt,
      };
    }

    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      artifacts: [],
      summary: 'Unexpected media generation error.',
      policyDecision,
      error: {
        code: 'UNKNOWN_ERROR',
        message: `Unexpected error during generation: ${message}`,
      },
      processedAt,
    };
  }
}
