import { ZavorthNaturalSetupControlPlaneService } from '../../src/services/ZavorthNaturalSetupControlPlaneService.js';

describe('ZavorthNaturalSetupControlPlaneService', () => {
  it('builds a natural-first setup snapshot from assistant and turn services', async () => {
    const service = new ZavorthNaturalSetupControlPlaneService({
      now: () => new Date('2026-04-12T22:20:00.000Z'),
      workspaceRoot: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      channelSetupAssistantService: {
        buildSession: jest.fn(() => ({
          status: 'needs_scaffold',
          naturalReply: 'Consigo preparar o Discord, mas ainda faltam segredos.',
          options: [
            { channelId: 'discord', label: 'Discord' },
          ],
          selected: {
            channelId: 'discord',
            label: 'Discord',
            missingEnvKeys: ['DISCORD_TOKEN', 'DISCORD_PUBLIC_KEY'],
            operatorNextStep: 'Preencha o token e a public key.',
          },
          channels: {
            entries: [{ id: 'discord', label: 'Discord' }],
          },
        })),
      } as any,
      naturalChannelSetupTurnService: {
        buildTurn: jest.fn(async () => ({
          channelId: 'discord',
          remainingEnvKeys: ['DISCORD_TOKEN'],
          promotionReady: false,
          naturalReply: 'Ja detectei que voce quer o Discord; falta um token para concluir.',
          assistant: {
            status: 'needs_scaffold',
            selected: {
              channelId: 'discord',
              label: 'Discord',
              operatorNextStep: 'Preencha o token e rode o doctor.',
            },
            channels: {
              entries: [{ id: 'discord', label: 'Discord' }],
            },
          },
        })),
      } as any,
      channelMeshService: {
        buildSnapshot: jest.fn(() => ({
          entries: [{ id: 'discord', label: 'Discord' }],
        })),
      } as any,
      capabilityLifecycleService: {
        describeCapability: jest.fn(() => ({
          capabilityId: 'discord',
          label: 'Discord gateway',
          state: 'dormant',
          activationMode: 'lazy',
          approvalRequired: false,
          enabledByProfile: false,
          enabledByUser: false,
          approvalScope: null,
          idleTtlMs: null,
          fallbackBehavior: 'Usar Telegram enquanto Discord fica dormente.',
          estimatedFootprint: {
            ramIdleMb: 36,
            diskMb: 12,
            processCount: 0,
          },
          lastUpdatedAt: null,
        })),
      } as any,
    });

    const snapshot = await service.buildSnapshot({
      intentText: 'Quero me conectar ao Discord com DISCORD_BOT_TOKEN=super-secret-value',
      autoApply: true,
    });

    expect(snapshot.generatedAt).toBe('2026-04-12T22:20:00.000Z');
    expect(snapshot.selectedChannelId).toBe('discord');
    expect(snapshot.summary.posture).toBe('attention');
    expect(snapshot.summary.missingEnvKeys).toBe(1);
    expect(snapshot.summary.operationMode).toBe('preview');
    expect(snapshot.summary.previewOnly).toBe(true);
    expect(snapshot.summary.capabilityId).toBe('discord');
    expect(snapshot.intentText).toContain('DISCORD_BOT_TOKEN=***');
    expect(JSON.stringify(snapshot)).not.toContain('super-secret-value');
    expect(snapshot.planPreview.kind).toBe('NaturalSetupPlan');
    expect(snapshot.planPreview.approvalRequired).toBe(true);
    expect(snapshot.planPreview.canApply).toBe(false);
    expect(snapshot.planPreview.readinessGate.status).toBe('warning');
    expect(snapshot.planPreview.capability?.state).toBe('dormant');
    expect(snapshot.actions[0]).toEqual(expect.objectContaining({ id: 'fill-missing-env' }));
    expect(await service.renderReport({ intentText: 'Quero me conectar ao Discord' })).toContain(
      'Wave A: Natural Setup Agent',
    );
  });

  it('treats ready_to_validate as attention instead of critical', async () => {
    const service = new ZavorthNaturalSetupControlPlaneService({
      channelSetupAssistantService: {
        buildSession: jest.fn(() => ({
          status: 'ready_to_validate',
          naturalReply: 'Discord pronto para doctor.',
          options: [],
          selected: {
            channelId: 'discord',
            label: 'Discord',
            missingEnvKeys: [],
            operatorNextStep: 'Rodar doctor.',
          },
          channels: { entries: [] },
        })),
      } as any,
    });

    const snapshot = await service.buildSnapshot({
      channelId: 'discord',
      intentText: 'Quero conectar ao Discord',
    });

    expect(snapshot.summary.posture).toBe('attention');
    expect(snapshot.summary.operationMode).toBe('explain');
    expect(snapshot.planPreview.canApply).toBe(false);
  });
});
