import { EventEmitter } from 'events';
import { TelegramSwarmController } from '../../../src/telegram/controllers/TelegramSwarmController.js';

describe('TelegramSwarmController', () => {
  it('routes /swarm to a non-interactive orchestrator and sends a truncated final summary', async () => {
    const botApi = {
      sendMessage: jest.fn(async () => ({ message_id: 123 })),
      editMessageText: jest.fn(async () => ({})),
    };
    const swarm = new EventEmitter() as any;
    swarm.execute = jest.fn(async () => {
      swarm.emit('role:started', { roleId: 'swarm-researcher' });
      swarm.emit('role:finished', { roleId: 'swarm-researcher', status: 'IDLE' });
      return {
        status: 'completed',
        roles: [{ roleId: 'swarm-researcher' }],
        startedAt: new Date(0).toISOString(),
        finishedAt: new Date(1000).toISOString(),
        synthesizedOutput: 'x'.repeat(5000),
      };
    });
    const createSwarm = jest.fn(() => swarm);
    const controller = new TelegramSwarmController({
      botApi,
      getLlmRuntime: () => ({}) as any,
      createSwarm,
    });

    await controller.handleSwarm({ chat: { id: 42 } }, 'validar release');

    expect(createSwarm).toHaveBeenCalledWith(
      'validar release',
      expect.arrayContaining([
        expect.objectContaining({
          args: expect.arrayContaining(['--platform', 'telegram']),
        }),
      ]),
      expect.objectContaining({ roleTimeoutMs: 120000 }),
    );
    expect(swarm.execute).toHaveBeenCalledTimes(1);
    expect(botApi.editMessageText).toHaveBeenCalled();
    const finalMessage = botApi.sendMessage.mock.calls.at(-1)?.[1] || '';
    expect(finalMessage.length).toBeLessThanOrEqual(4020);
    expect(finalMessage).toContain('truncated');
  });
});
