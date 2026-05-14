import { config } from '../../src/config/index';
import { extractTaskPayload, getDefaultWorkspace, persistTask } from '../../src/telegram/TelegramTaskSupport';

describe('TelegramTaskSupport', () => {
  it('extracts payloads from explicit slash commands', () => {
    expect(
      extractTaskPayload({
        raw_message: '/run npm test',
        command_type: '/run',
      } as any),
    ).toBe('npm test');
  });

  it('returns the raw message for free-form tasks', () => {
    expect(
      extractTaskPayload({
        raw_message: 'me ajude com esse projeto',
        command_type: '/task',
      } as any),
    ).toBe('me ajude com esse projeto');
  });

  it('resolves default workspaces by executor family', () => {
    expect(getDefaultWorkspace('/codex')).toBe(config.defaultWorkspace);
    expect(getDefaultWorkspace('/task')).toBe('core');
  });

  it('persists through TaskManager.saveTask when available', () => {
    const saveTask = jest.fn();
    const task = { task_id: 'task-1' } as any;

    persistTask({ saveTask }, task);

    expect(saveTask).toHaveBeenCalledWith(task);
  });
});
