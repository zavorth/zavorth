import { readFileSync } from 'fs';
import { join } from 'path';

const controlDir = join(
  process.cwd(),
  'src/ai-gateway/app/(dashboard)/control',
);

describe('Control WebSocket ticket wiring', () => {
  it('requests a one-time ticket before opening the browser WebSocket', () => {
    const hook = readFileSync(join(controlDir, 'useControlPageClient.ts'), 'utf8');
    const utils = readFileSync(join(controlDir, 'controlPageClient.utils.ts'), 'utf8');

    expect(hook).toContain('/api/auth/ticket');
    expect(hook).toContain('method: "POST"');
    expect(hook).toContain('buildGatewayWsUrl(sessionId, ticket)');
    expect(utils).toContain('url.searchParams.set("ticket", ticket)');
    expect(utils).not.toContain('url.searchParams.set("token"');
  });
});
