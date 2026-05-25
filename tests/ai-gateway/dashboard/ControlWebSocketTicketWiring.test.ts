import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const dashboardDir = join(
  process.cwd(),
  'src/ai-gateway/app/(dashboard)/dashboard',
);

function readDashboardSources(dir: string): string {
  return readdirSync(dir)
    .filter((entry) => !entry.startsWith('__'))
    .map((entry) => join(dir, entry))
    .map((entryPath) => {
      if (statSync(entryPath).isDirectory()) {
        return readDashboardSources(entryPath);
      }

      if (!/\.(ts|tsx)$/.test(entryPath)) {
        return '';
      }

      return readFileSync(entryPath, 'utf8');
    })
    .join('\n');
}

describe('Dashboard browser transport security', () => {
  it('does not expose gateway tokens or open browser WebSocket sessions from the Dashboard app', () => {
    const sources = readDashboardSources(dashboardDir);

    expect(sources).not.toContain('new WebSocket');
    expect(sources).not.toContain('/api/auth/ticket');
    expect(sources).not.toContain('url.searchParams.set("token"');
    expect(sources).not.toContain('url.searchParams.set("ticket"');
  });
});
