import { SharedSurfaceConsistencyService } from '../../src/services/SharedSurfaceConsistencyService';

describe('SharedSurfaceConsistencyService', () => {
  it('builds a consistency manifest for web, Telegram and Discord', () => {
    const service = new SharedSurfaceConsistencyService({
      now: () => new Date('2026-04-05T10:00:00.000Z'),
      surfaceReadiness: {
        web: {
          ready: true,
          summary: 'Web is ready for use.',
        },
        telegram: {
          ready: true,
          summary: 'Telegram is ready for use.',
        },
        discord: {
          enabled: true,
          commandExposure: 'operator',
          publicServerMode: false,
          summary: 'Discord com slash operator.',
        },
      },
    });

    const manifest = service.buildManifest();

    expect(manifest.generatedAt).toBe('2026-04-05T10:00:00.000Z');
    expect(manifest.counts.total).toBeGreaterThan(5);
    expect(manifest.counts.webReady).toBe(manifest.counts.total);
    expect(manifest.counts.telegramReady).toBe(manifest.counts.total);
    expect(manifest.recommended).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          commandType: '/task',
          equivalents: expect.objectContaining({
            webPrompt: '/task',
            telegramCommand: '/task',
          }),
          availability: expect.objectContaining({
            web: 'ready',
            telegram: 'ready',
          }),
        }),
        expect.objectContaining({
          commandType: '/autorepair',
          category: 'operations',
        }),
      ]),
    );
  });

  it('marks Telegram as pending when the surface is not ready yet', () => {
    const service = new SharedSurfaceConsistencyService({
      now: () => new Date('2026-04-05T10:00:00.000Z'),
      surfaceReadiness: {
        web: {
          ready: true,
        },
        telegram: {
          ready: false,
          summary: 'Telegram ainda waiting for token e allowlist.',
        },
        discord: {
          enabled: false,
          summary: 'Discord desligado neste host.',
        },
      },
    });

    const manifest = service.buildManifest();

    expect(manifest.surfaces.telegram.ready).toBe(false);
    expect(manifest.counts.telegramReady).toBe(0);
    expect(manifest.summary).toContain('Telegram pendente');
    expect(manifest.recommended).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          commandType: '/access',
          equivalents: expect.objectContaining({
            telegramCommand: '/access',
          }),
          availability: expect.objectContaining({
            telegram: 'pending',
          }),
        }),
      ]),
    );
  });

  it('publishes contextual action snapshots when continuity, approval and workflow data exist', () => {
    const service = new SharedSurfaceConsistencyService({
      now: () => new Date('2026-04-05T10:00:00.000Z'),
      surfaceReadiness: {
        web: { ready: true },
        telegram: { ready: true },
        discord: { enabled: true, commandExposure: 'operator', publicServerMode: false },
      },
    });

    const manifest = service.buildManifest({
      context: {
        access: {
          recommendedPlan: {
            primaryAction: 'remote',
            primaryLabel: 'Close acesso remoto oficial',
            primarySummary: 'Continue o rollout remoto oficial.',
            primaryCommand: 'npm run ops:remote:go',
            openTarget: 'https://zavorth.example.com/app',
          },
          local: {
            appUrl: 'http://127.0.0.1:33333/app',
          },
          remote: {
            appUrl: 'https://zavorth.example.com/app',
          },
        },
        continuity: {
          suggestedAction: {
            reason: 'There is research ready to become a briefing.',
            prompt: 'Resume the previous research and turn the findings into a final briefing.',
          },
          focusTask: {
            taskId: 'task-001',
          },
        },
        tasks: [
          {
            task_id: 'task-001',
            artifacts: [
              {
                id: 'artifact-001',
                name: 'briefing-final.md',
                path: 'artifacts/briefing-final.md',
                summary: 'Briefing final entregue.',
              },
            ],
          },
        ],
        permissions: [
          {
            permission_id: 'perm-001',
            task_id: 'task-001',
            status: 'pending',
            reason: 'Gravar o briefing final no workspace.',
          },
        ],
        workflowRuns: [
          {
            workflow_run_id: 'workflow-001',
            workflow_name: 'ship',
            actionable_stages: [
              {
                id: 'draft',
                label: 'Draft',
                status: 'completed',
                reason: 'Initial draft delivered.',
                task_id: 'task-draft-001',
              },
              {
                id: 'delivery',
                label: 'Entrega final',
                status: 'approval_pending',
                reason: 'Aguardando resumption after approval.',
                task_id: 'task-delivery-001',
              },
            ],
            resume_stage: {
              id: 'delivery',
              label: 'Entrega final',
              reason: 'Aguardando resumption after approval.',
            },
          },
        ],
      },
    });

    expect(manifest.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionType: 'continue-official-access',
          context: expect.objectContaining({
            artifactPath: 'https://zavorth.example.com/app',
          }),
          equivalents: expect.objectContaining({
            telegram: expect.objectContaining({
              value: '/access',
            }),
            discord: expect.objectContaining({
              value: '/access',
            }),
          }),
        }),
        expect.objectContaining({
          actionType: 'continue-latest-context',
          equivalents: expect.objectContaining({
            web: expect.objectContaining({
              mode: 'prompt',
            }),
          }),
        }),
        expect.objectContaining({
          actionType: 'resume-workflow',
          context: expect.objectContaining({
            workflowRunId: 'workflow-001',
            workflowStageId: 'delivery',
          }),
          equivalents: expect.objectContaining({
            telegram: expect.objectContaining({
              value: '/workflow resume workflow-001 delivery',
            }),
            discord: expect.objectContaining({
              value: '/workflow mode:resume input:workflow-001 stage:delivery',
            }),
          }),
        }),
        expect.objectContaining({
          actionId: 'resume-workflow-stage:workflow-001:draft',
          actionType: 'restart-workflow-stage',
          title: 'Rerun Draft',
          context: expect.objectContaining({
            workflowRunId: 'workflow-001',
            workflowStageId: 'draft',
            taskId: 'task-draft-001',
          }),
          equivalents: expect.objectContaining({
            telegram: expect.objectContaining({
              value: '/workflow restart-stage workflow-001 draft',
            }),
            discord: expect.objectContaining({
              value: '/workflow mode:restart-stage input:workflow-001 stage:draft',
            }),
          }),
        }),
        expect.objectContaining({
          actionType: 'approve-pending-task',
          context: expect.objectContaining({
            permissionId: 'perm-001',
          }),
        }),
        expect.objectContaining({
          actionType: 'open-latest-artifact',
          context: expect.objectContaining({
            artifactId: 'artifact-001',
            artifactPath: 'artifacts/briefing-final.md',
          }),
          equivalents: expect.objectContaining({
            telegram: expect.objectContaining({
              mode: 'command',
              value: '/file artifacts/briefing-final.md',
            }),
          }),
        }),
      ]),
    );
  });

  it('publishes the official go action with explicit equivalents for web, Telegram and Discord', () => {
    const service = new SharedSurfaceConsistencyService({
      now: () => new Date('2026-04-05T10:00:00.000Z'),
      surfaceReadiness: {
        web: { ready: true },
        telegram: { ready: true },
        discord: { enabled: true, commandExposure: 'operator', publicServerMode: false },
      },
    });

    const manifest = service.buildManifest({
      context: {
        access: {
          recommendedPlan: {
            primaryAction: 'go',
            primaryLabel: 'Atalho oficial em um comando',
            primarySummary: 'Use the shortest official path to install, start the runtime, and open the best ready surface.',
            primaryCommand: 'npm run ops:go',
            openTarget: 'http://127.0.0.1:33333/app',
          },
          local: {
            appUrl: 'http://127.0.0.1:33333/app',
          },
          remote: {
            appUrl: 'https://zavorth.example.com/app',
          },
        },
      },
    });

    expect(manifest.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionId: 'continue-official-access:go',
          actionType: 'continue-official-access',
          equivalents: expect.objectContaining({
            web: expect.objectContaining({
              mode: 'inline',
              value: 'npm run ops:go',
            }),
            telegram: expect.objectContaining({
              mode: 'command',
              value: '/access',
            }),
            discord: expect.objectContaining({
              mode: 'slash',
              value: '/access',
            }),
          }),
          availability: expect.objectContaining({
            web: 'ready',
            telegram: 'ready',
            discord: 'slash',
          }),
        }),
      ]),
    );
  });

  it('publishes a close action for blocked workflows and hides resume actions after operator close', () => {
    const service = new SharedSurfaceConsistencyService({
      now: () => new Date('2026-04-05T10:00:00.000Z'),
      surfaceReadiness: {
        web: { ready: true },
        telegram: { ready: true },
        discord: { enabled: true, commandExposure: 'operator', publicServerMode: false },
      },
    });

    const blockedManifest = service.buildManifest({
      context: {
        workflowRuns: [
          {
            workflow_run_id: 'workflow-closed-candidate',
            workflow_name: 'ship',
            status: 'blocked',
            operator_state: 'active',
            resume_stage: {
              id: 'delivery',
              label: 'Entrega final',
              reason: 'Bloqueado waiting for decision do operador.',
            },
          },
        ],
      },
    });

    expect(blockedManifest.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionId: 'close-blocked-workflow:workflow-closed-candidate',
          actionType: 'close-blocked-workflow',
          equivalents: expect.objectContaining({
            telegram: expect.objectContaining({
              value: '/workflow close workflow-closed-candidate',
            }),
            discord: expect.objectContaining({
              value: '/workflow mode:close input:workflow-closed-candidate',
            }),
          }),
        }),
      ]),
    );

    const closedManifest = service.buildManifest({
      context: {
        workflowRuns: [
          {
            workflow_run_id: 'workflow-closed-candidate',
            workflow_name: 'ship',
            status: 'blocked',
            operator_state: 'closed',
            resume_stage: {
              id: 'delivery',
              label: 'Entrega final',
              reason: 'Bloqueado waiting for decision do operador.',
            },
          },
        ],
      },
    });

    expect(closedManifest.actions.some((action) => action.actionType === 'resume-workflow')).toBe(false);
    expect(closedManifest.actions.some((action) => action.actionType === 'close-blocked-workflow')).toBe(false);
  });

  it('publishes trust as the primary access action when the host still needs authorization', () => {
    const service = new SharedSurfaceConsistencyService({
      now: () => new Date('2026-04-05T10:00:00.000Z'),
      surfaceReadiness: {
        web: { ready: true },
        telegram: { ready: true },
        discord: { enabled: true, commandExposure: 'operator', publicServerMode: false },
      },
    });

    const manifest = service.buildManifest({
      context: {
        access: {
          recommendedPlan: {
            primaryAction: 'trust',
            primaryLabel: 'Liberar este host',
            primarySummary: 'Authorize this host before running mutable actions, local writes, or persisted deliveries.',
            primaryCommand: '/hostauth trust',
            openTarget: 'http://127.0.0.1:33333/app',
          },
          local: {
            appUrl: 'http://127.0.0.1:33333/app',
          },
          remote: {
            appUrl: 'https://zavorth.example.com/app',
          },
        },
      },
    });

    expect(manifest.actions[0]).toEqual(
      expect.objectContaining({
        actionId: 'continue-official-access:trust',
        actionType: 'continue-official-access',
        equivalents: expect.objectContaining({
          web: expect.objectContaining({
            mode: 'inline',
            value: '/hostauth trust',
          }),
          telegram: expect.objectContaining({
            mode: 'command',
            value: '/hostauth trust',
          }),
          discord: expect.objectContaining({
            mode: 'hidden',
            value: null,
          }),
        }),
      }),
    );
  });
});
