import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';


const rootDir = resolve(__dirname, '../../../');

describe('ZavorthControlBrowserPreview', () => {
  it('exposes a local browser preview script that wires the preview fixtures', () => {
    const scriptPath = join(rootDir, 'scripts', 'zavorthControl-browser-preview.ts');
    expect(existsSync(scriptPath)).toBe(true);
    const script = readFileSync(scriptPath, 'utf8');

    expect(script).toContain('buildZavorthControlZavorthControlFixturePreviewViewModel');
    expect(script).toContain('listZavorthControlZavorthControlFixturePreviewOptions');
    expect(script).toContain('ZavorthControlZavorthControlViewModel');
    expect(script).toContain('LIVE_FIXTURE_ID');
    expect(script).toContain('buildLiveViewModelFromSnapshot');
    expect(script).toContain('sessionStorage');
  });

  it('exposes the browser preview through package scripts and ZavorthControl QA', () => {
    const packageJson = JSON.parse(
      readFileSync(join(rootDir, 'package.json'), 'utf8'),
    ) as { scripts: Record<string, string> };

    expect(packageJson.scripts['zavorthControl:preview']).toContain('scripts/zavorthControl-browser-preview.ts');
    expect(packageJson.scripts['qa:zavorthControl-browser-preview']).toContain('ZavorthControlBrowserPreview.test.ts');
    expect(packageJson.scripts['qa:zavorthControl']).toContain('qa:zavorthControl-browser-preview');
  });

  it('documents that fixture previews are an internal QA surface', () => {
    const packageJson = JSON.parse(
      readFileSync(join(rootDir, 'package.json'), 'utf8'),
    ) as { scripts: Record<string, string> };

    expect(packageJson.scripts['zavorthControl:preview']).toContain('scripts/zavorthControl-browser-preview.ts');
    expect(packageJson.scripts['qa:zavorthControl-browser-preview']).toContain('--fixture=all');
  });

  it('keeps the ZavorthControl QA surface wired to the browser preview pipeline', () => {
    const visualQaPath = join(
      rootDir,
      'src',
      'services',
      'ZavorthControlVisualQaService.ts',
    );
    const visualQa = readFileSync(visualQaPath, 'utf8');

    expect(visualQa).toContain('/control/review?fixture=all');
    expect(visualQa).toContain('npm run qa:zavorthControl-browser-preview');
    expect(visualQa).toContain('.tmp/zavorthControl-browser-preview/index.html');
  });

  it('keeps the user-provided ZavorthControl visual wired to the runtime bridge', () => {
    const shellPath = join(
      rootDir,
      'apps',
      'zavorth-control-vite-shell',
      'index.html',
    );
    const appScript = [
      readFileSync(
        join(rootDir, 'apps', 'zavorth-control-vite-shell', 'src', 'app.ts'),
        'utf8',
      ),
      readFileSync(
        join(rootDir, 'apps', 'zavorth-control-vite-shell', 'src', 'signal-transmitter.ts'),
        'utf8',
      ),
    ].join('\n');
    const runtimeBridge = [
      readFileSync(
        join(rootDir, 'apps', 'zavorth-control-vite-shell', 'src', 'runtime-bridge.ts'),
        'utf8',
      ),
      readFileSync(
        join(rootDir, 'apps', 'zavorth-control-vite-shell', 'src', 'runtime-refresh.ts'),
        'utf8',
      ),
    ].join('\n');
    const layoutCss = readFileSync(
      join(rootDir, 'apps', 'zavorth-control-vite-shell', 'public', 'styles', 'layout.css'),
      'utf8',
    );

    const shell = readFileSync(shellPath, 'utf8');

    expect(shell).toContain('core-frame');
    expect(shell).toContain('/src/runtime-bridge.ts');
    expect(runtimeBridge).toContain('/api/auth/status');
    expect(runtimeBridge).toContain('/api/web/zavorthControl');
    expect(runtimeBridge).toContain('Non-invasive data bridge');
    expect(runtimeBridge).not.toContain('document.body.innerHTML');
    expect(appScript).toContain('runtimeBridge.sendChat');
    expect(layoutCss).toContain('.bridge__pulse[data-auth-state="protected"]');
    expect(layoutCss).toContain('.bridge__pulse[data-auth-state="unlocked"]');
  });
});
