import { describe, it, expect } from 'vitest';
import {
  sanitizeModelId,
  sanitizeProviderId,
  sanitizeLabel,
  sanitizeBaseUrl,
  validateModelId,
  validateProviderId,
} from '../../../../src/services/providers/catalog/ModelIdSanitizer.js';

describe('ModelIdSanitizer', () => {
  describe('sanitizeModelId()', () => {
    it('should sanitize normal model IDs', () => {
      expect(sanitizeModelId('gpt-4o')).toBe('gpt-4o');
      expect(sanitizeModelId('claude-3-5-sonnet-latest')).toBe('claude-3-5-sonnet-latest');
      expect(sanitizeModelId('gemini-2.5-flash')).toBe('gemini-2.5-flash');
    });

    it('should strip control characters', () => {
      expect(sanitizeModelId('gpt\x00-4o')).toBe('gpt-4o');
      expect(sanitizeModelId('gpt\x1f-4o')).toBe('gpt-4o');
    });

    it('should replace spaces with hyphens', () => {
      expect(sanitizeModelId('gpt 4o')).toBe('gpt-4o');
      expect(sanitizeModelId('claude  sonnet')).toBe('claude-sonnet');
    });

    it('should remove blocked patterns', () => {
      expect(sanitizeModelId('gpt-4o<script>')).toBe('gpt-4oscript');
      expect(sanitizeModelId('model${injection}')).toBe('modelinjection');
    });

    it('should handle empty/null input', () => {
      expect(sanitizeModelId('')).toBe('');
      expect(sanitizeModelId(null as any)).toBe('');
      expect(sanitizeModelId(undefined as any)).toBe('');
    });

    it('should truncate long model IDs', () => {
      const longId = 'a'.repeat(300);
      expect(sanitizeModelId(longId).length).toBeLessThanOrEqual(256);
    });

    it('should preserve valid special characters', () => {
      expect(sanitizeModelId('accounts/fireworks/models/llama')).toBe('accounts/fireworks/models/llama');
      expect(sanitizeModelId('meta-llama/Llama-3.3-70B')).toBe('meta-llama/Llama-3.3-70B');
    });
  });

  describe('sanitizeProviderId()', () => {
    it('should normalize provider IDs', () => {
      expect(sanitizeProviderId('OpenAI')).toBe('openai');
      expect(sanitizeProviderId('MY-PROVIDER')).toBe('my-provider');
    });

    it('should remove invalid characters', () => {
      expect(sanitizeProviderId('my provider!')).toBe('my-provider');
      expect(sanitizeProviderId('test@provider')).toBe('test-provider');
    });

    it('should remove leading/trailing hyphens', () => {
      expect(sanitizeProviderId('-test-')).toBe('test');
      expect(sanitizeProviderId('--test--')).toBe('test');
    });

    it('should collapse multiple hyphens', () => {
      expect(sanitizeProviderId('my--provider')).toBe('my-provider');
    });

    it('should handle empty input', () => {
      expect(sanitizeProviderId('')).toBe('');
      expect(sanitizeProviderId(null as any)).toBe('');
    });
  });

  describe('sanitizeLabel()', () => {
    it('should preserve normal labels', () => {
      expect(sanitizeLabel('OpenAI')).toBe('OpenAI');
      expect(sanitizeLabel('My Provider')).toBe('My Provider');
    });

    it('should remove dangerous characters', () => {
      expect(sanitizeLabel('Test<script>')).toBe('Testscript');
      expect(sanitizeLabel('Test"quotes"')).toBe('Testquotes');
    });

    it('should handle empty input', () => {
      expect(sanitizeLabel('')).toBe('');
    });
  });

  describe('sanitizeBaseUrl()', () => {
    it('should accept valid HTTPS URLs', () => {
      expect(sanitizeBaseUrl('https://api.openai.com/v1')).toBe('https://api.openai.com/v1');
    });

    it('should accept valid HTTP URLs', () => {
      expect(sanitizeBaseUrl('http://example.com:8080/v1')).toBe('http://example.com:8080/v1');
    });

    it('should reject non-HTTP protocols', () => {
      expect(sanitizeBaseUrl('ftp://example.com')).toBe('');
      expect(sanitizeBaseUrl('javascript:alert(1)')).toBe('');
    });

    it('should reject localhost', () => {
      expect(sanitizeBaseUrl('http://localhost:8080')).toBe('');
      expect(sanitizeBaseUrl('http://127.0.0.1:8080')).toBe('');
    });

    it('should reject non-HTTP protocols', () => {
      expect(sanitizeBaseUrl('ftp://example.com')).toBe('');
      expect(sanitizeBaseUrl('javascript:alert(1)')).toBe('');
    });

    it('should reject localhost when not allowed', () => {
      expect(sanitizeBaseUrl('http://localhost:8080')).toBe('');
      expect(sanitizeBaseUrl('http://127.0.0.1:8080')).toBe('');
    });

    it('should handle empty input', () => {
      expect(sanitizeBaseUrl('')).toBe('');
    });
  });

  describe('validateModelId()', () => {
    it('should accept valid model IDs', () => {
      expect(validateModelId('gpt-4o').valid).toBe(true);
      expect(validateModelId('claude-3-5-sonnet-latest').valid).toBe(true);
    });

    it('should reject empty model IDs', () => {
      expect(validateModelId('').valid).toBe(false);
    });

    it('should reject model IDs with blocked patterns', () => {
      expect(validateModelId('model<script>').valid).toBe(false);
    });
  });

  describe('validateProviderId()', () => {
    it('should accept valid provider IDs', () => {
      expect(validateProviderId('openai').valid).toBe(true);
      expect(validateProviderId('my-provider').valid).toBe(true);
    });

    it('should reject uppercase provider IDs', () => {
      expect(validateProviderId('OpenAI').valid).toBe(false);
    });

    it('should reject provider IDs with special characters', () => {
      expect(validateProviderId('my_provider').valid).toBe(false);
    });

    it('should reject empty provider IDs', () => {
      expect(validateProviderId('').valid).toBe(false);
    });
  });
});
