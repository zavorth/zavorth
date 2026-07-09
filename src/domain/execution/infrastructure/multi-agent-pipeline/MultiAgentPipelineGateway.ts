import { ExecutionGateway } from '../../../../execution/ExecutionGateway.js';
import {
  EXTERNAL_EXECUTOR_ID,
  ExternalExecutor,
} from '../../../../execution/ExternalExecutor.js';
import { CodexExecutor } from '../../../../execution/CodexExecutor.js';

import { AiStudioExecutor } from '../../../../execution/AiStudioExecutor.js';
import { SwarmExecutor } from '../../../../execution/SwarmExecutor.js';
import { LlmRuntimeService } from '../../../../services/llm/LlmRuntimeService.js';

export function createMultiAgentExecutionGateway(): ExecutionGateway {
  const gateway = new ExecutionGateway({ log: () => undefined } as any);
  const externalExecutor = new ExternalExecutor();
  gateway.registerExecutor(EXTERNAL_EXECUTOR_ID, externalExecutor);
  gateway.registerExecutor('codex', new CodexExecutor());
  gateway.registerExecutor('aistudio', new AiStudioExecutor());
  gateway.registerExecutor('swarm', new SwarmExecutor(new LlmRuntimeService()));
  return gateway;
}
