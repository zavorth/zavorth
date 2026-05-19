import path from 'path';
import { ZavorthNativeIntelligencePackService } from '../../src/services/ZavorthNativeIntelligencePackService.js';

describe('ZavorthNativeIntelligencePackService Intent model', () => {
  const projectRoot = process.cwd();

  it('publishes the native intelligence pack with presets and no execution', () => {
    const snapshot = new ZavorthNativeIntelligencePackService({
      now: () => new Date('2026-05-10T12:00:00.000Z'),
      projectRoot,
    }).buildSnapshot({ projectRoot });

    expect(snapshot.status).toBe('passed');
    expect(snapshot.contractVersion).toBe('2026-05-10.native-intelligence-checkpoint-1');
    expect(snapshot.nativeRootPath).toBe(path.join(projectRoot, 'skill-library', 'native'));
    expect(snapshot.summary).toEqual(expect.objectContaining({
      nativeSkills: 15,
      presets: 6,
      missingSkillFiles: 0,
      manifestIssues: 0,
      activationReady: 15,
      executionPerformed: false,
      directToolUsePerformed: false,
    }));
    expect(snapshot.policy).toEqual(expect.objectContaining({
      nativePackIsZavorthOwned: true,
      externalSourceRequired: false,
      noExecutionByDefault: true,
      importedSkillsRemainSeparate: true,
    }));
    expect(snapshot.skills.map((entry) => entry.id)).toEqual(expect.arrayContaining([
      'agent-orchestrator',
      'large-skill-absorption',
      'security-audit',
      'prompt-injection-defense',
      'user-onboarding',
    ]));
  });

  it('prepares activation for the developer preset without direct tool use', () => {
    const snapshot = new ZavorthNativeIntelligencePackService({
      projectRoot,
    }).buildSnapshot({
      projectRoot,
      presetId: 'developer',
      activate: true,
    });

    expect(snapshot.status).toBe('passed');
    expect(snapshot.selectedPreset).toBe('developer');
    expect(snapshot.activationPlan).toEqual(expect.objectContaining({
      requested: true,
      presetId: 'developer',
      noExecutionPerformed: true,
      noDirectToolUsePerformed: true,
    }));
    expect(snapshot.activationPlan.readySkillIds).toEqual(expect.arrayContaining([
      'task-planning',
      'agent-orchestrator',
      'large-skill-absorption',
      'code-review',
      'repo-map',
    ]));
    expect(snapshot.activationPlan.approvalRequiredSkillIds).toContain('large-skill-absorption');
  });

  it('exposes the native source through the skill catalog and trust policy', () => {
    const snapshot = new ZavorthNativeIntelligencePackService({
      projectRoot,
    }).buildSnapshot({ projectRoot });

    expect(snapshot.catalog).toEqual(expect.objectContaining({
      sourceId: 'zavorth-native',
      sourceConfigured: true,
      policyAllowsSource: true,
      catalogVisibleSkillCount: 15,
      missingFromCatalog: [],
    }));
    expect(snapshot.skills.every((entry) => entry.catalogVisible)).toBe(true);
    expect(snapshot.skills.every((entry) => entry.runtimePolicy.noExecutionByDefault)).toBe(true);
  });
});
