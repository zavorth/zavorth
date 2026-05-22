import type { SkillCatalogEntry } from '../../src/skills/SkillCatalogContract.js';
import { ZavorthSkillEcosystemImporterService } from '../../src/services/ZavorthSkillEcosystemImporterService.js';
import { ZavorthSkillEcosystemPackService } from '../../src/services/ZavorthSkillEcosystemPackService.js';
import { ZavorthSkillPackReceiptEmitterService } from '../../src/services/ZavorthSkillPackReceiptEmitterService.js';
import { ZavorthSkillPermissionProfileService } from '../../src/services/ZavorthSkillPermissionProfileService.js';
import { ZavorthSkillSmokeRunnerService } from '../../src/services/ZavorthSkillSmokeRunnerService.js';

describe('ZavorthSkillEcosystemPackService Dashboard controls', () => {
  const now = () => new Date('2026-05-05T20:00:00.000Z');
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

  it('imports optional manifests that can be inspected before enablement', () => {
    const importer = new ZavorthSkillEcosystemImporterService({
      now,
      catalogEntries,
      maxWorkspaceCatalogManifests: 2,
      skillCatalogService: null,
    });
    const snapshot = importer.buildSnapshot();
    const connector = importer.inspectManifest('skill.connector-calendar-brief');

    expect(snapshot.status).toBe('pass');
    expect(snapshot.selectedSkills).toBe(11);
    expect(snapshot.connectorConcepts).toBe(3);
    expect(snapshot.workspaceCatalogInputs).toBe(2);
    expect(snapshot.enabledByDefault).toBe(false);
    expect(snapshot.manifests.every((manifest) => manifest.optional)).toBe(true);
    expect(snapshot.manifests.every((manifest) => manifest.inspectableBeforeEnablement)).toBe(true);
    expect(connector).toEqual(expect.objectContaining({
      id: 'skill.connector-calendar-brief',
      permissionProfileId: 'connector-live-secretref',
      ownerApprovalRequiredForEnablement: true,
      enabledByDefault: false,
      secretValuesSerialized: false,
    }));
  });

  it('builds permission profiles that deny live skills without owner approval and SecretRef', () => {
    const importer = new ZavorthSkillEcosystemImporterService({
      now,
      catalogEntries,
      maxWorkspaceCatalogManifests: 2,
      skillCatalogService: null,
    });
    const manifests = importer.buildSnapshot().manifests;
    const permissions = new ZavorthSkillPermissionProfileService({
      now,
    }).buildSnapshot(manifests);

    expect(permissions.status).toBe('pass');
    expect(permissions.profiles).toHaveLength(5);
    expect(permissions.enabledByDefault).toBe(false);
    expect(permissions.liveSkillsRequiringOwnerApproval).toBe(2);
    expect(permissions.liveSkillsMissingSecretRefs).toBe(2);
    expect(permissions.evaluations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        manifestId: 'skill.zavorth-pulse',
        status: 'pass',
        enableAllowed: true,
        executeAllowed: true,
      }),
      expect.objectContaining({
        manifestId: 'skill.connector-calendar-brief',
        status: 'deny',
        enableAllowed: false,
        executeAllowed: false,
        missingSecretRefs: ['calendar.oauth'],
      }),
    ]));
  });

  it('runs only non-destructive smoke tests and records safe denials', () => {
    const importer = new ZavorthSkillEcosystemImporterService({
      now,
      catalogEntries,
      maxWorkspaceCatalogManifests: 2,
      skillCatalogService: null,
    });
    const manifests = importer.buildSnapshot().manifests;
    const permissionProfileService = new ZavorthSkillPermissionProfileService({
      now,
    });
    const smoke = new ZavorthSkillSmokeRunnerService({
      now,
      permissionProfileService,
    }).buildSnapshot(manifests);

    expect(smoke.status).toBe('pass');
    expect(smoke.smokeTests).toBe(22);
    expect(smoke.failed).toBe(0);
    expect(smoke.denied).toBeGreaterThan(0);
    expect(smoke.nonDestructiveOnly).toBe(true);
    expect(smoke.liveSecretsUsed).toBe(false);
    expect(smoke.liveExternalIoPerformed).toBe(false);
    expect(smoke.results.every((result) => result.destructive === false)).toBe(true);
  });

  it('emits lifecycle receipts for import, inspect, enable, execute and denial', () => {
    const importer = new ZavorthSkillEcosystemImporterService({
      now,
      catalogEntries,
      maxWorkspaceCatalogManifests: 2,
      skillCatalogService: null,
    });
    const manifests = importer.buildSnapshot().manifests;
    const permissionProfileService = new ZavorthSkillPermissionProfileService({
      now,
    });
    const permissions = permissionProfileService.buildSnapshot(manifests);
    const smoke = new ZavorthSkillSmokeRunnerService({
      now,
      permissionProfileService,
    }).buildSnapshot(manifests);
    const receipts = new ZavorthSkillPackReceiptEmitterService({
      now,
    }).buildSnapshot({
      manifests,
      evaluations: permissions.evaluations,
      smokeResults: smoke.results,
    });

    expect(receipts.status).toBe('pass');
    expect(receipts.imports).toBe(11);
    expect(receipts.inspections).toBe(11);
    expect(receipts.enablements).toBeGreaterThan(0);
    expect(receipts.executions).toBeGreaterThan(0);
    expect(receipts.denials).toBeGreaterThan(0);
    expect(receipts.liveExternalIoPerformed).toBe(false);
    expect(receipts.secretValuesSerialized).toBe(false);
  });

  it('emits a passing Dashboard controls skill ecosystem snapshot', () => {
    const importer = new ZavorthSkillEcosystemImporterService({
      now,
      catalogEntries,
      maxWorkspaceCatalogManifests: 2,
      skillCatalogService: null,
    });
    const service = new ZavorthSkillEcosystemPackService({
      now,
      rootDir: 'C:/fixture/zavorth',
      importer,
    });
    const snapshot = service.buildSnapshot();
    const text = service.formatSnapshotText(snapshot);

    expect(snapshot.status).toBe('passed');
    expect(snapshot.phase).toBe(8);
    expect(snapshot.summary).toEqual(expect.objectContaining({
      manifests: 11,
      connectorConcepts: 3,
      permissionProfiles: 5,
      smokeTests: 22,
      optionalSkills: 11,
      inspectableBeforeEnablement: 11,
      enabledByDefault: false,
      liveSkillsRequireOwnerApproval: true,
      liveSkillsRequireSecretRef: true,
      nonDestructiveSmokeOnly: true,
      liveExternalIoPerformed: false,
      secretValuesSerialized: false,
    }));
    expect(snapshot.policy).toEqual(expect.objectContaining({
      optionalEcosystemCapacity: true,
      inspectBeforeEnablement: true,
      nonDestructiveSmokeOnly: true,
      liveSkillsRequireOwnerApproval: true,
      liveSkillsRequireSecretRef: true,
      noCoreBloat: true,
      mcpAcpBridgeOptional: true,
    }));
    expect(snapshot.commands.nextStage).toBe('Certification matrix - Full Functional Closure');
    expect(text).toContain('Zavorth Skill Ecosystem Pack - Dashboard controls');
    expect(text).toContain('Next: Certification matrix - Full Functional Closure');
  });
});

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
