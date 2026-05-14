import fs from 'fs';
import os from 'os';
import path from 'path';
import { IntegrationInstallerService } from '../../src/services/IntegrationInstallerService';

describe('IntegrationInstallerService', () => {
  function createService() {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-integration-hub-'));
    return new IntegrationInstallerService({
      stateFile: path.join(tempDir, 'state.json'),
      secretsFile: path.join(tempDir, 'secrets.json'),
      now: () => new Date('2026-04-01T12:00:00.000Z'),
    });
  }

  it('builds a safe draft for a native provider', () => {
    const service = createService();

    const draft = service.buildDraft({
      requestedId: 'openrouter',
      persist: false,
    });

    expect(draft.manifest.id).toBe('openrouter');
    expect(draft.selectedMode).toBe('api');
    expect(['planned', 'configured']).toContain(draft.installed.status);
    expect(draft.nextAction.command).toContain('openrouter');
  });

  it('persists a draft when requested', () => {
    const service = createService();

    const draft = service.buildDraft({
      requestedId: 'custom-api',
      answers: {
        service_name: 'ZeroCloud',
      },
      persist: true,
    });

    const installed = service.getInstalled('custom-api');

    expect(draft.manifest.id).toBe('custom-api');
    expect(installed?.answers.service_name).toBe('ZeroCloud');
  });

  it('stores secret answers outside the public draft state', () => {
    const service = createService();

    const draft = service.buildDraft({
      requestedId: 'openrouter',
      answers: {
        openrouter_api_key: 'sk-test-123',
        routing_goal: 'research',
      },
      persist: true,
    });

    const installed = service.getInstalled('openrouter');

    expect(draft.installed.answers.openrouter_api_key).toBeUndefined();
    expect(installed?.answers.openrouter_api_key).toBeUndefined();
    expect(installed?.answers.routing_goal).toBe('research');
    expect(service.getStoredSecretKeys('openrouter')).toContain('openrouter_api_key');
  });
});
