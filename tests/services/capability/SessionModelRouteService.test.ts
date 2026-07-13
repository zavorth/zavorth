import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { SessionModelRouteService } from '../../../src/services/SessionModelRouteService.js';

describe('SessionModelRouteService', () => {
  let root: string;
  let service: SessionModelRouteService;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-session-model-'));
    service = new SessionModelRouteService({ storageDir: root });
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('sets and reads mid-session model route', () => {
    service.setSessionModel({
      sessionId: 'sess-1',
      modelName: 'gpt-4o-mini',
      providerName: 'openai',
      source: 'cli',
    });
    const route = service.getSessionModel('sess-1');
    expect(route?.modelName).toBe('gpt-4o-mini');
    expect(route?.providerName).toBe('openai');
    expect(route?.source).toBe('cli');
  });

  it('records per-model usage ledger', () => {
    service.setSessionModel({ sessionId: 'sess-2', modelName: 'gemini-2.5-flash', providerName: 'gemini' });
    service.recordUsage({
      sessionId: 'sess-2',
      modelName: 'gemini-2.5-flash',
      providerName: 'gemini',
      inputTokens: 100,
      outputTokens: 50,
      estimatedCostUsd: 0.001,
    });
    service.recordUsage({
      sessionId: 'sess-2',
      modelName: 'gpt-4o',
      providerName: 'openai',
      inputTokens: 200,
      outputTokens: 80,
      estimatedCostUsd: 0.02,
    });

    const ledger = service.getLedger('sess-2');
    expect(ledger.totalsByModel['gemini/gemini-2.5-flash'].calls).toBe(1);
    expect(ledger.totalsByModel['openai/gpt-4o'].outputTokens).toBe(80);
    expect(ledger.usage.length).toBe(2);
  });

  it('clears session model', () => {
    service.setSessionModel({ sessionId: 'sess-3', modelName: 'x' });
    service.clearSessionModel('sess-3');
    expect(service.getSessionModel('sess-3')).toBeNull();
  });
});
