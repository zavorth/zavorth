import {
  CanonicalSessionContextAssembler,
  MemoryContextAssembler,
} from '../../../src/runtime/agent/index.js';

describe('MemoryContextAssembler', () => {
  it('returns an honest cold memory snapshot when Mnemos tools are unavailable', () => {
    const assembler = new MemoryContextAssembler();

    const snapshot = assembler.assemble({
      connectedToolNames: ['read_file'],
    });

    expect(snapshot.available).toBe(false);
    expect(snapshot.requiredTools).toEqual(['search_memory', 'scan_local_metadata']);
    expect(snapshot.cadence).toEqual(['search_memory', 'scan_local_metadata', 'index_file']);
    expect(snapshot.indexing).toEqual({
      toolName: 'index_file',
      requiresApproval: true,
      approvalBoundary: 'human-in-the-loop',
      owner: 'MnemosHumanInTheLoopService',
    });
    expect(snapshot.cold.memoryPrompt).toBeNull();
    expect(snapshot.metadata).toEqual(expect.objectContaining({
      source: 'MnemosCognitiveProtocol',
      mnemosAvailable: false,
      requiredTools: ['search_memory', 'scan_local_metadata'],
      cadence: ['search_memory', 'scan_local_metadata', 'index_file'],
      connectedToolNames: ['read_file'],
      indexingTool: 'index_file',
      indexingRequiresApproval: true,
      indexingApprovalBoundary: 'human-in-the-loop',
      toolExposureGatedByMemoryContext: false,
    }));
  });

  it('injects compact Mnemos cadence only when the required tools are connected', () => {
    const assembler = new MemoryContextAssembler();

    const snapshot = assembler.assemble({
      connectedToolNames: ['scan_local_metadata', 'search_memory', 'search_memory'],
      compact: true,
    });

    expect(snapshot.available).toBe(true);
    expect(snapshot.cold.memoryPrompt).toContain('MNEMOS:');
    expect(snapshot.cold.memoryPrompt).toContain('search_memory');
    expect(snapshot.cold.memoryPrompt).toContain('scan_local_metadata');
    expect(snapshot.metadata).toEqual(expect.objectContaining({
      mnemosAvailable: true,
      connectedToolNames: ['scan_local_metadata', 'search_memory'],
      compact: true,
      cadence: ['search_memory', 'scan_local_metadata', 'index_file'],
      indexingTool: 'index_file',
      indexingRequiresApproval: true,
      indexingApprovalBoundary: 'human-in-the-loop',
      toolExposureGatedByMemoryContext: false,
    }));
  });

  it('feeds canonical cold context without becoming a tool exposure gate', () => {
    const memoryAssembler = new MemoryContextAssembler();
    const canonicalAssembler = new CanonicalSessionContextAssembler();
    const memoryContext = memoryAssembler.assemble({
      connectedToolNames: ['search_memory', 'scan_local_metadata'],
      compact: true,
    });

    const snapshot = canonicalAssembler.assemble({
      sessionId: 'web:memory-context',
      channel: 'web',
      profile: 'cold',
      hot: {
        continuityPrompt: 'Continuidade recente.',
      },
      warm: {
        workspacePrompt: 'Workspace carregado.',
      },
      cold: {
        ...memoryContext.cold,
      },
    });

    expect(snapshot.profile).toEqual(expect.objectContaining({
      depth: 'cold',
      includeWarm: true,
      includeCold: true,
      gatesToolExposure: false,
    }));
    expect(snapshot.memoryPrompt).toContain('search_memory');
    expect(snapshot.cold?.metadata).toEqual(expect.objectContaining({
      mnemosAvailable: true,
      toolExposureGatedByMemoryContext: false,
    }));
    expect(snapshot.metadata.toolExposureGatedByContextProfile).toBe(false);
  });
});
