import fs from 'fs';
import path from 'path';

function readWorkspaceFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('Command Center product docs', () => {
  it('keeps the README focused on promise and first journey instead of command inventory', () => {
    const readme = readWorkspaceFile('README.md');

    expect(readme).toContain('Start Fast');
    expect(readme).toContain('/dashboard');
    expect(readme).toContain('zavorth setup');
    expect(readme).toContain('zavorth start');
    expect(readme).toContain('zavorth open');
    expect(readme).toContain('zavorth chat');
    expect(readme).toContain('receipts');
    expect(readme).toContain('approvals');
    expect(readme).toContain('memory');
    expect(readme).toContain('docs/zavorth-cli.md');
    expect(readme).not.toContain('npm run zavorth:operator-check');
    expect(readme).not.toContain('/control');
    expect(readme.split(/\r?\n/u).length).toBeLessThan(220);
  });

  it('points quickstart and web docs to dashboard as the official entry', () => {
    const quickstart = readWorkspaceFile('docs/quickstart.md');
    const web = readWorkspaceFile('docs/web-dashboard.md');
    const walkthrough = readWorkspaceFile('docs/product-direction.md');

    expect(quickstart).toContain('zavorth setup');
    expect(quickstart).toContain('zavorth start');
    expect(quickstart).toContain('zavorth open');
    expect(quickstart).toContain('/dashboard');
    expect(quickstart).toContain('zavorth chat');
    expect(web).toContain('Web Dashboard');
    expect(web).toContain('zavorth open');
    expect(web).toContain('/dashboard');
    expect(walkthrough).toContain('approvals');
    expect(walkthrough).toContain('provider readiness');
    expect(walkthrough).toContain('tests or certification evidence');
  });

  it('keeps identity docs as versioned direction rather than mutable runtime config', () => {
    const identity = readWorkspaceFile('IDENTITY.md');
    const soul = readWorkspaceFile('SOUL.md');
    const bootstrap = readWorkspaceFile('BOOTSTRAP.md');

    expect(identity).toContain('Mascot');
    expect(identity).toContain('fox');
    expect(identity).toContain('not mutable runtime configuration');
    expect(soul).toContain('not a live policy engine');
    expect(soul).toContain('versioned');
    expect(bootstrap).toContain('zavorth start');
    expect(bootstrap).toContain('zavorth open');
    expect(bootstrap).toContain('/dashboard');
  });
});
