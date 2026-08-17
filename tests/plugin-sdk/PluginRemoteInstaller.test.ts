import * as fs from 'node:fs';
import * as path from 'node:path';
import { PluginRemoteInstaller } from '../../src/plugin-sdk/installer.js';

describe('PluginRemoteInstaller', () => {
  const testPkgDir = path.join(process.cwd(), '.zavorth', 'test_installer_pkg');

  beforeAll(() => {
    if (!fs.existsSync(testPkgDir)) {
      fs.mkdirSync(testPkgDir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(testPkgDir, 'manifest.json'),
      JSON.stringify({ name: 'test_pkg', version: '1.0.0' }),
      'utf-8',
    );
  });

  afterAll(() => {
    if (fs.existsSync(testPkgDir)) {
      try {
        fs.rmSync(testPkgDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  });

  it('should verify local package directory correctly', () => {
    const installer = new PluginRemoteInstaller();
    const result = installer.verifyLocalPackage(testPkgDir);

    expect(typeof result.ok).toBe('boolean');
    expect(Array.isArray(result.findings)).toBe(true);
  });
});
