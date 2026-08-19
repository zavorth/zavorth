import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ZavorthAutoRepairOrchestratorService } from '../../../src/services/repair/ZavorthAutoRepairOrchestratorService';
import { ZavorthKanbanBoardService } from '../../../src/services/kanban/ZavorthKanbanBoardService';

describe('ZavorthAutoRepairOrchestratorService', () => {
  let orchestrator: ZavorthAutoRepairOrchestratorService;
  let kanbanService: ZavorthKanbanBoardService;
  let tempDir: string;
  let sampleFile: string;

  beforeEach(() => {
    kanbanService = new ZavorthKanbanBoardService();
    orchestrator = new ZavorthAutoRepairOrchestratorService({ kanbanService });
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-repair-test-'));
    sampleFile = path.join(tempDir, 'calculator.ts');
    fs.writeFileSync(sampleFile, 'export function add(a: number, b: number): number { return a - b; }', 'utf8');
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('should orchestrate repair, validate patch, and transition task to DONE on success', async () => {
    const task = kanbanService.createTask({ title: 'Fix calculator subtraction bug', priority: 'HIGH' });

    const result = await orchestrator.orchestrateRepair({
      taskId: task.id,
      targetFile: sampleFile,
      errorMessage: 'Expected add(2, 2) to equal 4, received 0',
      failedSymbolName: 'add',
      patchGenerator: async (_impact, attempt) => {
        if (attempt === 1) {
          return 'export function add(a: number, b: number): number { return a + b; }';
        }
        return null;
      },
      verificationRunner: async (_file, code) => {
        const pass = code.includes('return a + b;');
        return { success: pass, output: pass ? '1 test passed' : 'Test failed' };
      },
    });

    expect(result.resolved).toBe(true);
    expect(result.finalStatus).toBe('DONE');
    expect(result.attemptsCount).toBe(1);
    expect(result.rollbackExecuted).toBe(false);
  });

  it('should automatically execute surgical rollback when all repair attempts fail', async () => {
    const task = kanbanService.createTask({ title: 'Complex broken contract', priority: 'URGENT' });

    const result = await orchestrator.orchestrateRepair({
      taskId: task.id,
      targetFile: sampleFile,
      errorMessage: 'Fatal crash on invalid input',
      maxAttempts: 2,
      patchGenerator: async (_impact, attempt) => {
        return `// Broken attempt ${attempt}`;
      },
      verificationRunner: async () => {
        return { success: false, output: 'Still broken' };
      },
    });

    expect(result.resolved).toBe(false);
    expect(result.finalStatus).toBe('AUTO_REPAIR_FAILED');
    expect(result.rollbackExecuted).toBe(true);
    // Verified that file is restored to original state
    expect(fs.readFileSync(sampleFile, 'utf8')).toBe('export function add(a: number, b: number): number { return a - b; }');
  });
});
