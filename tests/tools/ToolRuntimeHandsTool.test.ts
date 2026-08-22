
import { EchoHandsTool } from '../../src/tools/EchoHandsTool';

describe('EchoHandsTool', () => {
  it('exposes the echo_hands declarative action contract', async () => {
    const service = {
      execute: jest.fn().mockResolvedValue({
        ok: true,
        action: 'open_app',
        message: 'App iniciado: notepad.',
        metadata: { app: 'notepad' },
        approvalRequired: false,
      }),
    };
    const tool = new EchoHandsTool(service as unknown as import('../../src/services/ToolRuntimeHandsService').EchoHandsService);

    const result = JSON.parse(await tool.execute({
      action: 'open_app',
      args: { app: 'notepad' },
      risk: 'low',
      requestId: 'req-1',
    }));

    expect(tool.name).toBe('echo_hands');
    expect(result.ok).toBe(true);
    expect(service.execute).toHaveBeenCalledWith({
      action: 'open_app',
      args: { app: 'notepad' },
      risk: 'low',
      requestId: 'req-1',
    });
  });
});
