#!/usr/bin/env node
import { formatZavorthCertificationHelp, formatZavorthConsistencyPreparedNotice, isZavorthConsistencyStubCommand } from './ZavorthCliCertificationCommands.js';
import { isZavorthLiveNamespaceCommand, runZavorthLiveNamespaceCommand } from './ZavorthCliLiveNamespaces.js';
import { asErrorLike } from '../utils/errorLike';
import { spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { formatCliHelp, resolveCliHelpTopic } from './ZavorthCliSurfaceHelpers.js';
import { getCommandAliases } from './locales/localeManager.js';
import { resolveZavorthSimpleCommand, type ZavorthSimpleCommandPlan } from './SimpleCommandRouter.js';

import type { DiskMutationGateRequestedOperation } from '../contracts/DiskMutationGateContract.js';
import { runDiskMutationGateCommand } from './disk/ZavorthCliDiskMutationNamespace.js';
import { runProjectConstitutionCommand } from './constitution/ZavorthCliConstitutionNamespace.js';
import { runMigrationUX } from './MigrationCli.js';
import { runCapabilitySubsystemCli } from './CapabilitySubsystemCli.js';
import { runReachSubsystemCli } from './ReachSubsystemCli.js';
import { runPowerSubsystemCli } from './PowerSubsystemCli.js';
import { runProductSubsystemCli } from './ProductSubsystemCli.js';
import { runProofLedgerCli } from './ProofLedgerCli.js';
import { runApprovalPresentationCli, shouldRunApprovalPresentationCli, normalizeApprovalPresentationArgs } from './ApprovalPresentationCli.js';
import { runRiskBudgetCli } from './RiskBudgetCli.js';
import { runChangePreviewCli } from './ChangePreviewCli.js';
import { runMemoryPrivacyCli } from './MemoryPrivacyCli.js';
import { runZavorthMinimalRuntimeNamespace } from './ZavorthCliMinimalRuntimeNamespace.js';

import {
  entryDir,
  logCliError,
  npmInherited,
  printBuiltinHelp,
  printCliPanel,
  printGeneralHelp,
  projectRoot,
  readDurationMsFlag,
  readFlexibleStringFlag,
  readNumberFlag,
  readStringFlag,
  readStringListFlag,
  readTaskPositional,
  runningFromDist,
  spawnInherited,
} from './ZavorthCliCommandRuntime.js';

export function silenceConsoleLogToStderr(): () => void {
  const originalLog = console.log;
  console.log = (...values: unknown[]) => {
    process.stderr.write(`${values.map((value) => String(value)).join(' ')}\n`);
  };
  return () => {
    console.log = originalLog;
  };
}

export async function runGatewayMatrix(rawArgs: string[] = []): Promise<number> {
  return npmInherited(['exec', 'tsx', '--', 'scripts/zavorth-gateway-matrix.ts', ...rawArgs], projectRoot);
}

export async function runExecutionBackends(rawArgs: string[] = []): Promise<number> {
  return npmInherited(['exec', 'tsx', '--', 'scripts/zavorth-execution-backends.ts', ...rawArgs], projectRoot);
}

export async function runSkillEcosystem(rawArgs: string[] = []): Promise<number> {
  return npmInherited(['exec', 'tsx', '--', 'scripts/zavorth-skill-ecosystem-pack.ts', ...rawArgs], projectRoot);
}

export async function runAcp(rawArgs: string[] = []): Promise<number> {
  const action = String(rawArgs[0] || 'live')
    .trim()
    .toLowerCase();
  if (action === 'channel' || action === 'adapter' || action === 'generic-channel') {
    const nextArgs = rawArgs.slice(1);
    const channelAction = String(nextArgs[0] || 'status')
      .trim()
      .toLowerCase();
    const channelArgs = ['status', 'list', 'inspect'].includes(channelAction) ? nextArgs.slice(1) : nextArgs;
    const { AcpGenericChannelAdapterService } = await import('../services/AcpGenericChannelAdapterService.js');
    const service = new AcpGenericChannelAdapterService();
    if (channelAction === 'status' || channelAction === 'list' || channelAction === 'inspect') {
      const snapshot = service.buildSnapshot();
      if (channelArgs.includes('--json')) {
        process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
      } else {
        process.stdout.write(`${service.renderText(snapshot)}\n`);
      }
      return 0;
    }

    if (channelAction === 'ingest' || channelAction === 'receive' || channelAction === 'message') {
      const frame = buildAcpGenericChannelFrame(channelArgs);
      const receipt = service.ingest(frame, {
        receiptPath: readFlexibleStringFlag(channelArgs, 'receipt-path'),
      });
      if (channelArgs.includes('--json')) {
        process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
      } else {
        process.stdout.write(`${service.renderText(receipt)}\n`);
      }
      return receipt.status === 'blocked' || receipt.status === 'failed' || ((channelArgs.includes('--strict') || channelArgs.includes('--require-pass')) && receipt.status !== 'accepted') ? 1 : 0;
    }

    await logCliError(`Unknown ACP channel action: ${channelAction}`, 'Zavorth ACP');
    return 1;
  }

  if (action === 'session' || action === 'run') {
    const nextArgs = rawArgs.slice(1);
    const { AcpLiveSessionService } = await import('../services/AcpLiveSessionService.js');
    const service = new AcpLiveSessionService();
    const receipt = await service.run({
      prompt: readFlexibleStringFlag(nextArgs, 'prompt') || nextArgs.find((arg) => !arg.startsWith('--')) || 'ping',
      serverId: readFlexibleStringFlag(nextArgs, 'server') || 'local-acp',
      transport: nextArgs.includes('--stdio') || nextArgs.includes('--acp-sdk-stdio') ? 'acp-sdk-stdio' : 'local-jsonrpc',
      stdioCommand: readFlexibleStringFlag(nextArgs, 'stdio-command') || undefined,
      stdioArgs: readFlexibleStringFlag(nextArgs, 'stdio-args')?.split(/\s+/).filter(Boolean),
      timeoutMs: Number(readFlexibleStringFlag(nextArgs, 'timeout-ms') || 0) || undefined,
    });
    if (nextArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
    } else {
      process.stdout.write(`${service.renderText(receipt)}\n`);
    }
    return receipt.status === 'failed' || receipt.status === 'blocked' || ((nextArgs.includes('--require-pass') || nextArgs.includes('--strict')) && receipt.status !== 'completed') ? 1 : 0;
  }
  const nextArgs = action === 'live' || action === 'status' || action === 'bridge' ? rawArgs.slice(1) : rawArgs;
  const { AcpLiveBridgeService } = await import('../services/AcpLiveBridgeService.js');
  const service = new AcpLiveBridgeService();
  const snapshot = service.buildSnapshot();
  if (nextArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(`${service.renderText(snapshot)}\n`);
  }
  return snapshot.status === 'blocked' || ((nextArgs.includes('--require-pass') || nextArgs.includes('--strict')) && snapshot.status !== 'ready') ? 1 : 0;
}

export function buildAcpGenericChannelFrame(rawArgs: string[]): Record<string, unknown> {
  const frameFile = readFlexibleStringFlag(rawArgs, 'frame-file');
  const frameJson = readFlexibleStringFlag(rawArgs, 'frame');
  if (frameFile) {
    return JSON.parse(readFileSync(path.resolve(projectRoot, frameFile), 'utf8')) as Record<string, unknown>;
  }
  if (frameJson) {
    return JSON.parse(frameJson) as Record<string, unknown>;
  }

  const kind = readFlexibleStringFlag(rawArgs, 'kind') || 'message';
  const requestedTools = readStringListFlag(rawArgs, 'tool');
  const text = readFlexibleStringFlag(rawArgs, 'text') || readFlexibleStringFlag(rawArgs, 'prompt') || rawArgs.find((arg) => !arg.startsWith('--') && !['ingest', 'receive', 'message'].includes(arg)) || '';
  return {
    kind,
    id: readFlexibleStringFlag(rawArgs, 'id') || undefined,
    idempotencyKey: readFlexibleStringFlag(rawArgs, 'idempotency-key') || undefined,
    runtimeId: readFlexibleStringFlag(rawArgs, 'runtime') || readFlexibleStringFlag(rawArgs, 'runtime-id') || 'acp-cli-runtime',
    sessionId: readFlexibleStringFlag(rawArgs, 'session') || readFlexibleStringFlag(rawArgs, 'session-id') || 'acp-cli-session',
    actor: {
      id: readFlexibleStringFlag(rawArgs, 'actor') || 'operator',
      role: readFlexibleStringFlag(rawArgs, 'role') || 'user',
    },
    handshake:
      kind === 'handshake'
        ? {
            clientId: readFlexibleStringFlag(rawArgs, 'client-id') || 'acp-cli-client',
            role: readFlexibleStringFlag(rawArgs, 'client-role') || 'external-agent',
            scopes: readStringListFlag(rawArgs, 'scope'),
            tokenPresent: rawArgs.includes('--token-present'),
          }
        : undefined,
    tool: requestedTools.length === 1 ? { name: requestedTools[0] } : undefined,
    payload: {
      text,
      channel: readFlexibleStringFlag(rawArgs, 'channel') || 'api',
      workspace: readFlexibleStringFlag(rawArgs, 'workspace') || projectRoot,
      requestedTools,
    },
    source: {
      runtimeName: readFlexibleStringFlag(rawArgs, 'source-runtime') || 'cli-acp-compatible-agent',
      runtimeVersion: readFlexibleStringFlag(rawArgs, 'source-version') || undefined,
      paths: ['zavorth-cli:acp-channel'],
    },
  };
}

export async function runRuntimeGuidedFixes(rawArgs: string[] = []): Promise<number> {
  const { ZavorthRuntimeGuidedFixesService } = await import('../services/ZavorthRuntimeGuidedFixesService.js');
  const { ZavorthRuntimeReadinessService } = await import('../services/ZavorthRuntimeReadinessService.js');
  const readiness = await new ZavorthRuntimeReadinessService().buildSnapshot({
    userId: readFlexibleStringFlag(rawArgs, 'user-id') || 'local-user',
    sessionId: readFlexibleStringFlag(rawArgs, 'session-id') || 'runtime-guided-fixes',
    workspaceHint: readFlexibleStringFlag(rawArgs, 'workspace') || projectRoot,
  });
  const service = new ZavorthRuntimeGuidedFixesService();
  const snapshot = service.buildSnapshot(readiness);
  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderCli(snapshot));
  }
  return readiness.status === 'blocked' ? 1 : 0;
}

