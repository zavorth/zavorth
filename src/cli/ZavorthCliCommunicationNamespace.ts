import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from 'crypto';
import { spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { spawnCommandLine } from '../security/SafeProcessExec.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';
import { formatZavorthCertificationHelp } from './ZavorthCliCertificationCommands.js';
import { ZavorthOperationalReadinessService } from '../services/ZavorthOperationalReadinessService.js';
import { ZavorthNativeCapabilityCertificationService } from '../services/ZavorthNativeCapabilityCertificationService.js';
import { ZavorthProductExcellenceService } from '../services/ZavorthProductExcellenceService.js';
import {
  AutonomySchedulePlane,
  bindAutonomySchedulePlane,
} from '../services/AutonomySchedulePlane.js';
import { GoalLoopService } from '../services/GoalLoopService.js';
import { GoalLoopDaemonService } from '../services/GoalLoopDaemonService.js';
import { GoalLoopWorkerService } from '../services/GoalLoopWorkerService.js';
import { GoalPlaneService } from '../services/GoalPlaneService.js';
import { TaskBoardPlaneService } from '../services/TaskBoardPlaneService.js';
import { TaskPlaneService } from '../services/TaskPlaneService.js';
import { ZavorthHomePathService } from '../services/ZavorthHomePathService.js';
import { ZavorthBackgroundTaskService } from '../services/ZavorthBackgroundTaskService.js';
import { ZavorthCapabilityLifecycleService } from '../services/ZavorthCapabilityLifecycleService.js';
import { ZavorthCapabilityUsageSignalsService } from '../services/ZavorthCapabilityUsageSignalsService.js';
import { ZavorthCapabilityAtlasService } from '../services/ZavorthCapabilityAtlasService.js';
import { ZavorthDailyProductQuietAutonomyService } from '../services/ZavorthDailyProductQuietAutonomyService.js';
import { ZavorthActionGateway, type ZavorthActionOperation } from '../runtime/actions/index.js';
import {
  SessionContinuumService,
  resolveSessionContinuumStorePath,
} from '../services/SessionContinuumService.js';
import { ZavorthXaiRuntimeService } from '../services/ZavorthXaiRuntimeService.js';
import { ZavorthOperationalStateDbService } from '../services/ZavorthOperationalStateDbService.js';
import { LlmRuntimeService } from '../services/llm/LlmRuntimeService.js';
import { SkillCuratorPlaneService } from '../skills/SkillCuratorPlaneService.js';
import { runSkills as runSkillsNamespace } from './skills/ZavorthCliSkillsNamespace.js';
import { runPlugins as runPluginsNamespace } from './plugins/ZavorthCliPluginsNamespace.js';
import { AgentRunService } from '../runtime/agent/AgentRunService.js';
import { TerminalPanel } from './presentation/TerminalPanel.js';
import { ChannelGatewayFactory } from '../gateways/ChannelGatewayFactory.js';
import { runCertify } from './certify/ZavorthCliCertifyNamespace.js';
import { runSandbox } from './sandbox/ZavorthCliSandboxNamespace.js';
import {
  firstArg,
  readFlag,
  readFlags,
  readNumberFlag,
  stateDir,
  ensureDir,
  readJson,
  readArray,
  writeJson,
  appendJsonArray,
  listJsonFiles,
  listAnyFiles,
  walkFiles,
  idWithTime,
  safeString,
  isInside,
  runProcess,
  sha256,
  render,
  normalizeRenderLines,
  resolvePanelType,
  terminalPanelWidth,
  text,
  splitList,
  getEnv,
  quoteEnv,
  mergeSingleEnvValue
} from './ZavorthCliSharedHelpers.js';
import type { ZavorthCapabilityUsageEventKind, ZavorthCapabilityUsageSurface } from '../contracts/ZavorthCapabilityUsageSignalsContract.js';
import type { ZavorthCapabilityAtlasCategory } from '../contracts/ZavorthCapabilityAtlasContract.js';
import type { ZavorthAppsSatelliteAction, ZavorthAppsSatelliteNodeKind } from '../contracts/ZavorthAppsSatelliteNodesContract.js';
import type { ZavorthTerminalBackendId } from '../contracts/runtime/ZavorthTerminalBackendsContract.js';
import type { SwarmScaleExecutionMode, SwarmScaleExecutionBackendId } from '../domain/execution/infrastructure/SwarmScalePlaneService.js';
import { logger } from '../logger.js';
import { asErrorLike, errorMessage } from '../utils/errorLike.js';


type JsonObject = Record<string, unknown>;
const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

import {
  getPath,
  setPath,
  unsetPath,
  redact,
  redactUrl,
  sanitizeMessageRecord,
  sanitizeDelivery,
  formatMessageReceipt,
} from './ZavorthCliCommunicationValues.js';
import {
  CHANNEL_ADAPTERS,
  parseMessageCompose,
  deliverMessageAdvanced,
  enforceChannelRateLimit,
  resolveAttachments,
  deliverMessage,
  readChannelMessages,
  lookupChannelDirectory,
  createPairingDraft,
  renderTerminalQr,
  hashPairingCode,
  pairingExpired,
  redactPairingRecord,
  formatDirectoryEntry,
  mergeDirectoryEntries,
  isChannelConfigured,
  resolveChannelAdapter,
  channelStatus,
  channelWebhookPayload,
  channelEndpointHeaders,
  writeChannelOutbox,
  sendTelegramDocument,
  safeAttachmentMetadata,
  runChannelScript,
  type MessageCompose,
} from './ZavorthCliChannelCommunicationSupport.js';
import {
  getFirstEnv,
  envPrefix,
  isProviderConfigured,
  inferText,
  resolveOpenAiLikeProvider,
  idFromSpec,
  resolveNpmCommand,
  postJson,
} from './ZavorthCliProviderInferenceHelpers.js';
export * from './ZavorthCliCommunicationValues.js';
export * from './ZavorthCliChannelCommunicationSupport.js';
export * from './ZavorthCliProviderInferenceHelpers.js';

export async function runMessage(root: string, args: string[]) {
  const action = firstArg(args, 'status');
  if (action === 'status') {
    const statuses = CHANNEL_ADAPTERS.map((adapter) => channelStatus(adapter.id));
    const readiness = statuses.map((status) => {
      const suffix = status.configured ? status.mode : `missing (${status.required.join(' or ')})`;
      return `${status.id}: ${suffix}`;
    });
    return render(args, 'Zavorth message', readiness, { channels: Object.fromEntries(statuses.map((status) => [status.id, status])) });
  }
  const file = path.join(stateDir(root), 'messages.json');
  const messages = await readArray(file);
  if (action === 'retry') {
    const id = args[1] || readFlag(args, 'id') || '';
    const selected = messages.find((entry) => String((entry as JsonObject).id) === id) as JsonObject | undefined;
    if (!selected) return render(args, 'Zavorth message', [`No message found for retry id: ${id || '<missing>'}`], { ok: false });
    if (!args.includes('--deliver') && !args.includes('--yes')) {
      return render(args, 'Zavorth message', [`Retry preview: ${id}`, 'Add --deliver --yes to retry delivery.'], { dryRun: true, message: sanitizeMessageRecord(selected) });
    }
    const retryArgs = [
      'send',
      '--channel', String(selected.channel || ''),
      '--target', String(selected.target || ''),
      '--message', String(selected.message || ''),
      '--deliver',
      '--yes',
      ...((selected.threadId ? ['--thread', String(selected.threadId)] : [])),
      ...((selected.replyTo ? ['--reply-to', String(selected.replyTo)] : [])),
    ];
    const retry = await deliverMessageAdvanced(root, retryArgs, {
      channel: String(selected.channel || ''),
      targets: splitList(String(selected.target || '')),
      message: String(selected.message || ''),
      attachments: (selected.attachments as string[] | undefined) || [],
      threadId: String(selected.threadId || ''),
      replyTo: String(selected.replyTo || ''),
      reaction: String(selected.reaction || ''),
      mentions: splitList(String(selected.mentions || '')),
    });
    selected.status = retry.ok ? 'delivered' : 'delivery-failed';
    selected.retryCount = Number(selected.retryCount || 0) + 1;
    selected.lastRetryAt = new Date().toISOString();
    selected.delivery = retry;
    await writeJson(file, messages);
    return render(args, 'Zavorth message', [`Retry ${selected.status}: ${id}`], { message: sanitizeMessageRecord(selected), retry });
  }
  if (action === 'receipts' || action === 'receipt') {
    const id = args[1] || readFlag(args, 'id') || '';
    const receipts = await readArray(path.join(stateDir(root), 'receipts', 'messages.json'));
    const selected = id ? receipts.filter((entry) => String((entry as JsonObject).messageId) === id || String((entry as JsonObject).id) === id) : receipts;
    return render(args, 'Zavorth message evidence', selected.length ? selected.slice(-20).map(formatMessageReceipt) : ['No message evidence recorded yet.'], { receipts: selected });
  }
  if (action === 'manage') {
    const pending = messages.filter((entry) => ['delivery-failed', 'draft', 'delivery-requested'].includes(String((entry as JsonObject).status)));
    return render(args, 'Zavorth message manage', pending.length ? pending.map((entry) => {
      const item = entry as JsonObject;
      return `- ${String(item.id)} | ${String(item.channel)} | ${String(item.status)} | retries ${String(item.retryCount || 0)}`;
    }) : ['No message drafts or failed deliveries need attention.'], { messages: pending.map(sanitizeMessageRecord) });
  }
  if (action === 'list' || action === 'read') {
    if (action === 'read' && args.includes('--live')) {
      if (!args.includes('--yes')) return render(args, 'Zavorth message', ['Live read requires --yes.'], { ok: false });
      const channel = readFlag(args, 'channel') || 'telegram';
      const result = await readChannelMessages(channel, args);
      return render(args, 'Zavorth message', result.lines, result.payload);
    }
    if (action === 'read') {
      const id = args[1];
      const message = messages.find((entry) => String((entry as JsonObject).id) === id) as JsonObject | undefined;
      if (!message) return render(args, 'Zavorth message', [`No message found for id: ${id || '<missing>'}`], { ok: false });
      return render(args, 'Zavorth message', [
        `id: ${String(message.id)}`,
        `channel: ${String(message.channel)}`,
        `target: ${String(message.target)}`,
        `status: ${String(message.status)}`,
        `message: ${redact(String(message.message || ''))}`,
      ], { message: { ...message, message: redact(String(message.message || '')) } });
    }
    return render(args, 'Zavorth message', messages.length ? messages.map((message) => `- ${String((message as JsonObject).id)} | ${String((message as JsonObject).channel)} | ${String((message as JsonObject).status)}`) : ['No message drafts recorded yet.'], { messages: messages.map(sanitizeMessageRecord) });
  }
  const compose = parseMessageCompose(args);
  const draft = {
    id: idWithTime('message'),
    channel: compose.channel,
    target: compose.targets.join(','),
    message: compose.message,
    attachments: compose.attachments,
    threadId: compose.threadId || null,
    replyTo: compose.replyTo || null,
    reaction: compose.reaction || null,
    mentions: compose.mentions,
    status: args.includes('--deliver') ? 'delivery-requested' : 'draft',
    retryCount: 0,
    createdAt: new Date().toISOString(),
  };
  if (args.includes('--deliver')) {
    const delivery = await deliverMessageAdvanced(root, args, compose);
    draft.status = delivery.ok ? 'delivered' : 'delivery-failed';
    (draft as JsonObject).delivery = delivery;
    await appendJsonArray(path.join(stateDir(root), 'receipts', 'messages.json'), {
      id: idWithTime('message-receipt'),
      messageId: draft.id,
      channel: compose.channel,
      targets: compose.targets,
      status: draft.status,
      delivery,
      createdAt: new Date().toISOString(),
    });
  }
  messages.push(draft);
  await writeJson(file, messages);
  return render(args, 'Zavorth message', [`Created ${draft.status}: ${draft.id}`, 'No secret or message body was printed in full.'], { draft: sanitizeMessageRecord(draft) });
}
