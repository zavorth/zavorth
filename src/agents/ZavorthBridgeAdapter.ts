import { logger } from '../logger.js';
import { Plan } from '../contracts/PlanContract.js';
import { Task } from '../contracts/TaskContract.js';
import { config } from '../config/index.js';
import { StructuredPlanner } from './StructuredPlanner.js';
import type { LogRepository } from '../storage/LogRepository.js';
import { asErrorLike } from '../utils/errorLike.js';

export class ZavorthBridgeAdapter {
  private planner: StructuredPlanner;
  private logRepo: LogRepository;

  constructor(logRepo: LogRepository) {
    this.planner = new StructuredPlanner();
    this.logRepo = logRepo;
  }

  public async generatePlan(task: Task): Promise<Plan> {
    const modelName = config.geminiModel || 'gemini-2.0-flash';
    const prompt = this.buildPrompt(task);

    try {
      const result = await this.planner.generatePlan(task, prompt);

      if (result.fallbackUsed && this.logRepo) {
        this.logRepo.log(
          'warn',
          'ZavorthBridgeAdapter',
          `Planner fell back to provider: ${result.providerUsed}`,
        );
      }

      return result.plan;
    } catch (error: unknown) {
      const err = asErrorLike(error);
      if (this.logRepo) {
        this.logRepo.log('error', 'ZavorthBridgeAdapter', `Planner error: ${err.message}`);
      }
      logger.error('[ZavorthBridgeAdapter] Planner error:', err.message);
      throw new Error(`Planner error (${modelName}): ${err.message}`);
    }
  }

  private buildPrompt(task: Task): string {
    return `
You are now operating in ZAVORTH_BRIDGE ADAPTER mode. Your strict role is technical Planner / Orchestrator.
You MUST return ONLY valid JSON matching the contract below, with no free-form text.

SPECIAL CAPABILITY:
When the provider supports it, use search capabilities to gather current facts before building the plan.
If that is not available, build the best possible plan from the provided context.

Expected contract (Zavorth V2 Plan interface):
{
  "objective": "string (what you understood must be done)",
  "context": "string (context inferred from real discovered data)",
  "assumptions": ["technical assumptions"],
  "executor_recommendation": "local_executor | codex | external_executor | gemini_cli | jules",
  "workspace_recommendation": "path or folder name",
  "risk_level": 0|1|2|3 (0=read, 2=write, 3=delete)",
  "requires_approval": boolean,
  "steps": [
    {
      "step_id": "string",
      "type": "shell",
      "description": "step description",
      "command": "exact terminal command",
      "file_targets": ["affected files"],
      "expected_output": "expected stdout",
      "sensitive": boolean
    }
  ],
  "validation_steps": ["test commands"],
  "success_condition": "success condition",
  "rollback_condition": "how to undo",
  "notes": ["sources or important notes"]
}

User task: "${task.normalized_message}"
Previous context: "${task.parent_task_id || 'None'}"

Executor selection:
? use "local_executor" for simple shell work on the local host
? use "codex" for code work in the Windows workspace
? use "external_executor" for delegation to ExternalExecutor/WSL when appropriate
? use "gemini_cli" for analysis/refactoring with Gemini AI in the terminal
? use "jules" for asynchronous GitHub repository tasks (bug fixes, PRs)

Respond ONLY with JSON. Start with { and end with }. No Markdown blocks.
    `.trim();
  }
}
