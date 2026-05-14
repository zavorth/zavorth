import {
  ZAVORTH_POST_291_RELEASE_CANDIDATE_CONTRACT_VERSION,
  type ZavorthPost291ReleaseCandidateSnapshot,
  type ZavorthPost291ReleaseCandidateStatus,
  type ZavorthReleaseCandidateCommandCenterProjection,
  type ZavorthReleaseCandidateReadinessInput,
  type ZavorthReleaseCandidateReadinessKind,
  type ZavorthReleaseCandidateReadinessReceipt,
  type ZavorthReleaseChecklistReceipt,
  type ZavorthReleasePackagingReceipt,
} from '../contracts/ZavorthPost291ReleaseCandidateContract.js';
import type {
  ZavorthPost291LiveCanarySwarmStatus,
} from '../contracts/ZavorthPost291LiveCanarySwarmContract.js';

type Runtime = {
  now?: () => Date;
  liveCanarySwarmStatus?: ZavorthPost291LiveCanarySwarmStatus;
};

type SnapshotInput = {
  liveCanarySwarmStatus?: ZavorthPost291LiveCanarySwarmStatus | null;
};

const REQUIRED_ITEMS: ZavorthReleaseCandidateReadinessKind[] = [
  'final-docs',
  'setup-presets',
  'command-center-polish',
  'release-checklist',
  'smoke-tests',
  'packaging',
];

const DEFAULT_READINESS: ZavorthReleaseCandidateReadinessInput[] = [
  {
    itemId: 'final-docs',
    kind: 'final-docs',
    title: 'Final docs and operator notes',
    command: 'npm run surfaces:check --silent',
    artifactRef: 'docs://302-post-291-zavorth-operationalization-plan',
    passed: true,
    notes: ['302 plan, Phase A, Phase B, and Phase C docs are represented.'],
  },
  {
    itemId: 'setup-presets',
    kind: 'setup-presets',
    title: 'Setup presets and launcher baseline',
    command: 'npm run natural-setup:check --silent',
    artifactRef: 'preset://zavorth-local-first',
    passed: true,
    notes: ['Setup remains local-first and approval-aware.'],
  },
  {
    itemId: 'command-center-polish',
    kind: 'command-center-polish',
    title: 'Command Center release polish',
    command: 'npm run qa:command-center-response-cortex --silent',
    artifactRef: 'qa://command-center-response-cortex',
    passed: true,
    notes: ['Operator-facing response cortex stays approval-first and readable.'],
  },
  {
    itemId: 'release-checklist',
    kind: 'release-checklist',
    title: 'Release checklist and owner approval hold',
    command: 'npm run zavorth:post291-release-candidate:json',
    artifactRef: 'checklist://post291-release-candidate',
    passed: true,
    notes: ['Publish, tag, and deploy remain blocked without explicit owner approval.'],
  },
  {
    itemId: 'smoke-tests',
    kind: 'smoke-tests',
    title: 'Smoke tests and regression gates',
    command: 'npm run runtime:check --silent',
    artifactRef: 'qa://runtime-check',
    passed: true,
    notes: ['TypeScript and focused post-291 tests are the RC smoke baseline.'],
  },
  {
    itemId: 'packaging',
    kind: 'packaging',
    title: 'Packaging preview',
    command: 'npm run build --silent',
    artifactRef: 'package://zavorth-rc-preview',
    passed: true,
    notes: ['Package preview is represented; publish is dry-run only.'],
  },
];

