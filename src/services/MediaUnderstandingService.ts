import { asErrorLike } from '../utils/errorLike';
﻿/**
 * MediaUnderstandingService - Zavorth-native media analysis and understanding service.
 *
 * This service is the center of the `media.understand` capability. It orchestrates:
 *
 * 1. Source validation (artifact-first, never raw provider URLs).
 * 2. Source resolution into binary data.
 * 3. Policy evaluation (file type, size, content).
 * 4. Adapter invocation.
 * 5. Structured result assembly with detected metadata.
 *
 * The service NEVER:
 * - Accepts external URLs as media sources.
 * - Treats provider output as authoritative without normalization.
 * - Exposes sensitive content without signaling.
 *
 * Architectural references:
 * - docs/native-absorption-execution-plan.md
 * - src/contracts/MediaUnderstandingContract.ts
 *
 * @module services/MediaUnderstandingService
 * @since 2026-05-03
 * @author Zavorth Core Team
 */

import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import type {
  MediaUnderstandingRequest,
  MediaUnderstandingResult,
  MediaUnderstandingPolicyDecision,
  MediaAnalysis,
  MediaDetectedMetadata,
  MediaUnderstandingError,
  MediaUnderstandingModality,
  MediaAnalysisType,
  IMediaUnderstandingAdapter,
  AdapterAnalysisInput,
  AdapterAnalysisOutput,
} from '../contracts/MediaUnderstandingContract.js';
import { logger } from '../logger.js';
import {
GeminiVisionAnalysisAdapter,
  VisionAdapterError,
} from '../adapters/media/GeminiVisionAnalysisAdapter.js';

/** Maximum analysis file size (20 MB). */
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

/** MIME types allowed for analysis. */
const ALLOWED_CONTENT_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/tiff',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/flac',
  'audio/mp4',
  'audio/webm',
  'video/mp4',
  'video/webm',
  'video/mpeg',
  'video/quicktime',
]);

type ResolvedMediaSource = {
  data: Buffer;
  contentType: string;
  sizeBytes: number;
  sourceValidated: boolean;
};

export type MediaArtifactResolverResult = {
  data?: Buffer | null;
  path?: string | null;
  contentType?: string | null;
  sizeBytes?: number | null;
};

export type MediaArtifactResolver = (artifactId: string) => Promise<MediaArtifactResolverResult | null>;

export class MediaUnderstandingService {
  private readonly adapters: Map<string, IMediaUnderstandingAdapter>;
  private readonly artifactResolver: MediaArtifactResolver;

  constructor(options?: {
    adapters?: IMediaUnderstandingAdapter[];
    artifactResolver?: MediaArtifactResolver;
    artifactDir?: string;
  }) {
    this.adapters = new Map();
    const artifactDir = options?.artifactDir || path.join(config.dataDir, 'artifacts', 'media');
    this.artifactResolver = options?.artifactResolver || ((artifactId) =>
      this.resolveArtifactFromMediaDir(artifactDir, artifactId));

    const adapterList = options?.adapters || [new GeminiVisionAnalysisAdapter()];
    for (const adapter of adapterList) {
      this.adapters.set(adapter.adapterId, adapter);
    }
  }

  /**
   * Runs media analysis end to end.
   *
   * Fluxo: request -> validate source -> resolve binary -> policy -> adapter -> result
   */
  public async analyze(request: MediaUnderstandingRequest): Promise<MediaUnderstandingResult> {
    const processedAt = new Date().toISOString();
    const analysisType = request.analysisType || 'describe';

    // 1. Resolve the source into binary data + contentType.
    let resolved: ResolvedMediaSource;
    try {
      resolved = await this.resolveSource(request);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const message = err instanceof Error ? err.message : String(err);
      return this.buildErrorResult(
        { code: 'INVALID_SOURCE', message },
        analysisType,
        processedAt,
      );
    }

    // 2. Infere modalidade.
    const modality = request.modality || this.inferModality(resolved.contentType);
    if (!modality) {
      return this.buildErrorResult(
        { code: 'UNSUPPORTED_MODALITY', message: `Tipo de midia nao suportado: ${resolved.contentType}` },
        analysisType,
        processedAt,
      );
    }

    // 3. Evaluate policy.
    const policyDecision = this.evaluatePolicy(
      resolved.contentType,
      resolved.sizeBytes,
      resolved.sourceValidated,
    );
    if (!policyDecision.allowed) {
      return this.buildPolicyBlockedResult(policyDecision, analysisType, modality, processedAt);
    }

    // 4. Seleciona adapter.
    const adapter = this.selectAdapter(modality);
    if (!adapter) {
      return this.buildErrorResult(
        { code: 'PROVIDER_UNAVAILABLE', message: `Nenhum adapter disponivel para modalidade '${modality}'.` },
        analysisType,
        processedAt,
        policyDecision,
      );
    }

    // 5. Invoca adapter.
    let adapterOutput: AdapterAnalysisOutput;
    try {
      const adapterInput: AdapterAnalysisInput = {
        data: resolved.data,
        contentType: resolved.contentType,
        analysisType,
        prompt: request.prompt,
        providerHints: request.providerHints,
      };
      adapterOutput = await adapter.analyze(adapterInput);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Media Understanding] path resolution failed', error);
    return this.buildAdapterErrorResult(err, analysisType, modality, policyDecision, processedAt);
  }

