/**
 * MediaUnderstandingContract — Contrato Zavorth-nativo para análise e compreensão de mídia.
 *
 * Este contrato define a interface canônica para toda análise de mídia (imagem, áudio, vídeo)
 * dentro do runtime do Zavorth. Ele complementa o contrato de geração (media.generate)
 * com a capacidade inversa: dado um artefato de mídia, produzir uma análise estruturada.
 *
 * Princípios fundamentais:
 *
 * - Entrada é SEMPRE via ZavorthArtifact ou referência local — nunca URL crua de provedor.
 * - Saída é sempre um MediaAnalysisResult estruturado.
 * - O adapter é o único componente que conhece detalhes do provedor de visão/análise.
 * - A política de conteúdo é avaliada ANTES da análise.
 * - Dados sensíveis detectados são sinalizados, nunca expostos.
 *
 * Capability canônica: `media.understand`
 *
 * Referências arquiteturais:
 * - docs/327-zavorth-native-absorption-execution-plan.md (Wave 3)
 * - docs/329-wave1-media-generate-implementation.md (padrão contract)
 * - docs/330-wave2-search-query-implementation.md (padrão contract)
 *
 * @module contracts/MediaUnderstandingContract
 * @since 2026-05-03
 * @author Zavorth Core Team
 */

// ---------------------------------------------------------------------------
// Capability ID
// ---------------------------------------------------------------------------

/** Identificador canônico da capability de compreensão de mídia. */
export const MEDIA_UNDERSTAND_CAPABILITY_ID = 'media.understand' as const;

// ---------------------------------------------------------------------------
// Tipos de modalidade e análise
// ---------------------------------------------------------------------------

/**
 * Modalidades de mídia suportadas para análise.
 */
export type MediaUnderstandingModality = 'image' | 'audio' | 'video';

/**
 * Tipo de análise solicitada.
 *
 * - `describe`:    Descrição geral do conteúdo.
 * - `extract`:     Extração de texto/dados visíveis (OCR, transcrição).
 * - `classify`:    Classificação em categorias predefinidas.
 * - `qa`:          Responder a uma pergunta sobre o conteúdo.
 */
export type MediaAnalysisType = 'describe' | 'extract' | 'classify' | 'qa';

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------

/**
 * Requisição canônica de análise de mídia.
 * A entrada é sempre via referência local — nunca URL crua.
 */
export interface MediaUnderstandingRequest {
  /**
   * Referência ao artefato de mídia.
   * Pode ser:
   * - Um caminho local do Zavorth (storageRef de um GeneratedMediaArtifact).
   * - Um ID de artefato do Zavorth.
   * - Um buffer de dados binários com metadados.
   *
   * NUNCA é uma URL crua de provedor externo.
   */
  source: MediaUnderstandingSource;

  /** Tipo de análise solicitada. Default: 'describe'. */
  analysisType?: MediaAnalysisType;

  /**
   * Pergunta ou instrução para guiar a análise.
   * Usado principalmente com analysisType='qa'.
   * Para 'describe', serve como foco adicional (ex: "foque nos rostos").
   */
  prompt?: string | null;

  /** Modalidade da mídia. Se null, será inferida do contentType. */
  modality?: MediaUnderstandingModality | null;

  /** Contexto de sessão para rastreabilidade. */
  sessionId?: string | null;

  /** ID de correlação para tracing distribuído. */
  correlationId?: string | null;

  /** Metadados extras para o adapter. */
  providerHints?: Record<string, unknown> | null;
}

/**
 * Fonte de mídia para análise.
 * Segue o princípio artifact-only: a entrada deve ser um artefato Zavorth
 * ou dados binários locais — nunca uma URL crua de provedor.
 */
export type MediaUnderstandingSource =
  | MediaSourceArtifactRef
  | MediaSourceLocalPath
  | MediaSourceBuffer;

export interface MediaSourceArtifactRef {
  kind: 'artifact-ref';
  /** ID do artefato Zavorth. */
  artifactId: string;
}

export interface MediaSourceLocalPath {
  kind: 'local-path';
  artifactId?: never;
  /** Caminho local do arquivo. */
  path: string;
  /** Tipo MIME, se conhecido. */
  contentType?: string | null;
}

export interface MediaSourceBuffer {
  kind: 'buffer';
  artifactId?: never;
  /** Dados binários da mídia. */
  data: Buffer;
  /** Tipo MIME. Obrigatório para buffers. */
  contentType: string;
  /** Nome de arquivo sugerido. */
  fileName?: string | null;
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

/**
 * Resultado completo da análise de mídia.
 */
export interface MediaUnderstandingResult {
  /** Se a operação foi bem-sucedida. */
  ok: boolean;

  /** Tipo de análise efetivamente executado. */
  analysisType: MediaAnalysisType;

  /** Modalidade da mídia analisada. */
  modality: MediaUnderstandingModality;

  /** Análise produzida (vazia se falhou). */
  analysis: MediaAnalysis | null;

  /** Decisão de política aplicada. */
  policyDecision: MediaUnderstandingPolicyDecision;

  /** Erro estruturado, se a operação falhou. */
  error?: MediaUnderstandingError | null;

  /** Resumo legível. */
  summary: string;

  /** Timestamp ISO do processamento. */
  processedAt: string;
}

/**
 * Análise estruturada de mídia.
 */
export interface MediaAnalysis {
  /**
   * Descrição textual do conteúdo.
   * Preenchida para analysisType='describe' e 'qa'.
   */
  description: string;

