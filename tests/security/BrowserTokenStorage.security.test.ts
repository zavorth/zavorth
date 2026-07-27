import fs from 'node:fs';
import path from 'node:path';

describe('browser authentication token storage', () => {
  it('reads control bearer tokens from sessionStorage first, localStorage as fallback', () => {
    const repositoryRoot = path.resolve(__dirname, '..', '..');
    const controlSource = fs.readFileSync(
      path.join(repositoryRoot, 'apps/zavorth-control-vite-shell/src/app.ts'),
      'utf8',
    );

    // Source reads from sessionStorage first, then falls back to localStorage
    expect(controlSource).toContain("sessionStorage.getItem('zavorth.zavorthControl.webToken')");
    expect(controlSource).toContain("localStorage.getItem('zavorth.zavorthControl.webToken')");
  });

  it('uses tab-scoped sessionStorage for control session identifiers', () => {
    const repositoryRoot = path.resolve(__dirname, '..', '..');
    const controlSource = fs.readFileSync(
      path.join(repositoryRoot, 'apps/zavorth-control-vite-shell/src/app.ts'),
      'utf8',
    );

    expect(controlSource).toContain("sessionStorage.getItem('zavorth.zavorthControl.sessionId')");
  });

  it('stores mobile supervision tokens via the mobile service session mechanism', () => {
    const repositoryRoot = path.resolve(__dirname, '..', '..');
    const mobileSource = fs.readFileSync(
      path.join(
        repositoryRoot,
        'src/domain/surface/presentation/web-app/web-app-supervision-route/mobileSupervisionRoutes.ts',
      ),
      'utf8',
    );

    expect(mobileSource).toContain('ZavorthMobileSupervisionService');
    expect(mobileSource).toContain('validateSessionToken');
    expect(mobileSource).toContain('generateSessionToken');
  });
});

describe('CLI remote documentation egress', () => {
  it('exists as a CLI collection namespace module', () => {
    const repositoryRoot = path.resolve(__dirname, '..', '..');
    const source = fs.readFileSync(
      path.join(repositoryRoot, 'src/cli/ZavorthCliCollectionNamespace.ts'),
      'utf8',
    );

    expect(source).toContain('runCollection');
    expect(source).toContain('runDocs');
  });
});
