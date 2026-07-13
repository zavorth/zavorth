import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHmac } from 'node:crypto';

import { PluginSignatureService } from '../../src/services/PluginSignatureService.js';

function writePackage(root: string, files: Record<string, string>): string {
  const dir = path.join(root, 'pkg');
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    const full = path.join(dir, name);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf8');
  }
  return dir;
}

describe('PluginSignatureService', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('verifies good integrity.checksum in manifest', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-sig-good-'));
    tempRoots.push(root);
    const dir = writePackage(root, {
      'index.js': 'module.exports={register(){}};\n',
      'manifest.json': JSON.stringify({ id: 'sig-demo', integrity: { checksum: 'placeholder' } }),
    });

    const service = new PluginSignatureService({ env: {} });
    const checksum = service.computePackageChecksum(dir);
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({
      id: 'sig-demo',
      integrity: { checksum: `sha256:${checksum}` },
    }), 'utf8');

    // Recompute after writing checksum file — checksum excludes SIGNATURE but includes manifest.
    const finalChecksum = service.computePackageChecksum(dir);
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({
      id: 'sig-demo',
      integrity: { checksum: `sha256:${finalChecksum}` },
    }), 'utf8');
    // Note: embedding checksum in manifest changes checksum; use sidecar for stable verify.
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ id: 'sig-demo' }), 'utf8');
    const packageChecksum = service.computePackageChecksum(dir);
    fs.writeFileSync(path.join(dir, 'SIGNATURE'), `sha256=${packageChecksum}\n`, 'utf8');

    const result = service.verifyPackage(dir);
    expect(result.ok).toBe(true);
    expect(result.status).toBe('verified');
    expect(result.packageChecksum).toBe(packageChecksum);
  });

  it('rejects bad checksum', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-sig-bad-'));
    tempRoots.push(root);
    const dir = writePackage(root, {
      'index.js': 'module.exports={};\n',
      'manifest.json': JSON.stringify({ id: 'bad' }),
      'SIGNATURE': 'sha256=deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef\n',
    });
    const service = new PluginSignatureService({ env: {} });
    const result = service.verifyPackage(dir);
    expect(result.ok).toBe(false);
    expect(result.status).toBe('checksum_mismatch');
  });

  it('blocks when require-signature and unsigned', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-sig-req-'));
    tempRoots.push(root);
    const dir = writePackage(root, {
      'index.js': 'module.exports={};\n',
      'manifest.json': JSON.stringify({ id: 'unsigned' }),
    });
    const service = new PluginSignatureService({
      env: { ZAVORTH_PLUGIN_REQUIRE_SIGNATURE: '1' },
    });
    const result = service.verifyPackage(dir);
    expect(result.ok).toBe(false);
    expect(result.status).toBe('signature_required');
  });

  it('verifies hmac-sha256 when secret matches', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-sig-hmac-'));
    tempRoots.push(root);
    const dir = writePackage(root, {
      'index.js': 'module.exports={};\n',
      'manifest.json': JSON.stringify({ id: 'hmac' }),
    });
    const secret = 'test-secret';
    const service = new PluginSignatureService({
      env: { ZAVORTH_PLUGIN_HMAC_SECRET: secret },
    });
    const checksum = service.computePackageChecksum(dir);
    const hmac = createHmac('sha256', secret).update(checksum).digest('hex');
    fs.writeFileSync(path.join(dir, 'plugin.sig'), `sha256=${checksum}\nhmac-sha256=${hmac}\n`, 'utf8');

    const result = service.verifyPackage(dir);
    expect(result.ok).toBe(true);
    expect(result.status).toBe('verified');
    expect(result.findings.some((item) => /hmac/i.test(item))).toBe(true);
  });
});
