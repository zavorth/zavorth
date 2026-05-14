import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ZavorthSemanticQaSecurityReleaseCertificationService } from '../../src/services/ZavorthSemanticQaSecurityReleaseCertificationService.js';

describe('ZavorthSemanticQaSecurityReleaseCertificationService S7', () => {
  const now = () => new Date('2026-05-05T20:00:00.000Z');
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-semantic-qa-security-release-'));
    writeFixture(tempRoot);
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('certifies S7 QA/security/release semantics with local-only receipts', () => {
    const snapshot = new ZavorthSemanticQaSecurityReleaseCertificationService({
      now,
      rootDir: tempRoot,
    }).buildSnapshot();

    expect(snapshot.status).toBe('passed');
    expect(snapshot.semanticPhase).toBe('S7');
    expect(snapshot.packStatus).toBe('passed');
    expect(snapshot.summary).toEqual(expect.objectContaining({
      gaps: 0,
      familyClaimsCertified: 6,
      receiptClaimsCertified: 30,
      qaScenarioClaimsCertified: 8,
      securityControlClaimsCertified: 6,
      releaseAcceptanceClaimsCertified: 8,
      workflowSemanticClaimsCertified: 7,
      patchRiskClaimsCertified: 2,
      functionalRunnerClaimsCertified: 1,
      scenariosPassed: 4,
      packFamilies: 6,
      packReceipts: 30,
      warnFamilies: 2,
      failFamilies: 0,
      warningReceipts: 2,
      blockingFailures: 0,
      localChecksOnly: true,
      dependencyPatchesAcceptedSilently: false,
      rawWorkflowYamlCopied: false,
      liveExternalIoPerformed: false,
      secretValuesSerialized: false,
      sourceCodeCopied: false,
    }));
    expect(snapshot.summary.receiptBackedClaims).toBe(snapshot.summary.semanticClaims);
    expect(snapshot.policy).toEqual(expect.objectContaining({
      localChecksOnly: true,
      noRawWorkflowYamlCopy: true,
      dependencyPatchesNeedReceipt: true,
      patchWarningsRemainOwnerGated: true,
      blockingFailuresBlockRelease: true,
      noLiveProviderCalls: true,
      noLiveChannelSends: true,
      artifactFirstReceipts: true,
      rawWorkflowYamlRejected: true,
      silentPatchAcceptanceRejected: true,
    }));
  });

  it('keeps family, receipt and patch-risk decisions explicit by semantic status', () => {
    const snapshot = new ZavorthSemanticQaSecurityReleaseCertificationService({
      now,
      rootDir: tempRoot,
    }).buildSnapshot();

    expect(familyClaim(snapshot, 'qa-scenarios')).toEqual(expect.objectContaining({
      status: 'covered',
      priority: 'P0',
    }));
    expect(familyClaim(snapshot, 'security')).toEqual(expect.objectContaining({
      status: 'covered',
      priority: 'P0',
    }));
    expect(familyClaim(snapshot, 'patch-risk')).toEqual(expect.objectContaining({
      status: 'owner-gated',
      priority: 'P1',
      receiptStatus: 'warn',
    }));
    expect(snapshot.claims).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'patch-risk-policy',
        status: 'owner-gated',
        expectedBehavior: 'Dependency patches are absent or explicitly tracked with owner decision before release.',
      }),
      expect.objectContaining({
        kind: 'release-acceptance-policy',
        status: 'covered',
        checkId: 'phase7-release-gate',
      }),
      expect.objectContaining({
        kind: 'workflow-semantic-policy',
        status: 'covered',
        checkId: 'phase7-certification-before-release',
      }),
    ]));
  });

  it('certifies release scenarios without copying workflows or accepting patches silently', () => {
    const snapshot = new ZavorthSemanticQaSecurityReleaseCertificationService({
      now,
      rootDir: tempRoot,
    }).buildSnapshot();
    const scenarios = Object.fromEntries(snapshot.scenarios.map((scenario) => [scenario.id, scenario]));

    expect(scenarios['blocking-failure-blocks-release']).toEqual(expect.objectContaining({
      status: 'passed',
      liveExternalIoPerformed: false,
    }));
    expect(scenarios['tracked-patch-warning-is-owner-gated']).toEqual(expect.objectContaining({
      status: 'passed',
      dependencyPatchesAcceptedSilently: false,
    }));
    expect(scenarios['workflow-semantics-do-not-copy-yaml']).toEqual(expect.objectContaining({
      status: 'passed',
      rawWorkflowYamlCopied: false,
    }));
    expect(scenarios['release-certification-stays-local-only']).toEqual(expect.objectContaining({
      status: 'passed',
      secretValuesSerialized: false,
    }));
  });

  it('rejects unsafe release behavior by policy instead of implementing it', () => {
    const snapshot = new ZavorthSemanticQaSecurityReleaseCertificationService({
      now,
      rootDir: tempRoot,
    }).buildSnapshot();

    const unsafeClaims = snapshot.claims.filter((claim) => claim.kind === 'unsafe-release-policy');
    expect(unsafeClaims).toHaveLength(4);
    expect(unsafeClaims.every((claim) => claim.status === 'rejected')).toBe(true);
    expect(snapshot.claims).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'unsafe-release-policy',
        status: 'rejected',
        expectedBehavior: 'The architecture must reject raw workflow YAML copying as the release integration strategy.',
      }),
      expect.objectContaining({
        kind: 'unsafe-release-policy',
        status: 'rejected',
        expectedBehavior: 'The architecture must reject silent dependency patch acceptance.',
      }),
    ]));
  });

  it('formats a readable S7 operator summary', () => {
    const service = new ZavorthSemanticQaSecurityReleaseCertificationService({
      now,
      rootDir: tempRoot,
    });
    const text = service.formatSnapshotText(service.buildSnapshot());

    expect(text).toContain('Zavorth Semantic QA Security Release Certification - S7');
    expect(text).toContain('Status: passed');
    expect(text).toContain('Next: S8 - Skill Ecosystem Semantics');
  });
});

