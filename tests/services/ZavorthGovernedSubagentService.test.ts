import {
  ZAVORTH_GOVERNED_SUBAGENT_CONTRACT_VERSION,
} from '../../src/contracts/ZavorthGovernedSubagentContract.js';
import { ZavorthGovernedSubagentService } from '../../src/services/ZavorthGovernedSubagentService.js';

describe('ZavorthGovernedSubagentService Phase 2', () => {
  it('prepares governed subagents from native skills without launching anything', () => {
    const snapshot = new ZavorthGovernedSubagentService({
      now: () => new Date('2026-05-10T12:00:00.000Z'),
    }).buildSnapshot({
      presetId: 'developer',
      task: 'implementar Large Skill Absorption Pipeline com auditoria de seguranca e testes',
      prepare: true,
    });

    expect(snapshot).toEqual(expect.objectContaining({
      contractVersion: ZAVORTH_GOVERNED_SUBAGENT_CONTRACT_VERSION,
      source: 'ZavorthGovernedSubagentService',
      status: 'attention',
      selectedPreset: 'developer',
      guarantees: expect.objectContaining({
        compilerOnly: true,
        noSubagentsLaunched: true,
        noToolsInvoked: true,
        noWorkspaceMutation: true,
        launchRequiresPolicyBroker: true,
        nativeSkillsBackEveryRole: true,
      }),
      summary: expect.objectContaining({
        executionPerformed: false,
        directToolUsePerformed: false,
        workspaceMutationPerformed: false,
      }),
    }));
    expect(snapshot.selectedProfileIds).toEqual(expect.arrayContaining([
      'planner',
      'coder',
      'qa',
      'auditor',
      'researcher',
    ]));
    expect(snapshot.preparedRoles.length).toBe(snapshot.summary.selectedRoles);
    expect(snapshot.preparedRoles.every((role) => role.launchBoundary.noSubagentLaunched)).toBe(true);
    expect(snapshot.preparedRoles.every((role) => role.launchBoundary.noToolInvoked)).toBe(true);
    expect(snapshot.preparedRoles.every((role) => role.launchBoundary.noWorkspaceMutation)).toBe(true);
    expect(snapshot.preparedRoles.every((role) => role.nativeSkills.missingSkillIds.length === 0)).toBe(true);
    expect(snapshot.preparedRoles.every((role) => role.policyReceipt.surface === 'skill')).toBe(true);
    expect(snapshot.preparedRoles.every((role) => role.subagentReceipt.status === 'planned')).toBe(true);
  });

  it('marks mutable, network, provider and channel roles as approval-required', () => {
    const snapshot = new ZavorthGovernedSubagentService({
      now: () => new Date('2026-05-10T12:00:00.000Z'),
    }).buildSnapshot({
      roleIds: ['planner', 'researcher', 'coder', 'operator'],
      prepare: true,
    });

    const byId = new Map(snapshot.preparedRoles.map((role) => [role.profile.id, role]));

    expect(byId.get('planner')?.runtimeStatus).toBe('ready');
    expect(byId.get('researcher')?.runtimeStatus).toBe('approval-required');
    expect(byId.get('coder')?.runtimeStatus).toBe('approval-required');
    expect(byId.get('operator')?.runtimeStatus).toBe('approval-required');
    expect(byId.get('coder')?.policyReceipt.action).toBe('require_user_confirmation');
    expect(byId.get('operator')?.profile.allowedSurfaces).toEqual(expect.arrayContaining(['provider', 'mcp', 'plugin']));
    expect(snapshot.summary.approvalRequiredRoles).toBeGreaterThanOrEqual(3);
  });

  it('blocks preparation when a required native skill is missing', () => {
    const nativePackService = {
      buildSnapshot: () => ({
        status: 'attention',
        summary: {
          activationReady: 0,
        },
        skills: [
          { id: 'task-planning', activationReady: true },
          { id: 'agent-orchestrator', activationReady: false },
        ],
      }),
    };
    const snapshot = new ZavorthGovernedSubagentService({
      now: () => new Date('2026-05-10T12:00:00.000Z'),
      nativePackService: nativePackService as any,
    }).buildSnapshot({
      roleIds: ['planner'],
      prepare: true,
    });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.summary.blockedRoles).toBe(1);
    expect(snapshot.preparedRoles[0]?.runtimeStatus).toBe('blocked');
    expect(snapshot.preparedRoles[0]?.nativeSkills.missingSkillIds).toEqual(['agent-orchestrator']);
    expect(snapshot.preparedRoles[0]?.subagentReceipt.status).toBe('blocked');
  });
});
