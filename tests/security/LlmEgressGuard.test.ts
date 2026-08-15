import {
  buildLlmEgressGuardMetadata,
  sanitizeLlmEgressPayload,
  wrapLlmProviderWithEgressGuard,
} from '../../src/security/LlmEgressGuard';
import type { ChatMessage, ToolDefinition } from '../../src/providers/ILlmProvider';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';


const root = resolve(__dirname, '..', '..');

describe('LlmEgressGuard', () => {
  it('redacts raw secrets from LLM messages and tool-call arguments', () => {
    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: 'Use OPENAI_API_KEY=sk-test12345678901234567890 to debug.',
      },
      {
        role: 'assistant',
        content: null,
        toolCalls: [
          {
            id: 'call-1',
            name: 'query_external_ai',
            arguments: {
              authorization: 'Bearer abcdefghijklmnopqrstuvwxyz123456',
            },
          },
        ],
      },
    ];

    const guarded = sanitizeLlmEgressPayload(messages);

    expect(guarded.report.redacted).toBe(true);
    expect(guarded.report.findingCount).toBeGreaterThanOrEqual(2);
    expect(guarded.report.policyReceipt).toEqual(expect.objectContaining({
      surface: 'llm-egress',
      action: 'allow_with_redaction',
      allowed: true,
    }));
    expect(JSON.stringify(guarded.messages)).not.toContain('sk-test12345678901234567890');
    expect(JSON.stringify(guarded.messages)).not.toContain('abcdefghijklmnopqrstuvwxyz123456');
    expect(JSON.stringify(guarded.messages)).toContain('[redacted-secret]');
    expect(messages[0].content).toContain('sk-test12345678901234567890');
  });

  it('redacts tool schema text without destroying sensitive parameter names', () => {
    const tools: ToolDefinition[] = [
      {
        name: 'configure',
        description: 'Configure with token=abcd1234supersecret',
        parameters: {
          type: 'object',
          required: ['apiKey'],
          properties: {
            apiKey: {
              type: 'string',
              description: 'Use secret=abcd1234supersecret only as a placeholder example',
            },
          },
        },
      },
    ];

    const guarded = sanitizeLlmEgressPayload([{ role: 'user', content: 'configure' }], tools);

    expect(guarded.report.redacted).toBe(true);
    expect(buildLlmEgressGuardMetadata(guarded.report)).toEqual(expect.objectContaining({
      llmEgressGuard: expect.objectContaining({
        policyReceipt: expect.objectContaining({
          action: 'allow_with_redaction',
        }),
      }),
    }));
    expect(guarded.tools?.[0].parameters.properties.apiKey).toEqual(expect.objectContaining({
      type: 'string',
      description: expect.stringContaining('[redacted-secret]'),
    }));
    expect(guarded.tools?.[0].parameters.required).toEqual(['apiKey']);
  });

  it('wraps providers so direct ProviderFactory callers also receive sanitized payloads', async () => {
    const provider = {
      name: 'test-provider',
      chat: jest.fn().mockResolvedValue({
        content: 'ok',
        toolCalls: [],
        finishReason: 'stop',
      }),
    };
    const wrapped = wrapLlmProviderWithEgressGuard(provider);

    await wrapped.chat([
      {
        role: 'user',
        content: 'Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456',
      },
    ]);

    expect(wrapped.name).toBe('test-provider');
    expect(provider.chat).toHaveBeenCalledWith(
      [expect.objectContaining({
        content: expect.stringContaining('[redacted-secret]'),
      })],
      undefined,
      undefined,
    );
    expect(JSON.stringify(provider.chat.mock.calls[0][0])).not.toContain('abcdefghijklmnopqrstuvwxyz123456');
  });

  it('keeps ProviderFactory wired to the egress guard for direct provider callers', () => {
    const source = readFileSync(resolve(root, 'src/providers/ProviderFactory.ts'), 'utf8');

    expect(source).toContain('wrapLlmProviderWithEgressGuard');
  });
});
