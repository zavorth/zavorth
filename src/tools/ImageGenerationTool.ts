/**
 * ImageGenerationTool - Zavorth-native LLM image generation tool.
 *
 * This is the agent/LLM-facing interface for the `media.generate` capability.
 * It exposes image generation as a JSON Schema tool the LLM can invoke.
 *
 * Responsibilities:
 * - Define the parameter schema for the LLM.
 * - Convert LLM arguments into a MediaGenerationRequest.
 * - Invoke MediaGenerationService.
 * - Return a readable summary for the LLM with artifact references.
 *
 * The tool never:
 * - Talks directly to providers.
 * - Returns raw URLs as the canonical result.
 * - Bypasses security policies.
 *
 * Architecture references:
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

// Tool

export class ImageGenerationTool extends BaseTool {
  public readonly name = 'generate_image';

  public readonly description =
    'Generates images from a text prompt. Returns references to generated image artifacts stored locally by Zavorth.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description: 'Detailed text description of the image to generate.',
      },
      count: {
        type: 'number',
        description: 'Number of images to generate (1-4). Default: 1.',
      },
      size: {
        type: 'string',
        description: "Image size or aspect. Examples: '1024x1024', 'landscape', 'portrait', 'square', '16:9'.",
      },
      style: {
        type: 'string',
        description: "Image visual style. Examples: 'realistic', 'cartoon', 'watercolor', 'photographic', 'digital-art'.",
      },
    },
    required: ['prompt'],
  };

  private readonly service: MediaGenerationService;

  constructor(options?: { service?: MediaGenerationService }) {
    super();
    this.service = options?.service || new MediaGenerationService();
  }

  // Execution

  public async execute(args: Record<string, unknown>): Promise<string> {
    const request = this.buildRequest(args);
    const result = await this.service.generate(request);

    if (!result.ok) {
      return this.formatErrorResponse(result.error?.message || result.summary);
    }

    return this.formatSuccessResponse(result);
  }

  // Argument conversion

  private buildRequest(args: Record<string, unknown>): MediaGenerationRequest {
    return {
      prompt: String(args.prompt || ''),
      modality: 'image',
      count: typeof args.count === 'number' ? args.count : 1,
      sizeHint: typeof args.size === 'string' ? args.size : null,
      styleHint: typeof args.style === 'string' ? args.style : null,
    };
  }

  // Response formatting

  private formatSuccessResponse(result: import('../contracts/MediaGenerationContract.js').MediaGenerationResult): string {
    const lines: string[] = [];
    lines.push(`${result.artifacts.length} image(s) generated successfully.`);
    lines.push('');

    for (let i = 0; i < result.artifacts.length; i++) {
      const artifact = result.artifacts[i];
      lines.push(`Image ${i + 1}:`);
      lines.push(`  - Artifact ID: ${artifact.artifactId}`);
      lines.push(`  - Storage: ${artifact.storageRef}`);
      lines.push(`  - Type: ${artifact.contentType}`);
      if (artifact.sizeBytes) {
        lines.push(`  - Size: ${(artifact.sizeBytes / 1024).toFixed(1)} KB`);
      }
      lines.push(`  - Provider: ${artifact.providerEvidence.providerId}`);
      if (artifact.providerEvidence.modelId) {
        lines.push(`  - Model: ${artifact.providerEvidence.modelId}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  private formatErrorResponse(message: string): string {
    return `Image generation failed: ${message}`;
  }
}
