import {
  CanonicalSessionContextAssembler,
  WorkspaceIdentityContextAssembler,
} from '../../../src/runtime/agent/index.js';
import type { ContextResolverSnapshot } from '../../../src/services/ContextResolverService.js';

function createResolverSnapshot(overrides: Partial<ContextResolverSnapshot> = {}): ContextResolverSnapshot {
  return {
    workspace: 'C:/repo/Zavorth',
    workspaceName: 'Zavorth',
    instructionFile: 'C:/repo/Zavorth/ZAVORTH.md',
    instructionSources: [
      'C:/repo/Zavorth/ZAVORTH.md',
      'C:/repo/Zavorth/AGENTS.md',
      'C:/repo/Zavorth/.agents/skills',
    ],
    skillDirectories: [
      'C:/repo/Zavorth/.agents/skills',
    ],
    instructionSummary: 'Use o runtime canonico e preserve approvals.',
    instructionNotes: [
      'Nao criar runtime paralelo.',
      'Convergir antes de mover codigo.',
    ],
    workspaceCommands: [
      {
        name: 'check',
        template: 'npm run runtime:check',
      },
    ],
    workspaceHooks: [
      {
        event: 'before_finish',
        command: 'npm test',
      },
    ],
    layers: [
      {
        id: 'global-policy',
        label: 'Politica global do Zavorth',
        summary: 'Core leve por padrao.',
        source: 'zavorth://policy/global',
      },
      {
        id: 'workspace-manual',
        label: 'ZAVORTH.md do workspace',
        summary: 'Manual operacional do workspace.',
        source: 'C:/repo/Zavorth/ZAVORTH.md',
      },
      {
        id: 'agents-compat',
        label: 'Compatibilidade AGENTS.md',
        summary: 'Convencoes de agentes do workspace.',
        source: 'C:/repo/Zavorth/AGENTS.md',
      },
    ],
    ...overrides,
  };
}

describe('WorkspaceIdentityContextAssembler', () => {
  it('adapts ContextResolverService output into warm canonical context', async () => {
    const resolve = jest.fn(async () => createResolverSnapshot());
    const workspaceAssembler = new WorkspaceIdentityContextAssembler({
      contextResolver: {
        resolve,
      },
    });

    const workspaceContext = await workspaceAssembler.assemble({
      workspace: 'C:/repo/Zavorth',
      userRequest: 'continue o blueprint',
      capabilityIds: ['read_file'],
      toolContracts: ['workspace.read'],
      sessionOverrides: ['usar corte pequeno'],
    });

    expect(resolve).toHaveBeenCalledWith({
      workspace: 'C:/repo/Zavorth',
      userRequest: 'continue o blueprint',
      sessionOverrides: ['usar corte pequeno'],
      capabilityIds: ['read_file'],
      toolContracts: ['workspace.read'],
    });
    expect(workspaceContext.warm.workspacePrompt).toContain('Workspace: Zavorth');
    expect(workspaceContext.warm.workspacePrompt).toContain('Use o runtime canonico');
    expect(workspaceContext.warm.workspaceProfile).toEqual(expect.objectContaining({
      workspaceName: 'Zavorth',
      instructionFile: 'C:/repo/Zavorth/ZAVORTH.md',
      skillDirectories: ['C:/repo/Zavorth/.agents/skills'],
    }));
    expect(workspaceContext.warm.identityFiles).toEqual([
      {
        path: 'C:/repo/Zavorth/ZAVORTH.md',
        exists: true,
        content: null,
        summary: 'Manual operacional do workspace.',
      },
      {
        path: 'C:/repo/Zavorth/AGENTS.md',
        exists: true,
        content: null,
        summary: 'Convencoes de agentes do workspace.',
      },
    ]);
    expect(workspaceContext.metadata).toEqual(expect.objectContaining({
      source: 'WorkspaceIdentityContextAssembler',
      resolver: 'ContextResolverService',
      identityFileCount: 2,
    }));
  });

  it('feeds the canonical assembler without loading cold context or gating tools', async () => {
    const workspaceAssembler = new WorkspaceIdentityContextAssembler({
      contextResolver: {
        resolve: async () => createResolverSnapshot(),
      },
    });
    const canonicalAssembler = new CanonicalSessionContextAssembler();
    const workspaceContext = await workspaceAssembler.assemble({
      workspace: 'C:/repo/Zavorth',
    });

    const snapshot = canonicalAssembler.assemble({
      sessionId: 'web:workspace-identity',
      channel: 'web',
      workspace: workspaceContext.workspace,
      profile: 'warm',
      hot: {
        canonicalSessionPrompt: 'Sessao pronta.',
      },
      warm: workspaceContext.warm,
      cold: {
        memoryPrompt: 'Nao deve entrar no warm.',
      },
    });

    expect(snapshot.profile).toEqual(expect.objectContaining({
      depth: 'warm',
      includeWarm: true,
      includeCold: false,
      gatesToolExposure: false,
    }));
    expect(snapshot.workspacePrompt).toContain('Workspace: Zavorth');
    expect(snapshot.warm?.identityFiles).toHaveLength(2);
    expect(snapshot.cold).toBeUndefined();
    expect(snapshot.memoryPrompt).toBeNull();
    expect(snapshot.metadata.toolExposureGatedByContextProfile).toBe(false);
  });

  it('keeps optional identity sources absent without failing the run context', async () => {
    const workspaceAssembler = new WorkspaceIdentityContextAssembler({
      contextResolver: {
        resolve: async () => createResolverSnapshot({
          instructionFile: null,
          instructionSources: [],
          instructionSummary: '',
          instructionNotes: [],
          layers: [],
        }),
      },
    });

    const workspaceContext = await workspaceAssembler.assemble({
      workspace: 'C:/repo/Zavorth',
    });

    expect(workspaceContext.warm.workspacePrompt).toBe('Workspace: Zavorth');
    expect(workspaceContext.warm.identityFiles).toEqual([]);
    expect(workspaceContext.metadata.identityFileCount).toBe(0);
  });
});
