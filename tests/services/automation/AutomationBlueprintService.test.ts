import { AutomationBlueprintService } from '../../../src/services/automation/AutomationBlueprintService.js';

describe('AutomationBlueprintService', () => {
  beforeEach(() => {
    AutomationBlueprintService.reset();
  });

  afterEach(() => {
    AutomationBlueprintService.reset();
  });

  it('should list all predefined automation blueprints', () => {
    const blueprints = AutomationBlueprintService.listBlueprints();
    expect(blueprints.length).toBeGreaterThanOrEqual(5);

    const ids = blueprints.map((b) => b.id);
    expect(ids).toContain('git_hygiene');
    expect(ids).toContain('security_audit');
    expect(ids).toContain('dependency_freshness');
    expect(ids).toContain('system_health_digest');
    expect(ids).toContain('workspace_doc_sync');
  });

  it('should retrieve a blueprint by id case-insensitively', () => {
    const bp = AutomationBlueprintService.getBlueprint('GIT_HYGIENE');
    expect(bp).not.toBeNull();
    expect(bp?.name).toBe('Git Hygiene & Branch Audit');
    expect(bp?.defaultCron).toBeDefined();

    const nonExistent = AutomationBlueprintService.getBlueprint('non_existent');
    expect(nonExistent).toBeNull();
  });

  it('should schedule a blueprint task with default or custom cron', () => {
    const taskDefault = AutomationBlueprintService.scheduleBlueprint('security_audit');
    expect(taskDefault.id).toBeDefined();
    expect(taskDefault.blueprintId).toBe('security_audit');
    expect(taskDefault.enabled).toBe(true);

    const taskCustom = AutomationBlueprintService.scheduleBlueprint('git_hygiene', '0 12 * * *');
    expect(taskCustom.cronExpression).toBe('0 12 * * *');

    const allTasks = AutomationBlueprintService.listScheduledTasks();
    expect(allTasks).toHaveLength(2);
  });

  it('should throw when trying to schedule an unknown blueprint', () => {
    expect(() => {
      AutomationBlueprintService.scheduleBlueprint('unknown_bp');
    }).toThrow(/Automation blueprint not found/);
  });

  it('should cancel a scheduled task by taskId', () => {
    const task = AutomationBlueprintService.scheduleBlueprint('system_health_digest');
    expect(AutomationBlueprintService.listScheduledTasks()).toHaveLength(1);

    const cancelled = AutomationBlueprintService.cancelScheduledTask(task.id);
    expect(cancelled).toBe(true);
    expect(AutomationBlueprintService.listScheduledTasks()).toHaveLength(0);

    expect(AutomationBlueprintService.cancelScheduledTask('invalid_id')).toBe(false);
  });
});
