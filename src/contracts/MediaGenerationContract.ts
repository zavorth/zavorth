/**
 * MediaGenerationContract — Contrato Zavorth-nativo para geração de mídia.
 *
 * Este contrato define a interface canônica para toda geração de mídia (imagem, vídeo, áudio)
 * dentro do runtime do Zavorth. Ele substitui qualquer dependência direta de superfícies
 * externas, garantindo que:
 *
 * - Toda saída é um ZavorthArtifact (nunca uma URL solta ou caminho de fonte).
 * - O adapter é o único componente que conhece detalhes do provedor.
 * - O serviço controla política, loop de geração, criação de artefato e normalização de erros.
 * - A tool controla a interface voltada ao agente/LLM.
 *
 * Capability canônica: `media.generate`
 *
 * Referências arquiteturais:
 * - docs/327-zavorth-native-absorption-execution-plan.md (Wave 1)
 * - docs/328 roadmap (Seção 6: Media Generation)
 * - docs/326 auditoria de originalidade (P1-1)
 *
 * @module contracts/MediaGenerationContract
 * @since 2026-05-03
 * @author Zavorth Core Team
 */

// ---------------------------------------------------------------------------
// Capability ID
// ---------------------------------------------------------------------------

/** Identificador canônico da capability de geração de mídia. */
export const MEDIA_GENERATE_CAPABILITY_ID = 'media.generate' as const;

// ---------------------------------------------------------------------------
// Tipos de modalidade
// ---------------------------------------------------------------------------

/**
 * Modalidades de mídia suportadas pelo contrato.
 * Cada modalidade pode ter adapters diferentes.
 */
export type MediaGenerationModality = 'image' | 'video' | 'audio';

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------

/**
 * Requisição canônica de geração de mídia.
 * Este shape é agnóstico ao provedor — detalhes de API ficam no adapter.
 */
export interface MediaGenerationRequest {
  /** Prompt textual descrevendo o que gerar. */
  prompt: string;

  /** Modalidade de mídia solicitada. Default: 'image'. */
  modality?: MediaGenerationModality;

  /** Quantidade de unidades a gerar. Default: 1. */
  count?: number;

  /**
   * Dica de tamanho/aspecto.
   * Formatos aceitos: '1024x1024', '16:9', 'landscape', 'portrait', 'square'.
   * O adapter converte para o formato do provedor.
   */
  sizeHint?: string | null;

  /**
   * Dica de estilo (ex: 'realistic', 'cartoon', 'watercolor', 'photographic').
   * O adapter pode ignorar se o provedor não suportar.
   */
  styleHint?: string | null;

  /** Contexto de sessão para rastreabilidade. */
  sessionId?: string | null;

  /** Contexto de workspace para escopo de artefatos. */
  workspaceId?: string | null;

  /** ID de correlação para tracing distribuído. */
  correlationId?: string | null;

  /**
   * Metadados extras que o caller pode passar.
   * O service não interpreta estes dados; o adapter pode usá-los.
   */
  providerHints?: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// Result (Output)
// ---------------------------------------------------------------------------

/**
 * Um artefato de mídia gerado.
 * Segue o princípio artifact-first: a saída é sempre um ZavorthArtifact,
 * nunca uma URL solta ou caminho de fonte.
 */
export interface GeneratedMediaArtifact {
  /** ID único do artefato dentro do Zavorth. */
  artifactId: string;

  /** Modalidade da mídia gerada. */
  modality: MediaGenerationModality;

  /** Tipo MIME do conteúdo (ex: 'image/png', 'video/mp4'). */
  contentType: string;

  /**
   * Referência ao armazenamento do artefato.
   * Pode ser um caminho local do Zavorth ou uma referência de storage.
   * Nunca é a URL crua do provedor.
   */
  storageRef: string;

  /** URL pública revisada, se disponível após política de exposição. */
  publicUrl?: string | null;

  /** Tamanho em bytes, se conhecido. */
  sizeBytes?: number | null;

  /** Timestamp ISO da geração. */
  generatedAt: string;

