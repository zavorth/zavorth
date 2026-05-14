import fs from 'fs';
import os from 'os';
import path from 'path';
import { NodePairingService } from '../../src/services/NodePairingService.js';
import { NodeRegistryService } from '../../src/services/NodeRegistryService.js';

describe('NodePairingService', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('creates, claims and revokes pairing drafts for headless nodes', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-node-pairing-'));
    tempDirs.push(root);
    const registry = new NodeRegistryService({
      now: () => new Date('2026-04-02T16:00:00.000Z'),
      stateFile: path.join(root, 'node-mesh-state.json'),
      secretsFile: path.join(root, 'node-mesh-secrets.json'),
      secureStorageService: {
        encryptString: jest.fn((value: string) => `enc:${value}`),
        decryptString: jest.fn((value: string) => value.replace(/^enc:/, '')),
      } as any,
    });
    const service = new NodePairingService({
      now: () => new Date('2026-04-02T16:00:00.000Z'),
      registryService: registry,
    });

    const draft = service.createPairingDraft({
      label: 'WSL Headless',
      requestedBy: 'dashboard',
      capabilityIds: ['system.run', 'browser.proxy'],
    });
    const claimed = service.claimPairing(draft.entry.id, {
      pairingCode: draft.pairingCode,
      hostHints: {
        hostname: 'wsl-host',
      },
    });

    expect(draft).toEqual(
      expect.objectContaining({
        pairingCode: expect.any(String),
        bootstrap: expect.objectContaining({
          packageScript: 'nodes:host',
          command: expect.stringContaining('npm run nodes:host --'),
          pairingToken: expect.stringContaining(draft.entry.id),
        }),
        profile: expect.objectContaining({
          id: 'headless-worker',
        }),
        entry: expect.objectContaining({
          pairingStatus: 'pending',
          label: 'WSL Headless',
          profileId: 'headless-worker',
        }),
      }),
    );
    expect(claimed).toEqual(
      expect.objectContaining({
        sharedSecret: expect.any(String),
        node: expect.objectContaining({
          pairingStatus: 'paired',
          paired: true,
          hostHints: expect.objectContaining({
            hostname: 'wsl-host',
          }),
        }),
      }),
    );
    expect(service.validateSharedSecret(draft.entry.id, claimed?.sharedSecret || null)).toBe(true);
    expect(registry.getStoredSecretKeys(draft.entry.id)).toEqual(['sharedSecret']);
    const revoked = service.revokePairing(draft.entry.id, 'operator-request');
    expect(revoked).toEqual(
      expect.objectContaining({
        pairingStatus: 'revoked',
        status: 'blocked',
      }),
    );
    expect(registry.getStoredSecretKeys(draft.entry.id)).toEqual([]);
  });

  it('stores and preserves approved capability allowlists during pairing flows', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-node-pairing-allowlist-'));
    tempDirs.push(root);
    const registry = new NodeRegistryService({
      now: () => new Date('2026-04-02T16:30:00.000Z'),
      stateFile: path.join(root, 'node-mesh-state.json'),
      secretsFile: path.join(root, 'node-mesh-secrets.json'),
      secureStorageService: {
        encryptString: jest.fn((value: string) => `enc:${value}`),
        decryptString: jest.fn((value: string) => value.replace(/^enc:/, '')),
      } as any,
    });
    const service = new NodePairingService({
      now: () => new Date('2026-04-02T16:30:00.000Z'),
      registryService: registry,
    });

    const draft = service.createPairingDraft({
      label: 'Restricted Headless',
      capabilityIds: ['system.run', 'files.read'],
      approvedCapabilityIds: ['files.read', 'screen.capture'],
    });
    const claimed = service.claimPairing(draft.entry.id, {
      pairingCode: draft.pairingCode,
    });

    expect(draft.entry).toEqual(expect.objectContaining({
      capabilityIds: ['files.read', 'system.run'],
      approvedCapabilityIds: ['files.read'],
    }));
    expect(claimed?.node).toEqual(expect.objectContaining({
      approvedCapabilityIds: ['files.read'],
    }));
  });

  it('updates approved capabilities for paired nodes through the operational allowlist setter', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-node-pairing-policy-'));
    tempDirs.push(root);
    const registry = new NodeRegistryService({
      now: () => new Date('2026-04-02T16:45:00.000Z'),
      stateFile: path.join(root, 'node-mesh-state.json'),
      secretsFile: path.join(root, 'node-mesh-secrets.json'),
      secureStorageService: {
        encryptString: jest.fn((value: string) => `enc:${value}`),
        decryptString: jest.fn((value: string) => value.replace(/^enc:/, '')),
      } as any,
    });
    const service = new NodePairingService({
      now: () => new Date('2026-04-02T16:45:00.000Z'),
      registryService: registry,
    });

    const draft = service.createPairingDraft({
      label: 'Policy Node',
      capabilityIds: ['system.run', 'files.read', 'files.write'],
    });
    service.approvePairing(draft.entry.id, {
      pairingCode: draft.pairingCode,
    });

    const restricted = service.setApprovedCapabilities(draft.entry.id, ['files.read', 'screen.capture'], {
      approvedBy: 'web-user',
      reason: 'Allowlist ajustada no shell oficial.',
      mode: 'custom',
    });
    const unrestricted = service.setApprovedCapabilities(draft.entry.id, [], {
      approvedBy: 'web-user',
      reason: 'Allowlist limpa no shell oficial.',
      mode: 'clear',
    });

    expect(restricted).toEqual(expect.objectContaining({
      approvedCapabilityIds: ['files.read'],
      allowlistAudit: expect.objectContaining({
        approvedBy: 'web-user',
        reason: 'Allowlist ajustada no shell oficial.',
        mode: 'custom',
      }),
    }));
    expect(unrestricted).toEqual(expect.objectContaining({
      approvedCapabilityIds: [],
      allowlistAudit: expect.objectContaining({
        approvedBy: 'web-user',
        reason: 'Allowlist limpa no shell oficial.',
        mode: 'clear',
      }),
    }));
  });

  it('rebuilds the canonical bootstrap draft for pending nodes', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-node-pairing-bootstrap-'));
    tempDirs.push(root);
    const registry = new NodeRegistryService({
      now: () => new Date('2026-04-02T16:50:00.000Z'),
      stateFile: path.join(root, 'node-mesh-state.json'),
      secretsFile: path.join(root, 'node-mesh-secrets.json'),
      secureStorageService: {
        encryptString: jest.fn((value: string) => `enc:${value}`),
        decryptString: jest.fn((value: string) => value.replace(/^enc:/, '')),
      } as any,
    });
    const service = new NodePairingService({
      now: () => new Date('2026-04-02T16:50:00.000Z'),
      registryService: registry,
    });

    const draft = service.createPairingDraft({
      label: 'Bootstrap Node',
      capabilityIds: ['system.run', 'files.read'],
      requestedBy: 'dashboard',
    });

    const rebuilt = service.buildBootstrapForNode(draft.entry.id);

    expect(rebuilt).toEqual(
      expect.objectContaining({
        pairingCode: draft.pairingCode,
        entry: expect.objectContaining({
          id: draft.entry.id,
          pairingStatus: 'pending',
        }),
        bootstrap: expect.objectContaining({
          command: expect.stringContaining(draft.entry.id),
          pairingToken: expect.stringContaining(draft.entry.id),
        }),
      }),
    );
  });

  it('applies desktop and mobile profile defaults when creating pairing drafts', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-node-pairing-profiles-'));
    tempDirs.push(root);
    const registry = new NodeRegistryService({
      now: () => new Date('2026-04-02T17:00:00.000Z'),
      stateFile: path.join(root, 'node-mesh-state.json'),
      secretsFile: path.join(root, 'node-mesh-secrets.json'),
      secureStorageService: {
        encryptString: jest.fn((value: string) => `enc:${value}`),
        decryptString: jest.fn((value: string) => value.replace(/^enc:/, '')),
      } as any,
    });
    const service = new NodePairingService({
      now: () => new Date('2026-04-02T17:00:00.000Z'),
      registryService: registry,
    });

    const desktopDraft = service.createPairingDraft({
      profileId: 'desktop',
      requestedBy: 'dashboard',
    });
    const desktopClaim = service.claimPairing(desktopDraft.entry.id, {
      pairingCode: desktopDraft.pairingCode,
      hostHints: {
        hostname: 'windows-main',
      },
    });
    const mobileDraft = service.createPairingDraft({
      profileId: 'mobile-companion',
      requestedBy: 'dashboard',
    });

    expect(desktopDraft).toEqual(
      expect.objectContaining({
        bootstrap: expect.objectContaining({
          packageScript: 'companion:start',
          command: expect.stringContaining('npm run companion:start --'),
          fallbackCommand: expect.stringContaining('node apps/zavorth-companion/index.js'),
        }),
        profile: expect.objectContaining({
          id: 'desktop-companion',
          kind: 'desktop',
        }),
        entry: expect.objectContaining({
          profileId: 'desktop-companion',
          kind: 'desktop',
          transport: 'remote',
          hostHints: expect.objectContaining({
            surface: 'desktop',
          }),
          capabilityIds: expect.arrayContaining(['screen.capture', 'notifications.send', 'files.read', 'files.write', 'clipboard.read']),
        }),
      }),
    );
    expect(desktopClaim).toEqual(
      expect.objectContaining({
        node: expect.objectContaining({
          pairingStatus: 'paired',
          hostHints: expect.objectContaining({
            hostname: 'windows-main',
            surface: 'desktop',
          }),
        }),
      }),
    );
    expect(mobileDraft).toEqual(
      expect.objectContaining({
        bootstrap: expect.objectContaining({
          packageScript: 'companion:start',
          command: expect.stringContaining('--surface mobile'),
        }),
        profile: expect.objectContaining({
          id: 'mobile-companion',
          kind: 'mobile',
        }),
        entry: expect.objectContaining({
          profileId: 'mobile-companion',
          kind: 'mobile',
          transport: 'remote',
          hostHints: expect.objectContaining({
            surface: 'mobile',
          }),
          capabilityIds: expect.arrayContaining(['device.info', 'notifications.send', 'location.read', 'camera.capture']),
        }),
      }),
    );
  });

  it('refuses claim and approve when the pairing draft has already expired', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-node-pairing-expired-'));
    tempDirs.push(root);
    const secureStorageService = {
      encryptString: jest.fn((value: string) => `enc:${value}`),
      decryptString: jest.fn((value: string) => value.replace(/^enc:/, '')),
    } as any;
    const registry = new NodeRegistryService({
      now: () => new Date('2026-04-02T18:00:00.000Z'),
      stateFile: path.join(root, 'node-mesh-state.json'),
      secretsFile: path.join(root, 'node-mesh-secrets.json'),
      pairingDraftStaleMs: 1000 * 60 * 30,
      secureStorageService,
    });
    const service = new NodePairingService({
      now: () => new Date('2026-04-02T18:00:00.000Z'),
      registryService: registry,
    });

    const draft = service.createPairingDraft({
      label: 'Stale Desktop',
      profileId: 'desktop-companion',
      requestedBy: 'dashboard',
    });

    const laterRegistry = new NodeRegistryService({
      now: () => new Date('2026-04-02T20:00:00.000Z'),
      stateFile: path.join(root, 'node-mesh-state.json'),
      secretsFile: path.join(root, 'node-mesh-secrets.json'),
      pairingDraftStaleMs: 1000 * 60 * 30,
      secureStorageService,
    });
    const laterService = new NodePairingService({
      now: () => new Date('2026-04-02T20:00:00.000Z'),
      registryService: laterRegistry,
    });

    expect(laterService.claimPairing(draft.entry.id, { pairingCode: draft.pairingCode })).toBeNull();
    expect(laterService.approvePairing(draft.entry.id, { pairingCode: draft.pairingCode })).toBeNull();
  });

  it('regenerates pairing drafts for non-paired nodes with a fresh createdAt and code', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-node-pairing-regenerate-'));
    tempDirs.push(root);
    const secureStorageService = {
      encryptString: jest.fn((value: string) => `enc:${value}`),
      decryptString: jest.fn((value: string) => value.replace(/^enc:/, '')),
    } as any;
    const registry = new NodeRegistryService({
      now: () => new Date('2026-04-02T18:00:00.000Z'),
      stateFile: path.join(root, 'node-mesh-state.json'),
      secretsFile: path.join(root, 'node-mesh-secrets.json'),
      secureStorageService,
    });
    const service = new NodePairingService({
      now: () => new Date('2026-04-02T18:00:00.000Z'),
      registryService: registry,
    });

    const draft = service.createPairingDraft({
      nodeId: 'desktop-node',
      profileId: 'desktop-companion',
      label: 'Desktop Node',
      requestedBy: 'dashboard',
    });

    const laterRegistry = new NodeRegistryService({
      now: () => new Date('2026-04-02T18:30:00.000Z'),
      stateFile: path.join(root, 'node-mesh-state.json'),
      secretsFile: path.join(root, 'node-mesh-secrets.json'),
      secureStorageService,
    });
    const laterService = new NodePairingService({
      now: () => new Date('2026-04-02T18:30:00.000Z'),
      registryService: laterRegistry,
    });

    const regenerated = laterService.regeneratePairingDraft('desktop-node', {
      notes: ['regen'],
    });

    expect(regenerated).toEqual(
      expect.objectContaining({
        pairingCode: expect.any(String),
        entry: expect.objectContaining({
          id: 'desktop-node',
          pairingStatus: 'pending',
          createdAt: '2026-04-02T18:30:00.000Z',
        }),
      }),
    );
    expect(regenerated?.pairingCode).not.toBe(draft.pairingCode);
    expect(laterService.regeneratePairingDraft('missing-node')).toBeNull();
  });
});
