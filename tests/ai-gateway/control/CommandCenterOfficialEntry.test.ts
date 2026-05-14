import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const appDir = join(process.cwd(), 'src/ai-gateway/app');
const controlDir = join(appDir, '(dashboard)/control');

describe('CommandCenterOfficialEntry', () => {
  it('keeps the root redirected to the product dashboard and restores /dashboard as the operator home', () => {
    const rootPage = readFileSync(join(appDir, 'page.tsx'), 'utf8');
    const dashboardPage = readFileSync(join(appDir, '(dashboard)/dashboard/page.tsx'), 'utf8');

    expect(rootPage).toContain('redirect("/dashboard")');
    expect(dashboardPage).toContain('HomePageClient');
    expect(dashboardPage).toContain('getMachineId');
  });

  it('removes /control as a routable product entry while keeping internals available for refactor', () => {
    const view = readFileSync(join(controlDir, 'controlPageClient.view.tsx'), 'utf8');

    expect(existsSync(join(controlDir, 'page.tsx'))).toBe(false);
    expect(view).toContain('CommandCenterControlShell');
    expect(view).not.toContain('ControlPageClientHeader');
    expect(view).not.toContain('ControlPageClientSidebar');
    expect(view).not.toContain('ControlPageClientMain');
  });

});
