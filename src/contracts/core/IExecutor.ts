import { ExecutionRequest, ExecutionResult } from '../ExecutionContract.js';

/**
 * IExecutor — Interface comum para todos os executores do Zavorth.
 * 
 * Qualquer executor (LocalExecutor, ExternalExecutor, etc.) deve implementar
 * este contrato para ser registrado no ExecutionGateway.
 */
export interface IExecutor {
  /**
   * Nome identificador do executor.
   */
  readonly name: string;

  /**
   * Executa uma requisição validada pelo ExecutionGateway.
   * Nunca deve ser chamado diretamente — sempre via Gateway.
   */
  execute(request: ExecutionRequest): Promise<ExecutionResult>;

  /**
   * Verifica se o executor está disponível e operacional.
   */
  isAvailable(): Promise<boolean>;
}
