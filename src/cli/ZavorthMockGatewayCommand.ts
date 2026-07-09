import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import { SlackGateway } from '../gateways/channels/slack/SlackGateway.stub.js';
import { WhatsAppGateway } from '../gateways/channels/whatsapp/WhatsAppGateway.stub.js';
import { TeamsGateway } from '../gateways/channels/teams/TeamsGateway.stub.js';
import { IMessageGateway } from '../gateways/channels/imessage/IMessageGateway.stub.js';
import { SignalGateway } from '../gateways/channels/signal/SignalGateway.stub.js';
import { EmailGateway } from '../gateways/channels/email/EmailGateway.stub.js';
import { InstagramGateway } from '../gateways/channels/instagram/InstagramGateway.stub.js';
import { DiscordGateway } from '../gateways/channels/discord/DiscordGateway.stub.js';
import { asErrorLike } from '../utils/errorLike';

import { CoreOrchestrator } from '../core/CoreOrchestrator.js';
import { LogRepository } from '../storage/LogRepository.js';
import { DiscordSurfacePolicyService } from '../services/DiscordSurfacePolicyService.js';
import { buildCliRuntimeFromOverrides } from './ZavorthCliCommandHelpers.js';
import { ContextEngine } from '../context-engine/ContextEngine.js';
import type { LegacyUnifiedGatewayAdapter } from '../context-engine/LegacyUnifiedGatewayAdapter.js';
import type { PlatformKey } from '../contracts/PlatformContract.js';

function readStringFlag(args: string[], name: string): string | null {
  const direct = args.find((arg) => arg.startsWith(`--${name}=`));
  if (direct) return direct.slice(name.length + 3);
  const index = args.indexOf(`--${name}`);
  if (index >= 0 && args[index + 1] && !args[index + 1].startsWith('--')) return args[index + 1];
  return null;
}

function hookGatewayOutbox(gateway: any, onReply: (message: string) => void) {
  if (typeof gateway.writeStubEnvelope === 'function') {
    const original = gateway.writeStubEnvelope;
    gateway.writeStubEnvelope = function(message: string, recipients: string[], extra: any = {}) {
      onReply(message);
      return original.call(this, message, recipients, extra);
    };
  }
  if (typeof gateway.writeEnvelope === 'function') {
    const original = gateway.writeEnvelope;
    gateway.writeEnvelope = function(inputEnvelope: any) {
      onReply(inputEnvelope.message);
      return original.call(this, inputEnvelope);
    };
  }
}