export async function runRuntimeReadinessFix(rawArgs: string[] = []): Promise<number> {
  const target = String(rawArgs[0] || '')
    .trim()
    .toLowerCase();
  if (target === 'provider') {
    return runRuntimeReadinessFixProvider(rawArgs.slice(1));
  }
  await logCliError('Unknown fix. Use: zavorth readiness fix provider --live-proof --provider <id>', 'Usage Error');
  return 1;
}

export async function runRuntimeReadinessFixProvider(rawArgs: string[] = []): Promise<number> {
  const { ZavorthProviderLiveProofStoreService } = await import('../services/ZavorthProviderLiveProofStoreService.js');
  const { ZavorthProviderReadinessMatrixService } = await import('../services/ZavorthProviderReadinessMatrixService.js');
  const { ZavorthRuntimeReadinessService } = await import('../services/ZavorthRuntimeReadinessService.js');
  const asJson = rawArgs.includes('--json');
  const baseService = new ZavorthProviderReadinessMatrixService();
  const baseSnapshot = baseService.buildSnapshot({ includeAdvanced: rawArgs.includes('--advanced') });
  const providerId = readFlexibleStringFlag(rawArgs, 'provider') || rawArgs.find((arg) => !arg.startsWith('--') && arg !== 'live-proof' && arg !== 'provider') || baseSnapshot.activeProvider || '';
  if (!providerId) {
    const msg = 'No provider selected. Pass --provider <id> or set your default with `zavorth providers switch`.';
    if (asJson) {
      process.stdout.write(`${JSON.stringify({ ok: false, error: msg }, null, 2)}\n`);
    } else {
      process.stdout.write(`${msg}\n`);
    }
    return 1;
  }
  const liveProofStore = new ZavorthProviderLiveProofStoreService();
  const service = new ZavorthProviderReadinessMatrixService({ liveProofStore });
  const snapshot = await service.buildLiveSnapshot({
    includeAdvanced: rawArgs.includes('--advanced'),
    providerId,
    probe: true,
    live: true,
  });
  const selected = snapshot.entries.find((entry) => entry.id === providerId || entry.familyIds.includes(providerId)) || snapshot.entries[0] || null;
  const readiness = await new ZavorthRuntimeReadinessService().buildSnapshot({
    userId: readFlexibleStringFlag(rawArgs, 'user-id') || 'local-user',
    sessionId: 'runtime-readiness-provider-fix',
    workspaceHint: readFlexibleStringFlag(rawArgs, 'workspace') || projectRoot,
  });

  if (asJson) {
    process.stdout.write(
      `${JSON.stringify(
        {
          providerLiveProof: snapshot,
          selected,
          proofStore: {
            path: liveProofStore.filePath,
            rawSecretsSerialized: false,
          },
          runtimeReadiness: readiness,
        },
        null,
        2,
      )}\n`,
    );
  } else {
    const passed = selected?.probe.status === 'passed';
    await printCliPanel(
      'Provider live proof',
      [
        `provider=${selected?.id || providerId}`,
        `probe=${selected?.probe.status || 'not_found'}`,
        `default_route=${selected?.defaultRouteAllowed ? 'allowed' : 'blocked'}`,
        `runtime=${readiness.status}`,
        `proof_store=${liveProofStore.filePath}`,
        '',
        passed ? 'Provider validated with persisted live proof. Run zavorth readiness to check daily state.' : selected?.probe.summary || 'Live probe could not validate the provider.',
      ],
      passed ? 'success' : 'warning',
    );
  }

  return selected?.defaultRouteAllowed ? 0 : 1;
}
