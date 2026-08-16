/**
 * Automation Blueprint Service.
 * Inspired by Hermes-Agent cron blueprints and OpenClaw automation templates.
 * Provides pre-configured, tested automation blueprints for recurring scheduled agent tasks.
 */

export interface AutomationBlueprint {
  id: string;
  name: string;
  category: 'maintenance' | 'security' | 'devops' | 'observability';
  description: string;
  defaultCron: string;
  prompt: string;
  suggestedTools: string[];
  safetyLevel: 'safe' | 'attention' | 'danger';
}

export interface ScheduledBlueprintTask {
  id: string;
  blueprintId: string;
  name: string;
  cronExpression: string;
  prompt: string;
  enabled: boolean;
  createdAt: string;
  lastRunAt?: string;
  nextRunAt?: string;
}

export class AutomationBlueprintService {
  private static blueprints: AutomationBlueprint[] = [
    {
      id: 'git_hygiene',
      name: 'Git Hygiene & Branch Audit',
      category: 'devops',
      description: 'Scans the repository for uncommitted changes, dangling stashes, and generates a concise health summary.',
      defaultCron: '0 9 * * 1-5', // Mon-Fri at 9 AM
      prompt: 'Check git status, list any uncommitted files or unpushed commits, audit branch health, and summarize repository state.',
      suggestedTools: ['execute_command', 'zavorth_checkpoint', 'zavorth_bm25_search'],
      safetyLevel: 'safe',
    },
    {
      id: 'security_audit',
      name: 'Dependency & Security Policy Audit',
      category: 'security',
      description: 'Runs package dependency vulnerability audits and verifies network egress policy compliance.',
      defaultCron: '0 3 * * *', // Daily at 3 AM
      prompt: 'Run dependency vulnerability checks, inspect high-severity security advisories, and verify network policy rules.',
      suggestedTools: ['execute_command', 'zavorth_lsp_diagnostics'],
      safetyLevel: 'safe',
    },
    {
      id: 'dependency_freshness',
      name: 'Dependency Outdated & Upgrade Advisor',
      category: 'maintenance',
      description: 'Checks package manager for outdated dependencies and provides non-breaking upgrade suggestions.',
      defaultCron: '0 8 * * 1', // Mondays at 8 AM
      prompt: 'Check for outdated packages, analyze changelogs for breaking changes, and summarize recommended safe updates.',
      suggestedTools: ['execute_command'],
      safetyLevel: 'safe',
    },
    {
      id: 'system_health_digest',
      name: 'System Health & Scratch Cleanup',
      category: 'observability',
      description: 'Inspects disk usage, dead scratch directories, active background tasks, and reports system health.',
      defaultCron: '0 */4 * * *', // Every 4 hours
      prompt: 'Inspect background task states, check memory and disk health, clean transient scratch files, and report system diagnostics.',
      suggestedTools: ['zavorth_power_lock', 'execute_command'],
      safetyLevel: 'safe',
    },
    {
      id: 'workspace_doc_sync',
      name: 'Contract & Documentation Sync Gate',
      category: 'devops',
      description: 'Verifies that public API exports match documentation, README files, and typescript declarations.',
      defaultCron: '0 18 * * 5', // Fridays at 6 PM
      prompt: 'Audit workspace exports against README and documentation, verify no broken links or stale contracts exist, and report status.',
      suggestedTools: ['zavorth_bm25_search', 'zavorth_lsp_diagnostics'],
      safetyLevel: 'safe',
    },
  ];

  private static scheduledTasks = new Map<string, ScheduledBlueprintTask>();

  /**
   * Returns all available automation blueprints.
   */
  static listBlueprints(): AutomationBlueprint[] {
    return [...this.blueprints];
  }

  /**
   * Retrieves a specific blueprint by ID.
   */
  static getBlueprint(id: string): AutomationBlueprint | null {
    const cleanId = id.trim().toLowerCase();
    return this.blueprints.find((b) => b.id.toLowerCase() === cleanId) || null;
  }

  /**
   * Instantiates a blueprint into an active scheduled task.
   */
  static scheduleBlueprint(blueprintId: string, cronOverride?: string): ScheduledBlueprintTask {
    const blueprint = this.getBlueprint(blueprintId);
    if (!blueprint) {
      throw new Error(`Automation blueprint not found: '${blueprintId}'`);
    }

    const taskId = `task_${blueprint.id}_${Date.now()}`;
    const scheduled: ScheduledBlueprintTask = {
      id: taskId,
      blueprintId: blueprint.id,
      name: blueprint.name,
      cronExpression: cronOverride || blueprint.defaultCron,
      prompt: blueprint.prompt,
      enabled: true,
      createdAt: new Date().toISOString(),
    };

    this.scheduledTasks.set(taskId, scheduled);
    return scheduled;
  }

  /**
   * Lists all active scheduled blueprint tasks.
   */
  static listScheduledTasks(): ScheduledBlueprintTask[] {
    return Array.from(this.scheduledTasks.values());
  }

  /**
   * Cancels a scheduled task.
   */
  static cancelScheduledTask(taskId: string): boolean {
    return this.scheduledTasks.delete(taskId);
  }

  /**
   * Clears all scheduled tasks (for testing).
   */
  static reset(): void {
    this.scheduledTasks.clear();
  }
}
