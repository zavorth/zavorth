import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(__dirname, '../../../');

function read(rel: string): string {
  return readFileSync(join(root, rel), 'utf8');
}

describe('Dashboard React islands', () => {
  it('ships React islands for Work / Review / Proof in the Vite shell', () => {
    const islands = read('apps/zavorth-control-vite-shell/src/react/DashboardReactIslands.tsx');
    const mount = read('apps/zavorth-control-vite-shell/src/react/mountDashboardReactIslands.ts');
    const pages = read('apps/zavorth-control-vite-shell/src/pages.ts');
    const registry = read('apps/zavorth-control-vite-shell/src/dashboard-surface-registry.ts');

    expect(islands).toContain('WorkOverviewIsland');
    expect(islands).toContain('ReviewApprovalsIsland');
    expect(islands).toContain('ProofReceiptsIsland');
    expect(islands).toContain('data-react-dashboard-island');
    expect(islands).toContain('data-dashboard-runtime-title');
    expect(islands).toContain('data-sales-os-metric="approvals"');
    expect(islands).toContain('data-receipts-list');

    expect(mount).toContain('mountDashboardReactIslands');
    expect(mount).toContain('renderToStaticMarkup');

    expect(pages).toContain("from './react/mountDashboardReactIslands'");
    expect(pages).toContain('mountDashboardReactIslands()');
    expect(pages).not.toMatch(/populate\('sector-overview'/);
    expect(pages).not.toMatch(/populate\('sector-sales-os'/);
    expect(pages).not.toMatch(/populate\('sector-instances'/);

    expect(registry).toContain('DASHBOARD_REACT_ISLAND_SECTOR_IDS');
    expect(registry).toContain('overview');
    expect(registry).toContain('sales-os');
    expect(registry).toContain('instances');
  });

  it('mounts Channels, Sessions and Cron as live islands', () => {
    const islands = read('apps/zavorth-control-vite-shell/src/react/DashboardReactIslands.tsx');
    const pages = read('apps/zavorth-control-vite-shell/src/pages.ts');
    const registry = read('apps/zavorth-control-vite-shell/src/dashboard-surface-registry.ts');

    expect(islands).toContain('ChannelsIsland');
    expect(islands).toContain('SessionsIsland');
    expect(islands).toContain('CronIsland');
    expect(islands).toContain('data-react-dashboard-island="channels"');
    expect(islands).toContain('data-react-dashboard-island="sessions"');
    expect(islands).toContain('data-react-dashboard-island="cron"');
    expect(islands).toContain('sector-channels');
    expect(islands).toContain('sector-sessions');
    expect(islands).toContain('sector-cron');
    expect(islands).toContain('data-session-search');
    expect(islands).toContain('data-sessions-table');
    expect(islands).toContain('data-dashboard-prompt');
    expect(islands).toContain('data-dashboard-sector');
    expect(islands).toContain('daily-channel-row');
    expect(islands).toContain('Connect Telegram. Show only missing credentials.');
    expect(islands).toContain('Test configured channels and show only failures or missing credentials.');
    expect(islands).toContain('card-grid card-grid--quiet');
    expect(islands).toContain('Channel status');

    expect(pages).not.toMatch(/populate\('sector-channels'/);
    expect(pages).not.toMatch(/populate\('sector-sessions'/);
    expect(pages).not.toMatch(/populate\('sector-cron'/);

    expect(registry).toContain("'channels'");
    expect(registry).toContain("'sessions'");
    expect(registry).toContain("'cron'");
  });

  it('mounts Agents, Skills and Config as live islands', () => {
    const islands = read('apps/zavorth-control-vite-shell/src/react/DashboardReactIslands.tsx');
    const pages = read('apps/zavorth-control-vite-shell/src/pages.ts');
    const registry = read('apps/zavorth-control-vite-shell/src/dashboard-surface-registry.ts');

    expect(islands).toContain('AgentsIsland');
    expect(islands).toContain('SkillsIsland');
    expect(islands).toContain('ConfigIsland');
    expect(islands).toContain('data-react-dashboard-island="agents"');
    expect(islands).toContain('data-react-dashboard-island="skills"');
    expect(islands).toContain('data-react-dashboard-island="config"');
    expect(islands).toContain('sector-agents');
    expect(islands).toContain('sector-skills');
    expect(islands).toContain('sector-config');

    expect(islands).toContain('data-runtime-adapter-action');
    expect(islands).toContain('data-runtime-adapter-metric');
    expect(islands).toContain('data-runtime-adapter-register-form');
    expect(islands).toContain('data-runtime-adapter-profile-select');
    expect(islands).toContain('data-runtime-adapter-prompt');
    expect(islands).toContain('data-runtime-adapter-receipt-status');
    expect(islands).toContain('data-runtime-adapter-grid');

    expect(islands).toContain('data-skill-search');
    expect(islands).toContain('data-skill-filter');
    expect(islands).toContain('data-tools-live-ready');
    expect(islands).toContain('premium-skill-list');

    expect(islands).toContain('data-zavorth-locale-select');
    expect(islands).toContain('data-zavorth-locale-apply');
    expect(islands).toContain('data-runtime-engine-active');
    expect(islands).toContain('data-runtime-engine-cards');
    expect(islands).toContain('data-trusted-workspace-form');
    expect(islands).toContain('data-trusted-workspaces-list');
    expect(islands).toContain('model-preference-form');
    expect(islands).toContain('data-provider-model-catalog-summary');

    expect(islands).toContain('data-dashboard-sector');
    expect(islands).toContain('data-dashboard-prompt');

    expect(pages).not.toMatch(/populate\('sector-agents'/);
    expect(pages).not.toMatch(/populate\('sector-skills'/);
    expect(pages).not.toMatch(/populate\('sector-config'/);

    expect(registry).toContain("'agents'");
    expect(registry).toContain("'skills'");
    expect(registry).toContain("'config'");
  });

  it('expands Next control shell inactive sectors to React surfaces', () => {
    const shell = read('src/ai-gateway/app/(zavorthControl)/control/LegacyZavorthControlShell.tsx');
    const surfaces = read('src/ai-gateway/app/(zavorthControl)/control/ZavorthControlSurfaces.tsx');

    for (const name of [
      'ReviewSurface',
      'ProofSurface',
      'ChannelsSurface',
      'SessionsSurface',
      'CronSurface',
      'AgentsSurface',
      'DocsSurface',
      'WorkSurface',
    ]) {
      expect(shell).toContain(name);
      expect(surfaces).toContain(`export function ${name}`);
    }

    expect(shell).not.toContain('sectors.salesOs');
    expect(shell).not.toContain('sectors.instances');
    expect(shell).not.toContain('sectors.channels');
    expect(shell).not.toContain('sectors.sessions');
    expect(shell).not.toContain('sectors.agents');
    expect(shell).not.toContain('sectors.cron');
    expect(shell).not.toContain('sectors.docs');

    expect(surfaces).toContain('data-react-dashboard-island="overview"');
    expect(surfaces).toContain('data-dashboard-runtime-title');
    expect(surfaces).toContain('data-approvals-queue');
    expect(surfaces).toContain('data-receipts-list');
  });

  it('keeps island source files present', () => {
    expect(existsSync(join(root, 'apps/zavorth-control-vite-shell/src/react/DashboardReactIslands.tsx'))).toBe(true);
    expect(existsSync(join(root, 'apps/zavorth-control-vite-shell/src/react/mountDashboardReactIslands.ts'))).toBe(true);
  });
});
