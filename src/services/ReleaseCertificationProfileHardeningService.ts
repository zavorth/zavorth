import type {
  ReleaseCertificationFinalReceipt,
  ReleaseCertificationHardeningGate,
  ReleaseCertificationProfileHardeningSnapshot,
  ReleaseCertificationProfileHardeningStatus,
  ReleaseCertificationProfilePolicy,
  ReleaseCertificationProfileResult,
} from '../contracts/ReleaseCertificationProfileHardeningContract.js';
import { ZAVORTH_RELEASE_CERTIFICATION_PROFILE_HARDENING_CONTRACT_VERSION } from '../contracts/ReleaseCertificationProfileHardeningContract.js';
import { ReleaseCertificationService } from './ReleaseCertificationService.js';

import type {
  ReleaseCertificationProfile,
  ReleaseCertificationSnapshot,
} from '../contracts/ReleaseCertificationContract.js';

type ReleaseCertificationProfileHardeningRuntime = {
  now?: () => Date;
  releaseCertificationService?: ReleaseCertificationService;
};

export class ReleaseCertificationProfileHardeningService {
  private readonly now: () => Date;
  private readonly certification: ReleaseCertificationService;

  constructor(runtime: ReleaseCertificationProfileHardeningRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.certification = runtime.releaseCertificationService || new ReleaseCertificationService({
      now: this.now,
    });
  }

  public buildSnapshot(): ReleaseCertificationProfileHardeningSnapshot {
    const generatedAt = this.now().toISOString();
    const profilePolicyMatrix = this.profilePolicyMatrix();
    const certifications = profilePolicyMatrix.map((policy) =>
      this.certification.buildSnapshot({ profile: policy.profile }),
    );
    const profileResults = certifications.map((snapshot) =>
      this.profileResult(snapshot, this.policyForProfile(profilePolicyMatrix, snapshot.profile)),
    );
    const gates = this.buildGates(profileResults);
    const finalReceipts = this.finalReceipts(profileResults, certifications);
    const failedGates = gates.filter((gate) => gate.status === 'fail').length;
    const failedProfiles = profileResults.filter((result) => !result.certified || !result.releaseReady).length;
    const status: ReleaseCertificationProfileHardeningStatus = failedGates > 0
      ? profileResults.some((result) => result.failed > 0 || result.sourceP0Gaps > 0) ? 'blocked'
        : 'attention'
      : 'certified';
    const sourceOpenGaps = Math.max(...profileResults.map((result) => result.sourceOpenGaps));
    const sourceP0Gaps = Math.max(...profileResults.map((result) => result.sourceP0Gaps));
    const sourceP1Gaps = Math.max(...profileResults.map((result) => result.sourceP1Gaps));
    const sourceP2Gaps = Math.max(...profileResults.map((result) => result.sourceP2Gaps));

    return {
      generatedAt,
      contractVersion: ZAVORTH_RELEASE_CERTIFICATION_PROFILE_HARDENING_CONTRACT_VERSION,
      status,
      summary: {
        profiles: profilePolicyMatrix.length,
        certifiedProfiles: profileResults.filter((result) => result.certified).length,
        releaseReadyProfiles: profileResults.filter((result) => result.releaseReady).length,
        failedProfiles,
        gates: gates.length,
        passedGates: gates.filter((gate) => gate.status === 'pass').length,
        failedGates,
        finalReceipts: finalReceipts.length,
        sourceOpenGaps,
        sourceP0Gaps,
        sourceP1Gaps,
        sourceP2Gaps,
        warnings: profileResults.reduce((sum, result) => sum + result.warned, 0),
        waivers: profileResults.reduce((sum, result) => sum + result.waived, 0),
        releaseReady: status === 'certified'
          && profileResults.every((result) => result.releaseReady)
          && finalReceipts.length === certifications.reduce((sum, snapshot) => sum + snapshot.receipts.length, 0),
        liveExternalCallRequired: false,
        liveChannelSendRequired: false,
        liveDeviceRequired: false,
        liveMemoryWriteRequired: false,
        filesystemReadRequired: false,
        secretValuesSerialized: false,
      },
      profilePolicyMatrix,
      profileResults,
      gates,
      finalReceipts,
      certifications: certifications.map((snapshot) => ({
        contractVersion: snapshot.contractVersion,
        profile: snapshot.profile,
        status: snapshot.status,
        summary: snapshot.summary,
        recommendations: snapshot.recommendations,
      })),
      commands: {
        run: 'npm run release-certification-hardening --silent',
        runJson: 'npm run release-certification-hardening:json --silent',
        check: 'npm run release-certification-hardening:check --silent',
        releaseCandidate: 'npm run release-certify:release-candidate --silent',
        publicLaunch: 'npm run release-certify:public-launch --silent',
        focusedTests: [
          'npx jest tests/services/ReleaseCertificationProfileHardeningService.test.ts --runInBand',
          'npm run release-certification-hardening:check --silent',
          'npm run release-certification-hardening --silent -- --require-ready',
        ],
        typecheck: 'npm run runtime:check --silent',
        nextAction: 'Public launch smoke and evidence ledger',
      },
      policy: {
        hardensAllProfiles: true,
        requiresReleaseCandidate: true,
        requiresPublicLaunch: true,
        requiresFinalReceipts: true,
        requiresZeroP0P1P2: true,
        noExternalCalls: true,
        noLiveSends: true,
        noDeviceAccess: true,
        noMemoryWrites: true,
        noArtifactBodyReads: true,
        noWaiversForFinalCertification: true,
        secretsSerialized: false,
      },
    };
  }

