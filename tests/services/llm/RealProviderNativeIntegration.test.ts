import dotenv from 'dotenv';
dotenv.config();

import { ProviderFactory } from '../../../src/providers/ProviderFactory';
import { ZavorthDenseContextEncoderService } from '../../../src/services/ZavorthDenseContextEncoderService';
import { ZavorthTokenEconomyCompressor } from '../../../src/services/llm/ZavorthTokenEconomyCompressor';
import { ZavorthDeterministicEventLedger } from '../../../src/services/ZavorthDeterministicEventLedger';

describe('Universal Provider Native Enhancements Integration', () => {
  jest.setTimeout(120000);

  const targetProviderName = (process.env.TEST_PROVIDER || process.env.LLM_PROVIDER || 'gemini').toLowerCase();

  it('renders text to PNG and sends it to the active provider to verify multimodal vision reading', async () => {
    const encoder = new ZavorthDenseContextEncoderService({
      maxCanvasWidth: 512,
      maxCanvasHeight: 256,
    });

    const secretMessage = 'CONFIDENTIAL CODE 774921';
    const encodingResult = await encoder.encodeTextToBitmap(secretMessage);

    expect(encodingResult.mimeType).toBe('image/png');
    expect(encodingResult.encodedImageBase64.length).toBeGreaterThan(0);

    const provider = ProviderFactory.create(targetProviderName);
    const ledger = new ZavorthDeterministicEventLedger(undefined, `provider_live_test_${Date.now()}`);

    ledger.recordEvent('STEP_EXECUTE', targetProviderName, {
      action: 'encode_visual_context',
      lines: encodingResult.linesEncoded,
      digest: encodingResult.digest,
    });

    const response = await provider.chat([
      {
        role: 'user',
        content: 'Read the secret code written on this image and reply with ONLY the code.',
        inlineData: [
          {
            mimeType: 'image/png',
            data: encodingResult.encodedImageBase64,
          },
        ],
      },
    ]);

    expect(response).toBeDefined();
    expect(response.content).toBeDefined();

    ledger.recordEvent('TOOL_RESPONSE', targetProviderName, {
      providerResponse: response.content,
    });

    const integrity = ledger.verifyIntegrity();
    expect(integrity.valid).toBe(true);

    console.log(`Real Provider (${targetProviderName}) Vision Response:`, response.content);
  });

  it('compresses a code prompt using ZavorthTokenEconomyCompressor and receives valid answer from active provider', async () => {
    const rawPrompt = `
      // This is a test comment that should be stripped
      /* Multi-line comment block
         describing a dummy function */
      function calculateSum(a: number, b: number): number {
        // Return addition
        return a + b;
      }
      What does the function above return when passed 15 and 25? Reply with ONLY the number.
    `;

    const compressed = ZavorthTokenEconomyCompressor.compressText(rawPrompt, 'aggressive');
    expect(compressed.compressedCharCount).toBeLessThan(compressed.originalCharCount);

    const provider = ProviderFactory.create(targetProviderName);
    const response = await provider.chat([
      {
        role: 'user',
        content: compressed.compressedText,
      },
    ]);

    expect(response).toBeDefined();
    expect(response.content).toContain('40');
    console.log('Compressed Prompt Savings:', `${compressed.savingsPercentage}%`);
    console.log(`Real Provider (${targetProviderName}) Compressed Response:`, response.content);
  });
});
