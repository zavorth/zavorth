
import {
  GeminiInteractionsProviderAdapter,
  mapGeminiInteractionToReceipt,
} from '../../src/providers/GeminiInteractionsProviderAdapter';
import { config } from '../../src/config';

describe('GeminiInteractionsProviderAdapter', () => {
  const originalEnabled = (config as any).geminiInteractionsEnabled;
  const originalEnv = process.env.ZAVORTH_GEMINI_INTERACTIONS_ENABLED;

  afterEach(() => {
    (config as any).geminiInteractionsEnabled = originalEnabled;
    if (originalEnv === undefined) {
      delete process.env.ZAVORTH_GEMINI_INTERACTIONS_ENABLED;
    } else {
      process.env.ZAVORTH_GEMINI_INTERACTIONS_ENABLED = originalEnv;
    }
  });

  it('maps Interactions API steps to a governed receipt timeline', () => {
    const receipt = mapGeminiInteractionToReceipt({
      id: 'interactions/123',
      steps: [
        { type: 'user_input', text: 'Run checks' },
        { type: 'thought', text: 'Need a safe plan' },
        { type: 'function_call', function_call: { name: 'preview', args: { risk: 'low' } } },
        { type: 'model_output', text: 'Done' },
      ],
    }, 'gemini-2.5-flash', 'interactions/old', false);

    expect(receipt).toMatchObject({
      provider: 'gemini-interactions',
      model: 'gemini-2.5-flash',
      interactionId: 'interactions/123',
      previousInteractionId: 'interactions/old',
      storedServerSide: false,
    });
    expect(receipt.steps.map((step) => step.kind)).toEqual([
      'user_input',
      'thought',
      'function_call',
      'model_output',
    ]);
    expect(receipt.steps[2].toolName).toBe('preview');
  });

  it('calls Interactions API only when explicitly enabled', async () => {
    (config as any).geminiInteractionsEnabled = true;
    const fetchImpl = jest.fn(async () => new Response(JSON.stringify({
      id: 'interactions/ok',
      output_text: 'hello',
      steps: [{ type: 'model_output', text: 'hello' }],
    }), { status: 200, headers: { 'content-type': 'application/json' } })) as any;
    const provider = new GeminiInteractionsProviderAdapter({
      apiKey: 'test-key',
      baseUrl: 'https://example.test/v1beta',
      fetchImpl,
    });

    const result = await provider.chat([{ role: 'user', content: 'oi' }]);

    expect(result.content).toBe('hello');
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.test/v1beta/interactions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-goog-api-key': 'test-key' }),
      }),
    );
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).store).toBe(false);
  });

  it('fails closed when the beta route is not enabled', async () => {
    (config as any).geminiInteractionsEnabled = false;
    const provider = new GeminiInteractionsProviderAdapter({ apiKey: 'test-key' });
    await expect(provider.chat([{ role: 'user', content: 'oi' }])).rejects.toThrow(/desabilitada/i);
  });
});
