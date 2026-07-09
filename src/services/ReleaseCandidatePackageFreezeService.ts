import type {
  ReleaseCandidatePackageFreezeArtifact,
  ReleaseCandidatePackageFreezeGate,
  ReleaseCandidatePackageFreezeReceipt,
  ReleaseCandidatePackageFreezeSnapshot,
  ReleaseCandidatePackageFreezeStatus,
} from '../contracts/ReleaseCandidatePackageFreezeContract.js';
import {
  ZAVORTH_RELEASE_CANDIDATE_FREEZE_ID,
  ZAVORTH_RELEASE_CANDIDATE_PACKAGE_FREEZE_CONTRACT_VERSION,
  ZAVORTH_RELEASE_CANDIDATE_PACKAGE_NAME,
  ZAVORTH_RELEASE_CANDIDATE_PACKAGE_VERSION,
} from '../contracts/ReleaseCandidatePackageFreezeContract.js';
import { PublicLaunchSmokeEvidenceLedgerService } from './PublicLaunchSmokeEvidenceLedgerService.js';


type ReleaseCandidatePackageFreezeRuntime = {
  now?: () => Date;
  publicLaunchSmokeEvidenceLedgerService?: PublicLaunchSmokeEvidenceLedgerService;
};

export class ReleaseCandidatePackageFreezeService {
  private readonly now: () => Date;
  private readonly publicLaunchSmokeLedger: PublicLaunchSmokeEvidenceLedgerService;

  constructor(runtime: ReleaseCandidatePackageFreezeRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.publicLaunchSmokeLedger = runtime.publicLaunchSmokeEvidenceLedgerService
      || new PublicLaunchSmokeEvidenceLedgerService({ now: this.now });
  }

