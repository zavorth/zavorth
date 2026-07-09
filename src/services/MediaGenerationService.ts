/**
 * MediaGenerationService — Serviço Zavorth-nativo de orquestração de geração de mídia.
 *
 * Este serviço é o coração da capability `media.generate`. Ele é responsável por:
 *
 * 1. Validar o request contra a política de conteúdo.
 * 2. Selecionar e invocar o adapter correto para a modalidade solicitada.
 * 3. Converter a saída do adapter em ZavorthArtifacts.
 * 4. Persistir os artefatos no storage local do Zavorth.
 * 5. Retornar um MediaGenerationResult estruturado.
 *
 * O serviço NUNCA:
 * - Retorna uma URL solta como resultado canônico.
 * - Aceita caminhos de saída do provedor como autoridade.
 * - Carrega SDKs externos diretamente.
 *
 * Referências arquiteturais:
 * - docs/native-absorption-execution-plan.md
 * - docs/product-direction roadmap (Seção 6: Media Generation)
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
import {
  AiGatewayImageGenerationAdapter,
  MediaAdapterNetworkError,
  MediaAdapterProviderError,
} from '../adapters/media/AiGatewayImageGenerationAdapter.js';
import { safeFetch } from '../security/SafeFetchService.js';

// ---------------------------------------------------------------------------
// Constantes de política
// ---------------------------------------------------------------------------

/** Termos bloqueados por política de segurança de conteúdo. */
const BLOCKED_TERMS = [
  'explicit',
  'pornographic',
  'gore',
  'violent death',
  'child abuse',
  'csam',
];

/** Limite padrão de unidades por request. */
const MAX_COUNT_PER_REQUEST = 4;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // API Pública
  // -------------------------------------------------------------------------

  /**
   * Executa a geração de mídia de ponta a ponta.
   *
   * Fluxo: request -> policy -> adapter -> artifact storage -> result
   */
  public async generate(request: MediaGenerationRequest): Promise<MediaGenerationResult> {
    const processedAt = new Date().toISOString();

    // 1. Validação básica do request.
    const validationError = this.validateRequest(request);
    if (validationError) {
      return this.buildErrorResult(validationError, processedAt);
    }

    // 2. Avaliação de política de conteúdo.
    const policyDecision = this.evaluatePolicy(request);
    if (!policyDecision.allowed) {
      return this.buildPolicyBlockedResult(policyDecision, processedAt);
    }

    // 3. Seleciona o adapter para a modalidade.
    const modality = request.modality || 'image';
    const adapter = this.selectAdapter(modality);
    if (!adapter) {
      return this.buildErrorResult(
        {
          code: 'PROVIDER_UNAVAILABLE',
          message: `Nenhum adapter disponível para a modalidade '${modality}'.`,
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
    } catch (error: any) { const err = error; const e = error;
    logger.warn('[Media Generation] creation failed', error);
    return this.buildAdapterErrorResult(err, processedAt, policyDecision);
  }

    // 5. Converte outputs do adapter em artefatos Zavorth e persiste.
    const artifacts: GeneratedMediaArtifact[] = [];
    for (const output of adapterOutputs) {
      try {
        const artifact = await this.storeAsArtifact(output, modality, request);
        artifacts.push(artifact);
      } catch (err: any) { const error = err; const e = err;
        logger.error(`[MediaGenerationService] Artifact storage failed: ${err instanceof Error ? err.message : String(err)}`);
        // Continua com os outros artefatos, não falha tudo.
      }
    }

    if (artifacts.length === 0 && adapterOutputs.length > 0) {
      return this.buildErrorResult(
        {
          code: 'ARTIFACT_STORAGE_FAILED',
          message: 'O adapter retornou dados, mas nenhum artefato pôde ser armazenado.',
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
      summary: `${artifacts.length} ${modality}(s) gerada(s) com sucesso.`,
      processedAt,
    };
  }

  // -------------------------------------------------------------------------
  // Validação
  // -------------------------------------------------------------------------

  private validateRequest(request: MediaGenerationRequest): MediaGenerationError | null {
    if (!request.prompt || typeof request.prompt !== 'string' || request.prompt.trim().length === 0) {
      return {
        code: 'INVALID_REQUEST',
        message: 'O campo "prompt" é obrigatório e deve ser uma string não-vazia.',
      };
    }

    if (request.count !== undefined && (typeof request.count !== 'number' || request.count < 1)) {
      return {
        code: 'INVALID_REQUEST',
        message: 'O campo "count" deve ser um número >= 1.',
      };
    }

    if (request.count && request.count > MAX_COUNT_PER_REQUEST) {
      return {
        code: 'INVALID_REQUEST',
        message: `Máximo de ${MAX_COUNT_PER_REQUEST} unidades por request.`,
      };
    }

    return null;
  }

  // -------------------------------------------------------------------------
  // Política
  // -------------------------------------------------------------------------

  private evaluatePolicy(request: MediaGenerationRequest): MediaGenerationPolicyDecision {
    const promptLower = request.prompt.toLowerCase();

    for (const term of BLOCKED_TERMS) {
      if (promptLower.includes(term)) {
        return {
          allowed: false,
          reason: `Prompt bloqueado por política de segurança de conteúdo (termo: "${term}").`,
          policySource: 'content-safety',
          promptModified: false,
        };
      }
    }

    return {
      allowed: true,
      reason: 'Prompt aprovado pela política de segurança de conteúdo.',
      policySource: 'content-safety',
      promptModified: false,
    };
  }

  // -------------------------------------------------------------------------
  // Seleção de adapter
  // -------------------------------------------------------------------------

  private selectAdapter(modality: MediaGenerationModality): IMediaGenerationAdapter | null {
    for (const adapter of this.adapters.values()) {
      if (adapter.supportedModalities.includes(modality)) {
        return adapter;
      }
    }
    return null;
  }

  // -------------------------------------------------------------------------
  // Armazenamento de artefatos
  // -------------------------------------------------------------------------

  private async storeAsArtifact(
    output: AdapterGenerationOutput,
    modality: MediaGenerationModality,
    request: MediaGenerationRequest,
  ): Promise<GeneratedMediaArtifact> {
    const artifactId = randomUUID();
    const ext = this.inferExtension(output.contentType);
    const filename = `${modality}-${artifactId}${ext}`;
    const artifactPath = path.join(this.artifactDir, filename);

    // Garante que o diretório de artefatos existe.
    await fs.promises.mkdir(this.artifactDir, { recursive: true });

    // Se temos dados binários, salva diretamente.
    if (output.data) {
      await fs.promises.writeFile(artifactPath, output.data);
    } else if (output.sourceUrl) {
      // Baixa da URL do provedor para armazenamento local.
      await this.downloadToFile(output.sourceUrl, artifactPath);
    } else {
      throw new Error('Adapter output has no data and no sourceUrl.');
    }

    // Verifica se o arquivo foi salvo corretamente.
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

  // -------------------------------------------------------------------------
  // Builders de resultado
  // -------------------------------------------------------------------------

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
        reason: 'Política não avaliada devido a erro anterior.',
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
          message: 'O provedor de geração de mídia está indisponível.',
          providerDetail: err.message,
        },
        summary: 'Provedor indisponível.',
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
          message: 'O provedor retornou um erro durante a geração.',
          providerDetail: err.message,
        },
        summary: 'Erro do provedor de geração.',
        processedAt,
      };
    }

    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      artifacts: [],
      policyDecision,
      error: {
        code: 'UNKNOWN_ERROR',
        message: `Erro inesperado durante a geração: ${message}`,
      },
      summary: 'Erro inesperado.',
      processedAt,
    };
  }
}