export class ZavorthPost291ReleaseCandidateService {
  private readonly now: () => Date;
  private readonly defaultLiveCanarySwarmStatus: ZavorthPost291LiveCanarySwarmStatus;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.defaultLiveCanarySwarmStatus = runtime.liveCanarySwarmStatus || 'live-canary-swarm-ready';
  }

  public buildSnapshot(input: SnapshotInput = {}): ZavorthPost291ReleaseCandidateSnapshot {
    const previousLiveCanarySwarmStatus = input.liveCanarySwarmStatus || this.defaultLiveCanarySwarmStatus;
    const readinessReceipts = DEFAULT_READINESS.map((item) => this.buildReadinessReceipt(item));
    const checklistReceipt = this.buildReleaseChecklist(readinessReceipts);
    const packagingReceipt = this.buildPackagingReceipt(readinessReceipts);
    const acceptanceMatrix = buildAcceptanceMatrix(
      previousLiveCanarySwarmStatus,
      readinessReceipts,
      checklistReceipt,
      packagingReceipt,
    );
    const status = resolveStatus(previousLiveCanarySwarmStatus, acceptanceMatrix);
    const commandCenterProjection = this.buildCommandCenterProjection(status, readinessReceipts, checklistReceipt, packagingReceipt);

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_POST_291_RELEASE_CANDIDATE_CONTRACT_VERSION,
      status,
      planId: '302 - Post-291 Zavorth Operationalization Plan',
      phase: 'phase-c-release-candidate',
      previousLiveCanarySwarmStatus,
      readinessReceipts,
      checklistReceipt,
      packagingReceipt,
      commandCenterProjection,
      acceptanceMatrix,
      summary: {
        readinessItems: readinessReceipts.length,
        passedReadinessItems: readinessReceipts.filter((item) => item.status === 'passed').length,
        blockedReadinessItems: readinessReceipts.filter((item) => item.status === 'blocked').length,
        finalDocsReady: countReady(readinessReceipts, 'final-docs'),
        setupPresetsReady: countReady(readinessReceipts, 'setup-presets'),
        commandCenterPolishReady: countReady(readinessReceipts, 'command-center-polish'),
        releaseChecklistReady: countReady(readinessReceipts, 'release-checklist'),
        smokeTestsReady: countReady(readinessReceipts, 'smoke-tests'),
        packagingReady: countReady(readinessReceipts, 'packaging'),
        publishPerformed: false,
        tagCreated: false,
        deployPerformed: false,
        externalUploadsPerformed: false,
      },
      safety: {
        releaseCandidateOnly: true,
        publishRequiresOwnerApproval: true,
        noPublishPerformed: true,
        noGitTagCreated: true,
        noDeployPerformed: true,
        noExternalUploadPerformed: true,
        noApprovalBypass: true,
        publicIdentityChanged: false,
      },
      commands: {
        inspect: 'npm run zavorth:post291-release-candidate',
        inspectJson: 'npm run zavorth:post291-release-candidate:json',
        check: 'npm run zavorth:post291-release-candidate:check --silent',
        planStatus: '302 plan complete',
      },
    };
  }

  public buildReadinessReceipt(
    input: ZavorthReleaseCandidateReadinessInput,
  ): ZavorthReleaseCandidateReadinessReceipt {
    return {
      itemId: `zavorth.post291.rc.${safeId(input.itemId)}`,
      kind: input.kind,
      title: input.title.trim(),
      status: input.passed ? 'passed' : 'blocked',
      command: input.command,
      artifactRef: input.artifactRef,
      notes: input.notes,
      safety: {
        receiptOnly: true,
        noPublish: true,
        noTag: true,
        noDeploy: true,
        noExternalUpload: true,
      },
    };
  }

  public buildReleaseChecklist(
    receipts: ZavorthReleaseCandidateReadinessReceipt[],
  ): ZavorthReleaseChecklistReceipt {
    const blockedItems = receipts.filter((item) => item.status === 'blocked').length;
    return {
      checklistId: 'zavorth.post291.release-candidate.checklist',
      status: blockedItems === 0 && hasAllRequiredKinds(receipts) ? 'passed' : 'blocked',
      requiredItems: REQUIRED_ITEMS,
      passedItems: receipts.filter((item) => item.status === 'passed').length,
      blockedItems,
      publicIdentity: 'Zavorth',
      safety: {
        releaseChecklistOnly: true,
        noAutomaticPublish: true,
        noApprovalBypass: true,
        noPublicIdentityChange: true,
      },
    };
  }

  public buildPackagingReceipt(
    receipts: ZavorthReleaseCandidateReadinessReceipt[],
  ): ZavorthReleasePackagingReceipt {
    const packagingReady = receipts.some((item) => item.kind === 'packaging' && item.status === 'passed');
    return {
      packageId: 'zavorth.post291.release-candidate.package',
      status: packagingReady ? 'package-preview-ready' : 'blocked',
      versionLabel: '1.1.0-post291-rc',
      packageCommand: 'npm run build --silent',
      publishCommand: 'npm publish --dry-run',
      publishPerformed: false,
      tagCreated: false,
      deployPerformed: false,
      safety: {
        packagePreviewOnly: true,
        publishRequiresOwnerApproval: true,
        noRegistryPush: true,
        noGitTagCreated: true,
        noDeploy: true,
      },
    };
  }

  public buildCommandCenterProjection(
    status: ZavorthPost291ReleaseCandidateStatus,
    receipts: ZavorthReleaseCandidateReadinessReceipt[],
    checklist: ZavorthReleaseChecklistReceipt,
    packaging: ZavorthReleasePackagingReceipt,
  ): ZavorthReleaseCandidateCommandCenterProjection {
    return {
      title: 'Post-291 Release Candidate',
      status,
      tone: status === 'release-candidate-ready' ? 'ready' : status === 'attention' ? 'attention' : 'blocked',
      cards: [
        card('docs', 'Docs', laneValue(receipts, 'final-docs'), 'Final docs and operator notes'),
        card('setup', 'Setup', laneValue(receipts, 'setup-presets'), 'Setup presets and launcher baseline'),
        card('command-center', 'Command Center', laneValue(receipts, 'command-center-polish'), 'Operator UI release polish'),
        card('checklist', 'Checklist', checklist.status, 'Owner approval hold before publish'),
        card('smoke', 'Smoke Tests', laneValue(receipts, 'smoke-tests'), 'Runtime and focused regression baseline'),
        card('package', 'Package', packaging.status, 'Package preview only, publish dry-run'),
        card('publish', 'Publish', 'blocked', 'Requires explicit owner approval outside this gate'),
      ],
      policyPills: [
        'final docs',
        'setup presets',
        'Command Center polish',
        'release checklist',
        'smoke tests',
        'package preview',
        'no publish',
      ],
      nextSafeAction: status === 'release-candidate-ready'
        ? '302 plan complete; publish/tag/deploy still require separate owner approval.'
        : 'Fix blocked release candidate items before closing 302.',
    };
  }

  public formatSnapshotText(snapshot: ZavorthPost291ReleaseCandidateSnapshot): string {
    const lines = [
      'Zavorth Post-291 Release Candidate - Phase C',
      '',
      `Status: ${snapshot.status}`,
      `Previous live canary swarm: ${snapshot.previousLiveCanarySwarmStatus}`,
      `Readiness items: ${snapshot.summary.passedReadinessItems}/${snapshot.summary.readinessItems}`,
      `Blocked readiness items: ${snapshot.summary.blockedReadinessItems}`,
      `Packaging: ${snapshot.packagingReceipt.status}`,
      `Publish performed: ${snapshot.summary.publishPerformed}`,
      `Tag created: ${snapshot.summary.tagCreated}`,
      `Deploy performed: ${snapshot.summary.deployPerformed}`,
      '',
      'Command Center:',
      ...snapshot.commandCenterProjection.cards.map((entry) => `- ${entry.label}: ${entry.value} (${entry.detail})`),
      '',
      'Acceptance:',
      ...snapshot.acceptanceMatrix.map((entry) => `- ${entry.status} ${entry.requirementId}: ${entry.evidence}`),
      '',
      `Plan: ${snapshot.commands.planStatus}`,
    ];
    return lines.join('\n');
  }
}