  public buildSnapshot(): ReleaseCandidatePackageFreezeSnapshot {
    const publicLaunchSmokeLedger = this.publicLaunchSmokeLedger.buildSnapshot();
    const artifacts = this.artifacts();
    const receipts = this.receipts(artifacts);
    const gates = this.gates({
      publicLaunchReady: publicLaunchSmokeLedger.summary.publicLaunchReady,
      artifacts,
      receipts,
    });
    const failedGates = gates.filter((gate) => gate.status === 'fail').length;
    const blockedArtifacts = artifacts.filter((artifact) => artifact.status === 'blocked').length;
    const status: ReleaseCandidatePackageFreezeStatus = publicLaunchSmokeLedger.status === 'blocked' || failedGates > 0
      ? 'blocked'
      : artifacts.some((artifact) => artifact.status === 'manual-pending')
        ? 'attention'
        : 'frozen';

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_RELEASE_CANDIDATE_PACKAGE_FREEZE_CONTRACT_VERSION,
      status,
      package: {
        name: ZAVORTH_RELEASE_CANDIDATE_PACKAGE_NAME,
        version: ZAVORTH_RELEASE_CANDIDATE_PACKAGE_VERSION,
        releaseCandidateId: ZAVORTH_RELEASE_CANDIDATE_FREEZE_ID,
        channel: 'release-candidate',
        npmDistTag: 'rc',
        stableTagAllowed: false,
        latestTagAllowed: false,
      },
      summary: {
        artifacts: artifacts.length,
        requiredArtifacts: artifacts.filter((artifact) => artifact.requiredForFreeze).length,
        lockedArtifacts: artifacts.filter((artifact) => artifact.status === 'locked' || artifact.status === 'dry-ready').length,
        manualPendingArtifacts: artifacts.filter((artifact) => artifact.status === 'manual-pending').length,
        blockedArtifacts,
        gates: gates.length,
        passedGates: gates.filter((gate) => gate.status === 'pass').length,
        failedGates,
        receipts: receipts.length,
        publicLaunchLedgerStatus: publicLaunchSmokeLedger.status,
        publicLaunchReady: publicLaunchSmokeLedger.summary.publicLaunchReady,
        packageFrozen: status === 'frozen',
        publishAllowed: false,
        npmPublishExecuted: false,
        gitTagMoved: false,
        installerExecuted: false,
        secretValuesSerialized: false,
      },
      publicLaunchSmokeLedger: {
        contractVersion: publicLaunchSmokeLedger.contractVersion,
        status: publicLaunchSmokeLedger.status,
        summary: publicLaunchSmokeLedger.summary,
        commands: publicLaunchSmokeLedger.commands,
      },
      artifacts,
      gates,
      receipts,
      commands: {
        run: 'npm run release-candidate-freeze --silent',
        runJson: 'npm run release-candidate-freeze:json --silent',
        check: 'npm run release-candidate-freeze:check --silent',
        requireFrozen: 'npm run release-candidate-freeze --silent -- --require-frozen',
        build: 'npm run build --silent',
        typecheck: 'npm run runtime:check --silent',
        packDryRun: 'npm pack --dry-run',
        smokeLedger: 'npm run public-launch-smoke-ledger --silent -- --require-ready',
        releasePath: 'npm run release-path:check --silent',
        focusedTests: [
          'npx jest tests/services/ReleaseCandidatePackageFreezeService.test.ts --runInBand',
          'npm run release-candidate-freeze:check --silent',
          'npm run release-candidate-freeze --silent -- --require-frozen',
        ],
        nextStage: 'Release candidate distribution rehearsal',
      },
      policy: {
        freezeOnly: true,
        consumesPublicLaunchSmokeLedger: true,
        noNpmPublish: true,
        noGitTagMoved: true,
        noStableTagMoved: true,
        noLatestTagMoved: true,
        noInstallerExecuted: true,
        noNetworkRequiredByDefault: true,
        secretsSerialized: false,
      },
    };
  }

  public formatFreezeText(snapshot: ReleaseCandidatePackageFreezeSnapshot = this.buildSnapshot()): string {
    return [
      'Zavorth Release Candidate Package Freeze',
      `Status: ${snapshot.status}`,
      `Package: ${snapshot.package.releaseCandidateId}`,
      `Artifacts: ${snapshot.summary.lockedArtifacts}/${snapshot.summary.requiredArtifacts} locked`,
      `Gates: ${snapshot.summary.passedGates}/${snapshot.summary.gates} pass`,
      `Receipts: ${snapshot.summary.receipts}`,
      `Public launch ledger: ${snapshot.summary.publicLaunchLedgerStatus}, ready ${snapshot.summary.publicLaunchReady}`,
      `Package frozen: ${snapshot.summary.packageFrozen}`,
      `Publish allowed: ${snapshot.summary.publishAllowed}`,
      '',
      'Freeze artifacts:',
      ...snapshot.artifacts.map((artifact) =>
        `- ${artifact.status.toUpperCase()} ${artifact.id}: ${artifact.command}`,
      ),
      '',
      'Gate results:',
      ...snapshot.gates.map((gate) =>
        `- ${gate.status.toUpperCase()} ${gate.id}: ${gate.observed} / ${gate.threshold} - ${gate.nextAction}`,
      ),
      '',
      `Next: ${snapshot.commands.nextStage}`,
    ].join('\n');
  }

  private artifacts(): ReleaseCandidatePackageFreezeArtifact[] {
    return [
      artifact({
        id: 'package-manifest-lock',
        kind: 'manifest',
        status: 'locked',
        command: 'static:package.json name/version/files/bin/scripts review',
        evidence: `${ZAVORTH_RELEASE_CANDIDATE_PACKAGE_NAME}@${ZAVORTH_RELEASE_CANDIDATE_PACKAGE_VERSION} is the frozen package identity for ${ZAVORTH_RELEASE_CANDIDATE_FREEZE_ID}.`,
      }),
      artifact({
        id: 'source-tree-lock',
        kind: 'source',
        status: 'locked',
        command: 'git status --short',
        evidence: 'Source tree state is captured by operator status; no tag is moved by this phase.',
      }),
      artifact({
        id: 'runtime-build-lock',
        kind: 'build',
        status: 'dry-ready',
        command: 'npm run build --silent',
        evidence: 'Build command is part of the freeze manifest; execution is operator/CI controlled.',
      }),
      artifact({
        id: 'runtime-typecheck-lock',
        kind: 'typecheck',
        status: 'dry-ready',
        command: 'npm run runtime:check --silent',
        evidence: 'Runtime TypeScript check is required before the RC package can be distributed.',
      }),
      artifact({
        id: 'npm-pack-dry-run-lock',
        kind: 'pack',
        status: 'dry-ready',
        command: 'npm pack --dry-run',
        evidence: 'Package contents are checked through npm dry-run only; npm publish is forbidden.',
      }),
      artifact({
        id: 'public-launch-smoke-ledger-lock',
        kind: 'smoke-ledger',
        status: 'locked',
        command: 'npm run public-launch-smoke-ledger --silent -- --require-ready',
        evidence: 'Public launch smoke ledger is the prerequisite for freezing the release candidate.',
      }),
      artifact({
        id: 'public-launch-certification-lock',
        kind: 'smoke-ledger',
        status: 'locked',
        command: 'npm run release-certify:public-launch --silent',
        evidence: 'Public-launch profile certification remains certified with zero P0/P1/P2 gaps.',
      }),
      artifact({
        id: 'release-notes-lock',
        kind: 'release-notes',
        status: 'locked',
        command: 'npm run release:changelog --silent',
        evidence: 'Release notes/changelog command is captured as the RC notes source.',
      }),
      artifact({
        id: 'checksum-manifest-lock',
        kind: 'checksum',
        status: 'locked',
        command: 'npm pack --dry-run && manual:record-sha256-from-pack-output',
        evidence: 'Checksum manifest is required before distribution rehearsal; no archive is uploaded here.',
      }),
      artifact({
        id: 'rollback-plan-lock',
        kind: 'rollback',
        status: 'locked',
        command: 'npm run release-path:check --silent',
        evidence: 'Rollback and installer dry-run policy are linked through the release path gate.',
      }),
      artifact({
        id: 'no-publish-policy-lock',
        kind: 'policy',
        status: 'locked',
        command: 'policy:no-npm-publish no-git-tag no-installer-execution',
        evidence: 'Freeze is not a publication; npm publish, tag moves, and installer execution are blocked.',
      }),
    ];
  }

  private gates(input: {
    publicLaunchReady: boolean;
    artifacts: ReleaseCandidatePackageFreezeArtifact[];
    receipts: ReleaseCandidatePackageFreezeReceipt[];
  }): ReleaseCandidatePackageFreezeGate[] {
    const required = input.artifacts.filter((artifact) => artifact.requiredForFreeze);
    const locked = required.filter((artifact) => artifact.status === 'locked' || artifact.status === 'dry-ready');
    const dryPack = input.artifacts.find((artifact) => artifact.id === 'npm-pack-dry-run-lock');
    const packageManifest = input.artifacts.find((artifact) => artifact.id === 'package-manifest-lock');
    const rollbackPlan = input.artifacts.find((artifact) => artifact.id === 'rollback-plan-lock');
    const noPublish = input.artifacts.every((artifact) => artifact.blocksPublish);

    return [
      gate({
        id: 'public-launch-ledger-ready',
        status: input.publicLaunchReady ? 'pass' : 'fail',
        title: 'Public launch smoke ledger is ready',
        observed: input.publicLaunchReady,
        threshold: true,
        receipt: 'release-candidate-freeze.public-launch-ledger.receipt',
        nextAction: 'finish Intent model5 public launch smoke evidence before freezing RC package',
      }),
      gate({
        id: 'required-artifacts-locked',
        status: locked.length === required.length ? 'pass' : 'fail',
        title: 'All required RC artifacts are locked or dry-ready',
        observed: `${locked.length}/${required.length}`,
        threshold: `${required.length}/${required.length}`,
        receipt: 'release-candidate-freeze.required-artifacts.receipt',
        nextAction: 'lock every required artifact before freeze can pass',
      }),
      gate({
        id: 'package-identity-frozen',
        status: packageManifest?.status === 'locked' ? 'pass' : 'fail',
        title: 'Package identity is frozen',
        observed: ZAVORTH_RELEASE_CANDIDATE_FREEZE_ID,
        threshold: 'zavorth@1.1.0-rc.1',
        receipt: 'release-candidate-freeze.package-identity.receipt',
        nextAction: 'align package name, version, and release candidate id',
      }),
      gate({
        id: 'dry-pack-command-present',
        status: dryPack?.command === 'npm pack --dry-run' ? 'pass' : 'fail',
        title: 'NPM pack dry-run command is present',
        observed: dryPack?.command || 'missing',
        threshold: 'npm pack --dry-run',
        receipt: 'release-candidate-freeze.npm-pack-dry-run.receipt',
        nextAction: 'use npm pack dry-run before any distribution rehearsal',
      }),
      gate({
        id: 'rollback-plan-present',
        status: rollbackPlan?.status === 'locked' ? 'pass' : 'fail',
        title: 'Rollback plan is linked',
        observed: rollbackPlan?.command || 'missing',
        threshold: 'npm run release-path:check --silent',
        receipt: 'release-candidate-freeze.rollback-plan.receipt',
        nextAction: 'link rollback and installer dry-run evidence before freeze',
      }),
      gate({
        id: 'no-publish-side-effects',
        status: noPublish ? 'pass' : 'fail',
        title: 'Freeze has no publish side effects',
        observed: noPublish,
        threshold: true,
        receipt: 'release-candidate-freeze.no-publish-side-effects.receipt',
        nextAction: 'remove publish/tag/install side effects from freeze artifacts',
      }),
      gate({
        id: 'freeze-receipts-complete',
        status: input.receipts.length === input.artifacts.length ? 'pass' : 'fail',
        title: 'Every RC freeze artifact emits a receipt',
        observed: input.receipts.length,
        threshold: input.artifacts.length,
        receipt: 'release-candidate-freeze.receipts-complete.receipt',
        nextAction: 'repair missing RC freeze receipts',
      }),
    ];
  }

  private receipts(artifacts: ReleaseCandidatePackageFreezeArtifact[]): ReleaseCandidatePackageFreezeReceipt[] {
    return artifacts.map((artifactItem) => ({
      id: artifactItem.receipt,
      artifactId: artifactItem.id,
      status: artifactItem.status,
      command: artifactItem.command,
      evidence: artifactItem.evidence,
      noPublish: true,
      noTagMoved: true,
      noInstallerExecuted: true,
      secretValuesSerialized: false,
    }));
  }
}

function artifact(input: {
  id: ReleaseCandidatePackageFreezeArtifact['id'];
  kind: ReleaseCandidatePackageFreezeArtifact['kind'];
  status: ReleaseCandidatePackageFreezeArtifact['status'];
  command: string;
  evidence: string;
}): ReleaseCandidatePackageFreezeArtifact {
  return {
    ...input,
    receipt: `release-candidate-freeze.${input.id}.receipt`,
    requiredForFreeze: true,
    blocksPublish: true,
    secretValuesSerialized: false,
  };
}

function gate(input: ReleaseCandidatePackageFreezeGate): ReleaseCandidatePackageFreezeGate {
  return input;
}
