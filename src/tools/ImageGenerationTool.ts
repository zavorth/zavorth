/**
 * ImageGenerationTool — Tool Zavorth-nativa para geração de imagens via LLM.
 *
 * Esta tool é a interface voltada ao agente/LLM para a capability `media.generate`.
 * Ela expõe a geração de imagens como uma ferramenta JSON Schema que o LLM pode invocar.
 *
 * Responsabilidades:
 * - Definir o schema de parâmetros para o LLM.
 * - Converter os argumentos do LLM em um MediaGenerationRequest.
 * - Invocar o MediaGenerationService.
 * - Retornar um resumo legível para o LLM com referências aos artefatos.
 *
 * A tool NUNCA:
 * - Interage diretamente com provedores.
 * - Retorna URLs cruas como resultado canônico.
 * - Contorna políticas de segurança.
 *
 * Referências arquiteturais:
 * - docs/native-absorption-execution-plan.md
 * - src/contracts/MediaGenerationContract.ts
 * - src/services/MediaGenerationService.ts
 * - src/tools/BaseTool.ts
 *
 * @module tools/ImageGenerationTool
 * @since 2026-05-03
 * @author Zavorth Core Team
 */

import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '../providers/ILlmProvider.js';
import { MediaGenerationService } from '../services/MediaGenerationService.js';
import type { MediaGenerationRequest } from '../contracts/MediaGenerationContract.js';

// ---------------------------------------------------------------------------
// Tool
// ---------------------------------------------------------------------------

export class ImageGenerationTool extends BaseTool {
  public readonly name = 'generate_image';

  public readonly description =
    'Gera imagens a partir de um prompt textual. Retorna referências aos artefatos de imagem gerados no storage local do Zavorth.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description: 'Descrição textual detalhada da imagem a ser gerada.',
      },
      count: {
        type: 'number',
        description: 'Quantidade de imagens a gerar (1-4). Default: 1.',
      },
      size: {
        type: 'string',
        description: "Tamanho ou aspecto da imagem. Exemplos: '1024x1024', 'landscape', 'portrait', 'square', '16:9'.",
      },
      style: {
        type: 'string',
        description: "Estilo visual da imagem. Exemplos: 'realistic', 'cartoon', 'watercolor', 'photographic', 'digital-art'.",
      },
    },
    required: ['prompt'],
  };

  private readonly service: MediaGenerationService;

  constructor(options?: { service?: MediaGenerationService }) {
    super();
    this.service = options?.service || new MediaGenerationService();
  }

  // -------------------------------------------------------------------------
  // Execução
  // -------------------------------------------------------------------------

  public async execute(args: Record<string, unknown>): Promise<string> {
    const request = this.buildRequest(args);
    const result = await this.service.generate(request);

    if (!result.ok) {
      return this.formatErrorResponse(result.error?.message || result.summary);
    }

    return this.formatSuccessResponse(result);
  }

  // -------------------------------------------------------------------------
  // Conversão de argumentos
  // -------------------------------------------------------------------------

  private buildRequest(args: Record<string, unknown>): MediaGenerationRequest {
    return {
      prompt: String(args.prompt || ''),
      modality: 'image',
      count: typeof args.count === 'number' ? args.count : 1,
      sizeHint: typeof args.size === 'string' ? args.size : null,
      styleHint: typeof args.style === 'string' ? args.style : null,
    };
  }

  // -------------------------------------------------------------------------
  // Formatação de resposta
  // -------------------------------------------------------------------------

  private formatSuccessResponse(result: import('../contracts/MediaGenerationContract.js').MediaGenerationResult): string {
    const lines: string[] = [];
    lines.push(`✅ ${result.artifacts.length} imagem(ns) gerada(s) com sucesso.`);
    lines.push('');

    for (let i = 0; i < result.artifacts.length; i++) {
      const artifact = result.artifacts[i];
      lines.push(`📷 Imagem ${i + 1}:`);
      lines.push(`  - Artifact ID: ${artifact.artifactId}`);
      lines.push(`  - Storage: ${artifact.storageRef}`);
      lines.push(`  - Tipo: ${artifact.contentType}`);
      if (artifact.sizeBytes) {
        lines.push(`  - Tamanho: ${(artifact.sizeBytes / 1024).toFixed(1)} KB`);
      }
      lines.push(`  - Provedor: ${artifact.providerEvidence.providerId}`);
      if (artifact.providerEvidence.modelId) {
        lines.push(`  - Modelo: ${artifact.providerEvidence.modelId}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  private formatErrorResponse(message: string): string {
    return `❌ Geração de imagem falhou: ${message}`;
  }
}
