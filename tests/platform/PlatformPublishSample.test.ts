import fs from 'fs';
import os from 'os';
import path from 'path';
import { publishSamplePackage } from '../../scripts/platform-publish-sample.js';

describe('platform publish sample', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('creates an inspectable prepared publish artifact for the Wave 9 sample package', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-platform-sample-'));
    tempDirs.push(outputDir);

    const result = await publishSamplePackage({ outputDir });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      releaseId: '@zavorth/examples-hello-ecosystem@1.0.0',
      packageId: '@zavorth/examples-hello-ecosystem',
      version: '1.0.0',
      uploadStatus: 'prepared',
    }));
    expect(result.signature.startsWith('sha256:')).toBe(true);
    expect(fs.existsSync(result.outputFile)).toBe(true);

    const payload = JSON.parse(fs.readFileSync(result.outputFile, 'utf8')) as {
      inventory: Array<{ path: string }>;
    };
    expect(payload.inventory.map((entry) => entry.path)).toEqual([
      'index.js',
      'plugin.json',
      'README.md',
    ]);
  });
});
