import { logger } from '../logger.js';
import { Plan } from '../contracts/PlanContract.js';
import { Task } from '../contracts/TaskContract.js';
import { config } from '../config/index.js';
import { StructuredPlanner } from './StructuredPlanner.js';
import { asErrorLike } from '../utils/errorLike';

export class UniversalPlanner {
  private planner: StructuredPlanner;

  constructor() {
    this.planner = new StructuredPlanner();
  }

  public async generatePlan(task: Task): Promise<Plan> {
    const providerName = config.llmProvider || 'gemini';
    const modelName = providerName === 'gemini' ? (config.geminiModel || 'gemini-2.0-flash') : 'default';
    const prompt = this.buildPrompt(task);

    try {
      const result = await this.planner.generatePlan(task, prompt);
      return result.plan;
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.error('[UniversalPlanner] Planning error:', err.message);
      throw new Error(`Planner error (${providerName}/${modelName}): ${err.message}`);
    }
  }

  private buildPrompt(task: Task): string {
    return `
You are operating in ZAVORTH PLANNER mode. Your job is to generate a valid technical plan in JSON.
Respond only with JSON, without Markdown.

Available tools:
1. web_search
   - args: { "query": "string" }

Expected contract:
{
  "objective": "string",
  "context": "string",
  "assumptions": ["string"],
  "executor_recommendation": "local_executor | codex | external_executor | zavorthBridge | gemini_cli | jules",
  "workspace_recommendation": "alias or path",
  "risk_level": 0 | 1 | 2 | 3,
  "requires_approval": true,
  "steps": [
    {
      "step_id": "string",
      "type": "shell" | "tool",
      "description": "string",
      "tool": "web_search",
      "command": "string",
      "args": {},
      "file_targets": ["string"],
      "expected_output": "string",
      "sensitive": false
    }
  ],
  "validation_steps": ["string"],
  "success_condition": "string",
  "rollback_condition": "string",
  "notes": ["string"]
}

User task: "${task.raw_message}"
Normalized message: "${task.normalized_message}"
Previous context: "${task.parent_task_id || 'None'}"

Executor selection:
- "local_executor" for simple shell work on the local host
- "codex" for code work in the Windows workspace
- "external_executor" for delegation to ExternalExecutor/WSL
- "zavorthBridge" for flows that need the real ZavorthBridge interface
- "gemini_cli" for codebase analysis/refactoring with Gemini AI in the terminal
- "jules" for asynchronous GitHub repository tasks (bug fixes, PRs, tests)
    `.trim();
  }
}
