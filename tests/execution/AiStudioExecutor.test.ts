import { GoogleGenerativeAI } from '@google/generative-ai';
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn(),
  SchemaType: {
    OBJECT: 'OBJECT',
    STRING: 'STRING',
  },
}));

import { AiStudioExecutor } from '../../src/execution/AiStudioExecutor';
import { config } from '../../src/config/index';

describe('AiStudioExecutor', () => {
  const originalApiKey = config.aiStudioApiKey;
  const originalGeminiApiKey = config.geminiApiKey;
  const originalModel = config.aiStudioModel;
  const originalRounds = config.aiStudioMaxToolRounds;

  function buildRequest(overrides: Record<string, any> = {}) {
    return {
      execution_id: 'exec-aistudio-1',
      task_id: 'task-aistudio-1',
      executor: 'aistudio',
      workspace: 'C:/workspace/zavorth',
      objective: 'Teste do Google AI Studio',
      instructions: ['Explique rapidamente o que e o Zavorth.'],
      allowed_paths: ['C:/workspace/zavorth'],
      blocked_paths: [],
      allowed_commands: [],
      blocked_commands: [],
      timeout_seconds: 120,
      dry_run: false,
      requires_backup: false,
      metadata: {},
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    (config as any).aiStudioApiKey = originalApiKey;
    (config as any).geminiApiKey = originalGeminiApiKey;
    (config as any).aiStudioModel = originalModel;
    (config as any).aiStudioMaxToolRounds = originalRounds;
  });

  afterAll(() => {
    (config as any).aiStudioApiKey = originalApiKey;
    (config as any).geminiApiKey = originalGeminiApiKey;
    (config as any).aiStudioModel = originalModel;
    (config as any).aiStudioMaxToolRounds = originalRounds;
  });

  it('returns a friendly auth-missing error when AI Studio is not configured', async () => {
    (config as any).aiStudioApiKey = '';
    (config as any).geminiApiKey = '';
    const executor = new AiStudioExecutor();

    const result = await executor.execute(buildRequest() as any);

    expect(result.success).toBe(false);
    expect(result.error_code).toBe('AISTUDIO_AUTH_MISSING');
    expect(result.error_message).toContain('AISTUDIO_API_KEY');
  });

  it('does not inject built-in tools from free-text news keywords', async () => {
    (config as any).aiStudioApiKey = 'test-key';
    const generateContent = jest.fn().mockResolvedValue({
      response: {
        candidates: [
          {
            content: {
              role: 'model',
              parts: [{ text: 'Resumo sem tools automaticas.' }],
            },
          },
        ],
      },
    });
    const getGenerativeModel = jest.fn().mockReturnValue({ generateContent });
    (GoogleGenerativeAI as jest.Mock).mockImplementation(() => ({
      getGenerativeModel,
    }));
    const executor = new AiStudioExecutor();

    const result = await executor.execute(
      buildRequest({
        instructions: ['Search the main AI news for today.'],
      }) as any,
    );

    expect(result.success).toBe(true);
    expect(getGenerativeModel).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: [],
      }),
    );
  });

  it('requests approval when tools are requested via explicit structured tools= token', async () => {
    (config as any).aiStudioApiKey = 'test-key';
    const executor = new AiStudioExecutor();

    const result = await executor.execute(
      buildRequest({
        instructions: ['tools=google_search Search the main AI news for today.'],
      }) as any,
    );

    expect(result.success).toBe(false);
    expect(result.error_code).toBe('AISTUDIO_BUILTIN_TOOL_PERMISSION_REQUIRED');
    expect(result.metadata).toEqual(
      expect.objectContaining({
        requested_tools: ['google_search'],
      }),
    );
  });

  it('returns a structured summary on success', async () => {
    (config as any).aiStudioApiKey = 'test-key';
    (config as any).aiStudioModel = 'gemini-2.5-pro';
    const generateContent = jest.fn().mockResolvedValue({
      response: {
        candidates: [
          {
            content: {
              role: 'model',
              parts: [{ text: 'Resumo final do Zavorth.' }],
            },
            groundingMetadata: {
              groundingChunks: [
                {
                  web: {
                    title: 'Zavorth Docs',
                    uri: 'https://example.com/zavorth',
                  },
                },
              ],
            },
          },
        ],
      },
    });
    const getGenerativeModel = jest.fn().mockReturnValue({ generateContent });
    (GoogleGenerativeAI as jest.Mock).mockImplementation(() => ({
      getGenerativeModel,
    }));

    const executor = new AiStudioExecutor();
    const result = await executor.execute(buildRequest() as any);

    expect(result.success).toBe(true);
    expect(result.stdout).toContain('Google AI Studio completed the task.');
    expect(result.stdout).toContain('Model: gemini-2.5-pro');
    expect(result.stdout).toContain('Resumo final do Zavorth.');
    expect(result.stdout).toContain('Zavorth Docs');
    expect(result.metadata).toEqual(
      expect.objectContaining({
        aistudio_model: 'gemini-2.5-pro',
      }),
    );
    expect(getGenerativeModel).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-2.5-pro',
      }),
    );
  });

  it('normalizes AI Studio candidate parts before reading response fields', async () => {
    (config as any).aiStudioApiKey = 'test-key';
    const generateContent = jest.fn().mockResolvedValue({
      response: {
        candidates: [
          {
            content: {
              role: 'model',
              parts: [null, { text: 'Resumo seguro.' }, { codeExecutionResult: { output: 42 } }],
            },
            groundingMetadata: {
              groundingChunks: [{ web: { title: 123, uri: 'https://example.com/source' } }],
            },
          },
        ],
      },
    });
    const getGenerativeModel = jest.fn().mockReturnValue({ generateContent });
    (GoogleGenerativeAI as jest.Mock).mockImplementation(() => ({
      getGenerativeModel,
    }));

    const executor = new AiStudioExecutor();
    const result = await executor.execute(buildRequest() as any);

    expect(result.success).toBe(true);
    expect(result.stdout).toContain('Resumo seguro.');
    expect(result.stdout).toContain('42');
    expect(result.stdout).toContain('https://example.com/source');
    expect(result.metadata.grounding_metadata).toEqual({
      groundingChunks: [
        {
          web: {
            title: '123',
            uri: 'https://example.com/source',
          },
        },
      ],
    });
  });

  it('uses the supported googleSearch tool when web search is approved', async () => {
    (config as any).aiStudioApiKey = 'test-key';
    const generateContent = jest.fn().mockResolvedValue({
      response: {
        candidates: [
          {
            content: {
              role: 'model',
              parts: [{ text: 'Noticias resumidas.' }],
            },
          },
        ],
      },
    });
    const getGenerativeModel = jest.fn().mockReturnValue({ generateContent });
    (GoogleGenerativeAI as jest.Mock).mockImplementation(() => ({
      getGenerativeModel,
    }));

    const executor = new AiStudioExecutor();
    const result = await executor.execute(
      buildRequest({
        instructions: ['Search the main technology news for today.'],
        metadata: {
          aistudio_allowed_tools: ['google_search'],
        },
      }) as any,
    );

    expect(result.success).toBe(true);
    expect(getGenerativeModel).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: [{ googleSearch: {} }],
      }),
    );
  });

  it('returns a clear unsupported message when external services are requested explicitly', async () => {
    (config as any).aiStudioApiKey = 'test-key';
    const executor = new AiStudioExecutor();
    const result = await executor.execute(
      buildRequest({
        instructions: ['services=drive Resuma esse pedido usando um documento do Drive.'],
      }) as any,
    );

    expect(result.success).toBe(false);
    expect(result.error_code).toBe('AISTUDIO_EXTERNAL_SERVICE_UNSUPPORTED');
    expect(result.metadata).toEqual(
      expect.objectContaining({
        requested_services: ['drive'],
        supported_tools: ['google_search', 'code_execution'],
      }),
    );
    expect(result.error_message).toContain('supports only native Gemini API tools');
  });
});
