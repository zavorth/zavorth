import { ZavorthTrajectoryCompressorTool } from '../../src/tools/ZavorthTrajectoryCompressorTool';
import { ZavorthTrajectoryCompressorService } from '../../src/services/compression/ZavorthTrajectoryCompressorService';

describe('ZavorthTrajectoryCompressorTool', () => {
  let tool: ZavorthTrajectoryCompressorTool;
  let service: ZavorthTrajectoryCompressorService;

  beforeEach(() => {
    service = new ZavorthTrajectoryCompressorService();
    tool = new ZavorthTrajectoryCompressorTool(service);
  });

  it('should estimate tokens and compress turns via tool execution', async () => {
    const estRes = await tool.execute({
      action: 'estimate_tokens',
      content: 'This is a test prompt content.',
    });

    const parsedEst = JSON.parse(estRes);
    expect(parsedEst.success).toBe(true);
    expect(parsedEst.estimatedTokens).toBeGreaterThan(0);

    const turns = [
      { id: '1', role: 'user', content: 'Objective', estimatedTokens: 50 },
      { id: '2', role: 'assistant', content: 'Plan', estimatedTokens: 50 },
      { id: '3', role: 'tool', content: 'Dump '.repeat(500), estimatedTokens: 1000 },
      { id: '4', role: 'tool', content: 'Logs '.repeat(500), estimatedTokens: 1000 },
      { id: '5', role: 'assistant', content: 'Analysis', estimatedTokens: 50 },
      { id: '6', role: 'assistant', content: 'Result', estimatedTokens: 50 },
    ];

    const compRes = await tool.execute({
      action: 'compress',
      turns,
      targetTokenBudget: 500,
      protectedHeadTurnsCount: 2,
      protectedTailTurnsCount: 2,
    });

    const parsedComp = JSON.parse(compRes);
    expect(parsedComp.success).toBe(true);
    expect(parsedComp.compressedTurnsCount).toBe(2);
    expect(parsedComp.tokenSavingsPercentage).toBeGreaterThan(30);
  });
});
