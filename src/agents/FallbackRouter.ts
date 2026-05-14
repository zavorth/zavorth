import { Task } from '../contracts/TaskContract.js';
import { GeminiPlanner } from './GeminiPlanner.js';
import { LogRepository } from '../storage/LogRepository.js';
import { Plan } from '../contracts/PlanContract.js';

export class FallbackRouter {
  public static async planWithRedundancy(task: Task, logRepo: LogRepository): Promise<Plan> {
    const planner = new GeminiPlanner();
    const retries = 2;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await planner.generatePlan(task);
      } catch (err: any) {
        logRepo.log(
          'warn',
          'FallbackRouter',
          `Falha ao gerar plano para a task ${task.task_id} na tentativa ${attempt}/${retries}: ${err.message}`,
        );

        if (attempt === retries) {
          task.fallback_used = true;
          throw new Error('Rotas esgotadas. Planejador falhou criticamente.');
        }

        await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
      }
    }

    throw new Error('Fallback Router encountered unhandled loop exit.');
  }
}
