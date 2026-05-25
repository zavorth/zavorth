import os from 'os';
import path from 'path';
import { ZavorthSelfHealingReceiptService } from '../../src/services/ZavorthSelfHealingReceiptService.js';
import { ZavorthSelfHealingUxService } from '../../src/services/ZavorthSelfHealingUxService.js';

describe('ZavorthSelfHealingReceiptService', () => {
  it('writes redacted receipts and projects them into Experience receipts', () => {
    const service = new ZavorthSelfHealingReceiptService({
      now: () => new Date('2026-05-21T12:00:00.000Z'),
      storePath: path.join(os.tmpdir(), `zavorth-self-healing-receipt-${Date.now()}.jsonl`),
    });
    const projection = new ZavorthSelfHealingUxService().buildProjection({
      attempted: 'Call provider',
      error: new Error('quota failed for OPENAI_API_KEY=sk-secret-value-1234567890'),
      snapshot: {
        agent: { providerLabel: 'openai', modelLabel: 'gpt-test' },
        health: { status: 'attention', summary: 'quota', warnings: [] },
      } as any,
      providerMatrix: {
        entries: [{ id: 'gemini', status: 'ready', defaultRouteAllowed: true }],
      } as any,
    });

    const receipt = service.append({
      projection,
      status: 'applied',
      applied: true,
      fallbackProvider: 'gemini',
      summary: 'Recovered with fallback OPENAI_API_KEY=sk-secret-value-1234567890',
    });
    const projected = service.toExperienceReceipts(1);

    expect(receipt.rawSecretsSerialized).toBe(false);
    expect(JSON.stringify(receipt)).not.toContain('sk-secret-value');
    expect(projected[0]).toEqual(expect.objectContaining({
      id: receipt.id,
      source: 'self-healing',
      status: 'ready',
    }));
  });
});
