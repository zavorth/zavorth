import fs from 'fs';
import os from 'os';
import path from 'path';
import { TelegramExecutionArtifactDeliveryService } from '../../src/telegram/controllers/TelegramExecutionArtifactDeliveryService';

const tempDirs: string[] = [];

function removeTempDirWithRetry(targetPath: string): Promise<void> {
  const maxAttempts = 8;
  const attempt = async (index: number): Promise<void> => {
    try {
      await fs.promises.rm(targetPath, { recursive: true, force: true });
    } catch (error) {
      if (index >= maxAttempts - 1) {
        console.warn(`[test-cleanup] could not remove temp dir ${targetPath}`, error);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 25 * (index + 1)));
      await attempt(index + 1);
    }
  };
  return attempt(0);
}

describe('TelegramExecutionArtifactDeliveryService', () => {
  afterEach(async () => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        await removeTempDirWithRetry(target);
      }
    }
  });

  it('entrega artefatos de audio usando replyWithAudio', async () => {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'zavorth-telegram-artifact-'));
    tempDirs.push(tempDir);
    const audioPath = path.join(tempDir, 'echo-audio.wav');
    await fs.promises.writeFile(audioPath, 'wav');

    const persistTask = jest.fn();
    const service = new TelegramExecutionArtifactDeliveryService({ persistTask });
    const ctx = {
      replyWithAudio: jest.fn().mockResolvedValue(undefined),
      replyWithDocument: jest.fn().mockResolvedValue(undefined),
      replyWithPhoto: jest.fn().mockResolvedValue(undefined),
    } as any;

    const task = {
      task_id: 'task-audio-12345678',
      command_type: '/echo',
      executor_used: 'telegram-audio',
      source: 'telegram',
      chat_id: '42',
      metadata: {},
      artifacts: [
        {
          name: 'echo-audio.wav',
          path: audioPath,
          mimeType: 'audio/wav',
          source: 'telegram-audio',
        },
      ],
    } as any;

    await service.sendTaskArtifacts(ctx, task);

    expect(ctx.replyWithAudio).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      title: 'echo-audio.wav',
    }));
    expect(ctx.replyWithDocument).not.toHaveBeenCalled();
    expect(persistTask).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({
        deliveredArtifactKeys: expect.arrayContaining([audioPath]),
      }),
    }));
  });
});
