import { AgentWorkspaceConfigService } from '../../src/services/AgentWorkspaceConfigService.js';
import { Database } from '../../src/storage/Database.js';

describe('AgentWorkspaceConfigService', () => {
  afterEach(async () => {
    const db = await Database.getInstance();
    db.run('DELETE FROM agent_workspace_config');
  });

  it('provides a safe default config if none exists', async () => {
    const service = AgentWorkspaceConfigService.getInstance();
    const config = await service.getConfig('test-ws');

    expect(config.workspaceId).toBe('test-ws');
    expect(config.defaultAutonomyProfile).toBe('safe');
    expect(config.allowDeveloperMode).toBe(false);
    expect(config.allowHostPowerMode).toBe(false);
    expect(config.allowPty).toBe(false);
    expect(config.allowTemporaryDirectoryTrust).toBe(false);
    expect(config.allowProviderFallback).toBe(false);
    expect(config.allowTaskMandates).toBe(true);
  });

  it('saves and retrieves the configuration without leaking secrets', async () => {
    const service = AgentWorkspaceConfigService.getInstance();
    await service.updateConfig('test-ws-2', {
      allowDeveloperMode: true,
      allowHostPowerMode: true,
    });

    const config = await service.getConfig('test-ws-2');
    expect(config.allowDeveloperMode).toBe(true);
    expect(config.allowHostPowerMode).toBe(true);
    expect(config.allowPty).toBe(false);
  });
});
