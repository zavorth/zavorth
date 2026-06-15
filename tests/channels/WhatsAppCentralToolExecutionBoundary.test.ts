import { ToolExecutor } from '../../src/execution/ToolExecutor';
import { ToolRegistry } from '../../src/tools/ToolRegistry';
import { LogRepository } from '../../src/storage/LogRepository';

jest.mock('../../src/tools/ToolRegistry');
jest.mock('../../src/storage/LogRepository');

describe('WhatsAppCentralToolExecutionBoundary', () => {
  let registry: jest.Mocked<ToolRegistry>;
  let logRepo: jest.Mocked<LogRepository>;
  let executor: ToolExecutor;

  beforeEach(() => {
    registry = new ToolRegistry() as jest.Mocked<ToolRegistry>;
    logRepo = new LogRepository() as jest.Mocked<LogRepository>;
    executor = new ToolExecutor(registry, logRepo);
  });

  it('deve negar a execucao se channelUserIdAllowed for false no metadata (TOCTOU/downstream bypass)', async () => {
    const payload = {
      workspace: 'allowed-workspace',
      metadata: {
        channelUserIdAllowed: false,
      },
    };

    await expect(executor.executeTool('read_file', payload)).rejects.toThrow(
      'Tool execution denied: unauthorized channel/user/group context.'
    );
  });

  it('deve negar a execucao se channelUserIdAllowed for false no top-level payload', async () => {
    const payload = {
      workspace: 'allowed-workspace',
      channelUserIdAllowed: false,
    };

    await expect(executor.executeTool('read_file', payload)).rejects.toThrow(
      'Tool execution denied: unauthorized channel/user/group context.'
    );
  });
});
