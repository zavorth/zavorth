import { TelegramProviderController } from '../../../src/telegram/controllers/TelegramProviderController';
import { config } from '../../../src/config/index';
import { ProviderFactory } from '../../../src/providers/ProviderFactory';

describe('TelegramProviderController', () => {
  const originalProvider = config.llmProvider;
  const originalGeminiModel = config.geminiModel;
  const originalGeminiDefaultModel = config.geminiDefaultModel;
  const originalGemmaModel = config.gemmaModel;

  afterEach(() => {
    (config as any).llmProvider = originalProvider;
    (config as any).geminiModel = originalGeminiModel;
    (config as any).geminiDefaultModel = originalGeminiDefaultModel;
    (config as any).gemmaModel = originalGemmaModel;
    jest.restoreAllMocks();
  });

  it('switches providers and normalizes the puter alias to qwen', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const clearCache = jest.spyOn(ProviderFactory, 'clearCache').mockImplementation(() => {});
    const controller = new TelegramProviderController();

    await controller.handleModel(ctx, 'puter');

    expect(clearCache).toHaveBeenCalled();
    expect(config.llmProvider).toBe('qwen');
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('**Qwen via Puter**'));
  });

  it('rejects unknown providers without changing config', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const controller = new TelegramProviderController();

    await controller.handleModel(ctx, 'claude');

    expect(config.llmProvider).toBe(originalProvider);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Nao reconheci esse provider'));
  });

  it('shows usage when no provider name is supplied', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const controller = new TelegramProviderController();

    await controller.handleModel(ctx, '');

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('/model <nome>'));
  });

  it('switches to Gemma 2 through the Gemini provider alias', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    (config as any).gemmaModel = 'gemma-2-27b-it';
    const clearCache = jest.spyOn(ProviderFactory, 'clearCache').mockImplementation(() => {});
    const controller = new TelegramProviderController();

    await controller.handleModel(ctx, 'gemma');

    expect(clearCache).toHaveBeenCalled();
    expect(config.llmProvider).toBe('gemini');
    expect(config.geminiModel).toBe('gemma-2-27b-it');
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Gemma 2'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Provider efetivo: `gemini`'));
  });

  it('accepts a direct Gemma model id and keeps the Gemini provider', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const clearCache = jest.spyOn(ProviderFactory, 'clearCache').mockImplementation(() => {});
    const controller = new TelegramProviderController();

    await controller.handleModel(ctx, 'gemma-2-27b-it');

    expect(clearCache).toHaveBeenCalled();
    expect(config.llmProvider).toBe('gemini');
    expect(config.geminiModel).toBe('gemma-2-27b-it');
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Modelo ativo: `gemma-2-27b-it`'));
  });
});
