import { ContextImageCompressor } from '../../../../src/services/llm/compression/ContextImageCompressor';
import { registry } from '../../../../src/services/llm/compression/ImageTokenCostCalculator';
import type { ChatMessage } from '../../../../src/providers/ILlmProvider';

describe('ContextImageCompressor', () => {
  let compressor: ContextImageCompressor;

  beforeEach(() => {
    compressor = new ContextImageCompressor();
    registry.registerProvider('claude-sonnet-4', {
      supportsImages: true,
      billing: { type: 'patch', patchSize: 28, longEdgeMax: 1568, tokenCap: 1568 },
      pageGeometry: { cols: 312, widthPx: 1568, heightPx: 728, linesPerPage: 90 },
    });
  });

  it('compresses large system message blocks for supported models', async () => {
    const largeContent = 'word '.repeat(500);
    const messages: ChatMessage[] = [
      { role: 'system', content: largeContent },
      { role: 'user', content: 'hello' },
    ];

    const result = await compressor.compress(messages, { modelName: 'claude-sonnet-4' });
    expect(result.totalBlocksFound).toBeGreaterThanOrEqual(1);
    expect(result.totalBlocksCompressed).toBeGreaterThanOrEqual(1);
    expect(result.totalTextTokensSaved).toBeGreaterThan(0);
    expect(result.compressedMessages.length).toBe(2);
    expect(result.modelSupported).toBe(true);
  });

  it('skips compression for unsupported models and fails closed for Gemini', async () => {
    const largeContent = 'word '.repeat(500);
    const messages: ChatMessage[] = [
      { role: 'system', content: largeContent },
    ];

    const result = await compressor.compress(messages, { modelName: 'gemini-2.5-flash' });
    expect(result.totalBlocksCompressed).toBe(0);
    expect(result.modelSupported).toBe(false);
    expect(result.bypassReason).toBe('model_not_supported_for_image_compression');
  });

  it('does not compress immune tool emulation blocks', async () => {
    const emulationBlock = '__zavorth_emulated_tools__\nAvailable tools: execute_command, read_file\n' + 'param '.repeat(200);
    const messages: ChatMessage[] = [
      { role: 'system', content: emulationBlock },
      { role: 'user', content: 'hello' },
    ];

    const result = await compressor.compress(messages, { modelName: 'claude-sonnet-4' });
    expect(result.totalBlocksCompressed).toBe(0);
    expect(result.compressedMessages[0].content).toContain('__zavorth_emulated_tools__');
    expect(result.compressedMessages[0].inlineData).toBeUndefined();
  });

  it('does not compress small blocks', async () => {
    const messages: ChatMessage[] = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'hello' },
    ];

    const result = await compressor.compress(messages, { modelName: 'claude-sonnet-4' });
    expect(result.totalBlocksCompressed).toBe(0);
  });

  it('does not compress user messages', async () => {
    const largeContent = 'word '.repeat(500);
    const messages: ChatMessage[] = [
      { role: 'user', content: largeContent },
    ];

    const result = await compressor.compress(messages, { modelName: 'claude-sonnet-4' });
    expect(result.totalBlocksCompressed).toBe(0);
  });

  it('preserves inlineData from existing messages', async () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'hello', inlineData: [{ mimeType: 'image/png', data: 'abc' }] },
    ];

    const result = await compressor.compress(messages, { modelName: 'claude-sonnet-4' });
    expect(result.compressedMessages[0].inlineData).toBeDefined();
  });

  it('works with certified catalog models like Claude 3.7 Sonnet', async () => {
    const largeContent = 'word '.repeat(500);
    const messages: ChatMessage[] = [
      { role: 'system', content: largeContent },
    ];

    const result = await compressor.compress(messages, { modelName: 'claude-3-7-sonnet-20250219' });
    expect(result.totalBlocksFound).toBeGreaterThanOrEqual(1);
    expect(result.modelSupported).toBe(true);
  });
});