  /**
   * Texto extraído do conteúdo (OCR, transcrição).
   * Preenchido para analysisType='extract'.
   */
  extractedText?: string | null;

  /**
   * Classificações atribuídas.
   * Preenchido para analysisType='classify'.
   */
  classifications?: MediaClassification[] | null;

  /**
   * Resposta a uma pergunta específica.
   * Preenchido para analysisType='qa'.
   */
  answer?: string | null;

  /**
   * Metadados detectados da mídia.
   */
  detectedMetadata: MediaDetectedMetadata;

  /** Evidência do provedor (apenas auditoria). */
  providerEvidence: MediaAnalysisProviderEvidence;
}

/**
 * Uma classificação individual atribuída à mídia.
 */
export interface MediaClassification {
  /** Rótulo da classificação. */
  label: string;

  /** Confiança do modelo (0-1). */
  confidence: number;

  /** Categoria pai, se aplicável. */
  category?: string | null;
}

/**
 * Metadados detectados automaticamente da mídia.
 */
export interface MediaDetectedMetadata {
  /** Tipo MIME detectado. */
  contentType: string;

  /** Dimensões (largura x altura), se aplicável. */
  dimensions?: { width: number; height: number } | null;

  /** Duração em segundos, se aplicável (áudio/vídeo). */
  durationSeconds?: number | null;

  /** Tamanho em bytes. */
  sizeBytes: number;

  /** Se contém texto visível (OCR). */
  hasVisibleText: boolean;

  /** Se contém rostos detectados. */
  hasFaces: boolean;

  /** Idioma predominante detectado, se aplicável. */
  detectedLanguage?: string | null;

  /**
   * Sinalização de conteúdo sensível.
   * Se true, o conteúdo pode conter elementos que merecem atenção.
   */
  sensitiveContent: boolean;

  /** Razão da sinalização de conteúdo sensível. */
  sensitiveContentReason?: string | null;
}

/**
 * Evidência do provedor de análise.
 */
export interface MediaAnalysisProviderEvidence {
  /** ID do provedor usado. */
  providerId: string;

  /** Modelo usado para análise. */
  modelId?: string | null;

  /** Tokens consumidos, se reportado. */
  tokensUsed?: number | null;

  /** Metadados extras. */
  metadata?: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// Policy Decision
// ---------------------------------------------------------------------------

/**
 * Decisão de política sobre a requisição de análise.
 */
export interface MediaUnderstandingPolicyDecision {
  /** Se a análise foi permitida. */
  allowed: boolean;

  /** Razão da decisão. */
  reason: string;

  /** Fonte da política. */
  policySource: 'content-type-policy' | 'file-size-limit' | 'capability-gate' | 'source-validation';

  /** Se a fonte foi validada como artefato Zavorth legítimo. */
  sourceValidated: boolean;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Erro estruturado de análise de mídia.
 */
export interface MediaUnderstandingError {
  /** Código de erro canônico. */
  code:
    | 'POLICY_BLOCKED'
    | 'INVALID_SOURCE'
    | 'UNSUPPORTED_MODALITY'
    | 'PROVIDER_UNAVAILABLE'
    | 'PROVIDER_ERROR'
    | 'FILE_NOT_FOUND'
    | 'FILE_TOO_LARGE'
    | 'INVALID_REQUEST'
    | 'UNKNOWN_ERROR';

  /** Mensagem legível. */
  message: string;

  /** Detalhes do provedor (debugging). */
  providerDetail?: string | null;
}

// ---------------------------------------------------------------------------
// Adapter Interface
// ---------------------------------------------------------------------------

/**
 * Interface que cada adapter de análise de mídia deve implementar.
 */
export interface IMediaUnderstandingAdapter {
  /** Identificador do adapter. */
  readonly adapterId: string;

  /** Modalidades suportadas por este adapter. */
  readonly supportedModalities: MediaUnderstandingModality[];

  /**
   * Analisa a mídia fornecida.
   * O adapter recebe dados binários (buffer) e metadados — nunca uma URL crua.
   */
  analyze(input: AdapterAnalysisInput): Promise<AdapterAnalysisOutput>;
}

/**
 * Entrada para o adapter de análise.
 * O service converte a source do request neste formato antes de chamar o adapter.
 */
export interface AdapterAnalysisInput {
  /** Dados binários da mídia. */
  data: Buffer;

  /** Tipo MIME. */
  contentType: string;

  /** Tipo de análise. */
  analysisType: MediaAnalysisType;

  /** Prompt/pergunta adicional. */
  prompt?: string | null;

  /** Metadados extras. */
  providerHints?: Record<string, unknown> | null;
}

/**
 * Resultado cru do adapter de análise.
 */
export interface AdapterAnalysisOutput {
  /** Descrição/resposta gerada pelo modelo. */
  text: string;

  /** Se texto visível foi detectado (OCR). */
  hasVisibleText: boolean;

  /** Se rostos foram detectados. */
  hasFaces: boolean;

  /** Se conteúdo sensível foi detectado. */
  sensitiveContent: boolean;

  /** Razão de conteúdo sensível. */
  sensitiveContentReason?: string | null;

  /** Tokens usados, se reportado. */
  tokensUsed?: number | null;

  /** Evidência do provedor. */
  providerEvidence: MediaAnalysisProviderEvidence;
}
