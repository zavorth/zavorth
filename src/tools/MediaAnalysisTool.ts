import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '../providers/ILlmProvider.js';
import { MediaUnderstandingService } from '../services/MediaUnderstandingService.js';
import type {
  MediaUnderstandingRequest,
  MediaUnderstandingResult,
} from '../contracts/MediaUnderstandingContract.js';

export class MediaAnalysisTool extends BaseTool {
  public readonly name = 'analyze_media';

  public readonly description =
    'Analyzes media received as a Zavorth artifact. Can describe, extract text, classify, or answer questions about the content.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      artifact_id: {
        type: 'string',
        description: 'Zavorth media artifact id to analyze.',
      },
      analysis_type: {
        type: 'string',
        description: "Analysis type: 'describe', 'extract', 'classify', or 'qa'. Default: 'describe'.",
      },
      prompt: {
        type: 'string',
        description: 'Additional question or instruction to guide the analysis.',
      },
    },
    required: ['artifact_id'],
  };

  private readonly service: MediaUnderstandingService;

  constructor(options?: { service?: MediaUnderstandingService }) {
    super();
    this.service = options?.service || new MediaUnderstandingService();
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const request = this.buildRequest(args);
    const result = await this.service.analyze(request);

    if (!result.ok) {
      return this.formatErrorResponse(result);
    }

    return this.formatSuccessResponse(result);
  }

  private buildRequest(args: Record<string, unknown>): MediaUnderstandingRequest {
    const artifactId = String(args.artifact_id || args.artifactId || '').trim();
    const analysisType = String(args.analysis_type || args.analysisType || 'describe');
    const validTypes = ['describe', 'extract', 'classify', 'qa'];

    return {
      source: {
        kind: 'artifact-ref',
        artifactId,
      },
      analysisType: validTypes.includes(analysisType) ? analysisType as never : 'describe',
      prompt: typeof args.prompt === 'string' ? args.prompt : null,
    };
  }

  private formatSuccessResponse(result: MediaUnderstandingResult): string {
    if (!result.analysis) {
      return 'Analysis completed, but no structured result.';
    }

    const lines: string[] = [];
    const analysis = result.analysis;
    const meta = analysis.detectedMetadata;

    lines.push(`Analysis '${result.analysisType}' completed (${result.modality}).`);
    lines.push('');
    lines.push('Metadados:');
    lines.push(`- Tipo: ${meta.contentType}`);
    lines.push(`- Size: ${(meta.sizeBytes / 1024).toFixed(1)} KB`);
    if (meta.dimensions) {
      lines.push(`- Dimensoes: ${meta.dimensions.width}x${meta.dimensions.height}`);
    }
    if (meta.durationSeconds) {
      lines.push(`- Duraction: ${meta.durationSeconds.toFixed(1)}s`);
    }
    if (meta.hasVisibleText) {
      lines.push('- Visible text detected: yes');
    }
    if (meta.hasFaces) {
      lines.push('- Faces detected: yes');
    }
    if (meta.sensitiveContent) {
      lines.push(`- Sensitive content: ${meta.sensitiveContentReason || 'yes'}`);
    }
    lines.push('');

    switch (result.analysisType) {
      case 'extract':
        lines.push('Extracted text:');
        lines.push(analysis.extractedText || analysis.description);
        break;
      case 'classify':
        lines.push('Classifications:');
        if (analysis.classifications && analysis.classifications.length > 0) {
          for (const cls of analysis.classifications) {
            const confLabel = cls.confidence >= 0.8 ? 'alta' : cls.confidence >= 0.5 ? 'media' : 'baixa';
            lines.push(`- ${cls.label} (trust: ${confLabel})`);
          }
        } else {
          lines.push(analysis.description);
        }
        break;
      case 'qa':
        lines.push('Response:');
        lines.push(analysis.answer || analysis.description);
        break;
      case 'describe':
      default:
        lines.push('Descricao:');
        lines.push(analysis.description);
        break;
    }

    lines.push('');
    lines.push(`Provedor: ${analysis.providerEvidence.providerId}`);
    if (analysis.providerEvidence.modelId) {
      lines.push(`Modelo: ${analysis.providerEvidence.modelId}`);
    }
    if (analysis.providerEvidence.tokensUsed) {
      lines.push(`Tokens: ${analysis.providerEvidence.tokensUsed}`);
    }

    return lines.join('\n');
  }

  private formatErrorResponse(result: MediaUnderstandingResult): string {
    return `Media analysis failed: ${result.error?.message || result.summary}`;
  }
}
