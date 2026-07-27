import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { ZavorthManagedConfigService } from '../../../src/services/ZavorthManagedConfigService.js';

describe('ZavorthManagedConfigService', () => {
  it('previews and applies a checksum-verified managed config without raw secrets', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'zavorth-managed-config-'));
    const sourcePath = path.join(root, 'managed_config_source.json');
    const payload = JSON.stringify({
      schemaVersion: 1,
      managedConfig: { providerPolicy: 'balanced' },
      requirements: { node: '>=18' },
      secretRefs: { openai: 'OPENAI_API_KEY' },
    });
    writeFileSync(sourcePath, payload);
    const checksum = sha256(payload);
    const service = new ZavorthManagedConfigService(root);

    const preview = await service.buildPlan({ sourceRef: sourcePath, expectedChecksum: checksum });
    expect(preview.status).toBe('ready');
    expect(preview.applied).toBe(false);
    expect(preview.checksumVerified).toBe(true);

    const applied = await service.buildPlan({ sourceRef: sourcePath, expectedChecksum: checksum, apply: true, yes: true });
    expect(applied.status).toBe('applied');
    expect(applied.applied).toBe(true);
    expect(readFileSync(applied.managedConfigPath, 'utf8')).toContain('providerPolicy');
    expect(readFileSync(applied.receiptPath, 'utf8')).toContain('Managed config applied');
  });

  it('blocks raw secret values and checksum-less apply attempts', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'zavorth-managed-config-'));
    const sourcePath = path.join(root, 'managed_config_source.json');
    const payload = JSON.stringify({
      schemaVersion: 1,
      managedConfig: { apiKey: 'raw-secret' },
    });
    writeFileSync(sourcePath, payload);
    const service = new ZavorthManagedConfigService(root);

    const plan = await service.buildPlan({ sourceRef: sourcePath, apply: true, yes: true });

    expect(plan.status).toBe('blocked');
    expect(plan.applied).toBe(false);
    expect(plan.findings.some((finding) => finding.id.startsWith('raw-secret'))).toBe(true);
    expect(plan.findings.some((finding) => finding.id === 'checksum-not-provided')).toBe(true);
  });

  it('allows deployment key hashes without treating them as raw secrets', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'zavorth-managed-config-'));
    const sourcePath = path.join(root, 'managed_config_source.json');
    const deploymentKey = 'deployment-key';
    const payload = JSON.stringify({
      schemaVersion: 1,
      deployment: { keySthere is256: sha256(deploymentKey) },
      managedConfig: { providerPolicy: 'balanced' },
    });
    writeFileSync(sourcePath, payload);
    const service = new ZavorthManagedConfigService(root);

    const plan = await service.buildPlan({
      sourceRef: sourcePath,
      expectedChecksum: sha256(payload),
      deploymentKey,
    });

    expect(plan.status).toBe('ready');
    expect(plan.deploymentKeyVerified).toBe(true);
    expect(plan.findings.some((finding) => finding.id.startsWith('raw-secret'))).toBe(false);
  });
});

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}
