import fs from 'fs';
import os from 'os';
import path from 'path';
import { ChannelInstallScaffoldService } from '../../src/services/ChannelInstallScaffoldService.js';
import { ChannelSetupAssistantService } from '../../src/services/ChannelSetupAssistantService.js';
import { NaturalChannelSetupTurnService } from '../../src/services/NaturalChannelSetupTurnService.js';

describe('NaturalChannelSetupTurnService', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  function createService() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-natural-channel-turn-'));
    tempDirs.push(root);
    const envFilePath = path.join(root, '.env');
    fs.writeFileSync(envFilePath, '');
    const installService = new ChannelInstallScaffoldService({
      envFilePath,
      projectRoot: root,
      localBaseUrl: 'http://127.0.0.1:33333',
      publicBaseUrl: 'https://zavorth.example',
      now: () => new Date('2026-04-11T12:00:00.000Z'),
    });
    const providerDoctorService = {
      run: jest.fn(async () => ({
        checkedAt: '2026-04-11T12:01:00.000Z',
        status: 'passed',
        summary: 'Doctor ok.',
        command: 'npm run test:channels:smoke',
        items: [
          {
            channelId: 'slack',
            mode: 'native',
            enabled: true,
            configured: true,
            status: 'passed',
            summary: 'Slack validado.',
            error: null,
            recommendedAction: null,
            details: [],
          },
        ],
      })),
    };
    const channelActions = {
      execute: jest.fn(async () => ({
        generatedAt: '2026-04-11T12:02:00.000Z',
        channelId: 'slack',
        actionId: 'send-test',
        status: 'applied',
        ok: true,
        summary: 'Teste de broadcast enviado para Slack.',
        details: [],
        selected: null,
        snapshot: { entries: [], summary: {}, selected: null, narrative: {}, featuredIds: [], generatedAt: '2026-04-11T12:02:00.000Z' },
      })),
    };
    const assistant = new ChannelSetupAssistantService({
      installService,
      providerDoctorService: providerDoctorService as any,
      now: () => new Date('2026-04-11T12:00:00.000Z'),
    });

    return {
      envFilePath,
      providerDoctorService,
      channelActions,
      service: new NaturalChannelSetupTurnService({
        assistant,
        channelActions: channelActions as any,
        now: () => new Date('2026-04-11T12:00:00.000Z'),
      }),
    };
  }

  it('turns a natural setup request into scaffold, doctor and send-test', async () => {
    const { service, envFilePath, providerDoctorService, channelActions } = createService();

    const result = await service.buildTurn({
      intentText: 'Quero conectar o Zavorth no Slack native. Slack bot token é xoxb-123. Signing secret é shh-456. Slack channel id é C123. Aplique, valide e mande um teste.',
      requestedBy: 'tester',
      autoApply: true,
      autoDoctor: true,
      autoTest: true,
    });

    const envText = fs.readFileSync(envFilePath, 'utf8');
    expect(result.channelId).toBe('slack');
    expect(result.mode).toBe('native');
    expect(result.remainingEnvKeys).toEqual([]);
    expect(result.applyResult?.applyReport.channelId).toBe('slack');
    expect(result.doctorResult?.selectedItem?.status).toBe('passed');
    expect(result.sendTest?.status).toBe('applied');
    expect(result.promotionReady).toBe(true);
    expect(providerDoctorService.run).toHaveBeenCalled();
    expect(channelActions.execute).toHaveBeenCalledWith(expect.objectContaining({
      channelId: 'slack',
      actionId: 'send-test',
    }));
    expect(envText).toContain('SLACK_BOT_TOKEN=xoxb-123');
    expect(envText).toContain('SLACK_SIGNING_SECRET=shh-456');
    expect(envText).toContain('SLACK_ALLOWED_CHANNEL_IDS=C123');
  });

  it('asks for the channel first when the request is still ambiguous', async () => {
    const { service } = createService();

    const result = await service.buildTurn({
      intentText: 'Quero conectar voce em mais um lugar, mas ainda nao decidi qual.',
    });

    expect(result.channelId).toBeNull();
    expect(result.applyResult).toBeNull();
    expect(result.naturalReply).toContain('Me diga qual canal voce quer conectar');
  });

  it('previews requested mutations without writing secrets or running doctor/test', async () => {
    const { service, envFilePath, providerDoctorService, channelActions } = createService();

    const result = await service.buildTurn({
      intentText: 'Quero conectar Slack native. SLACK_BOT_TOKEN=xoxb-secret. SLACK_SIGNING_SECRET=shh-secret. SLACK_ALLOWED_CHANNEL_IDS=C123. Aplique, valide e mande um teste.',
      requestedBy: 'tester',
      autoApply: true,
      autoDoctor: true,
      autoTest: true,
      previewOnly: true,
    });

    expect(fs.readFileSync(envFilePath, 'utf8')).toBe('');
    expect(result.applyResult).toBeNull();
    expect(result.doctorResult).toBeNull();
    expect(result.sendTest).toBeNull();
    expect(providerDoctorService.run).not.toHaveBeenCalled();
    expect(channelActions.execute).not.toHaveBeenCalled();
    expect(result.extractedEntries).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'SLACK_BOT_TOKEN', valuePreview: 'xox***et' }),
      expect.objectContaining({ key: 'SLACK_SIGNING_SECRET', valuePreview: 'shh***et' }),
    ]));
    expect(result.naturalReply).toContain('Preview seguro');
    expect(result.naturalReply).not.toContain('xoxb-secret');
    expect(result.naturalReply).not.toContain('shh-secret');
  });
});
