import { CAPABILITY_PACK_READINESS_CONTRACT_VERSION } from '../../src/contracts/CapabilityPackReadinessContract';
import { ZavorthCapabilityActivationFlowService } from '../../src/services/ZavorthCapabilityActivationFlowService';
import { ZavorthCapabilityPackReadinessDoctorApiService } from '../../src/services/ZavorthCapabilityPackReadinessDoctorApiService';
import { ZavorthCapabilityPackReadinessDoctorService } from '../../src/services/ZavorthCapabilityPackReadinessDoctorService';

describe('ZavorthCapabilityPackReadinessDoctorService', () => {
  it('detects missing secret refs without reading or serializing secret values', () => {
    const doctor = new ZavorthCapabilityPackReadinessDoctorService({
      now: () => new Date('2026-05-08T13:00:00.000Z'),
    });

    const snapshot = doctor.buildSnapshot({
      packId: 'official-ops-skills',
      targetItemId: 'skill:zavorth-pulse',
    });

    expect(snapshot.contractVersion).toBe(CAPABILITY_PACK_READINESS_CONTRACT_VERSION);
    expect(snapshot.policy).toMatchObject({
      readsSecretValues: false,
      secretsSerialized: false,
      checksPresenceOnly: true,
      liveActivationApplied: false,
    });
    expect(snapshot.items).toHaveLength(1);
    expect(snapshot.items[0].status).toBe('needs_configuration');
    expect(snapshot.items[0].blockers).toEqual(expect.arrayContaining([
      'calendar.oauth must be configured as a secret ref.',
      'mail.oauth must be configured as a secret ref.',
    ]));
    expect(JSON.stringify(snapshot)).not.toContain('calendar-token-value');
  });

  it('marks no-secret skills ready when manual and probe checks are completed', () => {
    const doctor = new ZavorthCapabilityPackReadinessDoctorService({
      now: () => new Date('2026-05-08T13:00:00.000Z'),
    });

    const snapshot = doctor.buildSnapshot({
      packId: 'official-ops-skills',
      targetItemId: 'skill:release-readiness',
      completedManualSteps: ['review scope and approval budget'],
      completedReadinessChecks: ['release-readiness-readiness', 'artifact-receipt-policy'],
    });

    expect(snapshot.summary.ready).toBe(1);
    expect(snapshot.items[0].status).toBe('ready_for_activation_request');
  });

  it('checks local routes for local provider pack items', () => {
    const api = new ZavorthCapabilityPackReadinessDoctorApiService({
      now: () => new Date('2026-05-08T13:00:00.000Z'),
    });

    const missing = api.buildSnapshot({
      packId: 'official-ai-access',
      targetItemId: 'provider:ollama-local',
    });
    const ready = api.buildSnapshot({
      packId: 'official-ai-access',
      targetItemId: 'provider:ollama-local',
      completedManualSteps: ['start local model server'],
      completedReadinessChecks: ['ollama-local-doctor', 'model-route-policy'],
      localRoutes: {
        'ollama-local': true,
      },
    });

    expect(missing.items[0].status).toBe('needs_configuration');
    expect(ready.items[0].status).toBe('ready_for_activation_request');
  });

  it('surfaces official browser and voice provisioning gaps with safe readiness checks', () => {
    const doctor = new ZavorthCapabilityPackReadinessDoctorService({
      now: () => new Date('2026-05-08T13:00:00.000Z'),
      env: {},
    });

    const browser = doctor.buildSnapshot({
      packId: 'official-tool-bridges',
      targetItemId: 'mcp:browser-sidecar',
    });
    const voice = doctor.buildSnapshot({
      packId: 'official-tool-bridges',
      targetItemId: 'runtime-capability:local-voice-dictation',
    });

    expect(browser.items[0]).toEqual(expect.objectContaining({
      itemId: 'mcp:browser-sidecar',
      status: 'needs_configuration',
      nextAction: 'ZAVORTH_BROWSER_SIDECAR_URL must exist. Value will not be read by the doctor.',
    }));
    expect(browser.items[0].checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'env:ZAVORTH_BROWSER_SIDECAR_URL', status: 'missing' }),
      expect.objectContaining({ id: 'manual:run browser doctor', status: 'manual' }),
      expect.objectContaining({ id: 'readiness:mcp-browser-doctor', status: 'pending' }),
    ]));

    expect(voice.items[0]).toEqual(expect.objectContaining({
      itemId: 'runtime-capability:local-voice-dictation',
      status: 'needs_configuration',
    }));
    expect(voice.items[0].checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'env:ZAVORTH_WHISPER_BINARY', status: 'missing' }),
      expect.objectContaining({ id: 'env:ZAVORTH_WHISPER_MODEL', status: 'missing' }),
      expect.objectContaining({ id: 'manual:grant microphone permission', status: 'manual' }),
      expect.objectContaining({ id: 'readiness:voice-dictation-doctor', status: 'pending' }),
    ]));
    expect(JSON.stringify(voice)).not.toContain('super-secret-token');
  });

  it('marks official browser and voice edges ready only after provisioned checks pass', () => {
    const doctor = new ZavorthCapabilityPackReadinessDoctorService({
      now: () => new Date('2026-05-08T13:00:00.000Z'),
      env: {
        ZAVORTH_BROWSER_SIDECAR_URL: 'http://127.0.0.1:20187',
        ZAVORTH_WHISPER_BINARY: 'C:/tools/whisper-cli.exe',
        ZAVORTH_WHISPER_MODEL: 'C:/models/ggml-base.bin',
      },
    });

    const browser = doctor.buildSnapshot({
      packId: 'official-tool-bridges',
      targetItemId: 'mcp:browser-sidecar',
      completedManualSteps: ['run browser doctor'],
      completedReadinessChecks: ['browser-sidecar-health', 'network-policy', 'mcp-browser-doctor'],
      localRoutes: {
        'browser-sidecar': true,
      },
    });
    const voice = doctor.buildSnapshot({
      packId: 'official-tool-bridges',
      targetItemId: 'runtime-capability:local-voice-dictation',
      completedManualSteps: ['grant microphone permission'],
      completedReadinessChecks: ['voice-dictation-doctor', 'local-audio-policy'],
      localRoutes: {
        'local-voice-dictation': true,
      },
    });

    expect(browser.items[0].status).toBe('ready_for_activation_request');
    expect(voice.items[0].status).toBe('ready_for_activation_request');
  });

  it('moves activation flow into waiting_readiness until probes are complete', () => {
    const flow = new ZavorthCapabilityActivationFlowService({
      now: () => new Date('2026-05-08T13:00:00.000Z'),
    });

    const waiting = flow.buildSnapshot({
      packId: 'official-ops-skills',
      targetItemId: 'skill:release-readiness',
      text: 'ative release readiness',
      approvalId: 'approval-release',
    });
    const ready = flow.buildSnapshot({
      packId: 'official-ops-skills',
      targetItemId: 'skill:release-readiness',
      text: 'ative release readiness',
      approvalId: 'approval-release',
      completedManualSteps: ['review scope and approval budget'],
      completedReadinessChecks: ['release-readiness-readiness', 'artifact-receipt-policy'],
    });

    expect(waiting.status).toBe('waiting_readiness');
    expect(waiting.packReadinessSnapshot?.items[0].status).toBe('needs_probe');
    expect(ready.status).toBe('ready_for_controlled_activation');
    expect(ready.activation.liveActivationApplied).toBe(false);
  });
});
