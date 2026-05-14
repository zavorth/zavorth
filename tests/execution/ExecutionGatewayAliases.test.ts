import { resolveExecutionGatewayExecutorName } from '../../src/execution/execution-gateway/ExecutionGatewayAliases';

describe('ExecutionGatewayAliases', () => {
  it('maps native external executor names to the compatibility executor implementation', () => {
    expect(resolveExecutionGatewayExecutorName('external_executor')).toBe('external_executor');
    expect(resolveExecutionGatewayExecutorName('external-executor')).toBe('external_executor');
    expect(resolveExecutionGatewayExecutorName('executor.external')).toBe('external_executor');
  });

  it('keeps existing executor aliases stable', () => {
    expect(resolveExecutionGatewayExecutorName('local_executor')).toBe('local');
    expect(resolveExecutionGatewayExecutorName('codex_cli')).toBe('codex');
    expect(resolveExecutionGatewayExecutorName('gemini')).toBe('gemini_cli');
  });
});
