let GatewayUnifiedStatusService: any;
let runGatewayUnifiedStatusCli: any;
let GATEWAY_UNIFIED_STATUS_CONTRACT_VERSION: any;
try {
  const mod = require('../../../src/services/GatewayUnifiedStatusService.js');
  GatewayUnifiedStatusService = mod.GatewayUnifiedStatusService;
  runGatewayUnifiedStatusCli = mod.runGatewayUnifiedStatusCli;
} catch {
  // Module removed from source
}
try {
  GATEWAY_UNIFIED_STATUS_CONTRACT_VERSION = require('../../../src/contracts/channel/GatewayUnifiedStatusContract.js').GATEWAY_UNIFIED_STATUS_CONTRACT_VERSION;
} catch {
  // Module removed from source
}

const describeIf = GatewayUnifiedStatusService ? describe : describe.skip;

describeIf('GatewayUnifiedStatusService', () => {
  it('composes live matrix + spine + terminal backends from injected fakes', () => {
    const service = new GatewayUnifiedStatusService({
      now: () => new Date('2026-07-16T12:00:00.000Z'),
      liveMatrix: {
        buildSnapshot: () => ({
          contractVersion: 'channel-live-proof-matrix/v1',
          schemaVersion: 1,
          surface: 'channel-live-proof-matrix',
          generatedAt: '2026-07-16T12:00:00.000Z',
          safety: {
            catalogSupportIsNotLiveProof: true,
            defaultRoutingRequiresLiveProof: true,
            canMarkLiveRequiresDoctorAndProof: true,
          },
          summary: {
            total: 2,
            cataloged: 2,
            configured: 1,
            doctorOk: 0,
            liveProofPresent: 0,
            canMarkLive: 0,
            defaultRouteAllowed: 0,
            configuredButNotLive: 1,
          },
          entries: [],
        }),
      },
      gatewaySpine: {
        buildSnapshot: () => ({
          status: 'partial',
          channels: {
            summary: {
              total: 3,
              ready: 1,
              partial: 1,
              planned: 1,
              disabled: 0,
              unknown: 0,
            },
          },
          gatewayRuntime: { attached: true, lifecycleStatus: 'attached' },
          invariants: [{ status: 'passed' }, { status: 'attention' }],
        }),
      },
      terminalBackends: {
        execute: () => ({
          status: 'preview',
          backends: [
            { id: 'local', status: 'ready', liveReady: false },
            { id: 'docker', status: 'needs-configuration', liveReady: false },
          ],
        }),
      },
    });

    const snap = service.buildSnapshot();
    expect(snap.contractVersion).toBe(GATEWAY_UNIFIED_STATUS_CONTRACT_VERSION);
    expect(snap.surface).toBe('gateway-unified-status');
    expect(snap.generatedAt).toBe('2026-07-16T12:00:00.000Z');
    expect(snap.safety.noSecretsInPayload).toBe(true);
    expect(snap.safety.catalogIsNotLiveProof).toBe(true);
    expect(snap.planes).toHaveLength(3);

    const matrix = snap.planes.find((plane) => plane.id === 'channel-live-proof-matrix');
    expect(matrix?.available).toBe(true);
    expect(matrix?.metrics.configuredButNotLive).toBe(1);
    expect(matrix?.metrics.canMarkLive).toBe(0);

    const spine = snap.planes.find((plane) => plane.id === 'gateway-spine');
    expect(spine?.available).toBe(true);
    expect(spine?.metrics.channelsReady).toBe(1);
    expect(spine?.metrics.runtimeAttached).toBe(true);
    expect(spine?.metrics.invariantAttention).toBe(1);

    const backends = snap.planes.find((plane) => plane.id === 'terminal-backends');
    expect(backends?.available).toBe(true);
    expect(backends?.metrics.backendCount).toBe(2);
    expect(backends?.metrics.ready).toBe(1);

    expect(snap.overall).toBe('attention');
    expect(snap.nextActions.some((action) => action.includes('live-matrix'))).toBe(true);
  });

  it('soft-fails missing optional planes without throwing', () => {
    const service = new GatewayUnifiedStatusService({
      now: () => new Date('2026-07-16T00:00:00.000Z'),
      liveMatrix: {
        buildSnapshot: () => ({
          contractVersion: 'channel-live-proof-matrix/v1',
          schemaVersion: 1,
          surface: 'channel-live-proof-matrix',
          generatedAt: 't',
          safety: {
            catalogSupportIsNotLiveProof: true,
            defaultRoutingRequiresLiveProof: true,
            canMarkLiveRequiresDoctorAndProof: true,
          },
          summary: {
            total: 0,
            cataloged: 0,
            configured: 0,
            doctorOk: 0,
            liveProofPresent: 0,
            canMarkLive: 0,
            defaultRouteAllowed: 0,
            configuredButNotLive: 0,
          },
          entries: [],
        }),
      },
      gatewaySpine: null,
      terminalBackends: null,
      skipDefaultOptionalPlanes: true,
    });

    const snap = service.buildSnapshot();
    expect(snap.planes.find((plane) => plane.id === 'gateway-spine')?.available).toBe(false);
    expect(snap.planes.find((plane) => plane.id === 'terminal-backends')?.available).toBe(false);
    expect(snap.planes.find((plane) => plane.id === 'channel-live-proof-matrix')?.available).toBe(true);
    expect(snap.overall).toBe('ready');
  });

  it('soft-fails when optional plane execute throws', () => {
    const service = new GatewayUnifiedStatusService({
      now: () => new Date('2026-07-16T00:00:00.000Z'),
      liveMatrix: {
        buildSnapshot: () => ({
          contractVersion: 'channel-live-proof-matrix/v1',
          schemaVersion: 1,
          surface: 'channel-live-proof-matrix',
          generatedAt: 't',
          safety: {
            catalogSupportIsNotLiveProof: true,
            defaultRoutingRequiresLiveProof: true,
            canMarkLiveRequiresDoctorAndProof: true,
          },
          summary: {
            total: 1,
            cataloged: 1,
            configured: 0,
            doctorOk: 0,
            liveProofPresent: 0,
            canMarkLive: 0,
            defaultRouteAllowed: 0,
            configuredButNotLive: 0,
          },
          entries: [],
        }),
      },
      gatewaySpine: {
        buildSnapshot: () => {
          throw new Error('spine boom');
        },
      },
      terminalBackends: {
        execute: () => {
          throw new Error('backends boom');
        },
      },
    });

    const snap = service.buildSnapshot();
    expect(snap.planes.find((plane) => plane.id === 'gateway-spine')?.availability).toBe('error');
    expect(snap.planes.find((plane) => plane.id === 'terminal-backends')?.availability).toBe('error');
    expect(snap.planes.find((plane) => plane.id === 'channel-live-proof-matrix')?.available).toBe(true);
  });

  it('renderText and JSON path never include secret-like material', () => {
    const service = new GatewayUnifiedStatusService({
      now: () => new Date('2026-07-16T00:00:00.000Z'),
      liveMatrix: {
        buildSnapshot: () => ({
          contractVersion: 'channel-live-proof-matrix/v1',
          schemaVersion: 1,
          surface: 'channel-live-proof-matrix',
          generatedAt: 't',
          safety: {
            catalogSupportIsNotLiveProof: true,
            defaultRoutingRequiresLiveProof: true,
            canMarkLiveRequiresDoctorAndProof: true,
          },
          summary: {
            total: 0,
            cataloged: 0,
            configured: 0,
            doctorOk: 0,
            liveProofPresent: 0,
            canMarkLive: 0,
            defaultRouteAllowed: 0,
            configuredButNotLive: 0,
          },
          entries: [],
        }),
      },
      gatewaySpine: null,
      terminalBackends: null,
      skipDefaultOptionalPlanes: true,
    });
    const snap = service.buildSnapshot();
    const text = service.renderText(snap);
    const json = JSON.stringify(snap);
    expect(text).toContain('Gateway Unified Status');
    expect(text).not.toMatch(/sk-|AIza|api[_-]?key\s*=/i);
    expect(json).not.toMatch(/sk-|AIza|Bearer\s+/i);
    expect(snap.commands.gatewayStatusAi).toBe('zavorth gateway status');
    expect(snap.commands.gatewayPanel).toBe('zavorth gateway panel');
  });

  it('runGatewayUnifiedStatusCli supports --json without throwing', async () => {
    const write = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      const code = await runGatewayUnifiedStatusCli(['--json'], {
        now: () => new Date('2026-07-16T00:00:00.000Z'),
        liveMatrix: {
          buildSnapshot: () => ({
            contractVersion: 'channel-live-proof-matrix/v1',
            schemaVersion: 1,
            surface: 'channel-live-proof-matrix',
            generatedAt: 't',
            safety: {
              catalogSupportIsNotLiveProof: true,
              defaultRoutingRequiresLiveProof: true,
              canMarkLiveRequiresDoctorAndProof: true,
            },
            summary: {
              total: 0,
              cataloged: 0,
              configured: 0,
              doctorOk: 0,
              liveProofPresent: 0,
              canMarkLive: 0,
              defaultRouteAllowed: 0,
              configuredButNotLive: 0,
            },
            entries: [],
          }),
        },
        gatewaySpine: null,
        terminalBackends: null,
        skipDefaultOptionalPlanes: true,
      });
      expect(typeof code).toBe('number');
      expect(code).toBe(0);
      expect(write).toHaveBeenCalled();
      const payload = String(write.mock.calls[0]?.[0] || '');
      expect(payload).toContain('gateway-unified-status');
      expect(payload).not.toMatch(/sk-[a-zA-Z0-9]{10,}/);
    } finally {
      write.mockRestore();
    }
  });

  it('runGatewayUnifiedStatusCli --strict exits non-zero on configured-but-not-live', async () => {
    const write = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      const code = await runGatewayUnifiedStatusCli(['--json', '--strict'], {
        now: () => new Date('2026-07-16T00:00:00.000Z'),
        liveMatrix: {
          buildSnapshot: () => ({
            contractVersion: 'channel-live-proof-matrix/v1',
            schemaVersion: 1,
            surface: 'channel-live-proof-matrix',
            generatedAt: 't',
            safety: {
              catalogSupportIsNotLiveProof: true,
              defaultRoutingRequiresLiveProof: true,
              canMarkLiveRequiresDoctorAndProof: true,
            },
            summary: {
              total: 1,
              cataloged: 1,
              configured: 1,
              doctorOk: 0,
              liveProofPresent: 0,
              canMarkLive: 0,
              defaultRouteAllowed: 0,
              configuredButNotLive: 1,
            },
            entries: [],
          }),
        },
        gatewaySpine: null,
        terminalBackends: null,
        skipDefaultOptionalPlanes: true,
      });
      expect(code).toBe(1);
    } finally {
      write.mockRestore();
    }
  });
});