  /**
   * Evidência do provedor.
   * Contém metadados do provedor que originaram a geração.
   * Estes dados são apenas evidência — nunca autoridade.
   */
  providerEvidence: MediaProviderEvidence;
}

/**
 * Metadados de evidência do provedor.
 * Estes dados servem apenas para auditoria e debugging.
 * O domínio do Zavorth NUNCA usa estes dados como autoridade.
 */
export interface MediaProviderEvidence {
  /** Nome do provedor usado (ex: 'ai-gateway', 'openai', 'fal'). */
  providerId: string;

  /** Modelo usado pelo provedor, se conhecido. */
  modelId?: string | null;

  /** URL original retornada pelo provedor (apenas evidência). */
  sourceUrl?: string | null;

  /** Metadados extras do provedor. */
  metadata?: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// Policy Decision
// ---------------------------------------------------------------------------

/**
 * Decisão de política sobre a requisição de geração.
 * Executada antes de qualquer chamada ao adapter.
 */
export interface MediaGenerationPolicyDecision {
  /** Se a geração foi permitida. */
  allowed: boolean;

  /** Razão da decisão, em linguagem legível. */
  reason: string;

  /** Fonte da política que tomou a decisão. */
  policySource: 'content-safety' | 'budget-limit' | 'rate-limit' | 'capability-gate' | 'manual-block';

  /** Se o prompt foi modificado/sanitizado pela política. */
  promptModified: boolean;

  /** Prompt sanitizado, se houve modificação. */
  sanitizedPrompt?: string | null;
}

// ---------------------------------------------------------------------------
// Service Result
// ---------------------------------------------------------------------------

/**
 * Resultado completo da operação de geração de mídia.
 * Retornado pelo MediaGenerationService.
 */
export interface MediaGenerationResult {
  /** Se a operação foi bem-sucedida. */
  ok: boolean;

  /** Artefatos gerados (vazio se falhou). */
  artifacts: GeneratedMediaArtifact[];

  /** Decisão de política aplicada. */
  policyDecision: MediaGenerationPolicyDecision;

  /** Erro estruturado, se a operação falhou. */
  error?: MediaGenerationError | null;

  /** Resumo legível do resultado para o operador. */
  summary: string;

  /** Timestamp ISO do processamento. */
  processedAt: string;
}

/**
 * Erro estruturado de geração de mídia.
 * Sempre retornado como um shape Zavorth — nunca como exceção crua do provedor.
 */
export interface MediaGenerationError {
  /** Código de erro canônico do Zavorth. */
  code:
    | 'POLICY_BLOCKED'
    | 'PROVIDER_UNAVAILABLE'
    | 'PROVIDER_ERROR'
    | 'INVALID_REQUEST'
    | 'ARTIFACT_STORAGE_FAILED'
    | 'UNKNOWN_ERROR';

  /** Mensagem legível. */
  message: string;

  /** Detalhes de evidência do provedor (apenas para debugging). */
  providerDetail?: string | null;
}

// ---------------------------------------------------------------------------
// Adapter Interface
// ---------------------------------------------------------------------------

/**
 * Interface que cada adapter de geração de mídia deve implementar.
 * O adapter é responsável por:
 * - Converter o request Zavorth para o formato do provedor.
 * - Executar a chamada ao provedor.
 * - Converter a resposta do provedor para o formato Zavorth.
 * - NUNCA retornar dados do provedor como autoridade.
 */
export interface IMediaGenerationAdapter {
  /** Identificador do adapter (ex: 'ai-gateway-image', 'fal-image'). */
  readonly adapterId: string;

  /** Modalidades suportadas por este adapter. */
  readonly supportedModalities: MediaGenerationModality[];

  /**
   * Executa a geração de mídia no provedor subjacente.
   * @returns Array de resultados crus do adapter para conversão em artefatos.
   */
  generate(request: MediaGenerationRequest): Promise<AdapterGenerationOutput[]>;
}

/**
 * Resultado cru retornado por um adapter.
 * O service converte estes dados em GeneratedMediaArtifact.
 */
export interface AdapterGenerationOutput {
  /** Dados binários da mídia gerada, se disponíveis. */
  data?: Buffer | null;

  /** URL temporária do provedor (apenas evidência — será baixada e armazenada localmente). */
  sourceUrl?: string | null;

  /** Tipo MIME detectado pelo provedor. */
  contentType: string;

  /** Tamanho em bytes, se conhecido. */
  sizeBytes?: number | null;

  /** Metadados de evidência do provedor. */
  providerEvidence: MediaProviderEvidence;
}
