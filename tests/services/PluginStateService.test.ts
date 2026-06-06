import { PluginStateService } from '../../src/services/PluginStateService.js';

describe('PluginStateService', () => {
  it('resolves defaults when there is no persisted state', () => {
    const service = new PluginStateService({
      now: () => new Date('2026-04-02T12:00:00.000Z'),
      stateFile: 'X:/missing/plugin-state.json',
      existsSync: jest.fn(() => false),
    });

    const resolved = service.resolveState('openrouter', {
      installed: true,
      trust: 'trusted',
      installedRevision: 'rev-1',
    });

    expect(resolved).toEqual(
      expect.objectContaining({
        pluginId: 'openrouter',
        installed: true,
        trust: 'trusted',
        installedRevision: 'rev-1',
        sourceDigest: null,
        sourceLocator: null,
        sourceTrusted: null,
      }),
    );
  });

  it('preserves persisted review trust overrides when resolving state', () => {
    const service = new PluginStateService({
      now: () => new Date('2026-04-02T12:05:00.000Z'),
      stateFile: 'X:/state/plugin-state.json',
      existsSync: jest.fn(() => true),
      readFileSync: jest.fn(() => JSON.stringify({
        version: 1,
        updatedAt: '2026-04-02T12:04:00.000Z',
        entries: {
          'skill:zavorthBridge': {
            pluginId: 'skill:zavorthBridge',
            installed: true,
            trust: 'review',
            installedRevision: 'rev-2',
            sourceDigest: 'sha256-2',
            sourceLocator: 'registry:remote-catalog',
            sourceTrusted: true,
            updatedAt: '2026-04-02T12:04:00.000Z',
          },
        },
      })),
    });

    const resolved = service.resolveState('skill:zavorthBridge', {
      installed: true,
      trust: 'trusted',
      installedRevision: 'rev-1',
    });

    expect(resolved).toEqual(
      expect.objectContaining({
        pluginId: 'skill:zavorthBridge',
        installed: true,
        trust: 'review',
        installedRevision: 'rev-2',
        sourceDigest: 'sha256-2',
        sourceLocator: 'registry:remote-catalog',
        sourceTrusted: true,
      }),
    );
  });

  it('matches persisted plugin ids case-insensitively when checking approval', () => {
    const service = new PluginStateService({
      stateFile: 'X:/state/plugin-state.json',
      existsSync: jest.fn(() => true),
      readFileSync: jest.fn(() => JSON.stringify({
        version: 1,
        updatedAt: '2026-04-02T12:04:00.000Z',
        entries: {
          'skill:zavorthBridge': {
            pluginId: 'skill:zavorthBridge',
            installed: true,
            trust: 'trusted',
            installedRevision: 'rev-2',
            sourceDigest: 'sha256-2',
            sourceLocator: 'registry:remote-catalog',
            sourceTrusted: true,
            updatedAt: '2026-04-02T12:04:00.000Z',
          },
        },
      })),
    });

    expect(service.isApproved('SKILL:ZavorthBridge')).toBe(true);
  });

  it('builds one approval snapshot without repeated registry reads', () => {
    const readFileSync = jest.fn(() => JSON.stringify({
      version: 1,
      updatedAt: '2026-04-02T12:04:00.000Z',
      entries: {
        'skill:zavorthBridge': {
          pluginId: 'skill:zavorthBridge',
          installed: true,
          trust: 'trusted',
          installedRevision: 'rev-2',
          sourceDigest: 'sha256-2',
          sourceLocator: 'registry:remote-catalog',
          sourceTrusted: true,
          updatedAt: '2026-04-02T12:04:00.000Z',
        },
      },
    }));
    const service = new PluginStateService({
      stateFile: 'X:/state/plugin-state.json',
      existsSync: jest.fn(() => true),
      readFileSync,
    });

    const snapshot = service.getApprovalSnapshot();

    expect(snapshot.isApproved('SKILL:ZavorthBridge')).toBe(true);
    expect(snapshot.isApproved('skill:other')).toBe(false);
    expect(readFileSync).toHaveBeenCalledTimes(1);
  });

  it('does not approve trusted labels without trusted source provenance', () => {
    const service = new PluginStateService({
      stateFile: 'X:/state/plugin-state.json',
      existsSync: jest.fn(() => true),
      readFileSync: jest.fn(() => JSON.stringify({
        version: 1,
        updatedAt: '2026-04-02T12:04:00.000Z',
        entries: {
          'mcp:unsafe': {
            pluginId: 'mcp:unsafe',
            installed: true,
            trust: 'trusted',
            installedRevision: 'rev-2',
            sourceDigest: 'sha256-2',
            sourceLocator: 'registry:remote-catalog',
            sourceTrusted: false,
            updatedAt: '2026-04-02T12:04:00.000Z',
          },
        },
      })),
    });

    expect(service.isApproved('mcp:unsafe')).toBe(false);
  });

  it('does not resolve prototype properties as stored plugin state', () => {
    const service = new PluginStateService({
      stateFile: 'X:/state/plugin-state.json',
      existsSync: jest.fn(() => true),
      readFileSync: jest.fn(() => JSON.stringify({
        version: 1,
        updatedAt: '2026-04-02T12:04:00.000Z',
        entries: {},
      })),
    });

    expect(service.getState('toString')).toBeNull();
    expect(service.isApproved('toString')).toBe(false);
  });
});
