import { ExecutionRequest, ExecutionResult } from '../ExecutionContract.js';

/**
 * IExecutor - common interface for all Zavorth executors.
 *
 * Any executor (LocalExecutor, ExternalExecutor, etc.) must implement this
 * contract to be registered in ExecutionGateway.
 */
export interface IExecutor {
  /**
   * Executor identifier name.
   */
  readonly name: string;

  /**
   * Executes a request validated by ExecutionGateway.
   * Must never be called directly; always use the Gateway.
   */
  execute(request: ExecutionRequest): Promise<ExecutionResult>;

  /**
   * Checks whether the executor is available and operational.
   */
  isAvailable(): Promise<boolean>;
}
