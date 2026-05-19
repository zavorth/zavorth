import type { SkillMetadata } from '../../src/skills/SkillLoader.js';
import { ZavorthSubagentSkillLiveCompletionService } from '../../src/services/ZavorthSubagentSkillLiveCompletionService.js';

describe('ZavorthSubagentSkillLiveCompletionService Runtime gateway', () => {
  it('certifies live-ready subagents and governed instruction-only skills', async () => {
    const snapshot = await new ZavorthSubagentSkillLiveCompletionService({
      now: () => new Date('2026-05-14T12:00:00.000Z'),
      skillLoader: {
        loadAll: () => [buildImportedSkill()],
      },
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-14.checkpoint-6-subagent-skill-live-completion');
    expect(snapshot.status).toBe('passed');
    expect(snapshot.summary.subagentRuntimeLiveReady).toBe(true);
    expect(snapshot.summary.naturalInvocationReady).toBe(true);
    expect(snapshot.summary.importedSkills).toBe(1);
    expect(snapshot.summary.bridgeReadySkills).toBe(1);
    expect(snapshot.summary.workspaceMutationPerformed).toBe(false);
    expect(snapshot.summary.externalIoPerformed).toBe(false);
    expect(snapshot.summary.rawSecretsSerialized).toBe(false);
    expect(snapshot.liveCompletion.subagentsCanRunMockLiveWorkers).toBe(true);
    expect(snapshot.liveCompletion.skillLiveUseRequiresOwnerApproval).toBe(true);
    expect(snapshot.safety.noLiveSkillCodeExecutionByDefault).toBe(true);
    expect(snapshot.skills[0]).toMatchObject({
      instructionsOnly: true,
      executableCodeAllowed: false,
      defaultRouteAllowed: true,
    });
  });

  it('does not block daily use when no imported skill is available, but marks bridge attention honestly', async () => {
    const snapshot = await new ZavorthSubagentSkillLiveCompletionService({
      now: () => new Date('2026-05-14T12:00:00.000Z'),
      skillLoader: {
        loadAll: () => [],
      },
    }).buildSnapshot();

    expect(snapshot.status).toBe('attention');
    expect(snapshot.summary.subagentRuntimeLiveReady).toBe(true);
    expect(snapshot.entries.find((entry) => entry.id === 'skills.bridge-catalog')?.status).toBe('attention');
    expect(snapshot.entries.find((entry) => entry.id === 'skills.live-use-gate')?.defaultRouteAllowed).toBe(false);
  });
});

function buildImportedSkill(): SkillMetadata {
  return {
    name: 'safe-review',
    description: 'Safe imported review skill.',
    dirPath: 'skill-library/imported/safe-review',
    skillFilePath: 'skill-library/imported/safe-review/SKILL.md',
    supportFilePaths: [],
    supportFiles: [],
    sourceId: 'fixture',
    sourceLabel: 'Fixture imported source',
    sourceKind: 'workspace',
    sourceTrust: 'review',
    sourceRegistrySource: 'test',
    license: 'MIT',
    bundleTags: ['review', 'security'],
    provenance: {
      sourceId: 'fixture',
      sourceLabel: 'Fixture imported source',
      sourceKind: 'workspace',
      sourceTrust: 'review',
      registrySource: 'test',
      ownership: 'test',
      license: 'MIT',
      importMode: 'manual',
      imported: true,
      importedAt: '2026-05-14T00:00:00.000Z',
      originDocumentPath: null,
      attributionFilePath: null,
      upstreamSourceId: null,
      upstreamSourceLabel: null,
      upstreamSourceKind: null,
      upstreamSourceTrust: null,
      upstreamRegistrySource: null,
      upstreamRepository: null,
      upstreamLicense: null,
      upstreamSkillPath: null,
      upstreamRelativePath: null,
    },
    risk: {
      score: 5,
      level: 'low',
      reviewRequired: false,
      reasons: ['Fixture is read-only.'],
    },
    licensePolicy: {
      label: 'permissive',
      allowImport: true,
      allowRuntimeUse: true,
      allowCoreCopy: true,
      reviewRequired: false,
      summary: 'Permissive fixture.',
    },
    audit: null,
  };
}
