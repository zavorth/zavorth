import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const zavorthControlDir = join(
  process.cwd(),
  'src/ai-gateway/app/(zavorthControl)/control',
);

function readZavorthControlSources(dir: string): string {
  return readdirSync(dir)
    .filter((entry) => !entry.startsWith('__'))
    .map((entry) => join(dir, entry))
    .map((entryPath) => {
      if (statSync(entryPath).isDirectory()) {
        return readZavorthControlSources(entryPath);
      }

      if (!/\.(ts|tsx)$/.test(entryPath)) {
        return '';
      }

      return readFileSync(entryPath, 'utf8');
    })
    .join('\n');
}

describe('ZavorthControl browser transport security', () => {
  it('does not expose gateway tokens or open browser WebSocket sessions from the ZavorthControl app', () => {
    const sources = readZavorthControlSources(zavorthControlDir);

    expect(sources).not.toContain('new WebSocket');
    expect(sources).not.toContain('/api/auth/ticket');
    expect(sources).not.toContain('url.searchParams.set("token"');
    expect(sources).not.toContain('url.searchParams.set("ticket"');
  });
});
