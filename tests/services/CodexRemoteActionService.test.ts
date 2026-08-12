import { CodexRemoteActionService } from '../../src/services/CodexRemoteActionService';

describe('CodexRemoteActionService', () => {
  const codexRemoteSnapshot = {
    generatedAt: '2026-04-07T12:00:00.000Z',
    kernel: {
      label: 'Codex Remote',
      executionMode: 'codex-cli-broker',
      accountRouting: 'profile-routed',
      remoteTransport: 'zavorth-remote-plane',
    },
    summary: {
      cliReady: true,
      activeProfileId: 'default',
      profiles: 1,
      enabledProfiles: 1,
      readyRemotePaths: 1,
      partialRemotePaths: 0,
      webSpawnReady: true,
    },
    activeProfile: {
      id: 'default',
      label: 'Default Codex',
      description: 'Perfil padrao',
      codexCliPath: 'C:\\Codex\\codex.exe',
      codexHome: 'C:\\Users\\ermys\\.codex',
      workspaceRoot: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      enabled: true,
      active: true,
      source: 'default',
    },
    profiles: {
      generatedAt: '2026-04-07T12:00:00.000Z',
      activeProfileId: 'default',
      profiles: [],
      narrative: {
        headline: 'Codex Remote',
        operatorSummary: 'Perfil padrao.',
      },
    },
    remotePaths: [],
    actions: [],
    handoff: {
      recommendedSurface: 'web',
      webSessionReady: true,
      telegramCommand: '/codex continue de onde parou',
      webDraft: null,
    },
    narrative: {
      headline: 'Codex Remote',
      operatorSummary: 'Pronto.',
      nextAction: 'Abrir sessao.',
    },
  };

  it('switches the active profile through the profile registry', async () => {
    const selectProfile = jest.fn(() => ({
      ...codexRemoteSnapshot.activeProfile,
      id: 'work',
      label: 'Work Codex',
    }));
    const service = new CodexRemoteActionService({
      controlPlaneService: {
        buildSnapshot: jest.fn(async () => ({
          ...codexRemoteSnapshot,
          summary: {
            ...codexRemoteSnapshot.summary,
            activeProfileId: 'work',
          },
          activeProfile: {
            ...codexRemoteSnapshot.activeProfile,
            id: 'work',
            label: 'Work Codex',
          },
        })),
      },
      profileRegistryService: {
        selectProfile,
      } as any,
      sessionStoreService: {
        canSpawn: jest.fn(() => true),
        createSession: jest.fn(),
      } as any,
      runtimeUserId: 'web-user',
    });

    const result = await service.execute({
      actionId: 'select-profile',
      profileId: 'work',
      skipApproval: true,
    });

    expect(selectProfile).toHaveBeenCalledWith('work');
    expect(result.action.selectedProfileId).toBe('work');
    expect(result.profile?.label).toBe('Work Codex');
  });

  it('spawns a web handoff session for Codex Remote', async () => {
    const createSession = jest.fn(() => ({
      ok: true,
      platform: 'web',
      sessionId: 'session-web-1',
      chatId: 'web:session-web-1',
      sourceUserId: 'session-web-1',
      runtimeUserId: 'web-user',
      handoffCommand: '/open-session session-web-1',
    }));
    const service = new CodexRemoteActionService({
      controlPlaneService: {
        buildSnapshot: jest.fn(async () => codexRemoteSnapshot),
      },
      profileRegistryService: {
        selectProfile: jest.fn(),
      } as any,
      sessionStoreService: {
        canSpawn: jest.fn(() => true),
        createSession,
      } as any,
      runtimeUserId: 'web-user',
    });

    const result = await service.execute({
      actionId: 'spawn-web-session',
      skipApproval: true,
    });

    expect(createSession).toHaveBeenCalledWith({
      userId: 'web-user',
      platform: 'web',
    });
    expect(result.spawnedSession).toEqual(
      expect.objectContaining({
        sessionId: 'session-web-1',
      }),
    );
    expect(result.action.openSessionId).toBe('session-web-1');
  });

  it('requests approval by default for sensitive Codex Remote actions', async () => {
    const createRequest = jest.fn(async () => ({
      permission_id: 'perm-1',
      status: 'pending',
      executor: 'codex_remote',
      kind: 'session_control',
      reason: 'Iniciar uma nova sessao do Codex Remote.',
      metadata: {},
    }));
    const service = new CodexRemoteActionService({
      controlPlaneService: {
        buildSnapshot: jest.fn(async () => ({
          ...codexRemoteSnapshot,
          sessionBroker: {
            summary: {
              totalSessions: 0,
              pendingApprovals: 1,
            },
          },
        })),
      },
      permissionService: {
        createRequest,
        getRequest: jest.fn(),
        approveRequest: jest.fn(),
        rejectRequest: jest.fn(),
      } as any,
      sessionStoreService: {
        canSpawn: jest.fn(() => true),
        createSession: jest.fn(),
      } as any,
    });

    const result = await service.execute({
      actionId: 'start-session',
      title: 'Demo',
      prompt: 'continue de onde parou',
      runtimeUserId: 'telegram-user',
      sourceSurface: 'telegram',
      sourceChatId: 'telegram:chat-1',
    });

    expect(createRequest).toHaveBeenCalledWith(expect.objectContaining({
      executor: 'codex_remote',
      kind: 'session_control',
      requested_by: 'telegram-user',
    }));
    expect(result.action.status).toBe('pending-approval');
    expect(result.permission?.permission_id).toBe('perm-1');
  });

  it('executes an already-approved permission payload without re-approving it', async () => {
    const getRequest = jest.fn(async () => ({
      permission_id: 'perm-approved',
      status: 'approved',
      executor: 'codex_remote',
      kind: 'session_control',
      metadata: {
        action_id: 'resume-session',
        session_id: 'codex-1',
      },
    }));
    const approveRequest = jest.fn();
    const resumeSession = jest.fn(async () => ({
      record: {
        sessionId: 'codex-1',
        title: 'Sessao 1',
      },
      operatorSummary: 'Sessao retomada.',
      tail: { logLines: [] },
    }));
    const service = new CodexRemoteActionService({
      controlPlaneService: {
        buildSnapshot: jest.fn(async () => codexRemoteSnapshot),
      },
      permissionService: {
        createRequest: jest.fn(),
        getRequest,
        approveRequest,
        rejectRequest: jest.fn(),
      } as any,
      sessionBrokerService: {
        startSession: jest.fn(),
        resumeSession,
        stopSession: jest.fn(),
        openWebSession: jest.fn(),
        attachSpawnedWebSession: jest.fn(),
        readSession: jest.fn(),
      } as any,
      sessionStoreService: {
        canSpawn: jest.fn(() => true),
        createSession: jest.fn(),
      } as any,
    });

    const result = await service.execute({
      actionId: 'approve-permission',
      permissionId: 'perm-approved',
      runtimeUserId: 'telegram-user',
    });

    expect(approveRequest).not.toHaveBeenCalled();
    expect(resumeSession).toHaveBeenCalledWith({
      sessionId: 'codex-1',
      prompt: null,
      requestedBy: 'telegram-user',
    });
    expect(result.action.note).toContain('aprovado e executado');
  });

  it('normalizes profile and permission identifiers copied with trailing punctuation', async () => {
    const approveRequest = jest.fn(async () => ({
      permission_id: 'perm-1',
      status: 'approved',
      executor: 'codex_remote',
      kind: 'profile_management',
      metadata: {
        action_id: 'delete-profile',
        profile_id: 'work-b.',
      },
    }));
    const getRequest = jest.fn(async () => ({
      permission_id: 'perm-1.',
      status: 'pending',
      executor: 'codex_remote',
      kind: 'profile_management',
      metadata: {
        action_id: 'delete-profile',
        profile_id: 'work-b.',
      },
    }));
    const deleteProfile = jest.fn(() => true);
    const service = new CodexRemoteActionService({
      controlPlaneService: {
        buildSnapshot: jest.fn(async () => ({
          ...codexRemoteSnapshot,
          profiles: {
            ...codexRemoteSnapshot.profiles,
            profiles: [
              {
                ...codexRemoteSnapshot.activeProfile,
                id: 'work-b',
                label: 'Work B',
              },
            ],
          },
        })),
      },
      permissionService: {
        createRequest: jest.fn(),
        getRequest,
        approveRequest,
        rejectRequest: jest.fn(),
      } as any,
      profileRegistryService: {
        selectProfile: jest.fn(),
        upsertProfile: jest.fn(),
        deleteProfile,
      } as any,
      sessionStoreService: {
        canSpawn: jest.fn(() => true),
        createSession: jest.fn(),
      } as any,
    });

    const result = await service.execute({
      actionId: 'approve-permission',
      permissionId: 'perm-1.',
      runtimeUserId: 'telegram-user',
    });

    expect(getRequest).toHaveBeenCalledWith('perm-1');
    expect(approveRequest).toHaveBeenCalledWith('perm-1', 'telegram-user', expect.anything());
    expect(deleteProfile).toHaveBeenCalledWith('work-b');
    expect(result.action.note).toContain('aprovado e executado');
  });
});
