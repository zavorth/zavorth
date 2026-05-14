import {
  CanonicalSessionContextAssembler,
  LightweightRunProfileClassifier,
} from '../../../src/runtime/agent/index.js';
import type { AssembledAgentContext } from '../../../src/runtime/agent/contracts/index.js';

describe('CanonicalSessionContextAssembler', () => {
  it('builds a hot-only channel-neutral snapshot without requiring Telegram context', () => {
    const assembler = new CanonicalSessionContextAssembler();

    const snapshot = assembler.assemble({
      sessionId: 'telegram:session-1',
      userId: 'grey',
      channel: 'telegram',
      traceId: 'trace-context-1',
      hot: {
        continuityPrompt: 'Historico recente da sessao.',
        summaryPrompt: 'Resumo curto da conversa.',
        recentEvents: [
          {
            kind: 'input',
            text: 'oi',
          },
        ],
      },
      warm: {
        workspacePrompt: 'Este prompt nao entra no perfil hot.',
      },
      cold: {
        memoryPrompt: 'Esta memoria nao entra no perfil hot.',
      },
      metadata: {
        source: 'context-test',
      },
    });
    const contractView: AssembledAgentContext = snapshot;

    expect(contractView.sessionId).toBe('telegram:session-1');
    expect(snapshot.profile).toEqual(expect.objectContaining({
      depth: 'hot',
      includeHot: true,
      includeWarm: false,
      includeCold: false,
      gatesToolExposure: false,
    }));
    expect(snapshot.hot.recentEvents).toHaveLength(1);
    expect(snapshot.warm).toBeUndefined();
    expect(snapshot.cold).toBeUndefined();
    expect(snapshot.workspacePrompt).toBeNull();
    expect(snapshot.memoryPrompt).toBeNull();
    expect(snapshot.metadata).toEqual(expect.objectContaining({
      source: 'context-test',
      contextDepth: 'hot',
      contextLayers: ['hot'],
      toolExposureGatedByContextProfile: false,
    }));
  });

  it('adds warm workspace and identity context only when the profile requests it', () => {
    const assembler = new CanonicalSessionContextAssembler();

    const snapshot = assembler.assemble({
      sessionId: 'web:session-2',
      channel: 'web',
      workspace: '<repo>',
      profile: 'warm',
      hot: {
        canonicalSessionPrompt: 'Sessao canonica pronta.',
      },
      warm: {
        workspacePrompt: 'Workspace Zavorth com instrucoes locais.',
        workspaceProfile: {
          workspace_name: 'Zavorth',
          package_manager: 'npm',
        },
        identityFiles: [
          {
            path: 'IDENTITY.md',
            summary: 'Identidade operacional existente.',
            exists: true,
          },
          {
            path: 'MISSING.md',
            exists: false,
          },
        ],
      },
      cold: {
        mcpSnapshot: {
          should: 'not-load-yet',
        },
      },
    });

    expect(snapshot.profile.depth).toBe('warm');
    expect(snapshot.workspacePrompt).toBe('Workspace Zavorth com instrucoes locais.');
    expect(snapshot.warm?.workspaceProfile).toEqual(expect.objectContaining({
      workspace_name: 'Zavorth',
    }));
    expect(snapshot.warm?.identityFiles).toEqual([
      {
        path: 'IDENTITY.md',
        exists: true,
        content: null,
        summary: 'Identidade operacional existente.',
      },
    ]);
    expect(snapshot.cold).toBeUndefined();
    expect(snapshot.mcpSnapshot).toBeNull();
    expect(snapshot.metadata.contextLayers).toEqual(['hot', 'warm']);
  });

  it('adds cold memory, skill and MCP snapshots without using them as a tool exposure gate', () => {
    const assembler = new CanonicalSessionContextAssembler();
    const classifier = new LightweightRunProfileClassifier();
    const profile = classifier.classify({
      request: {
        text: 'use Mnemos e skills para lembrar o contexto',
        workspace: '<repo>',
        requestedTools: ['mcp.search_memory'],
        metadata: {},
      },
      hasMemoryContext: true,
      hasSkillOrMcpSnapshot: true,
    });

    const snapshot = assembler.assemble({
      sessionId: 'web:session-3',
      channel: 'web',
      profile,
      hot: {
        continuityPrompt: 'Continuidade recente.',
      },
      warm: {
        workspacePrompt: 'Workspace carregado.',
      },
      cold: {
        memoryPrompt: 'Memoria relevante condensada.',
        skillPrompt: 'Skills confiaveis disponiveis.',
        mcpSnapshot: {
          servers: [
            {
              id: 'mnemos',
              status: 'available',
            },
          ],
        },
      },
    });

    expect(profile).toEqual(expect.objectContaining({
      depth: 'cold',
      includeWarm: true,
      includeCold: true,
      gatesToolExposure: false,
    }));
    expect(snapshot.memoryPrompt).toBe('Memoria relevante condensada.');
    expect(snapshot.skillPrompt).toBe('Skills confiaveis disponiveis.');
    expect(snapshot.mcpSnapshot).toEqual({
      servers: [
        {
          id: 'mnemos',
          status: 'available',
        },
      ],
    });
    expect(snapshot.metadata).toEqual(expect.objectContaining({
      contextDepth: 'cold',
      contextLayers: ['hot', 'warm', 'cold'],
      toolExposureGatedByContextProfile: false,
    }));
  });
});