    // 6. Build structured analysis.
    const analysis = this.buildAnalysis(adapterOutput, analysisType, resolved);

    return {
      ok: true,
      analysisType,
      modality,
      analysis,
      policyDecision,
      summary: `Analise '${analysisType}' concluida para ${modality} (${(resolved.sizeBytes / 1024).toFixed(1)} KB).`,
      processedAt,
    };
  }

  private async resolveSource(request: MediaUnderstandingRequest): Promise<ResolvedMediaSource> {
    const source = request.source;

    if (source.kind === 'buffer') {
      return {
        data: source.data,
        contentType: source.contentType,
        sizeBytes: source.data.length,
        sourceValidated: true,
      };
    }

    if (source.kind === 'local-path') {
      if (!fs.existsSync(source.path)) {
        throw new Error(`Arquivo nao encontrado: ${source.path}`);
      }

      const stats = await fs.promises.stat(source.path);
      const data = await fs.promises.readFile(source.path);
      const contentType = source.contentType || this.inferContentType(source.path);

      return {
        data,
        contentType,
        sizeBytes: stats.size,
        sourceValidated: false,
      };
    }

    if (source.kind === 'artifact-ref') {
      const artifactId = String(source.artifactId || '').trim();
      if (!artifactId) {
        throw new Error('artifactId e obrigatorio para source artifact-ref.');
      }

      const artifact = await this.artifactResolver(artifactId);
      if (!artifact) {
        throw new Error(`Artefato '${artifactId}' nao encontrado.`);
      }

      if (artifact.data) {
        return {
          data: artifact.data,
          contentType: artifact.contentType || 'application/octet-stream',
          sizeBytes: artifact.sizeBytes ?? artifact.data.length,
          sourceValidated: true,
        };
      }

      const artifactPath = String(artifact.path || '').trim();
      if (!artifactPath) {
        throw new Error(`Artefato '${artifactId}' nao possui dados nem caminho local.`);
      }
      if (!fs.existsSync(artifactPath)) {
        throw new Error(`Arquivo do artefato '${artifactId}' nao encontrado: ${artifactPath}`);
      }

      const stats = await fs.promises.stat(artifactPath);
      const data = await fs.promises.readFile(artifactPath);
      return {
        data,
        contentType: artifact.contentType || this.inferContentType(artifactPath),
        sizeBytes: artifact.sizeBytes ?? stats.size,
        sourceValidated: true,
      };
    }

    throw new Error('Tipo de source invalido para media.understand.');
  }

  private async resolveArtifactFromMediaDir(
    artifactDir: string,
    artifactId: string,
  ): Promise<MediaArtifactResolverResult | null> {
    const normalizedId = String(artifactId || '').trim();
    if (!normalizedId || !fs.existsSync(artifactDir)) {
      return null;
    }

    const entries = await fs.promises.readdir(artifactDir, { withFileTypes: true });
    const match = entries.find((entry) =>
      entry.isFile() && entry.name.includes(normalizedId));
    if (!match) {
      return null;
    }

    const artifactPath = path.join(artifactDir, match.name);
    const stats = await fs.promises.stat(artifactPath);
    return {
      path: artifactPath,
      contentType: this.inferContentType(artifactPath),
      sizeBytes: stats.size,
    };
  }

  private inferContentType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const map: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.tiff': 'image/tiff',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.flac': 'audio/flac',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mpeg': 'video/mpeg',
      '.mov': 'video/quicktime',
    };
    return map[ext] || 'application/octet-stream';
  }

  private inferModality(contentType: string): MediaUnderstandingModality | null {
    if (contentType.startsWith('image/')) return 'image';
    if (contentType.startsWith('audio/')) return 'audio';
    if (contentType.startsWith('video/')) return 'video';
    return null;
  }

  private evaluatePolicy(
    contentType: string,
    sizeBytes: number,
    sourceValidated: boolean,
  ): MediaUnderstandingPolicyDecision {
    if (sizeBytes > MAX_FILE_SIZE_BYTES) {
      return {
        allowed: false,
        reason: `Arquivo excede o limite de ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB (tamanho: ${(sizeBytes / (1024 * 1024)).toFixed(1)} MB).`,
        policySource: 'file-size-limit',
        sourceValidated,
      };
    }

    if (!ALLOWED_CONTENT_TYPES.has(contentType) && !contentType.startsWith('image/') && !contentType.startsWith('audio/') && !contentType.startsWith('video/')) {
      return {
        allowed: false,
        reason: `Tipo de midia nao permitido para analise: ${contentType}.`,
        policySource: 'content-type-policy',
        sourceValidated,
      };
    }

    return {
      allowed: true,
      reason: 'Midia aprovada pela politica de analise.',
      policySource: 'content-type-policy',
      sourceValidated,
    };
  }

  private selectAdapter(modality: MediaUnderstandingModality): IMediaUnderstandingAdapter | null {
    for (const adapter of this.adapters.values()) {
      if (adapter.supportedModalities.includes(modality)) {
        return adapter;
      }
    }
    return null;
  }

  private buildAnalysis(
    output: AdapterAnalysisOutput,
    analysisType: MediaAnalysisType,
    resolved: { contentType: string; sizeBytes: number },
  ): MediaAnalysis {
    const detectedMetadata: MediaDetectedMetadata = {
      contentType: resolved.contentType,
      sizeBytes: resolved.sizeBytes,
      hasVisibleText: output.hasVisibleText,
      hasFaces: output.hasFaces,
      sensitiveContent: output.sensitiveContent,
      sensitiveContentReason: output.sensitiveContentReason,
    };

    const analysis: MediaAnalysis = {
      description: output.text,
      detectedMetadata,
      providerEvidence: output.providerEvidence,
    };

    // Fill fields that depend on the requested analysis type.
    if (analysisType === 'extract') {
      analysis.extractedText = output.text;
    }

    if (analysisType === 'qa') {
      analysis.answer = output.text;
    }

    if (analysisType === 'classify') {
      analysis.classifications = this.parseClassifications(output.text);
    }

    return analysis;
  }

  private parseClassifications(text: string): Array<{ label: string; confidence: number; category?: string | null }> {
    // Try to extract classifications from model text.
    const lines = text.split('\n').filter((line) => line.trim().length > 0);
    const classifications: Array<{ label: string; confidence: number; category?: string | null }> = [];

    for (const line of lines) {
      const match = line.match(/[-\u2022*]\s*(.+?)(?:\s*[-:]\s*(alt[oa]|m(?:e|\u00e9)di[oa]|baix[oa]|high|medium|low))?$/i);
      if (match) {
        const label = match[1].trim();
        const conf = match[2]?.toLowerCase() || '';
        const confidence = /alt|high/i.test(conf) ? 0.9 : /m(?:e|\u00e9)d/i.test(conf) ? 0.6 : /baix|low/i.test(conf) ? 0.3 : 0.5;
        classifications.push({ label, confidence });
      }
    }

    return classifications.length > 0 ? classifications : [{ label: text.slice(0, 100), confidence: 0.5 }];
  }

  private buildErrorResult(
    error: MediaUnderstandingError,
    analysisType: MediaAnalysisType,
    processedAt: string,
    policyDecision?: MediaUnderstandingPolicyDecision,
  ): MediaUnderstandingResult {
    return {
      ok: false,
      analysisType,
      modality: 'image',
      analysis: null,
      policyDecision: policyDecision || {
        allowed: true,
        reason: 'Politica nao avaliada.',
        policySource: 'source-validation',
        sourceValidated: false,
      },
      error,
      summary: error.message,
      processedAt,
    };
  }

  private buildPolicyBlockedResult(
    policyDecision: MediaUnderstandingPolicyDecision,
    analysisType: MediaAnalysisType,
    modality: MediaUnderstandingModality,
    processedAt: string,
  ): MediaUnderstandingResult {
    return {
      ok: false,
      analysisType,
      modality,
      analysis: null,
      policyDecision,
      error: { code: 'POLICY_BLOCKED', message: policyDecision.reason },
      summary: policyDecision.reason,
      processedAt,
    };
  }

  private buildAdapterErrorResult(
    err: unknown,
    analysisType: MediaAnalysisType,
    modality: MediaUnderstandingModality,
    policyDecision: MediaUnderstandingPolicyDecision,
    processedAt: string,
  ): MediaUnderstandingResult {
    const isVisionError = err instanceof VisionAdapterError;
    const message = err instanceof Error ? err.message : String(err);

    return {
      ok: false,
      analysisType,
      modality,
      analysis: null,
      policyDecision,
      error: {
        code: isVisionError ? 'PROVIDER_UNAVAILABLE' : 'PROVIDER_ERROR',
        message: isVisionError ? 'Provedor de analise de midia indisponivel.' : `Erro na analise: ${message}`,
        providerDetail: message,
      },
      summary: 'Erro na analise de midia.',
      processedAt,
    };
  }
}
