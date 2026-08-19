import fs from 'fs';
import os from 'os';
import path from 'path';
import { CompanionDistributionService } from '../../src/nodes/companion/CompanionDistributionService';

describe('CompanionDistributionService', () => {
  it('creates a companion bundle with launchers and manifest', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-companion-dist-'));
    const distDir = path.join(root, 'dist');
    const appDir = path.join(root, 'apps', 'zavorth-companion');
    fs.mkdirSync(distDir, { recursive: true });
    fs.mkdirSync(appDir, { recursive: true });
    fs.writeFileSync(path.join(distDir, 'companion.js'), 'console.log("companion");\n', 'utf8');
    fs.writeFileSync(path.join(appDir, 'index.js'), 'console.log("launcher");\n', 'utf8');
    fs.writeFileSync(path.join(appDir, 'package.json'), '{"name":"zavorth-companion","version":"1.2.3"}\n', 'utf8');

    const service = new CompanionDistributionService({
      projectRoot: root,
    });
    const bundle = service.buildBundle(path.join(root, 'output', 'companion'));

    expect(fs.existsSync(bundle.manifestPath)).toBe(true);
    expect(fs.existsSync(bundle.launcherPs1Path)).toBe(true);
    expect(fs.existsSync(bundle.launcherCmdPath)).toBe(true);
    expect(fs.existsSync(path.join(bundle.bundleDir, 'runtime', 'companion.js'))).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(bundle.manifestPath, 'utf8'));
    expect(manifest.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.capabilities).toEqual(expect.arrayContaining(['device.info', 'clipboard.write', 'screen.capture']));
    expect(manifest.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'runtime/companion.js',
          role: 'runtime',
          bytes: 26,
          sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      ]),
    );
    expect(bundle.manifest.sha256).toBe(manifest.sha256);
    expect(fs.readFileSync(bundle.readmePath, 'utf8')).toContain('Quick flow:');
    expect(fs.readFileSync(bundle.readmePath, 'utf8')).toContain('distribution-manifest.json');
  });
});
