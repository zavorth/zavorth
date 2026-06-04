import { ZavorthCapabilityAtlasService } from '../../src/services/ZavorthCapabilityAtlasService.js';

describe('ZavorthCapabilityAtlasService', () => {
  const now = () => new Date('2026-06-02T12:00:00.000Z');
  const projectRoot = process.cwd();

  it('maps core Zavorth capabilities that are easy to miss by repo search', () => {
    const snapshot = new ZavorthCapabilityAtlasService({ projectRoot, now }).buildSnapshot();
    const byId = new Map(snapshot.entries.map((entry) => [entry.id, entry]));

    expect(snapshot.surface).toBe('capability-atlas');
    expect(byId.get('echo')).toEqual(expect.objectContaining({
      shortName: 'Echo',
      surfaces: expect.objectContaining({ llm: true, actionHarness: true, cli: true }),
    }));
    expect(byId.get('mnemos')).toEqual(expect.objectContaining({
      shortName: 'Mnemos',
      actionIds: expect.arrayContaining(['memory.search', 'mnemos.session_recall', 'memory.forget']),
    }));
    expect(byId.get('nexus')).toEqual(expect.objectContaining({
      shortName: 'Nexus',
      aliases: expect.arrayContaining(['nexus']),
    }));
    expect(byId.get('action-harness')).toEqual(expect.objectContaining({
      shortName: 'Actions',
      actionIds: expect.arrayContaining(['action.schema.lookup']),
    }));
    expect(byId.get('swarm-scale-plane')).toEqual(expect.objectContaining({
      status: 'ready',
      keyFiles: expect.arrayContaining([
        'src/domain/execution/infrastructure/SwarmScalePlaneService.ts',
        'src/services/SwarmScalePlaneRuntimeService.ts',
      ]),
    }));
  });

  it('filters by natural query and emits compact LLM context', () => {
    const service = new ZavorthCapabilityAtlasService({ projectRoot, now });
    const snapshot = service.buildSnapshot({ query: 'wake microphone' });

    expect(snapshot.entries.map((entry) => entry.id)).toContain('echo');
    expect(snapshot.llmContextBlock).toContain('Capability Atlas');
    expect(snapshot.llmContextBlock).toContain('Execution rule');
  });
});