type Snapshot = ReturnType<ZavorthSemanticQaSecurityReleaseCertificationService['buildSnapshot']>;

function familyClaim(snapshot: Snapshot, familyId: string) {
  const claim = snapshot.claims.find((entry) =>
    entry.kind === 'family-coverage' && entry.familyId === familyId,
  );
  if (!claim) {
    throw new Error(`missing family claim ${familyId}`);
  }
  return claim;
}

function writeFixture(rootDir: string): void {
  const packageManifest = {
    name: 'zavorth-fixture',
    bin: {
      zavorth: 'bin/zavorth.js',
    },
    files: ['dist/'],
    exports: {
      './sdk/qa-security-release-certification-pack': {
        types: './dist/sdk/qa-security-release-certification-pack.d.ts',
        default: './dist/sdk/qa-security-release-certification-pack.js',
      },
    },
    scripts: {
      'runtime:check': 'tsc --noEmit',
      test: 'jest --runInBand',
      'provider-runtime-activation:check': 'node scripts/provider-runtime-activation-check.mjs',
      'channel-live-activation:check': 'node scripts/channel-live-activation-check.mjs',
      'memory-artifacts-runtime-live-closure:check': 'node scripts/memory-artifacts-runtime-live-closure-check.mjs',
      'zavorth-native-companion-device-pack:check': 'node scripts/zavorth-native-companion-device-pack-check.mjs',
      'release-certification-hardening:check': 'node scripts/release-certification-profile-hardening-check.mjs',
      'privacy:scan': 'node scripts/privacy-clean.mjs',
      'privacy:clean': 'node scripts/privacy-clean.mjs --apply --require-clean',
      'architecture:hardening': 'npx tsx scripts/architecture-hardening-check.ts',
      'release:scan': 'npx tsx scripts/release-hygiene-scan.ts',
      'final-absorption-certification:check': 'node scripts/final-absorption-certification-check.mjs',
      'qa:deterministic': 'npx tsx scripts/deterministic-qa.ts --require-pass',
      'zavorth-qa-security-release-certification-pack:check': 'node scripts/zavorth-qa-security-release-certification-pack-check.mjs',
      'qa:zavorth-qa-security-release-certification-pack': 'npx jest tests/services/ZavorthQaSecurityReleaseCertificationPackService.test.ts --runInBand && node scripts/zavorth-qa-security-release-certification-pack-check.mjs',
    },
  };

  fs.writeFileSync(path.join(rootDir, 'package.json'), JSON.stringify(packageManifest, null, 2));
  fs.writeFileSync(path.join(rootDir, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3 }, null, 2));
  fs.mkdirSync(path.join(rootDir, 'qa', 'benchmarks'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'qa', 'compat'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'qa', 'regression'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'qa', 'smokes'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'src', 'services'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'src', 'services', 'ZavorthSecurityMeshService.ts'), 'export class ZavorthSecurityMeshService {}\n');
  fs.mkdirSync(path.join(rootDir, '.github', 'workflows'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, '.github', 'workflows', 'ci.yml'), 'name: ci\n');
  fs.mkdirSync(path.join(rootDir, 'patches'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'patches', 'example.patch'), 'diff --git a/a b/a\n');
}
