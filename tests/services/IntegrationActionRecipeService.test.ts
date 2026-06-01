import fs from 'fs';
import os from 'os';
import path from 'path';
import { IntegrationHealthService } from '../../src/services/IntegrationHealthService';
import { IntegrationInstallerService } from '../../src/services/IntegrationInstallerService';
import { IntegrationProbeService } from '../../src/services/IntegrationProbeService';
import { IntegrationRegistryService } from '../../src/services/IntegrationRegistryService';
import { IntegrationActionRecipeService } from '../../src/domain/platform-ecosystem/infrastructure/integration-actions/IntegrationActionRecipeService';

describe('IntegrationActionRecipeService', () => {
  const originalEnvOllamaHost = process.env.OLLAMA_HOST;
  const originalEnvOllamaBaseUrl = process.env.OLLAMA_BASE_URL;

  function createRuntime() {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-integration-recipes-'));
    const installer = new IntegrationInstallerService({
      stateFile: path.join(tempDir, 'state.json'),
      secretsFile: path.join(tempDir, 'secrets.json'),
      now: () => new Date('2026-04-01T15:00:00.000Z'),
    });
    const registry = new IntegrationRegistryService();
    const probe = new IntegrationProbeService({
      registryService: registry,
      stateFile: path.join(tempDir, 'probes.json'),
      now: () => new Date('2026-04-01T15:00:00.000Z'),
      fetchImpl: jest.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => '{"models":[]}',
      })) as any,
    });
    const health = new IntegrationHealthService({
      installerService: installer,
      registryService: registry,
      probeService: probe,
      now: () => new Date('2026-04-01T15:00:00.000Z'),
    });

    return {
      installer,
      registry,
      probe,
      health,
    };
  }

  afterEach(() => {
    if (typeof originalEnvOllamaHost === 'string') {
      process.env.OLLAMA_HOST = originalEnvOllamaHost;
    } else {
      delete process.env.OLLAMA_HOST;
    }
    if (typeof originalEnvOllamaBaseUrl === 'string') {
      process.env.OLLAMA_BASE_URL = originalEnvOllamaBaseUrl;
    } else {
      delete process.env.OLLAMA_BASE_URL;
    }
  });

  it('marks only safelisted commands as executable guided actions', () => {
    const { installer, probe, health } = createRuntime();
    const service = new IntegrationActionRecipeService({
      installerService: installer,
      probeService: probe,
      healthService: health,
      ledgerService: { persistRecord: jest.fn() },
    });

    const doctorAction = service.createActionFromCommand(
      'openrouter',
      'doctor:next',
      'Rodar doctor',
      'Revalidar a integracao.',
      'npm run integrations:doctor -- --id openrouter',
      'recommended',
      false,
      'doctor',
    );
    const manualAction = service.createActionFromCommand(
      'openrouter',
      'manual:custom',
      'Acao custom',
      'Precisa revisao manual.',
      'npm run qualquer-coisa',
      'manual',
      false,
      'install_step',
    );

    expect(doctorAction?.executable).toBe(true);
    expect(doctorAction?.manualOnly).toBe(false);
    expect(doctorAction?.impact).toEqual(expect.objectContaining({ level: 'read_only' }));
    expect(manualAction?.executable).toBe(false);
    expect(manualAction?.manualOnly).toBe(true);
    expect(manualAction?.impact).toEqual(expect.objectContaining({ level: 'manual' }));
  });

  it('executes the Ollama host recipe through the delegated runtime binding callback', async () => {
    const { installer, registry, probe, health } = createRuntime();
    const persistRecord = jest.fn();
    const applyRuntimeBinding = jest.fn((envKey: string, value: string) => {
      process.env[envKey] = value;
    });
    delete process.env.OLLAMA_HOST;
    delete process.env.OLLAMA_BASE_URL;
    installer.buildDraft({
      requestedId: 'ollama',
      persist: true,
      selectedMode: 'docker',
    });

    const service = new IntegrationActionRecipeService({
      installerService: installer,
      probeService: probe,
      healthService: health,
      ledgerService: { persistRecord },
      applyRuntimeBinding,
      now: () => new Date('2026-04-01T15:00:00.000Z'),
    });

    const manifest = registry.getManifestById('ollama');
    expect(manifest).toBeTruthy();
    const doctor = health.buildDoctorSnapshot('ollama');
    const action = service.buildRecipeActions(manifest!, doctor)
      .find((entry) => entry.id === 'recipe:ollama:prepare-host');
    const record = await service.executeRecipeAction('ollama', action!);

    expect(action).toBeTruthy();
    expect(applyRuntimeBinding).toHaveBeenCalledWith('OLLAMA_HOST', 'http://127.0.0.1:11434');
    expect(record).toEqual(expect.objectContaining({
      actionId: 'recipe:ollama:prepare-host',
      appliedEnvKeys: ['OLLAMA_HOST'],
      status: record?.doctor?.status === 'ok' ? 'completed' : 'partial',
    }));
    expect(persistRecord).toHaveBeenCalledWith(expect.objectContaining({
      actionId: 'recipe:ollama:prepare-host',
    }));
    expect(process.env.OLLAMA_HOST).toBe('http://127.0.0.1:11434');
  });
});
