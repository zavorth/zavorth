import path from 'path';
import fs from 'fs';
import os from 'os';
import { ZavorthNativeIntelligencePackService } from '../../src/services/ZavorthNativeIntelligencePackService.js';


describe('ZavorthNativeIntelligencePackService Intent model', () => {
  const projectRoot = path.resolve(__dirname, '../../');

  it('publishes the native intelligence pack with presets and no execution', () => {
    const snapshot = new ZavorthNativeIntelligencePackService({
      now: () => new Date('2026-05-10T12:00:00.000Z'),
      projectRoot,
    }).buildSnapshot({ projectRoot });

    expect(snapshot.status).toBe('passed');
    expect(snapshot.contractVersion).toBe('2026-05-10.native-intelligence-checkpoint-1');
    expect(snapshot.nativeRootPath).toBe(path.join(projectRoot, 'skill-library', 'native'));
    expect(snapshot.summary).toEqual(expect.objectContaining({
      nativeSkills: 18,
      presets: 6,
      missingSkillFiles: 0,
      manifestIssues: 0,
      activationReady: 18,
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
      'guided-plan-review',
      'compact-channel-reply',
      'governed-test-loop',
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
      'governed-test-loop',
    ]));
    expect(snapshot.activationPlan.approvalRequiredSkillIds).toContain('large-skill-absorption');
    expect(snapshot.activationPlan.approvalRequiredSkillIds).toContain('governed-test-loop');
  });

  it('exposes the native source through the skill catalog and trust policy', () => {
    const snapshot = new ZavorthNativeIntelligencePackService({
      projectRoot,
    }).buildSnapshot({ projectRoot });

    expect(snapshot.catalog).toEqual(expect.objectContaining({
      sourceId: 'zavorth-native',
      sourceConfigured: true,
      policyAllowsSource: true,
      catalogVisibleSkillCount: 18,
      missingFromCatalog: [],
    }));
    expect(snapshot.skills.every((entry) => entry.catalogVisible)).toBe(true);
    expect(snapshot.skills.every((entry) => entry.runtimePolicy.noExecutionByDefault)).toBe(true);
    expect(snapshot.skills.every((entry) => entry.runtimePolicy.requiresPolicyBroker)).toBe(true);
    expect(snapshot.skills.find((entry) => entry.id === 'governed-test-loop')?.permissionProfileId).toBe('workspace-write-approval');
  });

  it('blocks activation when manifest governance drifts from the native runtime policy', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-native-intelligence-'));
    const nativeRoot = path.join(tempRoot, 'skill-library', 'native');
    try {
      fs.cpSync(path.join(projectRoot, 'skill-library', 'native'), nativeRoot, { recursive: true });
      const manifestPath = path.join(nativeRoot, 'task-planning', 'ZAVORTH_NATIVE_SKILL.json');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
      manifest.requiresPolicyBroker = false;
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

      const snapshot = new ZavorthNativeIntelligencePackService({
        projectRoot,
        nativeRootPath: nativeRoot,
      }).buildSnapshot({ projectRoot, nativeRootPath: nativeRoot });
      const taskPlanning = snapshot.skills.find((entry) => entry.id === 'task-planning');

      expect(snapshot.status).toBe('blocked');
      expect(taskPlanning?.fileStatus.manifestMatchesDefinition).toBe(false);
      expect(taskPlanning?.fileStatus.issues).toContain('manifest does not match native definition');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
