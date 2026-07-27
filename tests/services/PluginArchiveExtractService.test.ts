import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

import { PluginArchiveExtractService } from '../../src/services/PluginArchiveExtractService.js';

function buildStoreZip(entries: Array<{ name: string; content: Buffer | string }>): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const data = Buffer.isBuffer(entry.content) ? entry.content : Buffer.from(entry.content, 'utf8');
    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8); // store
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(0, 14); // crc
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    nameBuf.copy(local, 30);

    const localOffset = offset;
    parts.push(local, data);
    offset += local.length + data.length;

    const cen = Buffer.alloc(46 + nameBuf.length);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0, 8);
    cen.writeUInt16LE(0, 10);
    cen.writeUInt16LE(0, 12);
    cen.writeUInt16LE(0, 14);
    cen.writeUInt32LE(0, 16);
    cen.writeUInt32LE(data.length, 20);
    cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(nameBuf.length, 28);
    cen.writeUInt16LE(0, 30);
    cen.writeUInt16LE(0, 32);
    cen.writeUInt16LE(0, 34);
    cen.writeUInt16LE(0, 36);
    cen.writeUInt32LE(0, 38);
    cen.writeUInt32LE(localOffset, 42);
    nameBuf.copy(cen, 46);
    central.push(cen);
  }

  const centralBuf = Buffer.concat(central);
  const centralOffset = offset;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(centralOffset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...parts, centralBuf, end]);
}

function buildTar(entries: Array<{ name: string; content: string; type-: '0' | '5' }>): Buffer {
  const blocks: Buffer[] = [];
  for (const entry of entries) {
    const header = Buffer.alloc(512, 0);
    const name = entry.name.slice(0, 100);
    header.write(name, 0, 'utf8');
    const content = Buffer.from(entry.content, 'utf8');
    const sizeOctal = content.length.toString(8).padStart(11, '0') + '\0';
    header.write(sizeOctal, 124, 'utf8');
    header.write(entry.type || '0', 156, 'utf8');
    header.write('ustar\0', 257, 'utf8');
    header.write('00', 263, 'utf8');
    // checksum
    header.write('        ', 148, 'utf8');
    let sum = 0;
    for (let i = 0; i < 512; i += 1) sum += header[i];
    const checksum = `${sum.toString(8).padStart(6, '0')}\0 `;
    header.write(checksum, 148, 'utf8');
    blocks.push(header);
    if ((entry.type || '0') === '0') {
      const padded = Buffer.alloc(Math.ceil(content.length / 512) * 512, 0);
      content.copy(padded);
      blocks.push(padded);
    }
  }
  blocks.push(Buffer.alloc(512, 0), Buffer.alloc(512, 0));
  return Buffer.concat(blocks);
}

describe('PluginArchiveExtractService', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('extracts a pure ZIP with manifest.json', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-zip-'));
    tempRoots.push(root);
    const extractDir = path.join(root, 'out');
    const manifest = JSON.stringify({ id: 'zip-demo', schemaVersion: 'zavorth.plugin-os.v1' });
    const zip = buildStoreZip([
      { name: 'package/manifest.json', content: manifest },
      { name: 'package/index.js', content: 'module.exports={register(){}};' },
    ]);

    const service = new PluginArchiveExtractService({ preferSystemTools: false });
    const result = service.extractZipBuffer(zip, extractDir);
    expect(result.ok).toBe(true);
    expect(result.method).toBe('pure');
    expect(fs.existsSync(path.join(extractDir, 'package', 'manifest.json'))).toBe(true);
    expect(fs.readFileSync(path.join(extractDir, 'package', 'manifest.json'), 'utf8')).toContain('zip-demo');
  });

  it('extracts a pure TGZ with manifest.json', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-tgz-'));
    tempRoots.push(root);
    const extractDir = path.join(root, 'out');
    const tar = buildTar([
      { name: 'pkg/manifest.json', content: JSON.stringify({ id: 'tgz-demo' }) },
      { name: 'pkg/index.js', content: 'module.exports={};' },
    ]);
    const tgz = zlib.gzipSync(tar);

    const service = new PluginArchiveExtractService({ preferSystemTools: false });
    const result = service.extractTgzBuffer(tgz, extractDir);
    expect(result.ok).toBe(true);
    expect(fs.existsSync(path.join(extractDir, 'pkg', 'manifest.json'))).toBe(true);
    expect(fs.readFileSync(path.join(extractDir, 'pkg', 'manifest.json'), 'utf8')).toContain('tgz-demo');
  });

  it('rejects path traversal in ZIP entries', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-zip-trav-'));
    tempRoots.push(root);
    const extractDir = path.join(root, 'out');
    const zip = buildStoreZip([
      { name: '../evil.txt', content: 'nope' },
    ]);
    const service = new PluginArchiveExtractService({ preferSystemTools: false });
    const result = service.extractZipBuffer(zip, extractDir);
    expect(result.ok).toBe(false);
    expect(String(result.error || '')).toMatch(/traversal|escape/i);
  });

  it('rejects ZIP entries whose declared output exceeds the extraction limit', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-zip-bomb-'));
    tempRoots.push(root);
    const extractDir = path.join(root, 'out');
    const zip = buildStoreZip([{ name: 'large.bin', content: 'tiny' }]);
    zip.writeUInt32LE(51 * 1024 * 1024, 22);

    const result = new PluginArchiveExtractService({ preferSystemTools: false })
      .extractZipBuffer(zip, extractDir);

    expect(result.ok).toBe(false);
    expect(String(result.error || '')).toMatch(/size limit/i);
    expect(fs.existsSync(path.join(extractDir, 'large.bin'))).toBe(false);
  });
});
