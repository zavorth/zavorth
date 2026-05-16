import { formatCliHelp } from '../../src/cli/ZavorthCliSurfaceHelpers';
import { runZavorthCli } from '../../src/cli/ZavorthCli';

describe('Zavorth CLI product demo', () => {
  it('renders zavorth demo from the public CLI registry without loading runtime internals', async () => {
    const writes: string[] = [];

    const exitCode = await runZavorthCli(['demo'], {
      write: (value) => writes.push(value),
      error: () => undefined,
    });

    expect(exitCode).toBe(0);
    expect(writes[0]).toContain('Zavorth Demo');
    expect(writes[0]).toContain('10-minute path');
    expect(writes[0]).toContain('Visual Home');
    expect(writes[0]).toContain('zavorth go');
    expect(writes[0]).toContain('zavorth demo browser');
    expect(writes[0]).toContain('GitHub');
    expect(writes[0]).toContain('Telegram');
    expect(writes[0]).toContain('Discord');
    expect(writes[0]).not.toContain('Agent Runtime');
    expect(writes[0]).not.toContain('Policy Broker');
  });

  it('renders zavorth demo JSON with Home, connector checklist and smoke command', async () => {
    const writes: string[] = [];

    const exitCode = await runZavorthCli(['demo', '--json'], {
      write: (value) => writes.push(value),
      error: () => undefined,
    });

    expect(exitCode).toBe(0);
    const snapshot = JSON.parse(writes[0]);
    expect(snapshot.surface).toBe('product-demo');
    expect(snapshot.command.primary).toBe('zavorth start');
    expect(snapshot.command.connectors).toBe('zavorth connectors doctor');
    expect(snapshot.visualHome.openCommand).toBe('zavorth go');
    expect(snapshot.visualHome.browserDemoCommand).toBe('zavorth demo browser');
    expect(snapshot.connectors.checklist.map((entry: { id: string }) => entry.id)).toEqual([
      'github',
      'github-pr-comment',
      'telegram',
      'discord',
    ]);
    expect(snapshot.smoke.command).toBe('npm run zavorth:demo:check');
  });

  it('renders the Phase F start and connectors commands from the public CLI registry', async () => {
    const startWrites: string[] = [];
    const connectorWrites: string[] = [];

    expect(await runZavorthCli(['start'], {
      write: (value) => startWrites.push(value),
      error: () => undefined,
    })).toBe(0);
    expect(await runZavorthCli(['connectors', 'doctor', 'discord'], {
      write: (value) => connectorWrites.push(value),
      error: () => undefined,
    })).toBe(0);

    expect(startWrites[0]).toContain('Zavorth Start');
    expect(startWrites[0]).toContain('zavorth connectors doctor');
    expect(connectorWrites[0]).toContain('Zavorth Connector Doctor');
    expect(connectorWrites[0]).toContain('Discord');
    expect(connectorWrites[0]).toContain('zavorth connectors setup discord --apply');
  });

  it('adds focused help for zavorth demo and keeps root help product-first', () => {
    const demoHelp = formatCliHelp('demo');
    const connectorHelp = formatCliHelp('connectors');
    const rootHelp = formatCliHelp();

    expect(demoHelp).toContain('zavorth demo browser');
    expect(demoHelp).toContain('zavorth demo');
    expect(demoHelp).toContain('zavorth demo doctor');
    expect(demoHelp).toContain('zavorth go');
    expect(rootHelp).toContain('zavorth start');
    expect(rootHelp).toContain('zavorth connectors doctor');
    expect(rootHelp).toContain('zavorth demo');
    expect(connectorHelp).toContain('zavorth connectors setup telegram --apply');
    expect(connectorHelp).toContain('zavorth connectors setup discord --apply');
    expect(rootHelp).not.toContain('experience-certify');
    expect(rootHelp).not.toContain('ops run <actionId>');
  });
});
