import fs from 'fs';
import os from 'os';
import path from 'path';

import { ZavorthProviderPreferencePersistenceService } from '../../src/services/ZavorthProviderPreferencePersistenceService.js';
import type { ZavorthProviderSelectionUxSnapshot } from '../../src/contracts/ZavorthProviderSelectionUxContract.js';

describe('ZavorthProviderPreferencePersistenceService', () => {
  it('previews provider persistence without writing config', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-provider-pref-preview-'));
    const service = createService(root, selection('openai', 'ready'));

    const snapshot = await service.preview({ providerId: 'openai' });

    expect(snapshot.status).toBe('preview');
    expect(snapshot.receipt.safety).toEqual(expect.objectContaining({
      rawSecretsSerialized: false,
      writesSecrets: false,
      mutatesEnvFile: false,
      requiresExplicitApproval: true,
    }));
    expect(fs.existsSync(path.join(root, 'data', 'runtime', 'provider-selection-preferences.json'))).toBe(false);
  });

  it('blocks apply until explicit approval is present', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-provider-pref-denied-'));
    const service = createService(root, selection('openai', 'ready'));

    const snapshot = await service.apply({ providerId: 'openai' });

    expect(snapshot.status).toBe('denied');
    expect(snapshot.receipt.decision).toBe('approval_required');
    expect(snapshot.nextAction).toContain('--confirm');
    expect(fs.existsSync(path.join(root, 'data', 'runtime', 'provider-selection-preferences.json'))).toBe(false);
  });

  it('applies and rolls back a ready provider preference with receipts', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-provider-pref-apply-'));
    const service = createService(root, selection('openai', 'ready'));

    const applied = await service.apply({ providerId: 'openai', confirm: true });
    const preferencePath = path.join(root, 'data', 'runtime', 'provider-selection-preferences.json');
    const ledgerPath = path.join(root, 'data', 'runtime', 'provider-selection-receipts.jsonl');

    expect(applied.status).toBe('applied');
    expect(applied.preference).toEqual(expect.objectContaining({
      providerId: 'openai',
      modelId: 'openai-model',
    }));
    expect(applied.receipt.rollback.available).toBe(true);
    expect(JSON.parse(fs.readFileSync(preferencePath, 'utf8'))).toEqual(expect.objectContaining({
      providerId: 'openai',
      modelId: 'openai-model',
    }));
    expect(fs.readFileSync(ledgerPath, 'utf8')).toContain(applied.receipt.id);

    const rolledBack = await service.rollback({ receiptId: applied.receipt.id, confirm: true });

    expect(rolledBack.status).toBe('rolled_back');
    expect(await service.readPreference()).toBeNull();
    expect(fs.existsSync(preferencePath)).toBe(false);
  });

  it('denies persistence when the selected provider is not ready', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-provider-pref-unready-'));
    const service = createService(root, selection('anthropic', 'missing_auth'));

    const snapshot = await service.apply({ providerId: 'anthropic', confirm: true });

    expect(snapshot.status).toBe('denied');
    expect(snapshot.receipt.decision).toBe('provider_not_ready');
    expect(JSON.stringify(snapshot)).not.toContain('sk-');
  });
});

function createService(root: string, snapshot: ZavorthProviderSelectionUxSnapshot): ZavorthProviderPreferencePersistenceService {
  return new ZavorthProviderPreferencePersistenceService({
    projectRoot: root,
    now: () => new Date('2026-05-13T12:00:00.000Z'),
    selection: {
      async buildSnapshot() {
        return snapshot;
      },
    },
  });
}

function selection(providerId: string, status: 'ready' | 'missing_auth'): ZavorthProviderSelectionUxSnapshot {
  const ready = status === 'ready';
  return {
    contractVersion: '2026-05-13.checkpoint-11',
    schemaVersion: 1,
    surface: 'provider-selection-ux',
    generatedAt: '2026-05-13T12:00:00.000Z',
    request: {
      target: providerId,
      intent: 'explicit',
      requireLiveEvidence: false,
      includeAdvanced: false,
    },
    active: {
      provider: 'gemini',
      model: 'gemini-model',
    },
    decision: ready ? 'use_now' : 'configure_first',
    selected: {
      providerId,
      label: providerId,
      model: `${providerId}-model`,
      status,
      liveStatus: ready ? 'passed' : 'blocked',
      score: ready ? 1000 : -100,
      reasons: [],
      canUseNow: ready,
      canTestNow: ready,
      requiresConfiguration: !ready,
      userAction: ready ? 'Provider ready.' : 'Configure provider.',
      commands: {
        use: `zavorth providers select ${providerId}`,
        inspect: `zavorth providers --provider ${providerId}`,
        test: `zavorth providers test ${providerId}`,
        liveTest: `zavorth providers test ${providerId} --live`,
      },
    },
    fallbacks: [],
    blocked: [],
    explanation: ['fixture'],
    safety: {
      catalogIsNotLiveProof: true,
      selectionDoesNotWriteConfig: true,
      liveProbeRequiresExplicitCommand: true,
      rawSecretsSerialized: false,
      dashboardExecutionAuthority: false,
    },
    commands: [],
    nextAction: 'fixture',
  };
}