export async function runZavorthMockGatewayCommand(rawArgs: string[]): Promise<number> {
  const args = rawArgs.filter(Boolean);
  const channel = (readStringFlag(args, 'channel') || 'slack').toLowerCase();
  const userId = readStringFlag(args, 'userId') || 'mock-user';
  const chatId = readStringFlag(args, 'chatId') || 'mock-chat';
  const isGroup = args.includes('--isGroup');

  const supportedChannels = ['slack', 'whatsapp', 'teams', 'imessage', 'signal', 'email', 'instagram', 'discord'];
  if (!supportedChannels.includes(channel)) {
    process.stderr.write(`Error: Unsupported channel "${channel}". Supported: ${supportedChannels.join(', ')}\n`);
    return 1;
  }

  // Resolve runtime to obtain required orchestrator dependencies
  const runtime = await buildCliRuntimeFromOverrides({});

  const logRepo = new LogRepository();
  await logRepo.init();
  const discordSurfacePolicyService = new DiscordSurfacePolicyService();
  const orchestrator = new CoreOrchestrator(logRepo, discordSurfacePolicyService);

  // Wire dependencies
  if (runtime.agentGateway) {
    orchestrator.attachAgentGateway(runtime.agentGateway);
  }
  if (runtime.commandService) {
    orchestrator.attachSharedSurfaceCommandService(runtime.commandService);
  }
  if (runtime.surfaceTaskDispatcher) {
    orchestrator.attachSurfaceTaskDispatcher(runtime.surfaceTaskDispatcher);
  }
  const contextEngine = (runtime as Record<string, unknown>).contextEngine as ContextEngine | undefined;
  if (contextEngine) {
    orchestrator.attachContextEngine(contextEngine);
  }
  if (runtime.legacyUnifiedGateway) {
    orchestrator.attachLegacyUnifiedGatewayAdapter(runtime.legacyUnifiedGateway as unknown as Pick<LegacyUnifiedGatewayAdapter, 'recordEvent' | 'handleEvent'>);
  }

  let gateway: any;
  if (channel === 'slack') {
    gateway = new SlackGateway(orchestrator);
  } else if (channel === 'whatsapp') {
    gateway = new WhatsAppGateway(orchestrator);
  } else if (channel === 'teams') {
    gateway = new TeamsGateway(orchestrator);
  } else if (channel === 'imessage') {
    gateway = new IMessageGateway(orchestrator);
  } else if (channel === 'signal') {
    gateway = new SignalGateway(orchestrator);
  } else if (channel === 'email') {
    gateway = new EmailGateway(orchestrator);
  } else if (channel === 'instagram') {
    gateway = new InstagramGateway(orchestrator);
  } else if (channel === 'discord') {
    gateway = new DiscordGateway(orchestrator);
  }

  orchestrator.registerGateway(channel as PlatformKey, gateway);
  await gateway.start();

  // Hook outbox to capture replies
  hookGatewayOutbox(gateway, (replyMessage) => {
    process.stdout.write(`\n[${channel.toUpperCase()} REPLY] ${replyMessage}\n`);
  });

  const rl = readline.createInterface({ input, output });

  process.stdout.write(`=== Offline Gateway Mock REPL (${channel.toUpperCase()}) ===\n`);
  process.stdout.write(`User ID: ${userId} | Chat ID: ${chatId} | Group: ${isGroup}\n`);
  process.stdout.write(`Type your messages below. Type "exit" or "quit" to leave.\n\n`);

  try {
    while (true) {
      const text = await rl.question(`${channel} (${userId}) > `);
      const normalized = text.trim();
      if (normalized.toLowerCase() === 'exit' || normalized.toLowerCase() === 'quit') {
        break;
      }
      if (!normalized) {
        continue;
      }

      try {
        if (channel === 'slack') {
          await gateway.simulateIncomingMessage({
            userId,
            channelId: chatId,
            rawText: normalized,
            isGroup,
          });
        } else if (channel === 'whatsapp') {
          await gateway.simulateIncomingMessage({
            userId,
            chatId,
            rawText: normalized,
            isGroup,
          });
        } else if (channel === 'teams') {
          await gateway.simulateIncomingMessage({
            userId,
            chatId,
            rawText: normalized,
          });
        } else if (channel === 'imessage') {
          await gateway.simulateIncomingMessage({
            sender: userId,
            text: normalized,
            chatId,
          });
        } else if (channel === 'signal') {
          await gateway.simulateIncomingMessage({
            sender: userId,
            text: normalized,
            isGroup,
          });
        } else if (channel === 'email') {
          await gateway.simulateIncomingMessage({
            sender: userId,
            subject: 'Offline Mock Email',
            text: normalized,
          });
        } else if (channel === 'instagram') {
          await gateway.simulateIncomingMessage({
            senderId: userId,
            text: normalized,
            isGroup,
            threadId: chatId,
          });
        } else if (channel === 'discord') {
          await gateway.simulateIncomingMessage({
            userId,
            chatId,
            rawText: normalized,
            isGroup,
          });
        }
      } catch (error: unknown) {
        const err = asErrorLike(error);
        process.stderr.write(`[ERROR] Failed to process message: ${err?.message || err}\n`);
      }
    }
  } finally {
    rl.close();
    await gateway.stop();
  }

  return 0;
}