  public formatHardeningText(snapshot: ReleaseCertificationProfileHardeningSnapshot = this.buildSnapshot()): string {
    return [
      'Zavorth Release Certification Profile Hardening',
      `Status: ${snapshot.status}`,
      `Profiles: ${snapshot.summary.certifiedProfiles}/${snapshot.summary.profiles} certified`,
      `Gates: ${snapshot.summary.passedGates}/${snapshot.summary.gates} pass`,
      `Source gaps: ${snapshot.summary.sourceOpenGaps} (P0 ${snapshot.summary.sourceP0Gaps}, ${snapshot.summary.sourceP1Gaps}, P2 ${snapshot.summary.sourceP2Gaps})`,
      `Final receipts: ${snapshot.summary.finalReceipts}`,
      `Release ready: ${snapshot.summary.releaseReady}`,
      '',
      'Profile results:',
      ...snapshot.profileResults.map((result) =>
        `- ${result.profile}: ${result.status}, ready ${result.releaseReady}, receipts ${result.receipts}`,
      ),
      '',
      'Gate results:',
      ...snapshot.gates.map((gate) =>
        `- ${gate.status.toUpperCase()} ${gate.id}: ${gate.observed} / ${gate.threshold} - ${gate.nextAction}`,
      ),
      '',
      `Next: ${snapshot.commands.nextAction}`,
    ].join('\n');
  }

  private profilePolicyMatrix(): ReleaseCertificationProfilePolicy[] {
    return [
      this.profilePolicy({
        profile: 'private-absorption',
        gateId: 'profile-private-absorption-ready',
        label: 'Private absorption certification is final-clean',
      }),
      this.profilePolicy({
        profile: 'release-candidate',
        gateId: 'profile-release-candidate-ready',
        label: 'Release-candidate certification is final-clean',
      }),
      this.profilePolicy({
        profile: 'public-launch',
        gateId: 'profile-public-launch-ready',
        label: 'Public-launch certification is final-clean',
      }),
    ];
  }

  private profilePolicy(input: {
    profile: ReleaseCertificationProfile;
    gateId: string;
    label: string;
  }): ReleaseCertificationProfilePolicy {
    return {
      ...input,
      maxP0Gaps: 0,
      maxP1Gaps: 0,
      maxP2Gaps: 0,
      requireCertifiedStatus: true,
      requireReleaseReady: true,
      requireNoWarnings: true,
      requireNoWaivers: true,
      requireReceipts: true,
      requireNoLiveIo: true,
      requireSecretRedaction: true,
      command: `npm run release-certify --silent -- --profile=${input.profile}`,
      jsonCommand: `npm run release-certify:json --silent -- --profile=${input.profile}`,
      requireReadyCommand: `npm run release-certify --silent -- --profile=${input.profile} --require-ready --require-no-blockers`,
    };
  }

  private policyForProfile(
    policies: ReleaseCertificationProfilePolicy[],
    profile: ReleaseCertificationProfile,
  ): ReleaseCertificationProfilePolicy {
    const policy = policies.find((item) => item.profile === profile);
    if (!policy) {
      throw new Error(`Missing release certification hardening policy for profile ${profile}`);
    }
    return policy;
  }

