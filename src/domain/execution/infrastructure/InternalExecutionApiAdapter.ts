import { InternalExecutionApiService } from '../../../api/internal/InternalExecutionApiService.js';
import type {
  ExecutionDecision,
  ExecutionIntent,
  ExecutionOutcome,
} from '../../../contracts/InternalBoundaryContract.js';
import type { ExecutionBoundaryPort } from '../domain/ExecutionDomainTypes.js';

export class InternalExecutionApiAdapter implements ExecutionBoundaryPort {
  constructor(private readonly api: InternalExecutionApiService = new InternalExecutionApiService()) {}

  public decide(intent: ExecutionIntent): Promise<ExecutionDecision> {
    return this.api.decide(intent);
  }

  public execute(intent: ExecutionIntent): Promise<ExecutionOutcome> {
    return this.api.execute(intent);
  }
}
