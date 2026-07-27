/**
 *  B6 — cost hop transparency service.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let CostRouteOverviewService: any;
let extractCostRouteClass: any;
try {
  const mod = require('../../../src/services/CostRouteOverviewService.js');
  CostRouteOverviewService = mod.CostRouteOverviewService;
  extractCostRouteClass = mod.extractCostRouteClass;
} catch {
  // Module removed from source
}

import type { UserProviderSelection } from '../../../src/services/UserSelectionResolver.js';

const describeIf = CostRouteOverviewService ? describe : describe.skip;

describeIf('CostRouteOverviewService', () => {
  const baseSelection: UserProviderSelection = {
    providerId: 'openai',
    modelId: 'gpt-4o',
    routeId: null,
    familyId: null,
    secondaryModelId: 'gpt-4o-mini',
    fallbackProviderIds: ['ollama:llama3.2'],
    source: 'preference',
    configured: true,
  };

  it('extractCostRouteClass parses note tokens', () => {
    expect(extractCostRouteClass('cost-route:background')).toBe('background');
    expect(extractCostRouteClass('fallback-route|cost-route:premium')).toBe('premium');
    expect(extractCostRouteClass(null)).toBeNull();
    expect(extractCostRouteClass('no-route')).toBeNull();
  });

  it('returns cheapHop from user stack and commands', () => {
    const service = new CostRouteOverviewService({
      now: () => new Date('2026-07-16T12:00:00.000Z'),
      storageDir: path.join(os.tmpdir(), 'zavorth-cost-route-empty-' + Date.now()),
    });
    const snap = service.buildSnapshot({
      selection: baseSelection,
      env: {} as NodeJS.ProcessEnv,
      preferEnvBackground: false,
    });
    expect(snap.source).toBe('CostRouteOverviewService');
    expect(snap.cheapHop.providerName).toBe('ollama');
    expect(snap.cheapHop.modelName).toBe('llama3.2');
    expect(snap.commands.overview).toBe('zavorth cost-route');
    expect(snap.commands.costSavings).toBe('zavorth cost-savings');
    expect(snap.lastCostRouteClass).toBeNull();
    expect(service.renderText(snap)).toContain('Cheap hop:');
  });

  it('reads last costRouteClass from session ledgers when present', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-cost-route-'));
    try {
      fs.writeFileSync(
        path.join(dir, 'sess-1.json'),
        JSON.stringify({
          sessionId: 'sess-1',
          route: null,
          usage: [
            {
              at: '2026-07-16T10:00:00.000Z',
              providerName: 'openai',
              modelName: 'gpt-4o',
              inputTokens: 10,
              outputTokens: 5,
              estimatedCostUsd: 0.01,
              note: 'cost-route:standard',
            },
            {
              at: '2026-07-16T11:00:00.000Z',
              providerName: 'ollama',
              modelName: 'llama3.2',
              inputTokens: 2,
              outputTokens: 1,
              estimatedCostUsd: 0,
              note: 'cost-route:background',
            },
          ],
          totalsByModel: {},
          updatedAt: '2026-07-16T11:00:00.000Z',
        }),
        'utf8',
      );
      const service = new CostRouteOverviewService({
        storageDir: dir,
        now: () => new Date('2026-07-16T12:00:00.000Z'),
      });
      const snap = service.buildSnapshot({
        selection: baseSelection,
        env: {} as NodeJS.ProcessEnv,
        preferEnvBackground: false,
      });
      expect(snap.lastCostRouteClass).not.toBeNull();
      expect(snap.lastCostRouteClass?.className).toBe('background');
      expect(snap.lastCostRouteClass?.modelName).toBe('llama3.2');
      expect(snap.narrative).toMatch(/background/i);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