  private profileResult(
    snapshot: ReleaseCertificationSnapshot,
    policy: ReleaseCertificationProfilePolicy,
  ): ReleaseCertificationProfileResult {
    const noLiveIo = snapshot.summary.liveExternalCallRequired === false
      && snapshot.summary.liveChannelSendRequired === false
      && snapshot.summary.liveDeviceRequired === false
      && snapshot.summary.liveMemoryWriteRequired === false
      && snapshot.summary.filesystemReadRequired === false
      && snapshot.policy.noArtifactBodyReads === true;

    return {
      profile: snapshot.profile,
      gateId: policy.gateId,
      status: snapshot.status,
      certified: snapshot.status === 'certified',
      releaseReady: snapshot.summary.releaseReady,
      sourceOpenGaps: snapshot.summary.sourceOpenGaps,
      sourceP0Gaps: snapshot.summary.sourceP0Gaps,
      sourceP1Gaps: snapshot.summary.sourceP1Gaps,
      sourceP2Gaps: snapshot.summary.sourceP2Gaps,
      warned: snapshot.summary.warned,
      failed: snapshot.summary.failed,
      waived: snapshot.summary.waived,
      receipts: snapshot.summary.receipts,
      noLiveIo,
      secretValuesSerialized: false,
      command: policy.command,
      jsonCommand: policy.jsonCommand,
      requireReadyCommand: policy.requireReadyCommand,
      receiptIds: snapshot.receipts.map((receipt) => receipt.id),
    };
  }

  private buildGates(results: ReleaseCertificationProfileResult[]): ReleaseCertificationHardeningGate[] {
    const profileGates = results.map((result) => ({
      id: result.gateId,
      profile: result.profile,
      status: this.profilePasses(result) ? 'pass' as const : 'fail' as const,
      title: `${result.profile} profile is certified with zero P0/P1/P2 gaps`,
      observed: `${result.status}/${result.sourceP0Gaps}/${result.sourceP1Gaps}/${result.sourceP2Gaps}`,
      threshold: 'certified/0/0/0',
      receipt: `release-profile-hardening.${result.profile}.receipt`,
      nextAction: 'repair this profile before claiming final certification',
    }));

    return [
      ...profileGates,
      {
        id: 'final-receipts-complete',
        profile: 'all',
        status: results.every((result) => result.receipts > 0) ? 'pass' : 'fail',
        title: 'All profile gates emit final receipts',
        observed: results.reduce((sum, result) => sum + result.receipts, 0),
        threshold: results.length * 10,
        receipt: 'release-profile-hardening.final-receipts.receipt',
        nextAction: 'repair receipt generation before release hardening can pass',
      },
      {
        id: 'no-live-io-across-profiles',
        profile: 'all',
        status: results.every((result) => result.noLiveIo) ? 'pass' : 'fail',
        title: 'All profiles certify without live IO',
        observed: results.every((result) => result.noLiveIo),
        threshold: true,
        receipt: 'release-profile-hardening.no-live-io.receipt',
        nextAction: 'move live checks into opt-in smoke gates',
      },
      {
        id: 'no-waivers-across-profiles',
        profile: 'all',
        status: results.every((result) => result.waived === 0) ? 'pass' : 'fail',
        title: 'Final certification has no waivers',
        observed: results.reduce((sum, result) => sum + result.waived, 0),
        threshold: 0,
        receipt: 'release-profile-hardening.no-waivers.receipt',
        nextAction: 'close or remove waivers before final certification',
      },
      {
        id: 'commands-registered-for-release-profiles',
        profile: 'all',
        status: results.every((result) =>
          result.command.includes('--profile=')
          && result.jsonCommand.includes('--profile=')
          && result.requireReadyCommand.includes('--require-ready')
          && result.requireReadyCommand.includes('--require-no-blockers')
        ) ? 'pass' : 'fail',
        title: 'Release profile commands are registered',
        observed: results.length,
        threshold: 3,
        receipt: 'release-profile-hardening.commands.receipt',
        nextAction: 'register release-candidate and public-launch commands',
      },
    ];
  }

  private profilePasses(result: ReleaseCertificationProfileResult): boolean {
    return result.certified
      && result.releaseReady
      && result.sourceOpenGaps === 0
      && result.sourceP0Gaps === 0
      && result.sourceP1Gaps === 0
      && result.sourceP2Gaps === 0
      && result.warned === 0
      && result.failed === 0
      && result.waived === 0
      && result.receipts > 0
      && result.noLiveIo
      && result.secretValuesSerialized === false;
  }

  private finalReceipts(
    profileResults: ReleaseCertificationProfileResult[],
    certifications: ReleaseCertificationSnapshot[],
  ): ReleaseCertificationFinalReceipt[] {
    const byProfile = new Map(profileResults.map((result) => [result.profile, result]));
    return certifications.flatMap((snapshot) =>
      snapshot.receipts.map((receipt) => {
        const result = byProfile.get(snapshot.profile);
        return {
          id: `release-profile-hardening.${snapshot.profile}.${receipt.gateId}.receipt`,
          profile: snapshot.profile,
          sourceReceiptId: receipt.id,
          gateId: receipt.gateId,
          status: receipt.status,
          evidence: `${snapshot.profile}: ${receipt.evidence}`,
          noLiveIo: true,
          secretValuesSerialized: result?.secretValuesSerialized ?? false,
        };
      }),
    );
  }
}
