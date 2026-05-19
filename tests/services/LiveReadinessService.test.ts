import { CapabilityNormalizationService } from '../../src/services/CapabilityNormalizationService.js';
import { LiveReadinessService } from '../../src/services/LiveReadinessService.js';

const byName = (snapshot: ReturnType<LiveReadinessService['buildSnapshot']>) =>
  new Map(snapshot.entries.map((entry) => [entry.normalizedSourceName, entry]));

describe('LiveReadinessService Intent model', () => {
  it('builds a truthful no-live-IO readiness snapshot for the full tracked surface', () => {
    const snapshot = new LiveReadinessService({
      now: () => new Date('2026-05-04T18:00:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-04.live-checkpoint-1');
    expect(snapshot.profile).toBe('dry-audit');
    expect(snapshot.status).toBe('attention');
    expect(snapshot.summary.sourceModules).toBe(125);
    expect(snapshot.summary.liveReady).toBeGreaterThan(0);
    expect(snapshot.summary.partialLive).toBeGreaterThan(0);
    expect(snapshot.summary.configuredOnly).toBeGreaterThanOrEqual(0);
    expect(snapshot.summary.dryRunOnly).toBeGreaterThanOrEqual(0);
    expect(snapshot.summary.templateOnly).toBe(0);
    expect(snapshot.summary.planned).toBeGreaterThanOrEqual(0);
    expect(snapshot.summary.blocked).toBe(0);
    expect(snapshot.summary.receipts).toBe(snapshot.summary.sourceModules);
    expect(snapshot.summary.notFullyLive).toBe(
      snapshot.summary.sourceModules - snapshot.summary.liveReady,
    );
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        liveExternalCallRequiredToBuildSnapshot: false,
        liveChannelSendRequiredToBuildSnapshot: false,
        secretValuesSerialized: false,
      }),
    );
    expect(snapshot.policy).toEqual(
      expect.objectContaining({
        noLiveIoDuringReadinessKernel: true,
        noSecretsSerialized: true,
        liveActivationRequiresOperatorConfiguration: true,
        templatesCannotBeCertifiedAsLive: true,
        dryRunCannotBeCertifiedAsLive: true,
        truthfulStatusRequired: true,
      }),
    );
  });

  it('classifies channels by live-ready, partial, dry-run, planned, and template states', () => {
    const snapshot = new LiveReadinessService().buildSnapshot();
    const entries = byName(snapshot);

    expect(entries.get('telegram')).toEqual(
      expect.objectContaining({
        primitiveId: 'channel.message',
        status: 'live-ready',
        recommendedPhase: 'Preview engine - Channel Live Activation P0',
      }),
    );
    expect(entries.get('discord')?.status).toBe('partial-live');
    expect(entries.get('slack')?.status).toBe('partial-live');
    expect(entries.get('whatsapp')?.status).toBe('partial-live');
    expect(entries.get('signal')?.status).toBe('partial-live');
    expect(entries.get('msteams')?.status).toBe('partial-live');
    expect(entries.get('bluebubbles')?.status).toBe('partial-live');
    expect(entries.get('imessage')?.status).toBe('partial-live');
    expect(entries.get('feishu')?.status).toBe('partial-live');
    expect(entries.get('googlechat')?.status).toBe('partial-live');
    expect(entries.get('matrix')?.status).toBe('partial-live');
  });

  it('classifies provider and runtime families without pretending templates are live', () => {
    const snapshot = new LiveReadinessService().buildSnapshot();
    const entries = byName(snapshot);

    expect(entries.get('openai')).toEqual(
      expect.objectContaining({
        primitiveId: 'provider.call',
        status: 'partial-live',
        recommendedPhase: 'Connector registry - Provider Runtime Activation P0',
      }),
    );
    expect(entries.get('anthropic')?.status).toBe('partial-live');
    expect(entries.get('mistral')?.status).toBe('partial-live');
    expect(entries.get('groq')?.status).toBe('partial-live');
    expect(entries.get('lmstudio')?.status).toBe('partial-live');
    expect(entries.get('vercel-ai-gateway')?.status).toBe('partial-live');
    expect(entries.get('amazon-bedrock')).toEqual(
      expect.objectContaining({
        primitiveId: 'provider.call',
        status: 'partial-live',
        recommendedPhase: 'Credential vault - Provider Runtime Activation Long Tail',
      }),
    );
    expect(entries.get('anthropic-vertex')?.status).toBe('partial-live');
    expect(entries.get('sglang')?.status).toBe('partial-live');
    expect(entries.get('voyage')?.status).toBe('partial-live');
    expect(entries.get('zai')?.status).toBe('partial-live');
    expect(entries.get('duckduckgo')).toEqual(
      expect.objectContaining({
        primitiveId: 'search.query',
        status: 'partial-live',
        recommendedPhase: 'Dashboard controls - Research, Web, and Browser Live Activation',
      }),
    );
    expect(entries.get('deepgram')).toEqual(
      expect.objectContaining({
        primitiveId: 'speech.transcribe',
        status: 'partial-live',
        recommendedPhase: 'Surface controls - Speech, TTS, and Voice Live Activation',
      }),
    );
    expect(entries.get('document-extract')).toEqual(
      expect.objectContaining({
        status: 'partial-live',
        recommendedPhase: 'Certification matrix - File, Document, and Diff Live Activation',
      }),
    );
    expect(entries.get('phone-control')?.status).toBe('partial-live');
  });

  it('emits gap groups and receipts without serializing secret values', () => {
    const snapshot = new LiveReadinessService().buildSnapshot();
    const phases = snapshot.gaps.map((gap) => gap.phase);

    expect(phases).toContain('Preview engine - Channel Live Activation P0');
    expect(phases).not.toContain('Approval gate - Channel Long Tail');
    expect(phases).not.toContain('Credential vault - Provider Long Tail');
    expect(phases).toContain('Credential vault - Provider Runtime Activation Long Tail');
    expect(snapshot.receipts).toHaveLength(snapshot.summary.sourceModules);
    expect(snapshot.commands).toEqual(
      expect.objectContaining({
        check: 'npm run live-readiness:check --silent',
        typecheck: 'npm run runtime:check --silent',
        nextStage: 'Preview engine - Channel Live Activation P0',
      }),
    );
    expect(JSON.stringify(snapshot)).not.toContain('sk-');
    expect(JSON.stringify(snapshot)).not.toContain('xoxb-');
    expect(JSON.stringify(snapshot)).not.toContain('secret=');
  });

  it('keeps unmapped inputs blocked instead of hiding them', () => {
    const normalization = new CapabilityNormalizationService();
    const service = new LiveReadinessService();
    const entry = service.buildEntry(normalization.resolveSourceModule('unknown-private-module'));

    expect(entry.status).toBe('blocked');
    expect(entry.primitiveId).toBeNull();
    expect(entry.receipt).toEqual(
      expect.objectContaining({
        status: 'blocked',
        noLiveIo: true,
        secretValuesSerialized: false,
      }),
    );
  });
});
