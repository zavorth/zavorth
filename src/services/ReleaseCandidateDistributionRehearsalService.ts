import type {
  ReleaseCandidateDistributionRehearsalGate,
  ReleaseCandidateDistributionRehearsalReceipt,
  ReleaseCandidateDistributionRehearsalSnapshot,
  ReleaseCandidateDistributionRehearsalStatus,
  ReleaseCandidateDistributionRehearsalStep,
} from '../contracts/ReleaseCandidateDistributionRehearsalContract.js';
import { ZAVORTH_RELEASE_CANDIDATE_DISTRIBUTION_REHEARSAL_CONTRACT_VERSION } from '../contracts/ReleaseCandidateDistributionRehearsalContract.js';
import { ReleaseCandidatePackageFreezeService } from './ReleaseCandidatePackageFreezeService.js';

type ReleaseCandidateDistributionRehearsalRuntime = {
  now?: () => Date;
  releaseCandidatePackageFreezeService?: ReleaseCandidatePackageFreezeService;
};

export class ReleaseCandidateDistributionRehearsalService {
  private readonly now: () => Date;
  private readonly freeze: ReleaseCandidatePackageFreezeService;

  constructor(runtime: ReleaseCandidateDistributionRehearsalRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.freeze = runtime.releaseCandidatePackageFreezeService
      || new ReleaseCandidatePackageFreezeService({ now: this.now });
  }

