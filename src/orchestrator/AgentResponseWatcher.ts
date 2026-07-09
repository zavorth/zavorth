import fs from 'fs';
import path from 'path';
import { LogRepository } from '../storage/LogRepository.js';
import { config } from '../config/index.js';

type BroadcastClient = {
  broadcast(message: string): Promise<void>;
};

export class AgentResponseWatcher {
  private responseDir = config.zavorthBridgeResponseDir;
  private processing = false;

  constructor(
    private logRepo: LogRepository,
    private broadcaster: BroadcastClient,
  ) {}

  public start(): void {
    fs.mkdirSync(this.responseDir, { recursive: true });
    this.processPendingResponses().catch((error) => {
      this.logRepo.log('error', 'AgentResponseWatcher', error.message);
    });

    fs.watch(this.responseDir, async () => {
      if (this.processing) {
        return;
      }

      this.processing = true;
      try {
        await this.processPendingResponses();
      } catch (error: any) { const err = error; const e = error;
        this.logRepo.log('error', 'AgentResponseWatcher', error.message);
      } finally {
        this.processing = false;
      }
    });

    this.logRepo.log('info', 'AgentResponseWatcher', `Watching ZavorthBridge responses at ${this.responseDir}`);
  }

  private async processPendingResponses(): Promise<void> {
    const files = await fs.promises.readdir(this.responseDir);
    const pendingFiles = files.filter((file) => file.endsWith('.md') && !file.endsWith('.processed.md'));

    for (const file of pendingFiles) {
      const fullPath = path.join(this.responseDir, file);
      const content = (await fs.promises.readFile(fullPath, 'utf8')).trim();
      if (!content) {
        continue;
      }

      const processedPath = fullPath.replace(/\.md$/i, '.processed.md');
      await fs.promises.rename(fullPath, processedPath);
      await this.broadcaster.broadcast(`🤖 *ZavorthBridge respondeu*\n\nArquivo: \`${path.basename(processedPath)}\`\n\n\`\`\`\n${content}\n\`\`\``);
    }
  }
}
