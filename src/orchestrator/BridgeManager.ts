import fs from 'fs';
import path from 'path';
import { Task } from '../contracts/TaskContract.js';
import { MailboxAgent, MailboxProtocol } from './MailboxProtocol.js';
import { config } from '../config/index.js';

export class BridgeManager {
  private inboxDir: string;
  private runtimeDir: string;
  private protocol: MailboxProtocol;

  constructor(options?: { inboxDir?: string; runtimeDir?: string; protocol?: MailboxProtocol }) {
    this.inboxDir = options?.inboxDir || config.mailboxInboxDir;
    this.runtimeDir = options?.runtimeDir || config.mailboxRuntimeDir;
    this.protocol = options?.protocol || new MailboxProtocol();
    fs.mkdirSync(this.inboxDir, { recursive: true });
    fs.mkdirSync(this.runtimeDir, { recursive: true });
  }

  public async dispatchToIDE(task: Task, agent: MailboxAgent): Promise<void> {
    const dispatch = this.protocol.buildDispatchMessage(task, agent);
    const baseName = `${dispatch.timestamp.replace(/[:.]/g, '-')}_${agent.toLowerCase()}_${dispatch.taskId}_${dispatch.messageId}.msg`;
    const finalPath = path.join(this.inboxDir, baseName);
    const tmpPath = path.join(this.runtimeDir, `${baseName}.tmp`);

    await fs.promises.writeFile(tmpPath, dispatch.payload, 'utf8');
    await fs.promises.rename(tmpPath, finalPath);
  }
}