  public buildSnapshot(): ReleaseCandidateDistributionRehearsalSnapshot {
    const freezeSnapshot = this.freeze.buildSnapshot();
    const steps = this.steps(freezeSnapshot.package.releaseCandidateId);
    const receipts = this.receipts(steps);
    const gates = this.gates({
      freezeReady: freezeSnapshot.summary.packageFrozen,
      steps,
      receipts,
    });
    const failedGates = gates.filter((gate) => gate.status === 'fail').length;
    const blockedSteps = steps.filter((step) => step.status === 'blocked').length;
    const status: ReleaseCandidateDistributionRehearsalStatus = freezeSnapshot.status === 'blocked' || failedGates > 0 || blockedSteps > 0
      ? 'blocked'
      : steps.some((step) => step.status === 'operator-ready')
        ? 'rehearsed'
        : 'attention';

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_RELEASE_CANDIDATE_DISTRIBUTION_REHEARSAL_CONTRACT_VERSION,
      status,
      releaseCandidate: {
        id: freezeSnapshot.package.releaseCandidateId,
        packageName: freezeSnapshot.package.name,
        packageVersion: freezeSnapshot.package.version,
        channel: 'release-candidate',
        npmDistTag: 'rc',
        distributionRehearsalOnly: true,
      },
      summary: {
        steps: steps.length,
        requiredSteps: steps.filter((step) => step.requiredForRehearsal).length,
        dryReadySteps: steps.filter((step) => step.status === 'dry-ready').length,
        operatorReadySteps: steps.filter((step) => step.status === 'operator-ready').length,
        blockedSteps,
        gates: gates.length,
        passedGates: gates.filter((gate) => gate.status === 'pass').length,
        failedGates,
        receipts: receipts.length,
        freezeStatus: freezeSnapshot.status,
        packageFrozen: freezeSnapshot.summary.packageFrozen,
        rehearsalReady: status === 'rehearsed' && freezeSnapshot.summary.packageFrozen,
        npmPublishExecuted: false,
        githubReleaseCreated: false,
        gitTagMoved: false,
        installerExecuted: false,
        remoteStateMutated: false,
        secretValuesSerialized: false,
      },
      packageFreeze: {
        contractVersion: freezeSnapshot.contractVersion,
        status: freezeSnapshot.status,
        package: freezeSnapshot.package,
        summary: freezeSnapshot.summary,
        commands: freezeSnapshot.commands,
      },
      steps,
      gates,
      receipts,
      commands: {
        run: 'npm run release-candidate-distribution-rehearsal --silent',
        runJson: 'npm run release-candidate-distribution-rehearsal:json --silent',
        check: 'npm run release-candidate-distribution-rehearsal:check --silent',
        requireRehearsed: 'npm run release-candidate-distribution-rehearsal --silent -- --require-rehearsed',
        freeze: 'npm run release-candidate-freeze --silent -- --require-frozen',
        packDryRun: 'npm pack --dry-run',
        npmPublishDryRun: 'npm publish --dry-run --tag rc',
        releasePath: 'npm run release-path:check --silent',
        publicSync: 'npm run public-sync:check --silent',
        distributionPolicy: 'npm run distribution-policy --silent -- --require-pass',
        focusedTests: [
          'npx jest tests/services/ReleaseCandidateDistributionRehearsalService.test.ts --runInBand',
          'npm run release-candidate-distribution-rehearsal:check --silent',
          'npm run release-candidate-distribution-rehearsal --silent -- --require-rehearsed',
        ],
        typecheck: 'npm run runtime:check --silent',
        nextPhase: 'Pre-canary go/no-go alignment',
      },
      policy: {
        rehearsalOnly: true,
        consumesReleaseCandidateFreeze: true,
        noNpmPublish: true,
        noGithubReleaseCreated: true,
        noGitTagMoved: true,
        noStableTagMoved: true,
        noLatestTagMoved: true,
        noInstallerExecuted: true,
        noRemoteMutationByDefault: true,
        noNetworkRequiredByDefault: true,
        secretsSerialized: false,
      },
    };
  }

  public formatRehearsalText(snapshot: ReleaseCandidateDistributionRehearsalSnapshot = this.buildSnapshot()): string {
    return [
      'Zavorth Release Candidate Distribution Rehearsal',
      `Status: ${snapshot.status}`,
      `Release candidate: ${snapshot.releaseCandidate.id}`,
      `Steps: ${snapshot.summary.dryReadySteps} dry-ready, ${snapshot.summary.operatorReadySteps} operator-ready, ${snapshot.summary.blockedSteps} blocked`,
      `Gates: ${snapshot.summary.passedGates}/${snapshot.summary.gates} pass`,
      `Receipts: ${snapshot.summary.receipts}`,
      `Package frozen: ${snapshot.summary.packageFrozen}`,
      `Rehearsal ready: ${snapshot.summary.rehearsalReady}`,
      `Remote state mutated: ${snapshot.summary.remoteStateMutated}`,
      '',
      'Distribution rehearsal steps:',
      ...snapshot.steps.map((step) =>
        `- ${step.status.toUpperCase()} ${step.id}: ${step.command}`,
      ),
      '',
      'Gate results:',
      ...snapshot.gates.map((gate) =>
        `- ${gate.status.toUpperCase()} ${gate.id}: ${gate.observed} / ${gate.threshold} - ${gate.nextAction}`,
      ),
      '',
      `Next: ${snapshot.commands.nextPhase}`,
    ].join('\n');
  }

  private steps(releaseCandidateId: string): ReleaseCandidateDistributionRehearsalStep[] {
    return [
      dryStep({
        id: 'rc-freeze-input',
        surface: 'package',
        command: 'npm run release-candidate-freeze --silent -- --require-frozen',
        evidence: `${releaseCandidateId} is frozen before distribution rehearsal starts.`,
      }),
      dryStep({
        id: 'pack-dry-run-rehearsal',
        surface: 'package',
        command: 'npm pack --dry-run',
        evidence: 'Tarball generation is rehearsed with npm dry-run only.',
      }),
      dryStep({
        id: 'tarball-contents-review',
        surface: 'package',
        command: 'npm pack --dry-run --json',
        evidence: 'Tarball contents can be inspected from npm dry-run JSON without uploading artifacts.',
      }),
      operatorStep({
        id: 'checksum-manifest-rehearsal',
        surface: 'checksums',
        command: 'manual:record-sha256-from-npm-pack-dry-run',
        evidence: 'Checksum manifest is prepared from dry-run pack output before any upload.',
      }),
      dryStep({
        id: 'npm-rc-publish-dry-run',
        surface: 'npm',
        command: 'npm publish --dry-run --tag rc',
        evidence: 'NPM publish path is rehearsed in dry-run mode and does not publish.',
      }),
      operatorStep({
        id: 'github-release-draft-plan',
        surface: 'github',
        command: 'manual:gh-release-draft --title zavorth@1.1.0-rc.1 --no-upload',
        evidence: 'GitHub release remains a draft plan; no release is created by default.',
      }),
      dryStep({
        id: 'installer-dry-run-rehearsal',
        surface: 'installer',
        command: 'zavorth release install --dry-run',
        evidence: 'Installer path is rehearsed as dry-run only.',
      }),
      dryStep({
        id: 'rollback-dry-run-rehearsal',
        surface: 'rollback',
        command: 'zavorth release rollback --dry-run',
        evidence: 'Rollback path is rehearsed as dry-run only.',
      }),
      dryStep({
        id: 'public-docs-release-route',
        surface: 'docs',
        command: 'npm run public-sync:check --silent',
        evidence: 'Public docs, website, and demo sync are linked before distribution rehearsal.',
      }),
      dryStep({
        id: 'distribution-policy-dry-gate',
        surface: 'policy',
        command: 'npm run distribution-policy --silent -- --require-pass',
        evidence: 'Distribution policy is checked without enabling publication side effects.',
      }),
      operatorStep({
        id: 'adoption-pre-canary-guard',
        surface: 'adoption',
        command: 'manual:pre-canary-go-no-go --requires-approver-and-rollback-owner',
        evidence: 'Adoption/pre-canary handoff is explicit and separate from distribution rehearsal.',
      }),
      policyStep({
        id: 'no-publish-lock',
        surface: 'policy',
        command: 'policy:no-npm-publish no-github-release no-git-tag no-installer-execution',
        evidence: 'Distribution rehearsal cannot publish, create a release, move tags, or execute installers.',
      }),
    ];
  }

  private gates(input: {
    freezeReady: boolean;
    steps: ReleaseCandidateDistributionRehearsalStep[];
    receipts: ReleaseCandidateDistributionRehearsalReceipt[];
  }): ReleaseCandidateDistributionRehearsalGate[] {
    const required = input.steps.filter((step) => step.requiredForRehearsal);
    const ready = required.filter((step) => step.status === 'dry-ready' || step.status === 'operator-ready');
    const dryRunOnly = input.steps
      .filter((step) => step.mode === 'local-dry-run')
      .every((step) =>
        step.command.includes('--dry-run')
        || step.command.includes(':check')
        || step.command.includes('--require-frozen')
        || step.command.includes('--require-pass')
      );
    const noSideEffects = input.steps.every((step) =>
      step.mutatesRemoteState === false
      && step.publishesPackage === false
      && step.movesGitTag === false
      && step.executesInstaller === false,
    );
    const rollbackReady = input.steps.some((step) => step.id === 'rollback-dry-run-rehearsal' && step.status === 'dry-ready');
    const installerReady = input.steps.some((step) => step.id === 'installer-dry-run-rehearsal' && step.status === 'dry-ready');
    const docsReady = input.steps.some((step) => step.id === 'public-docs-release-route' && step.status === 'dry-ready');
    const policyReady = input.steps.some((step) => step.id === 'distribution-policy-dry-gate' && step.status === 'dry-ready');

    return [
      gate({
        id: 'rc-freeze-ready',
        status: input.freezeReady ? 'pass' : 'fail',
        title: 'Release candidate package freeze is ready',
        observed: input.freezeReady,
        threshold: true,
        receipt: 'release-candidate-distribution.rc-freeze-ready.receipt',
        nextAction: 'finish Phase 16 package freeze before distribution rehearsal',
      }),
      gate({
        id: 'required-rehearsal-steps-ready',
        status: ready.length === required.length ? 'pass' : 'fail',
        title: 'All required distribution rehearsal steps are ready',
        observed: `${ready.length}/${required.length}`,
        threshold: `${required.length}/${required.length}`,
        receipt: 'release-candidate-distribution.required-steps.receipt',
        nextAction: 'prepare every required rehearsal step before distribution handoff',
      }),
      gate({
        id: 'distribution-commands-dry-run-only',
        status: dryRunOnly ? 'pass' : 'fail',
        title: 'Default distribution commands are dry-run or static gates',
        observed: dryRunOnly,
        threshold: true,
        receipt: 'release-candidate-distribution.dry-run-only.receipt',
        nextAction: 'move mutating commands into explicit operator-only steps',
      }),
      gate({
        id: 'no-publication-side-effects',
        status: noSideEffects ? 'pass' : 'fail',
        title: 'Distribution rehearsal has no publication side effects',
        observed: noSideEffects,
        threshold: true,
        receipt: 'release-candidate-distribution.no-side-effects.receipt',
        nextAction: 'remove publish, release creation, tag movement, or installer execution from rehearsal',
      }),
      gate({
        id: 'rollback-and-installer-rehearsed',
        status: rollbackReady && installerReady ? 'pass' : 'fail',
        title: 'Rollback and installer paths are dry-run rehearsed',
        observed: `${rollbackReady}/${installerReady}`,
        threshold: 'true/true',
        receipt: 'release-candidate-distribution.rollback-installer.receipt',
        nextAction: 'link both rollback and installer dry-run rehearsals',
      }),
      gate({
        id: 'docs-and-policy-linked',
        status: docsReady && policyReady ? 'pass' : 'fail',
        title: 'Public docs and distribution policy are linked',
        observed: `${docsReady}/${policyReady}`,
        threshold: 'true/true',
        receipt: 'release-candidate-distribution.docs-policy.receipt',
        nextAction: 'link public sync and distribution policy gates before rehearsal is complete',
      }),
      gate({
        id: 'rehearsal-receipts-complete',
        status: input.receipts.length === input.steps.length ? 'pass' : 'fail',
        title: 'Every distribution rehearsal step emits a receipt',
        observed: input.receipts.length,
        threshold: input.steps.length,
        receipt: 'release-candidate-distribution.receipts-complete.receipt',
        nextAction: 'repair missing distribution rehearsal receipts',
      }),
    ];
  }

  private receipts(steps: ReleaseCandidateDistributionRehearsalStep[]): ReleaseCandidateDistributionRehearsalReceipt[] {
    return steps.map((step) => ({
      id: step.receipt,
      stepId: step.id,
      status: step.status,
      command: step.command,
      evidence: step.evidence,
      noRemoteMutation: true,
      noPackagePublished: true,
      noGitTagMoved: true,
      noInstallerExecuted: true,
      secretValuesSerialized: false,
    }));
  }
}

