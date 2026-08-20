import { SupervisedNetworkTunnelAdapter } from '../../../src/adapters/supervisor/SupervisedNetworkTunnelAdapter.js';

describe('SupervisedNetworkTunnelAdapter', () => {
  it('inspects the canonical tunnel status by default', async () => {
    const tunnelService = {
      readStatus: jest.fn(() => ({
        enabled: true,
        running: true,
        ready: true,
        pid: 10,
        tunnelPid: 11,
        cliPath: 'cloudflared',
        hostScriptPath: 'scripts/public-tunnel.js',
        publicUrl: 'https://zavorth.example.com',
        targetUrl: 'http://127.0.0.1:3004',
        checkedAt: '2026-04-11T11:00:00.000Z',
        message: 'Tunnel pronto.',
        stateFile: 'state.json',
        logFile: 'log.txt',
      })),
      ensureStarted: jest.fn(),
      stop: jest.fn(),
    };
    const adapter = new SupervisedNetworkTunnelAdapter({
      tunnelService: tunnelService as any,
    });

    const result = await adapter.execute(
      {
        capability: 'network.tunnel',
        command: '',
      },
      {
        runtimeTarget: 'host',
      } as any,
    );

    expect(tunnelService.readStatus).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    expect(result.metadata?.publicUrl).toBe('https://zavorth.example.com');
  });

  it('starts the tunnel through the canonical service with an explicit target url', async () => {
    const tunnelService = {
      readStatus: jest.fn(),
      ensureStarted: jest.fn(async ({ targetUrl }) => ({
        enabled: true,
        running: true,
        ready: true,
        pid: 20,
        tunnelPid: 21,
        cliPath: 'cloudflared',
        hostScriptPath: 'scripts/public-tunnel.js',
        publicUrl: 'https://public.example.com',
        targetUrl,
        checkedAt: '2026-04-11T11:05:00.000Z',
        message: 'Tunnel publicado.',
        stateFile: 'state.json',
        logFile: 'log.txt',
        started: true,
      })),
      stop: jest.fn(),
    };
    const adapter = new SupervisedNetworkTunnelAdapter({
      tunnelService: tunnelService as any,
    });

    const result = await adapter.execute(
      {
        capability: 'network.tunnel',
        command: JSON.stringify({
          action: 'start',
          targetUrl: 'http://127.0.0.1:3333',
        }),
      },
      {
        runtimeTarget: 'host',
      } as any,
    );

    expect(tunnelService.ensureStarted).toHaveBeenCalledWith({
      targetUrl: 'http://127.0.0.1:3333',
    });
    expect(result.ok).toBe(true);
    expect(result.metadata?.started).toBe(true);
    expect(result.metadata?.publicUrl).toBe('https://public.example.com');
  });

  it('restarts the tunnel by stopping first and then starting again', async () => {
    const tunnelService = {
      readStatus: jest.fn(),
      ensureStarted: jest.fn(async () => ({
        enabled: true,
        running: true,
        ready: true,
        pid: 30,
        tunnelPid: 31,
        cliPath: 'cloudflared',
        hostScriptPath: 'scripts/public-tunnel.js',
        publicUrl: 'https://restart.example.com',
        targetUrl: 'http://127.0.0.1:3004',
        checkedAt: '2026-04-11T11:10:00.000Z',
        message: 'Tunnel reiniciado.',
        stateFile: 'state.json',
        logFile: 'log.txt',
        started: true,
      })),
      stop: jest.fn(async () => ({
        enabled: true,
        running: false,
        ready: false,
        pid: null,
        tunnelPid: null,
        cliPath: 'cloudflared',
        hostScriptPath: 'scripts/public-tunnel.js',
        publicUrl: null,
        targetUrl: 'http://127.0.0.1:3004',
        checkedAt: '2026-04-11T11:09:00.000Z',
        message: 'Tunnel parado.',
        stateFile: 'state.json',
        logFile: 'log.txt',
      })),
    };
    const adapter = new SupervisedNetworkTunnelAdapter({
      tunnelService: tunnelService as any,
    });

    const result = await adapter.execute(
      {
        capability: 'network.tunnel',
        command: JSON.stringify({ action: 'restart' }),
      },
      {
        runtimeTarget: 'host',
      } as any,
    );

    expect(tunnelService.stop).toHaveBeenCalledTimes(1);
    expect(tunnelService.ensureStarted).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    expect(result.metadata?.action).toBe('restart');
  });

  it('rejects unsupported tunnel actions', async () => {
    const adapter = new SupervisedNetworkTunnelAdapter({
      tunnelService: {
        readStatus: jest.fn(),
        ensureStarted: jest.fn(),
        stop: jest.fn(),
      } as any,
    });

    const result = await adapter.execute(
      {
        capability: 'network.tunnel',
        command: JSON.stringify({ action: 'open-portal' }),
      },
      {
        runtimeTarget: 'host',
      } as any,
    );

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('network_tunnel_action_rejected');
  });
});
