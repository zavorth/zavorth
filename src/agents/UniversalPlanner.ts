import { logger } from '../logger.js';
import { Plan } from '../contracts/PlanContract.js';
import { Task } from '../contracts/TaskContract.js';
import { config } from '../config/index.js';
import { StructuredPlanner } from './StructuredPlanner.js';

export class GeminiPlanner {
  private planner: StructuredPlanner;

  constructor() {
    this.planner = new StructuredPlanner();
  }

  public async generatePlan(task: Task): Promise<Plan> {
    const modelName = config.geminiModel || 'gemini-2.0-flash';
    const prompt = this.buildPrompt(task);

    try {
      const result = await this.planner.generatePlan(task, prompt);
      return result.plan;
    } catch (err: any) {
      logger.error('[GeminiPlanner] Erro ao planejar:', err.message);
      throw new Error(`Erro do planejador (${modelName}): ${err.message}`);
    }
  }

  private buildPrompt(task: Task): string {
    return `
Voce atua no modo ZAVORTH PLANNER. Sua funcao e gerar um plano tecnico em JSON valido.
Responda somente com JSON, sem markdown.

Ferramentas disponiveis:
1. web_search
   - args: { "query": "string" }

Contrato esperado:
{
  "objective": "string",
  "context": "string",
  "assumptions": ["string"],
  "executor_recommendation": "local_executor | codex | external_executor | zavorthBridge | gemini_cli | jules",
  "workspace_recommendation": "apelido ou path",
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

Tarefa do usuario: "${task.raw_message}"
Mensagem normalizada: "${task.normalized_message}"
Contexto anterior: "${task.parent_task_id || 'Nenhum'}"

Escolha de executor:
- "local_executor" para shell simples no host local
- "codex" para codigo no workspace Windows
- "external_executor" para delegacao ao ExternalExecutor/WSL
- "zavorthBridge" para fluxos que precisam da interface real do ZavorthBridge
- "gemini_cli" para analise/refatoracao de codebase com Gemini AI no terminal
- "jules" para tarefas assincromas em repos GitHub (fix bugs, criar PRs, testes)
    `.trim();
  }
}
