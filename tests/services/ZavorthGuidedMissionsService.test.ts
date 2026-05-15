import { describe, expect, it } from '@jest/globals';
import { ZavorthGuidedMissionsService } from '../../src/services/ZavorthGuidedMissionsService';

describe('ZavorthGuidedMissionsService', () => {
  const service = new ZavorthGuidedMissionsService();

  it('exposes a broad guided mission catalog with safety metadata', () => {
    const snapshot = service.buildContract({ profile: 'personal' });

    expect(snapshot.surface).toBe('guided-missions');
    expect(snapshot.catalog.length).toBeGreaterThanOrEqual(10);
    expect(snapshot.categories.length).toBeGreaterThanOrEqual(5);
    expect(snapshot.safety).toMatchObject({
      guidedDoesNotBypassPolicy: true,
      mutationRequiresApproval: true,
      receiptsRequired: true,
      rawSecretsSerialized: false,
    });
    expect(snapshot.catalog.every((mission) => mission.safeFirstStep.length > 0)).toBe(true);
    expect(snapshot.catalog.every((mission) => mission.approvalSummary.length > 0)).toBe(true);
  });

  it('resolves developer repository intents to repo review', () => {
    const snapshot = service.buildContract({
      profile: 'developer',
      intent: 'review this repo and find risky code',
    });

    expect(snapshot.selectedProfile).toBe('developer');
    expect(snapshot.recommended.id).toBe('review-this-repository');
    expect(snapshot.selection.confidence).toMatch(/high|medium/);
    expect(snapshot.recommended.likelyCapabilities).toContain('repo-map');
  });

  it('resolves personal document intents to document summary', () => {
    const snapshot = service.buildContract({
      intent: 'summarize this pdf for me',
    });

    expect(snapshot.selectedProfile).toBe('personal');
    expect(snapshot.recommended.id).toBe('summarize-document');
    expect(snapshot.recommended.mutatesByDefault).toBe(false);
  });

  it('keeps explicit mission selection authoritative', () => {
    const snapshot = service.buildContract({
      profile: 'business',
      missionId: 'connect-a-channel',
      intent: 'audit this repo',
    });

    expect(snapshot.recommended.id).toBe('connect-a-channel');
    expect(snapshot.selection.confidence).toBe('explicit');
    expect(snapshot.recommended.approvalSummary).toContain('SecretRefs');
  });

  it('filters by category while keeping start projection safe', () => {
    const snapshot = service.buildContract({
      category: 'device-help',
      intent: 'look at my phone',
    });

    expect(snapshot.catalog.every((mission) => mission.category === 'device-help')).toBe(true);
    expect(snapshot.recommended.id).toBe('look-at-my-phone');
    expect(snapshot.startProjection.previewOnlyByDefault).toBe(true);
    expect(snapshot.startProjection.policyBrokerRequired).toBe(true);
  });
});