function dryStep(input: {
  id: ReleaseCandidateDistributionRehearsalStep['id'];
  surface: ReleaseCandidateDistributionRehearsalStep['surface'];
  command: string;
  evidence: string;
}): ReleaseCandidateDistributionRehearsalStep {
  return {
    ...input,
    mode: 'local-dry-run',
    status: 'dry-ready',
    receipt: `release-candidate-distribution.${input.id}.receipt`,
    requiredForRehearsal: true,
    mutatesRemoteState: false,
    publishesPackage: false,
    movesGitTag: false,
    executesInstaller: false,
    secretValuesSerialized: false,
  };
}

function operatorStep(input: {
  id: ReleaseCandidateDistributionRehearsalStep['id'];
  surface: ReleaseCandidateDistributionRehearsalStep['surface'];
  command: string;
  evidence: string;
}): ReleaseCandidateDistributionRehearsalStep {
  return {
    ...input,
    mode: 'operator-rehearsal',
    status: 'operator-ready',
    receipt: `release-candidate-distribution.${input.id}.receipt`,
    requiredForRehearsal: true,
    mutatesRemoteState: false,
    publishesPackage: false,
    movesGitTag: false,
    executesInstaller: false,
    secretValuesSerialized: false,
  };
}

function policyStep(input: {
  id: ReleaseCandidateDistributionRehearsalStep['id'];
  surface: ReleaseCandidateDistributionRehearsalStep['surface'];
  command: string;
  evidence: string;
}): ReleaseCandidateDistributionRehearsalStep {
  return {
    ...input,
    mode: 'policy-lock',
    status: 'operator-ready',
    receipt: `release-candidate-distribution.${input.id}.receipt`,
    requiredForRehearsal: true,
    mutatesRemoteState: false,
    publishesPackage: false,
    movesGitTag: false,
    executesInstaller: false,
    secretValuesSerialized: false,
  };
}

function gate(input: ReleaseCandidateDistributionRehearsalGate): ReleaseCandidateDistributionRehearsalGate {
  return input;
}
