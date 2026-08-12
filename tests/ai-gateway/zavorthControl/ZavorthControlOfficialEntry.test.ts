import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const appDir = join(process.cwd(), 'src/ai-gateway/app');
const controlDir = join(appDir, '(zavorthControl)/control');
const sharedLayoutsDir = join(process.cwd(), 'src/ai-gateway/shared/components/layouts');
const removedLegacyRoute = ['dash', 'board'].join('');

describe('ZavorthControlOfficialEntry', () => {
  it('keeps /control as the only product Zavorth Control entry', () => {
    const rootPage = readFileSync(join(appDir, 'page.tsx'), 'utf8');
    const landingPage = readFileSync(join(appDir, 'landing/page.tsx'), 'utf8');
    const controlPage = readFileSync(join(controlDir, 'page.tsx'), 'utf8');
    const proxy = readFileSync(join(process.cwd(), 'src/ai-gateway/proxy.ts'), 'utf8');

    expect(rootPage).toContain('redirect("/control")');
    expect(landingPage).toContain('redirect("/control")');
    expect(controlPage).toContain('ControlPageClient');
    expect(controlPage).not.toContain('<iframe');
    expect(controlPage).not.toContain('/zavorth-control/index.html');
    expect(existsSync(join(appDir, 'dashboard'))).toBe(false);
    expect(proxy).toContain('pathname.startsWith("/control")');
  });

  it('removes legacy compatibility route files so they cannot become the default again', () => {
    const view = readFileSync(join(controlDir, 'controlPageClient.view.tsx'), 'utf8');

    expect(existsSync(join(appDir, '(zavorthControl)', removedLegacyRoute))).toBe(false);
    expect(existsSync(join(appDir, '(zavorthControl)/zavorthControl'))).toBe(false);
    expect(existsSync(join(sharedLayoutsDir, 'ZavorthControlShell.tsx'))).toBe(false);
    expect(existsSync(join(controlDir, 'page.tsx'))).toBe(true);
    expect(view).toContain('ZavorthControlControlShell');
  });
});
