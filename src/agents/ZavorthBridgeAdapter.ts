import { logger } from '../logger.js';
import { Plan } from '../contracts/PlanContract.js';
import { Task } from '../contracts/TaskContract.js';
import { config } from '../config/index.js';
import { StructuredPlanner } from './StructuredPlanner.js';

export class ZavorthBridgeAdapter {
  private planner: StructuredPlanner;
  private logRepo: any;

  constructor(logRepo?: any) {
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
          `Planner caiu em fallback de provider: ${result.providerUsed}`,
        );
      }

      return result.plan;
    } catch (error: any) {
      if (this.logRepo) {
        this.logRepo.log('error', 'ZavorthBridgeAdapter', `Erro no planner: ${error.message}`);
      }
      logger.error('[ZavorthBridgeAdapter] Erro no planner:', error.message);
      throw new Error(`Erro do Planejador (${modelName}): ${error.message}`);
    }
  }

  private buildPrompt(task: Task): string {
    return `
Voce atua agora no modo ZAVORTH_BRIDGE ADAPTER. Sua funcao estrita e de Planner / Orchestrator tecnico.
Voce DEVE devolver a resposta UNICAMENTE em JSON valido respeitando o contrato abaixo, sem nenhum texto livre.

CAPACIDADE ESPECIAL:
Quando o provider permitir, use recursos de busca para responder com fatos atualizados antes de montar o plano.
Se isso nao estiver disponivel, monte o melhor plano possivel com o contexto fornecido.

Contrato esperado (interface Plan do Zavorth V2):
{
  "objective": "string (o que voce entendeu que deve ser feito)",
  "context": "string (contexto inferido com os dados reais encontrados)",
  "assumptions": ["premissas tecnicas"],
  "executor_recommendation": "local_executor | codex | external_executor | gemini_cli | jules",
  "workspace_recommendation": "path ou nome da pasta",
  "risk_level": 0|1|2|3 (0=leitura, 2=escrita, 3=delecao)",
  "requires_approval": boolean,
  "steps": [
    {
      "step_id": "string",
      "type": "shell",
      "description": "descricao do passo",
      "command": "o comando terminal exato",
      "file_targets": ["arquivos afetados"],
      "expected_output": "esperado no stdout",
      "sensitive": boolean
    }
  ],
  "validation_steps": ["comandos de teste"],
  "success_condition": "condicao de sucesso",
  "rollback_condition": "como desfazer",
  "notes": ["fontes ou observacoes importantes"]
}

Tarefa do Usuario: "${task.normalized_message}"
Contexto Anterior: "${task.parent_task_id || 'Nenhum'}"

Escolha de executor:
- use "local_executor" para shell simples no host local
- use "codex" para trabalho de codigo no workspace Windows
- use "external_executor" para delegacao ao ExternalExecutor/WSL quando fizer sentido
- use "gemini_cli" para analise/refatoracao com Gemini AI no terminal
- use "jules" para tarefas assincronas em repos GitHub (fix bugs, criar PRs)

Responda APENAS com o JSON. Comece com { e termine com }. Sem blocos markdown.
    `.trim();
  }
}
