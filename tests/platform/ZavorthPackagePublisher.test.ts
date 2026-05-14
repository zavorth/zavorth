import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZavorthPackagePublisher } from '../../src/platform/publish/ZavorthPackagePublisher.js';

describe('ZavorthPackagePublisher', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('builds a local publish bundle and writes a report file', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-publisher-'));
    tempDirs.push(root);
    fs.writeFileSync(path.join(root, 'plugin.json'), JSON.stringify({
      id: '@example/sql-analyzer',
      version: '1.2.3',
      entrypoint: 'node index.js',
    }, null, 2), 'utf8');
    fs.writeFileSync(path.join(root, 'index.js'), 'console.log("hello");', 'utf8');

    const outputDir = path.join(root, 'out');
    const publisher = new ZavorthPackagePublisher({
      outputDir,
      registryEndpoint: '',
    });

    const result = await publisher.publishDetailed({
      packagePath: root,
      authToken: '',
      signLocal: true,
    });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      releaseId: '@example/sql-analyzer@1.2.3',
      fileCount: 2,
      uploadStatus: 'prepared',
    }));
    expect(result.signature.startsWith('sha256:')).toBe(true);
    expect(fs.existsSync(result.outputFile)).toBe(true);
  });
});
