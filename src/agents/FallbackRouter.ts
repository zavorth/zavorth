import { Task } from '../contracts/TaskContract.js';
import { UniversalPlanner } from './UniversalPlanner.js';
import { LogRepository } from '../storage/LogRepository.js';
import { Plan } from '../contracts/PlanContract.js';
import { asErrorLike } from '../utils/errorLike';

export class FallbackRouter {
  public static async planWithRedundancy(task: Task, logRepo: LogRepository): Promise<Plan> {
    const planner = new UniversalPlanner();
    const retries = 2;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await planner.generatePlan(task);
      } catch (error: unknown) {
        const err = asErrorLike(error);
        logRepo.log(
          'warn',
          'FallbackRouter',
          `Failed to generate plan for task ${task.task_id} on attempt ${attempt}/${retries}: ${err.message}`,
        );

        if (attempt === retries) {
          task.fallback_used = true;
          throw new Error('Routes exhausted. Planner failed critically.');
        }

        await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
      }
    }

    throw new Error('Fallback Router encountered unhandled loop exit.');
  }
}
