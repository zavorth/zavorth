import {
  ConversationalPermissionService,
  UniversalIntentService,
} from '../../../src/runtime/uni/index.js';

describe('ConversationalPermissionService', () => {
  const intentService = new UniversalIntentService({
    now: () => new Date('2026-05-02T12:00:00.000Z'),
  });

  function workspaceMutationRequest() {
    const decision = intentService.decide({
      surface: 'web',
      text: 'organize minha pasta Downloads',
      contextHints: {
        sessionId: 'session-a',
        workspaceRoot: 'C:/repo/Zavorth',
        targetPath: 'C:/repo/Zavorth/downloads',
      },
    });
    if (!decision.permissionRequest) {
      throw new Error('expected permission request');
    }
    return decision.permissionRequest;
  }

  it('consumes once permissions after the first use', () => {
    const service = new ConversationalPermissionService({
      now: () => new Date('2026-05-02T12:00:00.000Z'),
    });
    const grant = service.grant(workspaceMutationRequest(), {
      scope: 'once',
      sessionId: 'session-a',
      workspaceRoot: 'C:/repo/Zavorth',
    });

    expect(service.use(grant.permissionId, {
      sessionId: 'session-a',
      targetPath: 'C:/repo/Zavorth/downloads',
    })).toMatchObject({
      allowed: true,
      consumed: true,
    });
    expect(service.use(grant.permissionId, {
      sessionId: 'session-a',
      targetPath: 'C:/repo/Zavorth/downloads',
    })).toMatchObject({
      allowed: false,
      consumed: true,
      reason: 'Permissao once ja foi consumida.',
    });
  });

  it('does not leak session permissions into another session', () => {
    const service = new ConversationalPermissionService();
    const grant = service.grant(workspaceMutationRequest(), {
      scope: 'session',
      sessionId: 'session-a',
      workspaceRoot: 'C:/repo/Zavorth',
    });

    expect(service.use(grant.permissionId, {
      sessionId: 'session-b',
      targetPath: 'C:/repo/Zavorth/downloads',
    })).toMatchObject({
      allowed: false,
      consumed: false,
      reason: 'Permissao de sessao nao vale para outra sessao.',
    });
  });

  it('keeps workspace permissions inside the declared workspace only', () => {
    const service = new ConversationalPermissionService();
    const grant = service.grant(workspaceMutationRequest(), {
      scope: 'workspace',
      sessionId: 'session-a',
      workspaceRoot: 'C:/repo/Zavorth',
    });

    expect(service.use(grant.permissionId, {
      sessionId: 'session-b',
      targetPath: 'C:/repo/Zavorth/src/index.ts',
    })).toMatchObject({
      allowed: true,
    });
    expect(service.use(grant.permissionId, {
      sessionId: 'session-b',
      targetPath: 'C:/Windows/System32/drivers/etc/hosts',
    })).toMatchObject({
      allowed: false,
      reason: 'Permissao de workspace nao cobre caminho fora do workspace.',
    });
    expect(service.use(grant.permissionId, {
      sessionId: 'session-b',
      targetPath: 'C:/repo/Zavorth/src/index.ts',
      hostScopeRequested: true,
    })).toMatchObject({
      allowed: false,
      reason: 'Permissao conversacional nao autoriza host inteiro.',
    });
  });
});
