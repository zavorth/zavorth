import fs from 'fs';
import os from 'os';
import path from 'path';
import { ChannelInstallScaffoldService } from '../../src/services/ChannelInstallScaffoldService.js';
import { ChannelSetupAssistantService } from '../../src/services/ChannelSetupAssistantService.js';

describe('ChannelSetupAssistantService', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  function createService(envText = '') {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-channel-assistant-'));
    tempDirs.push(root);
    const envFilePath = path.join(root, '.env');
    fs.writeFileSync(envFilePath, envText);
    const installService = new ChannelInstallScaffoldService({
      envFilePath,
      projectRoot: root,
      localBaseUrl: 'http://127.0.0.1:33333',
      publicBaseUrl: 'https://zavorth.example',
      now: () => new Date('2026-04-11T10:00:00.000Z'),
    });
    const providerDoctorService = {
      run: jest.fn(async () => ({
        checkedAt: '2026-04-11T10:01:00.000Z',
        status: 'failed',
        summary: 'Doctor encontrou pendencias.',
        command: 'npm run test:channels:smoke',
        items: [
          {
            channelId: 'slack',
            mode: 'native',
            enabled: true,
            configured: false,
            status: 'failed',
            summary: 'Slack precisa de credenciais.',
            error: 'Campos ausentes.',
            recommendedAction: 'npm run test:channels:smoke',
            details: ['Preencha SLACK_BOT_TOKEN.'],
          },
        ],
      })),
    };

    return {
      root,
      envFilePath,
      providerDoctorService,
      service: new ChannelSetupAssistantService({
        installService,
        providerDoctorService: providerDoctorService as any,
        now: () => new Date('2026-04-11T10:00:00.000Z'),
      }),
    };
  }

  it('builds a natural setup session for a selected channel and mode', () => {
    const { service } = createService('SLACK_TRANSPORT=stub\n');

    const session = service.buildSession({
      channelId: 'slack',
      mode: 'native',
    });

    expect(session.status).toBe('needs_config');
    expect(session.selected).toEqual(expect.objectContaining({
      channelId: 'slack',
      setupMode: 'native',
      recommendedMode: 'stub',
      webhookUrl: 'https://zavorth.example/api/webhooks/slack',
    }));
    expect(session.naturalReply).toContain('Slack');
    expect(session.nextActions[0]).toEqual(expect.objectContaining({
      id: 'fill-env',
    }));
  });

  it('applies the safe scaffold and returns the refreshed assistant state', async () => {
    const { service, envFilePath, root } = createService();

    const result = await service.apply({
      channelId: 'signal',
      mode: 'signal-cli',
      requestedBy: 'test',
    });

    const envText = fs.readFileSync(envFilePath, 'utf8');
    expect(result.applyReport.channelId).toBe('signal');
    expect(result.applyReport.directoriesCreated).toEqual(expect.arrayContaining([
      path.join(root, 'data', 'signal-bridge', 'outbox'),
      path.join(root, 'data', 'runtime'),
    ]));
    expect(envText).toContain('SIGNAL_ENABLED=false');
    expect(result.assistant.selected).toEqual(expect.objectContaining({
      channelId: 'signal',
      currentMode: 'signal-cli',
    }));
    expect(result.assistant.naturalReply).toContain('SIGNAL_ACCOUNT_NUMBER');
  });

  it('runs the provider doctor and highlights the selected channel item', async () => {
    const { service, providerDoctorService } = createService('SLACK_TRANSPORT=native\n');

    const result = await service.runDoctor({
      selectedId: 'slack',
      localOnly: true,
    });

    expect(providerDoctorService.run).toHaveBeenCalledWith({ localOnly: true });
    expect(result.doctor.status).toBe('failed');
    expect(result.selectedItem).toEqual(expect.objectContaining({
      channelId: 'slack',
      status: 'failed',
    }));
    expect(result.assistant.selected?.channelId).toBe('slack');
  });
});
