/**
 * Zavorth End-to-End (E2E) Test Harness.
 * Provides a unified test environment coordinating multi-channel gateways,
 * the tool runtime, plugin SDK, persistent scheduler, and git worktrees.
 * Strictly typed (Zero any) and EN-First.
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import { MockChannelGateway, type ChannelPlatform, type OutboundMessage } from './MockChannelGateway.js';
import { PluginSdkRegistry } from '../../plugin-sdk/registry.js';
import { GitWorktreeManager } from '../../agents/worktree/GitWorktreeManager.js';
import { IsolatedWorktreeSubagentRunner } from '../../agents/worktree/IsolatedWorktreeSubagentRunner.js';
import { PersistentJobStore } from '../../scheduler/store.js';
import { ZavorthSchedulerEngine } from '../../scheduler/engine.js';
import { ZavorthPluginSdkTool } from '../../tools/ZavorthPluginSdkTool.js';
import { ZavorthSchedulerTool } from '../../tools/ZavorthSchedulerTool.js';
import { ZavorthWorktreeTool } from '../../tools/ZavorthWorktreeTool.js';
import { logger } from '../../logger.js';

export interface E2EHarnessOptions {
  tempDir?: string;
  enableScheduler?: boolean;
}

export class ZavorthE2EHarness {
  readonly gateway: MockChannelGateway;
  readonly pluginRegistry: PluginSdkRegistry;
  readonly worktreeManager: GitWorktreeManager;
  readonly worktreeRunner: IsolatedWorktreeSubagentRunner;
  readonly schedulerStore: PersistentJobStore;
  readonly schedulerEngine?: ZavorthSchedulerEngine;
  readonly sandboxDir: string;

  constructor(options: E2EHarnessOptions = {}) {
    this.sandboxDir = options.tempDir || path.join(process.cwd(), '.zavorth', `test_e2e_${Date.now()}`);
    if (!fs.existsSync(this.sandboxDir)) {
      fs.mkdirSync(this.sandboxDir, { recursive: true });
    }

    this.gateway = new MockChannelGateway();
    this.pluginRegistry = PluginSdkRegistry.getInstance();
    this.worktreeManager = new GitWorktreeManager(this.sandboxDir);
    this.worktreeRunner = new IsolatedWorktreeSubagentRunner(this.worktreeManager);

    const schedulerDir = path.join(this.sandboxDir, 'scheduler');
    this.schedulerStore = new PersistentJobStore(schedulerDir);

    if (options.enableScheduler) {
      this.schedulerEngine = new ZavorthSchedulerEngine({
        store: this.schedulerStore,
        tickIntervalMs: 50,
      });
    }

    this.setupInboundRouter();
  }

  private setupInboundRouter(): void {
    this.gateway.setInboundHandler(async (inbound) => {
      logger.info(`[E2EHarness] Processing inbound message from [${inbound.channel}]: "${inbound.text}"`);

      // Intent evaluation & tool invocation simulation
      const text = inbound.text.trim();
      const toolCalls: Array<{ name: string; args: Record<string, unknown>; result?: string }> = [];
      let replyText = '';

      if (text.startsWith('/plugin')) {
        const resultRaw = await ZavorthPluginSdkTool.execute({ action: 'list' });
        toolCalls.push({ name: 'zavorth_plugin_sdk', args: { action: 'list' }, result: resultRaw });
        const parsed = JSON.parse(resultRaw);
        replyText = `Active plugins count: ${parsed.total}`;
      } else if (text.startsWith('/schedule')) {
        const resultRaw = await ZavorthSchedulerTool.execute({ action: 'list' });
        toolCalls.push({ name: 'zavorth_scheduler', args: { action: 'list' }, result: resultRaw });
        const parsed = JSON.parse(resultRaw);
        replyText = `Scheduled jobs count: ${parsed.total}`;
      } else if (text.startsWith('/worktree')) {
        const resultRaw = await ZavorthWorktreeTool.execute({ action: 'list' });
        toolCalls.push({ name: 'zavorth_worktree', args: { action: 'list' }, result: resultRaw });
        const parsed = JSON.parse(resultRaw);
        replyText = `Active worktrees count: ${parsed.total}`;
      } else {
        replyText = `Processed request: "${inbound.text}" via ${inbound.channel}.`;
      }

      this.gateway.emitStreamEvent({
        channel: inbound.channel,
        sessionId: inbound.senderId,
        type: 'token',
        payload: replyText,
      });

      const outbound: OutboundMessage = {
        id: `out_${Date.now()}`,
        channel: inbound.channel,
        recipientId: inbound.senderId,
        text: replyText,
        toolCalls,
        timestamp: new Date().toISOString(),
      };

      return outbound;
    });
  }

  public async sendMessage(channel: ChannelPlatform, text: string, senderId = 'user_e2e'): Promise<OutboundMessage> {
    return this.gateway.receiveUserMessage(channel, text, senderId);
  }

  public dispose(): void {
    if (this.schedulerEngine) {
      this.schedulerEngine.stop();
    }
    if (fs.existsSync(this.sandboxDir)) {
      try {
        fs.rmSync(this.sandboxDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  }
}
