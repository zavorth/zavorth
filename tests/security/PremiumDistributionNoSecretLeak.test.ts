import { mkdtempSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { ZavorthInspectService } from '../../src/services/ZavorthInspectService.js';
import { ZavorthManagedConfigService } from '../../src/services/ZavorthManagedConfigService.js';

describe('premium distribution secret safety', () => {
  it('does not serialize provider secret values in inspect snapshots', () => {
    process.env.OPENAI_API_KEY = 'fixture_distribution_secret_value';
    const root = mkdtempSync(path.join(os.tmpdir(), 'zavorth-secret-safety-'));
    writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'fixture', version: '1.0.0' }));
    const snapshot = new ZavorthInspectService(root, {
      projectRoot: root,
      llmProvider: 'openai',
      modelSelectionModelId: 'gpt-test',
      modelSelectionRouteId: '',
      modelSelectionFamilyId: '',
      openaiModel: 'gpt-test',
    } as any).buildSnapshot();

    expect(JSON.stringify(snapshot)).not.toContain('fixture_distribution_secret_value');
    delete process.env.OPENAI_API_KEY;
  });

  it('blocks managed config payloads with raw secret values', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'zavorth-secret-safety-'));
    const source = path.join(root, 'managed_config.json');
    const payload = JSON.stringify({
      schemaVersion: 1,
      managedConfig: {
        providerApiKey: 'raw-managed-secret',
      },
    });
    writeFileSync(source, payload);
    const checksum = crypto.createHash('sha256').update(payload).digest('hex');

    const plan = await new ZavorthManagedConfigService(root).buildPlan({
      sourceRef: source,
      expectedChecksum: checksum,
      apply: true,
      yes: true,
    });

    expect(plan.status).toBe('blocked');
    expect(plan.applied).toBe(false);
    expect(plan.findings.some((finding) => finding.id.startsWith('raw-secret'))).toBe(true);
  });
});
