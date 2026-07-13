import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

import { PluginArchiveExtractService } from '../../src/services/PluginArchiveExtractService.js';
import { PluginSignatureService } from '../../src/services/PluginSignatureService.js';
import { PluginUrlInstallService } from '../../src/services/PluginUrlInstallService.js';

function buildStoreZip(entries: Array<{ name: string; content: string }>): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const data = Buffer.from(entry.content, 'utf8');
    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    nameBuf.copy(local, 30);
    const localOffset = offset;
    parts.push(local, data);
    offset += local.length + data.length;
    const cen = Buffer.alloc(46 + nameBuf.length);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt32LE(data.length, 20);
    cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(nameBuf.length, 28);
    cen.writeUInt32LE(localOffset, 42);
    nameBuf.copy(cen, 46);
    central.push(cen);
  }
  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, centralBuf, end]);
}

describe('PluginUrlInstallService', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('downloads zip via fetchBuffer and extracts with pure fallback', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-url-zip-'));
    tempRoots.push(root);
    const zip = buildStoreZip([
      {
        name: 'pkg/manifest.json',
        content: JSON.stringify({ id: 'url-zip', schemaVersion: 'zavorth.plugin-os.v1' }),
      },
      { name: 'pkg/index.js', content: 'module.exports={register(){}};' },
    ]);

    const service = new PluginUrlInstallService({
      projectRoot: root,
      fetchBuffer: async () => zip,
      archiveExtract: new PluginArchiveExtractService({
        preferSystemTools: false,
        spawnSyncFn: () => ({ error: new Error('no system'), status: 1 } as never),
      }),
    });

    const result = await service.downloadAndExtract('https://example.com/plugin.zip');
    expect(result.ok).toBe(true);
    expect(result.pluginId).toBe('url-zip');
    expect(result.packageDir && fs.existsSync(path.join(result.packageDir, 'manifest.json'))).toBe(true);
    expect(result.verify?.status === 'unsigned' || result.verify?.status === 'verified').toBe(true);
  });

  it('rejects install when signature required and package unsigned', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-url-sig-'));
    tempRoots.push(root);
    const zip = buildStoreZip([
      { name: 'pkg/manifest.json', content: JSON.stringify({ id: 'unsigned-url' }) },
      { name: 'pkg/index.js', content: 'module.exports={};' },
    ]);

    const service = new PluginUrlInstallService({
      projectRoot: root,
      fetchBuffer: async () => zip,
      archiveExtract: new PluginArchiveExtractService({ preferSystemTools: false }),
      signatureService: new PluginSignatureService({
        env: { ZAVORTH_PLUGIN_REQUIRE_SIGNATURE: '1' },
      }),
      verifyOptions: { requireSignature: true },
    });

    const result = await service.downloadAndExtract('https://example.com/plugin.zip');
    expect(result.ok).toBe(false);
    expect(String(result.error || '')).toMatch(/signature|verify/i);
  });

  it('soft-fails when network disabled', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-url-off-'));
    tempRoots.push(root);
    const service = new PluginUrlInstallService({
      projectRoot: root,
      networkEnabled: false,
    });
    const result = await service.downloadAndExtract('https://example.com/plugin.tgz');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Network is disabled/i);
  });

  it.each([
    'http://example.com/plugin.zip',
    'https://localhost/plugin.zip',
    'https://127.0.0.1/plugin.zip',
    'https://169.254.169.254/latest/meta-data/plugin.zip',
    'https://user:secret@example.com/plugin.zip',
  ])('rejects unsafe download URL before fetching: %s', async (url) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-url-policy-'));
    tempRoots.push(root);
    const fetchBuffer = jest.fn(async () => Buffer.from('should-not-download'));
    const service = new PluginUrlInstallService({ projectRoot: root, fetchBuffer });

    const result = await service.downloadAndExtract(url);

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/HTTPS|public host|credentials/i);
    expect(fetchBuffer).not.toHaveBeenCalled();
  });

  it('normalizes a hostile manifest id inside the plugin package root', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-url-id-'));
    tempRoots.push(root);
    const zip = buildStoreZip([
      { name: 'pkg/manifest.json', content: JSON.stringify({ id: '../../outside' }) },
      { name: 'pkg/index.js', content: 'module.exports={};' },
    ]);
    const service = new PluginUrlInstallService({
      projectRoot: root,
      fetchBuffer: async () => zip,
      archiveExtract: new PluginArchiveExtractService({ preferSystemTools: false }),
    });

    const result = await service.downloadAndExtract('https://example.com/plugin.zip');

    expect(result.ok).toBe(true);
    expect(result.pluginId).toBe('outside');
    expect(path.resolve(result.packageDir || '')).toBe(
      path.resolve(root, '.zavorth', 'plugins', 'outside'),
    );
  });

  it('extracts tgz payload via pure path', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-url-tgz-'));
    tempRoots.push(root);

    // Minimal tar with one file
    const name = 'pkg/manifest.json';
    const content = Buffer.from(JSON.stringify({ id: 'url-tgz' }), 'utf8');
    const header = Buffer.alloc(512, 0);
    header.write(name, 0, 'utf8');
    header.write(`${content.length.toString(8).padStart(11, '0')}\0`, 124, 'utf8');
    header.write('0', 156, 'utf8');
    header.write('ustar\0', 257, 'utf8');
    header.write('00', 263, 'utf8');
    header.write('        ', 148, 'utf8');
    let sum = 0;
    for (let i = 0; i < 512; i += 1) sum += header[i];
    header.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148, 'utf8');
    const padded = Buffer.alloc(Math.ceil(content.length / 512) * 512, 0);
    content.copy(padded);
    const tar = Buffer.concat([header, padded, Buffer.alloc(1024, 0)]);
    const tgz = zlib.gzipSync(tar);

    const service = new PluginUrlInstallService({
      projectRoot: root,
      fetchBuffer: async () => tgz,
      archiveExtract: new PluginArchiveExtractService({ preferSystemTools: false }),
    });

    const result = await service.downloadAndExtract('https://example.com/plugin.tgz');
    expect(result.ok).toBe(true);
    expect(result.pluginId).toBe('url-tgz');
  });
});
