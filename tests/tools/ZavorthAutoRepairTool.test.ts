import { ZavorthAutoRepairTool } from '../../src/tools/ZavorthAutoRepairTool';
import { ZavorthAutoRepairOrchestratorService } from '../../src/services/repair/ZavorthAutoRepairOrchestratorService';

describe('ZavorthAutoRepairTool', () => {
  let tool: ZavorthAutoRepairTool;
  let orchestrator: ZavorthAutoRepairOrchestratorService;

  beforeEach(() => {
    orchestrator = new ZavorthAutoRepairOrchestratorService();
    tool = new ZavorthAutoRepairTool(orchestrator);
  });

  it('should trigger repair execution via tool interface', async () => {
    const res = await tool.execute({
      action: 'repair_file',
      targetFile: 'src/calc.ts',
      errorMessage: 'SyntaxError: Unexpected token',
      candidatePatch: 'export function add(a: number, b: number) { return a + b; }',
    });

    const parsed = JSON.parse(res);
    expect(parsed.success).toBe(true);
    expect(parsed.result.resolved).toBe(true);
  });
});