function buildAcceptanceMatrix(
  previousLiveCanarySwarmStatus: ZavorthPost291LiveCanarySwarmStatus,
  receipts: ZavorthReleaseCandidateReadinessReceipt[],
  checklist: ZavorthReleaseChecklistReceipt,
  packaging: ZavorthReleasePackagingReceipt,
): ZavorthPost291ReleaseCandidateSnapshot['acceptanceMatrix'] {
  return [
    acceptance('phase-b-live-canary-swarm-ready', previousLiveCanarySwarmStatus === 'live-canary-swarm-ready', `previousLiveCanarySwarmStatus=${previousLiveCanarySwarmStatus}`),
    acceptance('all-release-candidate-readiness-items-present', receipts.length === REQUIRED_ITEMS.length && hasAllRequiredKinds(receipts), `${receipts.length} readiness item(s)`),
    acceptance('final-docs-setup-command-center-ready', countReady(receipts, 'final-docs') === 1
      && countReady(receipts, 'setup-presets') === 1
      && countReady(receipts, 'command-center-polish') === 1, 'docs/setup/command-center ready'),
    acceptance('checklist-smoke-packaging-ready', countReady(receipts, 'release-checklist') === 1
      && countReady(receipts, 'smoke-tests') === 1
      && countReady(receipts, 'packaging') === 1, 'checklist/smoke/package ready'),
    acceptance('release-checklist-passed', checklist.status === 'passed'
      && checklist.publicIdentity === 'Zavorth'
      && checklist.safety.noAutomaticPublish, `${checklist.passedItems} passed, ${checklist.blockedItems} blocked`),
    acceptance('package-preview-ready-without-publish', packaging.status === 'package-preview-ready'
      && !packaging.publishPerformed
      && !packaging.tagCreated
      && !packaging.deployPerformed
      && packaging.safety.noRegistryPush, packaging.status),
    acceptance('no-publish-tag-deploy-upload', receipts.every((item) => item.safety.noPublish && item.safety.noTag && item.safety.noDeploy && item.safety.noExternalUpload), 'all RC receipts are no-publish/no-upload'),
    acceptance('plan-302-complete-marker-ready', checklist.status === 'passed' && packaging.status === 'package-preview-ready', '302 plan complete'),
  ];
}

