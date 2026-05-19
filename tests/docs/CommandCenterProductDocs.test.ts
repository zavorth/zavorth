import fs from 'fs';
import path from 'path';

function readWorkspaceFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('Command Center product docs', () => {
  it('keeps the README focused on promise and first journey instead of command inventory', () => {
    const readme = readWorkspaceFile('README.md');

    expect(readme).toContain('Primeiro Uso Em 60 Segundos');
    expect(readme).toContain('Command Center');
    expect(readme).toContain('/control');
    expect(readme).toContain('zavorth setup');
    expect(readme).toContain('zavorth go');
    expect(readme).toContain('zavorth chat');
    expect(readme).toContain('artifacts');
    expect(readme).toContain('approvals');
    expect(readme).toContain('memoria');
    expect(readme).toContain('docs/zavorth-cli.md');
    expect(readme).toContain('docs/self-modification.md');
    expect(readme).not.toContain('## Comandos Principais');
    expect(readme.split(/\r?\n/u).length).toBeLessThan(140);
  });

  it('points quickstart and web docs to Command Center as the official entry', () => {
    const quickstart = readWorkspaceFile('docs/quickstart.md');
    const web = readWorkspaceFile('docs/web-dashboard.md');
    const walkthrough = readWorkspaceFile('docs/product-direction.md');

    expect(quickstart).toContain('zavorth go');
    expect(quickstart).toContain('Command Center');
    expect(quickstart).toContain('/control');
    expect(quickstart).toContain('zavorth chat');
    expect(web).toContain('Web / Command Center');
    expect(web).toContain('Legado E Fallback');
    expect(web).toContain('/app');
    expect(web).toContain('/classic');
    expect(walkthrough).toContain('approval quando houver risco');
    expect(walkthrough).toContain('artifact ou proximo passo');
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
    expect(bootstrap).toContain('Command Center');
    expect(bootstrap).toContain('/control');
  });
});
