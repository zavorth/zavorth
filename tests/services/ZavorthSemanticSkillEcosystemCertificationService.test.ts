import type { SkillCatalogEntry } from '../../src/skills/SkillCatalogContract.js';
import { ZavorthSemanticSkillEcosystemCertificationService } from '../../src/services/ZavorthSemanticSkillEcosystemCertificationService.js';
import { ZavorthSkillEcosystemImporterService } from '../../src/services/ZavorthSkillEcosystemImporterService.js';
import { ZavorthSkillEcosystemPackService } from '../../src/services/ZavorthSkillEcosystemPackService.js';

describe('ZavorthSemanticSkillEcosystemCertificationService S8', () => {
  const now = () => new Date('2026-05-05T21:00:00.000Z');
  const catalogEntries = [
    catalogEntry({
      name: 'debugging',
      description: 'Debug local failures and build verification notes.',
      sourceTrust: 'trusted',
      bundleTags: ['qa'],
    }),
    catalogEntry({
      name: 'security-threat-model',
      description: 'Build a security threat model from local repo evidence.',
      sourceTrust: 'review',
      bundleTags: ['security'],
    }),
  ];

  it('certifies S8 skill ecosystem semantics with optional manifests and receipts', () => {
    const snapshot = buildFixtureService().buildSnapshot();

    expect(snapshot.status).toBe('passed');
    expect(snapshot.semanticPhase).toBe('S8');
    expect(snapshot.packStatus).toBe('passed');
    expect(snapshot.summary).toEqual(expect.objectContaining({
      gaps: 0,
      manifestClaimsCertified: 11,
      capabilityTagClaimsCertified: 8,
      permissionProfileClaimsCertified: 5,
      permissionEvaluationClaimsCertified: 11,
      secretRefClaimsCertified: 4,
      smokeClaimsCertified: 23,
      lifecycleReceiptClaimsCertified: 66,
      bridgeClaimsCertified: 2,
      scenariosPassed: 4,
      packManifests: 11,
      packPermissionProfiles: 5,
      packSmokeTests: 22,
      packReceipts: 66,
      safeDenials: 35,
      connectorConcepts: 3,
      workspaceCatalogInputs: 2,
      enabledByDefault: false,
      liveSkillsRequireOwnerApproval: true,
      liveSkillsRequireSecretRef: true,
      nonDestructiveSmokeOnly: true,
      liveExternalIoPerformed: false,
      liveSecretsUsed: false,
      secretValuesSerialized: false,
      sourceCodeCopied: false,
    }));
    expect(snapshot.summary.receiptBackedClaims).toBe(snapshot.summary.semanticClaims);
    expect(snapshot.summary.ownerGated).toBeGreaterThan(0);
    expect(snapshot.summary.rejected).toBe(4);
    expect(snapshot.policy).toEqual(expect.objectContaining({
      optionalEcosystemCapacity: true,
      inspectBeforeEnablement: true,
      nonDestructiveSmokeOnly: true,
      liveSkillsRequireOwnerApproval: true,
      liveSkillsRequireSecretRef: true,
      denialsAreReceiptBacked: true,
      noSecretsInReceipts: true,
      noCoreBloat: true,
      mcpAcpBridgeOptional: true,
      defaultEnablementRejected: true,
      liveSecretUseRejected: true,
      destructiveSmokeRejected: true,
    }));
  });

  it('keeps manifests, permission denials and SecretRefs explicit by semantic status', () => {
    const snapshot = buildFixtureService().buildSnapshot();

    expect(manifestClaim(snapshot, 'skill.personal-daily-brief')).toEqual(expect.objectContaining({
      status: 'covered',
      priority: 'P0',
    }));
    expect(manifestClaim(snapshot, 'skill.connector-calendar-brief')).toEqual(expect.objectContaining({
      status: 'covered',
      priority: 'P1',
    }));
    expect(evaluationClaim(snapshot, 'skill.connector-calendar-brief')).toEqual(expect.objectContaining({
      status: 'owner-gated',
      sourceStatus: 'deny',
      profileId: 'connector-live-secretref',
    }));
    expect(snapshot.claims).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'secretref-policy',
        status: 'owner-gated',
        manifestId: 'skill.connector-calendar-brief',
      }),
      expect.objectContaining({
        kind: 'bridge-policy',
        status: 'owner-gated',
        expectedBehavior: 'MCP bridge support is optional and tied to owner-approved connector/tool manifests.',
      }),
      expect.objectContaining({
        kind: 'bridge-policy',
        status: 'owner-gated',
        expectedBehavior: 'ACP bridge support is optional and tied to owner-approved connector/tool manifests.',
      }),
    ]));
  });

  it('certifies inspect, live-denial, smoke and lifecycle scenarios', () => {
    const snapshot = buildFixtureService().buildSnapshot();
    const scenarios = Object.fromEntries(snapshot.scenarios.map((scenario) => [scenario.id, scenario]));

    expect(scenarios['inspect-before-enable']).toEqual(expect.objectContaining({
      status: 'passed',
      enabledByDefault: false,
    }));
    expect(scenarios['live-connector-denied-without-secretref']).toEqual(expect.objectContaining({
      status: 'passed',
      liveSecretsUsed: false,
    }));
    expect(scenarios['non-destructive-smoke-only']).toEqual(expect.objectContaining({
      status: 'passed',
      liveExternalIoPerformed: false,
    }));
    expect(scenarios['receipt-lifecycle-secret-safe']).toEqual(expect.objectContaining({
      status: 'passed',
      secretValuesSerialized: false,
    }));
  });

  it('rejects unsafe skill behavior by policy instead of enabling it', () => {
    const snapshot = buildFixtureService().buildSnapshot();

    const unsafeClaims = snapshot.claims.filter((claim) => claim.kind === 'unsafe-skill-policy');
    expect(unsafeClaims).toHaveLength(4);
    expect(unsafeClaims.every((claim) => claim.status === 'rejected')).toBe(true);
    expect(snapshot.claims).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'unsafe-skill-policy',
        status: 'rejected',
        expectedBehavior: 'The architecture must reject default-on skill enablement.',
      }),
      expect.objectContaining({
        kind: 'unsafe-skill-policy',
        status: 'rejected',
        expectedBehavior: 'The architecture must reject destructive skill smoke tests.',
      }),
    ]));
  });

  it('formats a readable S8 operator summary', () => {
    const service = buildFixtureService();
    const text = service.formatSnapshotText(service.buildSnapshot());

    expect(text).toContain('Zavorth Semantic Skill Ecosystem Certification - S8');
    expect(text).toContain('Status: passed');
    expect(text).toContain('Next: S9 - Full Functional Closure Semantics');
  });

  function buildFixtureService(): ZavorthSemanticSkillEcosystemCertificationService {
    const importer = new ZavorthSkillEcosystemImporterService({
      now,
      catalogEntries,
      maxWorkspaceCatalogManifests: 2,
      skillCatalogService: null,
    });
    const packService = new ZavorthSkillEcosystemPackService({
      now,
      rootDir: 'C:/fixture/zavorth',
      importer,
    });
    return new ZavorthSemanticSkillEcosystemCertificationService({
      now,
      packService,
    });
  }
});

