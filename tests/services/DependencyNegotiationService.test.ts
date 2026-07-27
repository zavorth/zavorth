import type { EngineeringContextSnapshot, EngineeringIntent, RequirementGap } from '../../src/contracts/EngineeringCoreContract.js';
import { DependencyNegotiationService } from '../../src/services/DependencyNegotiationService.js';

describe('DependencyNegotiationService', () => {
  it('formats a natural reply explaining missing runtime requirements', () => {
    const service = new DependencyNegotiationService();
    const intent: EngineeringIntent = {
      kind: 'create_project',
      objective: 'crie um servidor Express',
      mutating: true,
      requiresSession: true,
      preferredProfile: 'trusted',
      suggestedCommands: ['npm init -y'],
    };
    const context: EngineeringContextSnapshot = {
      workspace: '/tmp/demo',
      workspaceName: 'demo',
      packageJsonExists: false,
      packageManager: null,
      scripts: {},
      lockfiles: [],
      tsconfigExists: false,
      detectedStacks: [],
      frameworks: [],
      languages: [],
      importantPaths: [],
      shallowTree: [],
      instructionFile: null,
      instructionSummary: '',
      instructionNotes: [],
      workspaceCommands: [],
      workspaceHooks: [],
      autorepairSummary: null,
    };
    const gaps: RequirementGap[] = [
      {
        id: 'gap-1',
        kind: 'missing_docker',
        blocking: true,
        summary: 'Docker is not ready for guarded mutable execution yet.',
        detail: 'O Zavorth not encontrou Docker ready no host.',
        operatorAction: 'enable_docker',
      },
    ];

    const reply = service.buildReply({
      runId: 'eng-1',
      intent,
      context,
      gaps,
    });

    expect(reply).toContain('eng-1');
    expect(reply).toContain('Docker');
    expect(reply).toContain('Next passo');
  });

  it('mentions the supervised overlord route when the intent targets runtime control', () => {
    const service = new DependencyNegotiationService();
    const intent: EngineeringIntent = {
      kind: 'system_overlord_operation',
      objective: 'open the browser at https://example.com',
      mutating: true,
      requiresSession: false,
      preferredProfile: 'dangerous',
      preferredCapability: 'browser.control',
      preferredAutonomyLevel: 5,
      suggestedCommands: ['{"action":"navigate","url":"https://example.com"}'],
    };
    const context: EngineeringContextSnapshot = {
      workspace: '/tmp/demo',
      workspaceName: 'demo',
      packageJsonExists: true,
      packageManager: 'npm',
      scripts: {},
      lockfiles: [],
      tsconfigExists: false,
      detectedStacks: [],
      frameworks: [],
      languages: [],
      importantPaths: [],
      shallowTree: [],
      instructionFile: null,
      instructionSummary: '',
      instructionNotes: [],
      workspaceCommands: [],
      workspaceHooks: [],
      autorepairSummary: null,
    };

    const reply = service.buildReply({
      runId: 'eng-2',
      intent,
      context,
      gaps: [],
    });

    expect(reply).toContain('browser.control');
    expect(reply).toContain('System Overlord');
  });
});
