import {
  ZAVORTH_POST_291_RELEASE_CANDIDATE_CONTRACT_VERSION,
  type ZavorthReleaseCandidateReadinessInput,
} from '../../src/contracts/ZavorthPost291ReleaseCandidateContract.js';
import { ZavorthPost291ReleaseCandidateService } from '../../src/services/ZavorthPost291ReleaseCandidateService.js';

describe('ZavorthPost291ReleaseCandidateService Phase C', () => {
  it('publishes the post-291 release candidate snapshot after Phase B readiness', () => {
    const snapshot = createService().buildSnapshot();

    expect(snapshot).toEqual(expect.objectContaining({
      generatedAt: '2026-05-12T00:05:00.000Z',
      contractVersion: ZAVORTH_POST_291_RELEASE_CANDIDATE_CONTRACT_VERSION,
      status: 'release-candidate-ready',
      planId: '302 - Post-291 Zavorth Operationalization Plan',
      phase: 'phase-c-release-candidate',
      previousLiveCanarySwarmStatus: 'live-canary-swarm-ready',
    }));
    expect(snapshot.summary).toEqual(expect.objectContaining({
      readinessItems: 6,
      passedReadinessItems: 6,
      blockedReadinessItems: 0,
      finalDocsReady: 1,
      setupPresetsReady: 1,
      commandCenterPolishReady: 1,
      releaseChecklistReady: 1,
      smokeTestsReady: 1,
      packagingReady: 1,
      publishPerformed: false,
      tagCreated: false,
      deployPerformed: false,
      externalUploadsPerformed: false,
    }));
    expect(snapshot.commands.planStatus).toBe('302 plan complete');
  });

  it('builds readiness receipts without publish, tag, deploy, or upload side effects', () => {
    const receipt = createService().buildReadinessReceipt(createReadiness());

    expect(receipt).toEqual(expect.objectContaining({
      itemId: 'zavorth.post291.rc.final-docs-test',
      kind: 'final-docs',
      title: 'Final docs test',
      status: 'passed',
      command: 'npm run surfaces:check --silent',
      artifactRef: 'docs://test',
      notes: ['docs ready'],
    }));
    expect(receipt.safety).toEqual(expect.objectContaining({
      receiptOnly: true,
      noPublish: true,
      noTag: true,
      noDeploy: true,
      noExternalUpload: true,
    }));
  });

  it('blocks readiness receipts when an RC item is not passed', () => {
    const receipt = createService().buildReadinessReceipt({
      ...createReadiness(),
      passed: false,
    });

    expect(receipt.status).toBe('blocked');
  });

  it('builds a release checklist with all required item kinds', () => {
    const service = createService();
    const snapshot = service.buildSnapshot();
    const checklist = service.buildReleaseChecklist(snapshot.readinessReceipts);

    expect(checklist).toEqual(expect.objectContaining({
      checklistId: 'zavorth.post291.release-candidate.checklist',
      status: 'passed',
      requiredItems: [
        'final-docs',
        'setup-presets',
        'command-center-polish',
        'release-checklist',
        'smoke-tests',
        'packaging',
      ],
      passedItems: 6,
      blockedItems: 0,
      publicIdentity: 'Zavorth',
    }));
    expect(checklist.safety).toEqual(expect.objectContaining({
      releaseChecklistOnly: true,
      noAutomaticPublish: true,
      noApprovalBypass: true,
      noPublicIdentityChange: true,
    }));
  });

  it('builds a package preview without publishing, tagging, or deploying', () => {
    const service = createService();
    const receipt = service.buildPackagingReceipt(service.buildSnapshot().readinessReceipts);

    expect(receipt).toEqual(expect.objectContaining({
      packageId: 'zavorth.post291.release-candidate.package',
      status: 'package-preview-ready',
      versionLabel: '1.1.0-post291-rc',
      packageCommand: 'npm run build --silent',
      publishCommand: 'npm publish --dry-run',
      publishPerformed: false,
      tagCreated: false,
      deployPerformed: false,
    }));
    expect(receipt.safety).toEqual(expect.objectContaining({
      packagePreviewOnly: true,
      publishRequiresOwnerApproval: true,
      noRegistryPush: true,
      noGitTagCreated: true,
      noDeploy: true,
    }));
  });

  it('projects release candidate state for Command Center', () => {
    const snapshot = createService().buildSnapshot();

    expect(snapshot.commandCenterProjection).toEqual(expect.objectContaining({
      title: 'Post-291 Release Candidate',
      status: 'release-candidate-ready',
      tone: 'ready',
      policyPills: expect.arrayContaining([
        'final docs',
        'setup presets',
        'Command Center polish',
        'release checklist',
        'smoke tests',
        'package preview',
        'no publish',
      ]),
      nextSafeAction: '302 plan complete; publish/tag/deploy still require separate owner approval.',
    }));
    expect(snapshot.commandCenterProjection.cards.map((entry) => entry.id)).toEqual(expect.arrayContaining([
      'docs',
      'setup',
      'command-center',
      'checklist',
      'smoke',
      'package',
      'publish',
    ]));
  });

  it('blocks Phase C if Phase B live canary swarm is not ready', () => {
    const snapshot = createService().buildSnapshot({ liveCanarySwarmStatus: 'blocked' });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.previousLiveCanarySwarmStatus).toBe('blocked');
    expect(snapshot.acceptanceMatrix.find((entry) => entry.requirementId === 'phase-b-live-canary-swarm-ready')).toEqual(expect.objectContaining({
      status: 'failed',
    }));
  });

  it('formats an operator summary for release candidate closure', () => {
    const service = createService();
    const text = service.formatSnapshotText(service.buildSnapshot());

    expect(text).toContain('Zavorth Post-291 Release Candidate - Phase C');
    expect(text).toContain('Status: release-candidate-ready');
    expect(text).toContain('Readiness items: 6/6');
    expect(text).toContain('Publish performed: false');
    expect(text).toContain('Tag created: false');
    expect(text).toContain('Plan: 302 plan complete');
  });
});

function createService(): ZavorthPost291ReleaseCandidateService {
  return new ZavorthPost291ReleaseCandidateService({
    now: () => new Date('2026-05-12T00:05:00.000Z'),
    liveCanarySwarmStatus: 'live-canary-swarm-ready',
  });
}

function createReadiness(): ZavorthReleaseCandidateReadinessInput {
  return {
    itemId: 'final-docs-test',
    kind: 'final-docs',
    title: 'Final docs test',
    command: 'npm run surfaces:check --silent',
    artifactRef: 'docs://test',
    passed: true,
    notes: ['docs ready'],
  };
}
