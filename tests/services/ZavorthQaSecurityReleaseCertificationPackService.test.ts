import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ZavorthPatchRiskLedgerService } from '../../src/services/ZavorthPatchRiskLedgerService.js';
import { ZavorthQaScenarioImporterService } from '../../src/services/ZavorthQaScenarioImporterService.js';
import { ZavorthQaSecurityReleaseCertificationPackService } from '../../src/services/ZavorthQaSecurityReleaseCertificationPackService.js';
import { ZavorthReleaseAcceptanceCheckService } from '../../src/services/ZavorthReleaseAcceptanceCheckService.js';
import { ZavorthSecurityCertificationCheckService } from '../../src/services/ZavorthSecurityCertificationCheckService.js';
import { ZavorthWorkflowSemanticCheckService } from '../../src/services/ZavorthWorkflowSemanticCheckService.js';

describe('ZavorthQaSecurityReleaseCertificationPackService Surface controls', () => {
  const now = () => new Date('2026-05-05T19:00:00.000Z');
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-qa-security-release-certification-pack-'));
    writeFixture(tempRoot);
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('imports runnable local QA scenarios without live provider or channel IO', () => {
    const snapshot = new ZavorthQaScenarioImporterService({
      now,
      rootDir: tempRoot,
    }).buildSnapshot();

    expect(snapshot.status).toBe('pass');
    expect(snapshot.scenariosImported).toBe(8);
    expect(snapshot.qaDirectoriesDiscovered).toEqual(expect.arrayContaining([
      'qa/benchmarks',
      'qa/compat',
      'qa/regression',
      'qa/smokes',
    ]));
    expect(snapshot.receipts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        scenarioId: 'provider-runtime-gate',
        command: 'npm run provider-runtime-activation:check --silent',
        liveExternalIoPerformed: false,
      }),
      expect.objectContaining({
        scenarioId: 'channel-runtime-gate',
        command: 'npm run channel-live-activation:check --silent',
        liveExternalIoPerformed: false,
      }),
    ]));
    expect(snapshot.secretValuesSerialized).toBe(false);
  });

  it('certifies security, release and workflow surfaces from local evidence', () => {
    const security = new ZavorthSecurityCertificationCheckService({
      now,
      rootDir: tempRoot,
    }).buildSnapshot();
    const release = new ZavorthReleaseAcceptanceCheckService({
      now,
      rootDir: tempRoot,
    }).buildSnapshot();
    const workflow = new ZavorthWorkflowSemanticCheckService({
      now,
      rootDir: tempRoot,
    }).buildSnapshot();

    expect(security.status).toBe('pass');
    expect(security.localOnly).toBe(true);
    expect(security.receipts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        controlId: 'privacy-scan-command',
        status: 'pass',
      }),
      expect.objectContaining({
        controlId: 'dependency-lockfile',
        status: 'pass',
      }),
    ]));

    expect(release.status).toBe('pass');
    expect(release.packageBinPresent).toBe(true);
    expect(release.packageDistExported).toBe(true);
    expect(release.receipts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        acceptanceId: 'surface-controls-release-gate',
        status: 'pass',
      }),
      expect.objectContaining({
        acceptanceId: 'sdk-export-release-surface',
        status: 'pass',
      }),
    ]));

    expect(workflow.status).toBe('pass');
    expect(workflow.workflowFilesObserved).toBe(1);
    expect(workflow.rawWorkflowYamlCopied).toBe(false);
    expect(workflow.receipts.every((receipt) => receipt.copiedWorkflowYaml === false)).toBe(true);
  });

  it('tracks dependency patches with explicit owner decisions', () => {
    const snapshot = new ZavorthPatchRiskLedgerService({
      now,
      rootDir: tempRoot,
    }).buildSnapshot();

    expect(snapshot.status).toBe('warn');
    expect(snapshot.patchFilesObserved).toBe(1);
    expect(snapshot.dependencyPatchesAcceptedSilently).toBe(false);
    expect(snapshot.receipts).toEqual([
      expect.objectContaining({
        patchId: 'patches/example.patch',
        decision: 'owner-decision-required',
        status: 'warn',
        dependencyPatchAcceptedSilently: false,
      }),
    ]);
  });

  it('emits a passing Surface controls certification snapshot with warnable patch risk', () => {
    const service = new ZavorthQaSecurityReleaseCertificationPackService({
      now,
      rootDir: tempRoot,
    });
    const snapshot = service.buildSnapshot();
    const text = service.formatSnapshotText(snapshot);

    expect(snapshot.status).toBe('passed');
    expect(snapshot.phase).toBe(7);
    expect(snapshot.summary).toEqual(expect.objectContaining({
      families: 6,
      failFamilies: 0,
      scenariosImported: 8,
      securityChecks: 6,
      releaseChecks: 8,
      workflowChecks: 6,
      patchRisksTracked: 1,
      dependencyPatchesAcceptedSilently: false,
      rawWorkflowYamlCopied: false,
      liveExternalIoPerformed: false,
      secretValuesSerialized: false,
    }));
    expect(snapshot.functionalConsistencyRunner.printableLines).toEqual(expect.arrayContaining([
      expect.stringContaining('qa-scenarios'),
      expect.stringContaining('security'),
      expect.stringContaining('release-acceptance'),
      expect.stringContaining('workflow-semantics'),
      expect.stringContaining('patch-risk'),
      expect.stringContaining('functional-consistency'),
    ]));
    expect(snapshot.policy).toEqual(expect.objectContaining({
      localChecksOnly: true,
      noRawWorkflowYamlCopy: true,
      dependencyPatchesNeedReceipt: true,
      noLiveProviderCalls: true,
      noLiveChannelSends: true,
      artifactFirstReceipts: true,
    }));
    expect(snapshot.commands.nextAction).toBe('Dashboard controls - Skill Ecosystem Pack');
    expect(text).toContain('Zavorth QA Security Release Certification Pack - Surface controls');
    expect(text).toContain('Next: Dashboard controls - Skill Ecosystem Pack');
  });
});

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
