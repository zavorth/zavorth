import { DiscordGatewayRepairFlowService } from '../../src/services/DiscordGatewayRepairFlowService';
import os from 'os';
import fs from 'fs';
import path from 'path';

describe('DiscordGatewayRepairFlowService', () => {
  it('returns attention for a degraded native Discord gateway', () => {
    const service = new DiscordGatewayRepairFlowService();

    const report = service.inspect({
      mode: 'native',
      enabled: true,
      started: false,
      allowDirectMessages: false,
      allowedGuildIds: [],
      pendingInbox: 0,
      pendingOutbox: 0,
      lastError: 'Gateway nativo ainda inicializando.',
      updatedAt: null,
    });

    expect(report.status).toBe('attention');
    expect(report.summary).toContain('Discord nativo degradado');
    expect(report.nextStep).toContain('/autorepair');
  });

  it('returns not_applicable when Discord is disabled', () => {
    const service = new DiscordGatewayRepairFlowService();

    const report = service.inspect({
      mode: 'native',
      enabled: false,
      started: false,
      allowDirectMessages: false,
      allowedGuildIds: [],
      pendingInbox: 0,
      pendingOutbox: 0,
      lastError: null,
      updatedAt: null,
    });

    expect(report.status).toBe('not_applicable');
  });

  it('returns not_applicable when Discord is dormant in the current profile', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-discord-repair-'));
    const lifecycleFile = path.join(root, 'capability-lifecycle.json');
    fs.writeFileSync(
      lifecycleFile,
      JSON.stringify({
        capabilities: {
          discord: {
            state: 'dormant',
            notes: 'Perfil core nao preaquece Discord.',
          },
        },
      }),
      'utf8',
    );

    const service = new DiscordGatewayRepairFlowService({
      capabilityLifecycleStateFile: lifecycleFile,
      discordRequiredOnBoot: false,
    });

    const report = service.inspect({
      mode: 'native',
      enabled: true,
      started: false,
      allowDirectMessages: false,
      allowedGuildIds: [],
      pendingInbox: 0,
      pendingOutbox: 0,
      lastError: null,
      updatedAt: null,
    });

    expect(report.status).toBe('not_applicable');
    expect(report.summary).toContain('dormente no perfil atual');

    fs.rmSync(root, { recursive: true, force: true });
  });
});