type Snapshot = ReturnType<ZavorthSemanticSkillEcosystemCertificationService['buildSnapshot']>;

function manifestClaim(snapshot: Snapshot, manifestId: string) {
  const claim = snapshot.claims.find((entry) =>
    entry.kind === 'manifest-coverage' && entry.manifestId === manifestId,
  );
  if (!claim) {
    throw new Error(`missing manifest claim ${manifestId}`);
  }
  return claim;
}

function evaluationClaim(snapshot: Snapshot, manifestId: string) {
  const claim = snapshot.claims.find((entry) =>
    entry.kind === 'permission-evaluation-policy' && entry.manifestId === manifestId,
  );
  if (!claim) {
    throw new Error(`missing evaluation claim ${manifestId}`);
  }
  return claim;
}

function catalogEntry(input: {
  name: string;
  description: string;
  sourceTrust: SkillCatalogEntry['sourceTrust'];
  bundleTags: string[];
}): SkillCatalogEntry {
  return {
    id: `skill:${input.name}`,
    name: input.name,
    description: input.description,
    sourceId: 'fixture-catalog',
    sourceLabel: 'Fixture Catalog',
    sourceTrust: input.sourceTrust,
    license: 'local',
    imported: true,
    bundleTags: input.bundleTags,
    supportFileCount: 1,
    dirPath: `C:/fixture/${input.name}`,
    skillFilePath: `C:/fixture/${input.name}/SKILL.md`,
    searchText: `${input.name} ${input.description}`.toLowerCase(),
    provenance: null,
    risk: null,
    licensePolicy: null,
    audit: null,
    metadata: {
      name: input.name,
      description: input.description,
      dirPath: `C:/fixture/${input.name}`,
      skillFilePath: `C:/fixture/${input.name}/SKILL.md`,
      supportFilePaths: [],
    },
  };
}
