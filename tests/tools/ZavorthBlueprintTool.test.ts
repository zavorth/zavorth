import { ZavorthBlueprintTool } from '../../src/tools/ZavorthBlueprintTool.js';
import { AutomationBlueprintService } from '../../src/services/automation/AutomationBlueprintService.js';

describe('ZavorthBlueprintTool', () => {
  beforeEach(() => {
    AutomationBlueprintService.reset();
  });

  afterEach(() => {
    AutomationBlueprintService.reset();
  });

  it('should list all blueprints and active scheduled tasks', async () => {
    const rawResult = await ZavorthBlueprintTool.execute({ action: 'list' });
    const result = JSON.parse(rawResult);
    expect(result.status).toBe('success');
    expect(result.action).toBe('list');
    expect(result.totalBlueprints).toBeGreaterThanOrEqual(5);
    expect(result.blueprints).toBeInstanceOf(Array);
    expect(result.activeScheduledTasks).toHaveLength(0);
  });

  it('should get a specific blueprint details', async () => {
    const rawResult = await ZavorthBlueprintTool.execute({
      action: 'get',
      blueprintId: 'git_hygiene',
    });
    const result = JSON.parse(rawResult);
    expect(result.status).toBe('success');
    expect(result.blueprint.id).toBe('git_hygiene');
    expect(result.blueprint.suggestedTools).toContain('zavorth_checkpoint');
  });

  it('should schedule and cancel an automation blueprint task', async () => {
    const scheduleRaw = await ZavorthBlueprintTool.execute({
      action: 'schedule',
      blueprintId: 'security_audit',
      cronOverride: '0 4 * * *',
    });
    const scheduleResult = JSON.parse(scheduleRaw);
    expect(scheduleResult.status).toBe('success');
    expect(scheduleResult.task.blueprintId).toBe('security_audit');
    expect(scheduleResult.task.cronExpression).toBe('0 4 * * *');

    const cancelRaw = await ZavorthBlueprintTool.execute({
      action: 'cancel',
      taskId: scheduleResult.task.id,
    });
    const cancelResult = JSON.parse(cancelRaw);
    expect(cancelResult.status).toBe('success');
    expect(AutomationBlueprintService.listScheduledTasks()).toHaveLength(0);
  });
});