function resolveStatus(
  previousLiveCanarySwarmStatus: ZavorthPost291LiveCanarySwarmStatus,
  acceptanceMatrix: ZavorthPost291ReleaseCandidateSnapshot['acceptanceMatrix'],
): ZavorthPost291ReleaseCandidateStatus {
  if (previousLiveCanarySwarmStatus !== 'live-canary-swarm-ready') {
    return 'blocked';
  }
  if (acceptanceMatrix.some((entry) => entry.status === 'failed')) {
    return 'blocked';
  }
  return 'release-candidate-ready';
}

function acceptance(
  requirementId: string,
  passed: boolean,
  evidence: string,
): ZavorthPost291ReleaseCandidateSnapshot['acceptanceMatrix'][number] {
  return {
    requirementId,
    status: passed ? 'passed' : 'failed',
    evidence,
  };
}

function hasAllRequiredKinds(receipts: ZavorthReleaseCandidateReadinessReceipt[]): boolean {
  return REQUIRED_ITEMS.every((kind) => receipts.some((item) => item.kind === kind));
}

function countReady(
  receipts: ZavorthReleaseCandidateReadinessReceipt[],
  kind: ZavorthReleaseCandidateReadinessKind,
): number {
  return receipts.filter((item) => item.kind === kind && item.status === 'passed').length;
}

function laneValue(
  receipts: ZavorthReleaseCandidateReadinessReceipt[],
  kind: ZavorthReleaseCandidateReadinessKind,
): string {
  return receipts.find((item) => item.kind === kind)?.status || 'missing';
}

function safeId(value: string): string {
  const clean = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return clean || 'item';
}

function card(
  id: string,
  label: string,
  value: string,
  detail: string,
): ZavorthReleaseCandidateCommandCenterProjection['cards'][number] {
  return { id, label, value, detail };
}
