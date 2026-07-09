import { LLMIntentClassifier } from '../../src/cognitive-firewall/LLMIntentClassifier';
import type { ILlmProvider, LlmResponse } from '../../src/providers/ILlmProvider';

// Mock ProviderFactory
jest.mock('../../src/providers/ProviderFactory', () => ({
  ProviderFactory: {
    create: jest.fn(),
  },
}));

describe('LLMIntentClassifier', () => {
  let classifier: LLMIntentClassifier;
  let mockProvider: jest.Mocked<ILlmProvider>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockProvider = {
      name: 'mock',
      chat: jest.fn(),
    };

    const { ProviderFactory } = require('../../src/providers/ProviderFactory');
    ProviderFactory.create.mockReturnValue(mockProvider);

    classifier = new LLMIntentClassifier({
      providerName: 'mock',
      debug: true,
    });
  });

  describe('classify', () => {
    it('classifies file operation intent', async () => {
      const mockResponse: LlmResponse = {
        content: JSON.stringify({
          category: 'file_operation',
          confidence: 0.9,
          reason: 'File creation request',
        }),
        toolCalls: [],
        finishReason: 'stop',
      };

      mockProvider.chat.mockResolvedValue(mockResponse);

      const result = await classifier.classify('create a file called test.ts');

      expect(result.category).toBe('file_operation');
      expect(result.confidence).toBe(0.9);
      expect(result.isTrivialChat).toBe(false);
    });

    it('classifies conversation intent', async () => {
      const mockResponse: LlmResponse = {
        content: JSON.stringify({
          category: 'conversation',
          confidence: 0.95,
          reason: 'Simple greeting',
        }),
        toolCalls: [],
        finishReason: 'stop',
      };

      mockProvider.chat.mockResolvedValue(mockResponse);

      const result = await classifier.classify('oi');

      expect(result.category).toBe('conversation');
      expect(result.confidence).toBe(0.95);
      expect(result.isTrivialChat).toBe(true);
    });

    it('classifies execution intent', async () => {
      const mockResponse: LlmResponse = {
        content: JSON.stringify({
          category: 'execution',
          confidence: 0.85,
          reason: 'Command execution',
        }),
        toolCalls: [],
        finishReason: 'stop',
      };

      mockProvider.chat.mockResolvedValue(mockResponse);

      const result = await classifier.classify('run npm test');

      expect(result.category).toBe('execution');
      expect(result.confidence).toBe(0.85);
    });

    it('handles invalid JSON response', async () => {
      const mockResponse: LlmResponse = {
        content: 'This is not JSON',
        toolCalls: [],
        finishReason: 'stop',
      };

      mockProvider.chat.mockResolvedValue(mockResponse);

      const result = await classifier.classify('test message');

      expect(result.category).toBe('full_toolset');
      expect(result.confidence).toBe(0.3);
      expect(result.reason).toContain('failed');
    });

    it('handles invalid category', async () => {
      const mockResponse: LlmResponse = {
        content: JSON.stringify({
          category: 'invalid_category',
          confidence: 0.9,
          reason: 'Test',
        }),
        toolCalls: [],
        finishReason: 'stop',
      };

      mockProvider.chat.mockResolvedValue(mockResponse);

      const result = await classifier.classify('test message');

      expect(result.category).toBe('full_toolset');
      expect(result.confidence).toBe(0.3);
    });

    it('clamps confidence to valid range', async () => {
      const mockResponse: LlmResponse = {
        content: JSON.stringify({
          category: 'conversation',
          confidence: 1.5, // Invalid
          reason: 'Test',
        }),
        toolCalls: [],
        finishReason: 'stop',
      };

      mockProvider.chat.mockResolvedValue(mockResponse);

      const result = await classifier.classify('test message');

      expect(result.confidence).toBe(1); // Clamped to 1
    });

    it('handles LLM failure gracefully', async () => {
      mockProvider.chat.mockRejectedValue(new Error('LLM failed'));

      const result = await classifier.classify('test message');

      expect(result.category).toBe('full_toolset');
      expect(result.confidence).toBe(0.3);
      expect(result.reason).toContain('failed');
    });
  });

  describe('caching', () => {
    it('caches classification results', async () => {
      const mockResponse: LlmResponse = {
        content: JSON.stringify({
          category: 'file_operation',
          confidence: 0.9,
          reason: 'Test',
        }),
        toolCalls: [],
        finishReason: 'stop',
      };

      mockProvider.chat.mockResolvedValue(mockResponse);

      // First call
      await classifier.classify('create a file');
      expect(mockProvider.chat).toHaveBeenCalledTimes(1);

      // Second call should use cache
      await classifier.classify('create a file');
      expect(mockProvider.chat).toHaveBeenCalledTimes(1);
    });

    it('clears cache', async () => {
      const mockResponse: LlmResponse = {
        content: JSON.stringify({
          category: 'file_operation',
          confidence: 0.9,
          reason: 'Test',
        }),
        toolCalls: [],
        finishReason: 'stop',
      };

      mockProvider.chat.mockResolvedValue(mockResponse);

      await classifier.classify('create a file');
      expect(mockProvider.chat).toHaveBeenCalledTimes(1);

      classifier.clearCache();

      await classifier.classify('create a file');
      expect(mockProvider.chat).toHaveBeenCalledTimes(2);
    });

    it('returns cache stats', async () => {
      const stats = classifier.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('multilingual support', () => {
    it('classifies Spanish intent', async () => {
      const mockResponse: LlmResponse = {
        content: JSON.stringify({
          category: 'file_operation',
          confidence: 0.85,
          reason: 'Spanish file creation',
        }),
        toolCalls: [],
        finishReason: 'stop',
      };

      mockProvider.chat.mockResolvedValue(mockResponse);

      const result = await classifier.classify('crea un archivo de prueba');

      expect(result.category).toBe('file_operation');
      expect(result.confidence).toBe(0.85);
    });

    it('classifies French intent', async () => {
      const mockResponse: LlmResponse = {
        content: JSON.stringify({
          category: 'conversation',
          confidence: 0.9,
          reason: 'French greeting',
        }),
        toolCalls: [],
        finishReason: 'stop',
      };

      mockProvider.chat.mockResolvedValue(mockResponse);

      const result = await classifier.classify('bonjour');

      expect(result.category).toBe('conversation');
      expect(result.confidence).toBe(0.9);
    });

    it('classifies Japanese intent', async () => {
      const mockResponse: LlmResponse = {
        content: JSON.stringify({
          category: 'file_operation',
          confidence: 0.8,
          reason: 'Japanese file creation',
        }),
        toolCalls: [],
        finishReason: 'stop',
      };

      mockProvider.chat.mockResolvedValue(mockResponse);

      const result = await classifier.classify('ファイルを作成してください');

      expect(result.category).toBe('file_operation');
      expect(result.confidence).toBe(0.8);
    });
  });
});
