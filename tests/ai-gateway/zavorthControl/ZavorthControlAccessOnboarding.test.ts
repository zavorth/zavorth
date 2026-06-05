import { readFileSync } from 'fs';
import { join } from 'path';

const controlDir = join(
  process.cwd(),
  'src/ai-gateway/app/(zavorthControl)/control',
);

describe('ZavorthControl access and onboarding', () => {
  it('accepts the CLI hash token and scrubs it before runtime calls', () => {
    const authSession = readFileSync(
      join(process.cwd(), 'apps/zavorth-control-vite-shell/src/runtime-auth-session.ts'),
      'utf8',
    );

    expect(authSession).toContain("new URLSearchParams(url.hash.startsWith('#')");
    expect(authSession).toContain("hashParams.get('token')");
    expect(authSession).toContain('sessionStorage.setItem(authStorageKey, tokenFromUrl)');
    expect(authSession).toContain("hashParams.delete('token')");
    expect(authSession).toContain("url.searchParams.delete('token')");
    expect(authSession).toContain("history.replaceState(null, '', url)");
  });

  it('ships first-run guidance in the official /zavorthControl shell', () => {
    const page = readFileSync(join(controlDir, 'page.tsx'), 'utf8');
    const assets = readFileSync(join(controlDir, 'ControlPageAssets.tsx'), 'utf8');
    const shell = readFileSync(join(controlDir, 'LegacyDashboardShell.tsx'), 'utf8');
    const inbox = readFileSync(join(controlDir, 'TerminalInboxSector.tsx'), 'utf8');

    expect(page).toContain('LegacyDashboardShell');
    expect(assets).toContain('readViteModuleScriptSrc');
    expect(shell).toContain('TerminalInboxSector');
    expect(inbox).toContain('Provider');
    expect(inbox).toContain('First run setup');
    expect(inbox).toContain('Nothing is written to memory until you confirm it.');
    expect(inbox).toContain('data-first-run-setup-message');
  });

  it('keeps premium access/onboarding/approval classes in the scoped visual contract', () => {
    const css = readFileSync(
      join(process.cwd(), 'apps/zavorth-control-vite-shell/public/styles/chat.css'),
      'utf8',
    );

    for (const className of [
      'first-run-setup-message',
      'compose-dock__progress-pill',
      'compose-dock__stop',
    ]) {
      expect(css).toContain(`.${className}`);
    }

    expect(css).toContain('.terminal-view:not(.is-empty) .first-run-setup-message');
    expect(css).toContain('var(--b-error)');
  });
});
