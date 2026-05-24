import { createHash } from 'crypto';
import { mkdtempSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
import { ZavorthReleaseChannelService } from '../../../src/cli/update/ZavorthReleaseChannelService.js';

describe('ZavorthReleaseChannelService', () => {
  it('resolves release channels and maps stable to latest', () => {
    const root = makeProjectRoot();
    const service = new ZavorthReleaseChannelService(root);

    expect(service.resolveChannel('stable').npmTag).toBe('latest');
    expect(service.resolveChannel('beta').npmTag).toBe('beta');
    expect(service.resolveChannel('nightly').npmTag).toBe('nightly');
    expect(service.resolveChannel('dev').npmTag).toBe('dev');
  });

  it('builds preview update plans without executing npm', () => {
    const root = makeProjectRoot();
    const service = new ZavorthReleaseChannelService(root);
    const plan = service.buildUpdatePlan({ channel: 'beta', yes: false });

    expect(plan.applied).toBe(false);
    expect(plan.requiresConfirmation).toBe(true);
    expect(plan.packageSpec).toBe('zavorth@beta');
    expect(plan.command).toBe('npm install -g zavorth@beta');
    expect(plan.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(plan.manifestChecksum).toMatch(/^[a-f0-9]{64}$/);
  });

  it('uses local release manifests and verifies local artifacts by checksum', () => {
    const root = makeProjectRoot();
    const artifactPath = path.join(root, 'zavorth-test-artifact.bin');
    writeFileSync(artifactPath, 'artifact');
    const artifactSha256 = createHash('sha256').update('artifact').digest('hex');
    const manifestPath = path.join(root, 'manifest.json');
    writeFileSync(manifestPath, JSON.stringify({
      channels: [{
        id: 'beta',
        npmTag: 'beta',
        label: 'Beta',
        risk: 'medium',
        description: 'test',
        checksum: 'manifest-channel-checksum',
        packageSpec: 'zavorth@1.2.3-beta.1',
        artifactUrl: artifactPath,
        artifactSha256,
      }],
    }));
    const service = new ZavorthReleaseChannelService(root);
    const plan = service.buildUpdatePlan({ channel: 'beta', manifest: manifestPath, yes: false });
    const staged = service.verifyArtifact({ url: artifactPath, sha256: artifactSha256 });

    expect(plan.packageSpec).toBe('zavorth@1.2.3-beta.1');
    expect(plan.manifestSource).toBe(manifestPath);
    expect(plan.artifact?.sha256).toBe(artifactSha256);
    expect(staged.ok).toBe(true);
  });
});

function makeProjectRoot(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'zavorth-release-channel-'));
  writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'zavorth', version: '9.9.9' }, null, 2));
  return root;
}
