import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';


const root = path.resolve(__dirname, '..', '..');
const checker = path.join(root, 'scripts', 'public-api-compatibility-check.mjs');

describe('public API compatibility gate', () => {
  it('preserves the recorded package exports', () => {
    const result = spawnSync(process.execPath, [checker], { cwd: root, encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('baseline exports preserved');
  });

  it('rejects a removed export within the same major version', () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-api-'));
    try {
      fs.mkdirSync(path.join(temp, 'scripts'));
      fs.mkdirSync(path.join(temp, 'config'));
      fs.copyFileSync(checker, path.join(temp, 'scripts', 'public-api-compatibility-check.mjs'));
      fs.writeFileSync(path.join(temp, 'package.json'), JSON.stringify({ version: '2.1.0', exports: { '.': { types: './index.d.ts', default: './index.js' } } }));
      fs.writeFileSync(path.join(temp, 'config', 'public-api-baseline.json'), JSON.stringify({ schemaVersion: 1, packageVersion: '2.0.0', exports: ['.', './sdk'] }));
      const result = spawnSync(process.execPath, [path.join(temp, 'scripts', 'public-api-compatibility-check.mjs')], { cwd: temp, encoding: 'utf8' });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('requires a new major version');
    } finally {
      fs.rmSync(temp, { recursive: true, force: true });
    }
  });
});
