import type { ChatMessage } from '../../../providers/ILlmProvider.js';
import { ZAVORTH_TOOL_SPEC_IMMUNE_MARKER } from '../../../providers/EmulatedToolCallingProviderDecorator.js';
import { BitmapTextRenderer } from './BitmapTextRenderer.js';
import {
  estimateImageTokens,
  estimateTextTokens,
  registry as capabilityRegistry,
} from './ImageTokenCostCalculator.js';

const MIN_BLOCK_CHARS = 800;

export interface CompressionOptions {
  modelName?: string;
  maxColumns?: number;
  minSavingsRatio?: number;
}

export interface CompressionResult {
  compressedMessages: ChatMessage[];
  totalBlocksFound: number;
  totalBlocksCompressed: number;
  totalTextTokensSaved: number;
  pagesRendered: number;
  modelSupported: boolean;
  bypassReason?: string;
}

export class ContextImageCompressor {
  private readonly renderer = new BitmapTextRenderer();

  async compress(
    messages: ChatMessage[],
    options?: CompressionOptions,
  ): Promise<CompressionResult> {
    const modelName = options?.modelName;
    const modelSupported = capabilityRegistry.isImageSupported(modelName ?? '');

    if (!modelSupported) {
      return {
        compressedMessages: messages,
        totalBlocksFound: 0,
        totalBlocksCompressed: 0,
        totalTextTokensSaved: 0,
        pagesRendered: 0,
        modelSupported: false,
        bypassReason: 'model_not_supported_for_image_compression',
      };
    }

    const caps = capabilityRegistry.getCapabilities(modelName ?? '');
    const maxColumns = options?.maxColumns ?? caps.pageGeometry.cols;
    const linesPerPage = caps.pageGeometry.linesPerPage;
    const minSavingsRatio = options?.minSavingsRatio ?? 0.5;

    let totalBlocksFound = 0;
    let totalBlocksCompressed = 0;
    let totalTextTokensSaved = 0;
    let pagesRendered = 0;
    const compressedMessages: ChatMessage[] = [];

    for (const message of messages) {
      if (message.role !== 'system' || !message.content) {
        compressedMessages.push(message);
        continue;
      }

      const blocks = this.splitIntoBlocks(message.content);
      const compressedContent: Array<{ type: 'text'; text: string } | { type: 'image'; base64: string; width: number; height: number }> = [];

      for (const block of blocks) {
        totalBlocksFound++;
        const chars = block.length;
        if (chars < MIN_BLOCK_CHARS || this.isImmuneBlock(block)) {
          compressedContent.push({ type: 'text', text: block });
          continue;
        }

        const pages = this.renderer.renderPages(block, maxColumns, linesPerPage);
        const totalImageTokens = pages.reduce(
          (sum, p) => sum + estimateImageTokens(p.width, p.height, modelName ?? ''),
          0,
        );
        const estimatedTextTokens = estimateTextTokens(block);
        const savingsRatio = estimatedTextTokens > 0
          ? (estimatedTextTokens - totalImageTokens) / estimatedTextTokens
          : 0;

        if (savingsRatio < minSavingsRatio) {
          compressedContent.push({ type: 'text', text: block });
          continue;
        }

        for (const page of pages) {
          compressedContent.push({
            type: 'image',
            base64: page.pngBase64,
            width: page.width,
            height: page.height,
          });
        }
        pagesRendered += pages.length;
        totalBlocksCompressed++;
        totalTextTokensSaved += estimatedTextTokens - totalImageTokens;
      }

      const hasImages = compressedContent.some((c) => c.type === 'image');
      if (!hasImages) {
        compressedMessages.push(message);
        continue;
      }

      const inlineData: Array<{ mimeType: string; data: string }> = [];
      const textParts: string[] = [];
      for (const part of compressedContent) {
        if (part.type === 'image') {
          textParts.push(`[context-image ${part.width}x${part.height}]`);
          inlineData.push({ mimeType: 'image/png', data: part.base64 });
        } else {
          textParts.push(part.text);
        }
      }

      compressedMessages.push({
        ...message,
        content: textParts.join('\n'),
        inlineData: inlineData.length > 0 ? inlineData : undefined,
      });
    }

    return {
      compressedMessages,
      totalBlocksFound,
      totalBlocksCompressed,
      totalTextTokensSaved,
      pagesRendered,
      modelSupported: true,
    };
  }

  private isImmuneBlock(block: string): boolean {
    return (
      block.includes(ZAVORTH_TOOL_SPEC_IMMUNE_MARKER) ||
      block.includes('__zavorth_emulated_tools__') ||
      block.includes('<tool_call>')
    );
  }

  private splitIntoBlocks(text: string): string[] {
    return text
      .split('\n\n')
      .map((b) => b.trim())
      .filter((b) => b.length > 0);
  }
}
