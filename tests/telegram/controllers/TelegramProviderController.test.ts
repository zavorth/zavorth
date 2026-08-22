import { TelegramProviderController } from '../../../src/telegram/controllers/TelegramProviderController';
import { config } from '../../../src/config/index';
import { ProviderFactory } from '../../../src/providers/ProviderFactory';

describe('TelegramProviderController', () => {
  const originalProvider = config.llmProvider;
  const originalGeminiModel = config.geminiModel;
  const originalGeminiDefaultModel = config.geminiDefaultModel;
  const originalGemmaModel = config.gemmaModel;

  afterEach(() => {
    (config as unknown as Record<string, unknown>).llmProvider = originalProvider;
    (config as unknown as Record<string, unknown>).geminiModel = originalGeminiModel;
    (config as unknown as Record<string, unknown>).geminiDefaultModel = originalGeminiDefaultModel;
    (config as unknown as Record<string, unknown>).gemmaModel = originalGemmaModel;
    jest.restoreAllMocks();
  });

  it('switches providers and normalizes the puter alias to qwen', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as unknown as { reply: jest.Mock };
    const clearCache = jest.spyOn(ProviderFactory, 'clearCache').mockImplementation(() => {});
    const controller = new TelegramProviderController();

    await controller.handleModel(ctx, 'puter');

    expect(clearCache).toHaveBeenCalled();
    expect(config.llmProvider).toBe('qwen');
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('**Qwen via Puter**');
  });

  it('rejects unknown providers without changing config', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as unknown as { reply: jest.Mock };
    const controller = new TelegramProviderController();

    await controller.handleModel(ctx, 'claude');

    expect(config.llmProvider).toBe(originalProvider);
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toMatch(
      /Nao reconheci esse provider|I did not recognize this provider/i,
    );
  });

  it('shows usage when no provider name is supplied', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as unknown as { reply: jest.Mock };
    const controller = new TelegramProviderController();

    await controller.handleModel(ctx, '');

    const reply = String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'));
    expect(reply).toContain('LLM roles:');
    expect(reply).toMatch(/\/model\s+default\s+<provider\/model>/i);
    expect(reply).toMatch(/\/model\s+strong\s+<provider\/model>/i);
  });

  it('switches to Gemma 2 through the Gemini provider alias', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as unknown as { reply: jest.Mock };
    (config as unknown as Record<string, unknown>).gemmaModel = 'gemma-2-27b-it';
    const clearCache = jest.spyOn(ProviderFactory, 'clearCache').mockImplementation(() => {});
    const controller = new TelegramProviderController();

    await controller.handleModel(ctx, 'gemma');

    expect(clearCache).toHaveBeenCalled();
    expect(config.llmProvider).toBe('gemini');
    expect(config.geminiModel).toBe('gemma-2-27b-it');
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('Gemma 2');
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toMatch(
      /Provider efetivo: `gemini`|Effective provider: `gemini`/i,
    );
  });

  it('accepts a direct Gemma model id and keeps the Gemini provider', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as unknown as { reply: jest.Mock };
    const clearCache = jest.spyOn(ProviderFactory, 'clearCache').mockImplementation(() => {});
    const controller = new TelegramProviderController();

    await controller.handleModel(ctx, 'gemma-2-27b-it');

    expect(clearCache).toHaveBeenCalled();
    expect(config.llmProvider).toBe('gemini');
    expect(config.geminiModel).toBe('gemma-2-27b-it');
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toMatch(
      /Modelo ativo: `gemma-2-27b-it`|Active model: `gemma-2-27b-it`/i,
    );
  });
});
