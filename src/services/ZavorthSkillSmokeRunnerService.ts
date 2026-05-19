import type {
  ZavorthSkillManifest,
  ZavorthSkillPermissionEvaluation,
  ZavorthSkillSmokeResult,
  ZavorthSkillSmokeRunnerSnapshot,
  ZavorthSkillSmokeTestPrompt,
} from '../contracts/ZavorthSkillEcosystemPackContract.js';
import { ZavorthSkillPermissionProfileService } from './ZavorthSkillPermissionProfileService.js';

type Runtime = {
  now?: () => Date;
  permissionProfileService?: ZavorthSkillPermissionProfileService;
};

export class ZavorthSkillSmokeRunnerService {
  private readonly now: () => Date;
  private readonly permissionProfileService: ZavorthSkillPermissionProfileService;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.permissionProfileService = runtime.permissionProfileService || new ZavorthSkillPermissionProfileService({
      now: this.now,
    });
  }

  public buildSnapshot(manifests: ZavorthSkillManifest[]): ZavorthSkillSmokeRunnerSnapshot {
    const results = manifests.flatMap((manifest) => {
      const evaluation = this.permissionProfileService.evaluateManifest(manifest);
      return manifest.smokeTests.map((smokeTest) => this.runSmokeTest(manifest, smokeTest, evaluation));
    });
    const failed = results.filter((result) => result.status === 'fail').length;
    const denied = results.filter((result) => result.status === 'deny').length;
    const passed = results.filter((result) => result.status === 'pass').length;

    return {
      status: failed > 0 ? 'fail' : 'pass',
      smokeTests: results.length,
      passed,
      denied,
      failed,
      results,
      nonDestructiveOnly: true,
      liveSecretsUsed: false,
      liveExternalIoPerformed: false,
      secretValuesSerialized: false,
    };
  }

  private runSmokeTest(
    manifest: ZavorthSkillManifest,
    smokeTest: ZavorthSkillSmokeTestPrompt,
    evaluation: ZavorthSkillPermissionEvaluation,
  ): ZavorthSkillSmokeResult {
    if (smokeTest.destructive) {
      return this.result({
        manifest,
        smokeTest,
        status: 'fail',
        mode: 'denial',
        observed: 'destructive smoke test is not allowed in Dashboard controls',
      });
    }

    if (smokeTest.expectedReceipt === 'inspect') {
      return this.result({
        manifest,
        smokeTest,
        status: 'pass',
        mode: 'inspect',
        observed: `${manifest.id} inspected without enablement`,
      });
    }

    if (smokeTest.requiresLiveSecret || evaluation.denialRequired || smokeTest.expectedReceipt === 'deny') {
      return this.result({
        manifest,
        smokeTest,
        status: 'deny',
        mode: 'denial',
        observed: `${manifest.id} denied safely: ${evaluation.reason}`,
      });
    }

    return this.result({
      manifest,
      smokeTest,
      status: 'pass',
      mode: 'dry-run',
      observed: `${manifest.id} dry-run completed without live IO`,
    });
  }

  private result(input: {
    manifest: ZavorthSkillManifest;
    smokeTest: ZavorthSkillSmokeTestPrompt;
    status: ZavorthSkillSmokeResult['status'];
    mode: ZavorthSkillSmokeResult['mode'];
    observed: string;
  }): ZavorthSkillSmokeResult {
    return {
      id: `zavorth.dashboard-controls.skill-smoke.${safeId(input.manifest.id)}.${safeId(input.smokeTest.id)}.${this.now().getTime()}.receipt`,
      manifestId: input.manifest.id,
      promptId: input.smokeTest.id,
      status: input.status,
      mode: input.mode,
      destructive: false,
      liveSecretsUsed: false,
      liveExternalIoPerformed: false,
      artifactFirst: true,
      observed: input.observed,
    };
  }
}

function safeId(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'unknown';
}
