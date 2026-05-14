import { TrustSliderPolicyService } from '../../../src/runtime/uni/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-${++index}`;
}

describe('TrustSliderPolicyService', () => {
  const service = new TrustSliderPolicyService({
    now: () => new Date('2026-05-03T12:00:00.000Z'),
    idFactory: createIdFactory(),
  });

  it('maps the three slider levels to runtime sandbox policy', () => {
    expect(service.buildSnapshot('protected')).toEqual(expect.objectContaining({
      level: 'protected',
      runtimeProfile: 'safe-core',
      sandboxTier: 'safe-core',
      permissionBoundary: 'container-first',
      hostAllowed: false,
    }));
    expect(service.buildSnapshot('collaborator')).toEqual(expect.objectContaining({
      level: 'collaborator',
      runtimeProfile: 'trusted-workspace',
      sandboxTier: 'workspace-scoped',
      permissionBoundary: 'workspace-scoped',
      hostAllowed: false,
    }));
    expect(service.buildSnapshot('overlord')).toEqual(expect.objectContaining({
      level: 'overlord',
      runtimeProfile: 'owner-operator',
      sandboxTier: 'host-scoped',
      permissionBoundary: 'host-scoped',
      hostAllowed: true,
      killSwitchRequired: true,
    }));
  });

  it('blocks protected host scope and destructive execution before tools run', () => {
    const host = service.evaluate({
      level: 'protected',
      hostScopeRequested: true,
      requestedTools: ['shell.exec'],
    });
    const destructive = service.evaluate({
      level: 'protected',
      requestedTools: ['git.reset'],
    });

    expect(host).toEqual(expect.objectContaining({
      decision: 'block',
      sandboxTier: 'safe-core',
      permissionBoundary: 'container-first',
      blocked: true,
    }));
    expect(destructive.blockReason).toContain('destrutiva');
  });

  it('keeps collaborator inside the approved workspace', () => {
    const allowed = service.evaluate({
      level: 'collaborator',
      workspaceRoot: 'C:/repo/Zavorth',
      targetPath: 'C:/repo/Zavorth/src/index.ts',
      requestedTools: ['write_file'],
    });
    const blocked = service.evaluate({
      level: 'collaborator',
      workspaceRoot: 'C:/repo/Zavorth',
      targetPath: 'C:/Windows/System32/drivers/etc/hosts',
      requestedTools: ['write_file'],
    });

    expect(allowed).toEqual(expect.objectContaining({
      decision: 'requires_permission',
      permissionScope: 'once',
      sandboxTier: 'workspace-scoped',
      blocked: false,
    }));
    expect(blocked).toEqual(expect.objectContaining({
      decision: 'block',
      blocked: true,
    }));
    expect(blocked.blockReason).toContain('fora do workspace');
  });

  it('requires owner/operator and kill switch for Overlord', () => {
    const missingOwner = service.evaluate({
      level: 'overlord',
      requestedTools: ['shell.exec'],
    });
    const missingKillSwitch = service.evaluate({
      level: 'overlord',
      userRole: 'operator',
      requestedTools: ['shell.exec'],
    });
    const allowed = service.evaluate({
      level: 'overlord',
      previousLevel: 'collaborator',
      userRole: 'operator',
      killSwitchActive: true,
      requestedTools: ['shell.exec'],
    });

    expect(missingOwner.blockReason).toContain('owner/operator');
    expect(missingKillSwitch.blockReason).toContain('kill switch');
    expect(allowed).toEqual(expect.objectContaining({
      decision: 'requires_permission',
      auditTrailRequired: true,
      killSwitchRequired: true,
      blocked: false,
    }));
    expect(allowed.receipt).toEqual(expect.objectContaining({
      fromLevel: 'collaborator',
      toLevel: 'overlord',
      direction: 'elevation',
      rollbackCommand: 'trust-slider set collaborator',
    }));
  });

  it('keeps governed selfmod behind human preview in protected and collaborator', () => {
    for (const level of ['protected', 'collaborator'] as const) {
      const decision = service.evaluate({
        level,
        requestedTools: ['selfmod.preview'],
      });

      expect(decision).toEqual(expect.objectContaining({
        decision: 'requires_permission',
        previewRequired: true,
        blocked: false,
      }));
    }
  });

  it('emits reduction receipts when slider is lowered', () => {
    const decision = service.evaluate({
      previousLevel: 'overlord',
      level: 'protected',
      requestedTools: [],
    });

    expect(decision.receipt).toEqual(expect.objectContaining({
      fromLevel: 'overlord',
      toLevel: 'protected',
      direction: 'reduction',
      rollbackCommand: null,
    }));
  });
});
