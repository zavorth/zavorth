import {
  ZavorthTrajectoryCompressorService,
  type TrajectoryTurn,
} from '../../../src/services/compression/ZavorthTrajectoryCompressorService';

describe('ZavorthTrajectoryCompressorService', () => {
  let service: ZavorthTrajectoryCompressorService;

  beforeEach(() => {
    service = new ZavorthTrajectoryCompressorService();
  });

  it('should preserve trajectory unchanged when within token budget', () => {
    const turns: TrajectoryTurn[] = [
      { id: '1', role: 'user', content: 'Fix bug', estimatedTokens: 50 },
      { id: '2', role: 'assistant', content: 'Looking into it', estimatedTokens: 50 },
    ];

    const result = service.compressTrajectory(turns, {
      targetTokenBudget: 5000,
    });

    expect(result.tokenSavingsPercentage).toBe(0);
    expect(result.turns.length).toBe(2);
    expect(result.compressedTurnsCount).toBe(0);
  });

  it('should compress middle turns while strictly protecting head and tail turns', () => {
    const turns: TrajectoryTurn[] = [
      { id: 'turn-0', role: 'user', content: 'User Initial Objective', estimatedTokens: 100 },
      { id: 'turn-1', role: 'assistant', content: 'Agent Plan Overview', estimatedTokens: 200 },
      {
        id: 'turn-2',
        role: 'tool',
        content: 'Massive file dump output ' + 'x'.repeat(4000),
        estimatedTokens: 1000,
        toolCalls: [{ toolName: 'view_file', inputPayload: '{"path":"src/app.ts"}', outputPayload: 'lines...', exitCode: 0 }],
      },
      {
        id: 'turn-3',
        role: 'tool',
        content: 'Another long bash output ' + 'y'.repeat(4000),
        estimatedTokens: 1000,
        toolCalls: [{ toolName: 'run_command', inputPayload: '{"cmd":"npm test"}', outputPayload: 'logs...', exitCode: 0 }],
      },
      { id: 'turn-4', role: 'assistant', content: 'Analyzing previous outputs', estimatedTokens: 300 },
      { id: 'turn-5', role: 'assistant', content: 'Final code edit conclusion', estimatedTokens: 150 },
    ];

    const result = service.compressTrajectory(turns, {
      targetTokenBudget: 1000,
      protectedHeadTurnsCount: 2,
      protectedTailTurnsCount: 2,
    });

    expect(result.compressedTurnsCount).toBe(2);
    expect(result.tokenSavingsPercentage).toBeGreaterThan(40);
    expect(result.turns[0].id).toBe('turn-0');
    expect(result.turns[1].id).toBe('turn-1');
    expect(result.turns[2].id).toBe('compressed-middle-digest');
    expect(result.turns[3].id).toBe('turn-4');
    expect(result.turns[4].id).toBe('turn-5');
    expect(result.summaryDigest).toContain('view_file');
    expect(result.summaryDigest).toContain('run_command');
  });

  it('should accurately calculate estimated turn tokens based on content and tool calls', () => {
    const tokens = service.estimateTurnTokens('Hello world', [
      { toolName: 'grep', inputPayload: 'test', outputPayload: 'found 1 match' },
    ]);
    expect(tokens).toBeGreaterThan(5);
  });
});
