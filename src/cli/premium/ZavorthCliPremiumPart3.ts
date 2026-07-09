import { spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { formatCliHelp, resolveCliHelpTopic } from '../ZavorthCliSurfaceHelpers.js';
import { getCommandAliases } from '../locales/localeManager.js';
import { resolveZavorthSimpleCommand, type ZavorthSimpleCommandPlan } from '../SimpleCommandRouter.js';
import {
  formatZavorthCertificationHelp,
  formatZavorthConsistencyPreparedNotice,
  isZavorthConsistencyStubCommand,
} from '../ZavorthCliCertificationCommands.js';
import {
  isZavorthLiveNamespaceCommand,
  runZavorthLiveNamespaceCommand,
} from '../ZavorthCliLiveNamespaces.js';
import { runDiskMutationGateCommand } from '../disk/ZavorthCliDiskMutationNamespace.js';


import { runProjectConstitutionCommand } from '../constitution/ZavorthCliConstitutionNamespace.js';

// Shared infrastructure imports
import {
  projectRoot,
  logCliError,
  printCliPanel,
  spawnInherited,
  npmInherited,
  resolveNpmCli,
  printBuiltinHelp,
  printGeneralHelp,
  readNumberFlag,
  readStringFlag,
  readFlexibleStringFlag,
  readStringListFlag,
  readTaskPositional,
  readDurationMsFlag,
  runningFromDist
} from '../ZavorthCliCommonInfrastructure.js';

// Types
import type { DiskMutationGateRequestedOperation } from '../../contracts/DiskMutationGateContract.js';

type JsonObject = Record<string, unknown>;


export async function runAcp(rawArgs: string[] = []): Promise<number> {
  const action = String(rawArgs[0] || 'live').trim().toLowerCase();
  if (action === 'channel' || action === 'adapter' || action === 'generic-channel') {
    const nextArgs = rawArgs.slice(1);
    const channelAction = String(nextArgs[0] || 'status').trim().toLowerCase();
    const channelArgs = ['status', 'list', 'inspect'].includes(channelAction) ? nextArgs.slice(1) : nextArgs;
    const { AcpGenericChannelAdapterService } = await import('../../services/AcpGenericChannelAdapterService.js');
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
      return receipt.status === 'blocked' || receipt.status === 'failed'
        || ((channelArgs.includes('--strict') || channelArgs.includes('--require-pass')) && receipt.status !== 'accepted')
        ? 1
        : 0;
    }

    await logCliError(`Unknown ACP channel action: ${channelAction}`, 'Zavorth ACP');
    return 1;
  }

  if (action === 'session' || action === 'run') {
    const nextArgs = rawArgs.slice(1);
    const { AcpLiveSessionService } = await import('../../services/AcpLiveSessionService.js');
    const service = new AcpLiveSessionService();
    const receipt = await service.run({
      prompt: readFlexibleStringFlag(nextArgs, 'prompt') || nextArgs.find((arg) => !arg.startsWith('--')) || 'ping',
      serverId: readFlexibleStringFlag(nextArgs, 'server') || 'local-acp',
      transport: nextArgs.includes('--stdio') || nextArgs.includes('--acp-sdk-stdio') ? 'acp-sdk-stdio' : 'mock-jsonrpc',
      stdioCommand: readFlexibleStringFlag(nextArgs, 'stdio-command') || undefined,
      stdioArgs: readFlexibleStringFlag(nextArgs, 'stdio-args')?.split(/\s+/).filter(Boolean),
      timeoutMs: Number(readFlexibleStringFlag(nextArgs, 'timeout-ms') || 0) || undefined,
    });
    if (nextArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
    } else {
      process.stdout.write(`${service.renderText(receipt)}\n`);
    }
    return receipt.status === 'failed'
      || receipt.status === 'blocked'
      || ((nextArgs.includes('--require-pass') || nextArgs.includes('--strict')) && receipt.status !== 'completed')
      ? 1
      : 0;
  }
  const nextArgs = action === 'live' || action === 'status' || action === 'bridge'
    ? rawArgs.slice(1)
    : rawArgs;
  const { AcpLiveBridgeService } = await import('../../services/AcpLiveBridgeService.js');
  const service = new AcpLiveBridgeService();
  const snapshot = service.buildSnapshot();
  if (nextArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(`${service.renderText(snapshot)}\n`);
  }
  return snapshot.status === 'blocked' || ((nextArgs.includes('--require-pass') || nextArgs.includes('--strict')) && snapshot.status !== 'ready')
    ? 1
    : 0;
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
  const text = readFlexibleStringFlag(rawArgs, 'text')
    || readFlexibleStringFlag(rawArgs, 'prompt')
    || rawArgs.find((arg) => !arg.startsWith('--') && !['ingest', 'receive', 'message'].includes(arg))
    || '';
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
    handshake: kind === 'handshake'
      ? {
        clientId: readFlexibleStringFlag(rawArgs, 'client-id') || 'acp-cli-client',
        role: readFlexibleStringFlag(rawArgs, 'client-role') || 'external-agent',
        scopes: readStringListFlag(rawArgs, 'scope'),
        tokenPresent: rawArgs.includes('--token-present'),
      }
      : undefined,
    tool: requestedTools.length === 1
      ? { name: requestedTools[0] }
      : undefined,
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
  const { ZavorthRuntimeGuidedFixesService } = await import('../../services/ZavorthRuntimeGuidedFixesService.js');
  const { ZavorthRuntimeReadinessService } = await import('../../services/ZavorthRuntimeReadinessService.js');
  const readiness = await new ZavorthRuntimeReadinessService().buildSnapshot({
    userId: readFlexibleStringFlag(rawArgs, 'user-id') || 'operator',
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
  const target = String(rawArgs[0] || '').trim().toLowerCase();
  if (target === 'provider') {
    return runRuntimeReadinessFixProvider(rawArgs.slice(1));
  }
  await logCliError('Unknown fix. Use: zavorth readiness fix provider --live-proof --provider <id>', 'Usage Error');
  return 1;
}

export async function runRuntimeReadinessFixProvider(rawArgs: string[] = []): Promise<number> {
  const { ZavorthProviderLiveProofStoreService } = await import('../../services/ZavorthProviderLiveProofStoreService.js');
  const { ZavorthProviderReadinessMatrixService } = await import('../../services/ZavorthProviderReadinessMatrixService.js');
  const { ZavorthRuntimeReadinessService } = await import('../../services/ZavorthRuntimeReadinessService.js');
  const asJson = rawArgs.includes('--json');
  const baseService = new ZavorthProviderReadinessMatrixService();
  const baseSnapshot = baseService.buildSnapshot({ includeAdvanced: rawArgs.includes('--advanced') });
  const providerId = readFlexibleStringFlag(rawArgs, 'provider')
    || rawArgs.find((arg) => !arg.startsWith('--') && arg !== 'live-proof' && arg !== 'provider')
    || baseSnapshot.activeProvider
    || baseSnapshot.entries.find((entry: any) => entry.status === 'ready')?.id
    || 'gemini';
  const liveProofStore = new ZavorthProviderLiveProofStoreService();
  const service = new ZavorthProviderReadinessMatrixService({ liveProofStore });
  const snapshot = await service.buildLiveSnapshot({
    includeAdvanced: rawArgs.includes('--advanced'),
    providerId,
    probe: true,
    live: true,
  });
  const selected = snapshot.entries.find((entry: any) => entry.id === providerId || entry.familyIds.includes(providerId))
    || snapshot.entries[0]
    || null;
  const readiness = await new ZavorthRuntimeReadinessService().buildSnapshot({
    userId: readFlexibleStringFlag(rawArgs, 'user-id') || 'operator',
    sessionId: 'runtime-readiness-provider-fix',
    workspaceHint: readFlexibleStringFlag(rawArgs, 'workspace') || projectRoot,
  });

  if (asJson) {
    process.stdout.write(`${JSON.stringify({
      providerLiveProof: snapshot,
      selected,
      proofStore: {
        path: liveProofStore.filePath,
        rawSecretsSerialized: false,
      },
      runtimeReadiness: readiness,
    }, null, 2)}\n`);
  } else {
    const passed = selected?.probe.status === 'passed';
    await printCliPanel('Provider live proof', [
      `provider=${selected?.id || providerId}`,
      `probe=${selected?.probe.status || 'not_found'}`,
      `default_route=${selected?.defaultRouteAllowed ? 'allowed' : 'blocked'}`,
      `runtime=${readiness.status}`,
      `proof_store=${liveProofStore.filePath}`,
      '',
      passed
        ? 'Provider validated with persisted live proof. Run zavorth readiness to inspect the daily state.'
        : selected?.probe.summary || 'Live probe could not validate the provider.',
    ], passed ? 'success' : 'warning');
  }

  return selected?.defaultRouteAllowed ? 0 : 1;
}

export async function runCliExperienceConsistency(rawArgs: string[] = []): Promise<number> {
  if (!rawArgs.includes('--legacy')) {
    const { ZavorthCliTuiPolishService } = await import('../../services/ZavorthCliTuiPolishService.js');
    const service = new ZavorthCliTuiPolishService();
    const snapshot = await service.buildSnapshot({
      refreshProviders: rawArgs.includes('--refresh-providers') || rawArgs.includes('--live'),
      includeAdvancedProviders: rawArgs.includes('--advanced'),
      userId: readFlexibleStringFlag(rawArgs, 'user-id') || 'operator',
      sessionId: readFlexibleStringFlag(rawArgs, 'session-id') || 'cli-home',
      workspaceHint: readFlexibleStringFlag(rawArgs, 'workspace') || projectRoot,
    });
    if (rawArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    } else {
      process.stdout.write(service.renderCli(snapshot));
    }
    return snapshot.status === 'blocked' || ((rawArgs.includes('--require-pass') || rawArgs.includes('--strict')) && snapshot.status !== 'ready')
      ? 1
      : 0;
  }

  const { ZavorthCliExperienceCertificationService } = await import('../../services/ZavorthCliExperienceCertificationService.js');
  const service = new ZavorthCliExperienceCertificationService();
  const snapshot = service.buildSnapshot();

  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderText(snapshot));
  }

  return 0;
}

export async function runExperienceLayerDailyUseCertification(rawArgs: string[] = []): Promise<number> {
  const { ZavorthExperienceLayerDailyUseCertificationService } = await import('../../services/ZavorthExperienceLayerDailyUseCertificationService.js');
  const service = new ZavorthExperienceLayerDailyUseCertificationService();
  const snapshot = service.buildSnapshot();

  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderText(snapshot));
  }

  return snapshot.result === 'passed' ? 0 : 1;
}

export async function runGatewaySpine(rawArgs: string[] = []): Promise<number> {
  const { GatewayChannelRegistryService } = await import('../../services/GatewayChannelRegistryService.js');
  const { GatewaySpineService } = await import('../../services/GatewaySpineService.js');
  const view = String(rawArgs[0] || 'status').trim().toLowerCase();
  const asJson = rawArgs.includes('--json');
  const service = new GatewaySpineService({
    channelRegistry: new GatewayChannelRegistryService({
      hasDispatcher: true,
      canSpawnWeb: true,
    }),
  });
  const snapshot = service.buildSnapshot({
    gatewayRuntimeSnapshot: {
      lifecycle: {
        status: 'attached',
      },
      route: 'gateway-runtime',
      sessions: [],
    },
    approvals: {
      source: 'GatewayApprovalPlane',
      total: 0,
      pending: 0,
    },
    receipts: {
      source: 'GatewayReceiptPlane',
      total: 0,
      pending: 0,
    },
    artifacts: {
      source: 'GatewayArtifactPlane',
      total: 0,
      pending: 0,
    },
  });

  if (asJson) {
    const payload =
      view === 'sessions' ? snapshot.sessions
        : view === 'channels' ? snapshot.channels
          : view === 'approvals' ? snapshot.approvals
            : view === 'receipts' ? snapshot.receipts
              : view === 'artifacts' ? snapshot.artifacts
                : snapshot;
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return 0;
  }

  if (view === 'sessions') {
    return printCliPanel('Gateway sessions', [
      `total: ${snapshot.sessions.total}`,
      `active: ${snapshot.sessions.active}`,
      `source: ${snapshot.sessions.source}`,
    ], 'info');
  }
  if (view === 'channels') {
    return printCliPanel('Gateway channels', [
      `total: ${snapshot.channels.summary.total}`,
      `ready: ${snapshot.channels.summary.ready}`,
      `partial: ${snapshot.channels.summary.partial}`,
      '',
      ...snapshot.channels.entries.map((entry: any) => `- ${entry.id}: ${entry.readiness} | ${entry.transport}`),
    ], 'info');
  }
  if (view === 'approvals') {
    return printCliPanel('Gateway approvals', [
      `pending: ${snapshot.approvals.pending}`,
      `total: ${snapshot.approvals.total}`,
      `source: ${snapshot.approvals.source}`,
    ], snapshot.approvals.pending > 0 ? 'warning' : 'success');
  }
  if (view === 'receipts') {
    return printCliPanel('Gateway receipts', [
      `total: ${snapshot.receipts.total}`,
      `source: ${snapshot.receipts.source}`,
    ], 'info');
  }
  if (view === 'artifacts') {
    return printCliPanel('Gateway artifacts', [
      `total: ${snapshot.artifacts.total}`,
      `source: ${snapshot.artifacts.source}`,
    ], 'info');
  }

  process.stdout.write(service.renderText(snapshot));
  return 0;
}

export async function runUnifiedOnboarding(rawArgs: string[] = []): Promise<number> {
  const { ProviderDoctorService } = await import('../../services/ProviderDoctorService.js');
  const { ZavorthUnifiedOnboardingService } = await import('../../services/ZavorthUnifiedOnboardingService.js');
  const service = new ZavorthUnifiedOnboardingService({
    providerDoctor: new ProviderDoctorService(),
  });
  const snapshot = service.buildSnapshot({
    dailyMode: readFlexibleStringFlag(rawArgs, 'mode'),
    detailMode: rawArgs.includes('--advanced') ? 'advanced' : rawArgs.includes('--simple') ? 'simple' : readFlexibleStringFlag(rawArgs, 'detail'),
    selectedTemplateId: readFlexibleStringFlag(rawArgs, 'template'),
    request: readFlexibleStringFlag(rawArgs, 'request'),
    includeAdvanced: rawArgs.includes('--advanced'),
  });
  const view = String(rawArgs.find((arg) => !arg.startsWith('--')) || 'journey').trim().toLowerCase();

  if (rawArgs.includes('--json')) {
    const payload =
      view === 'templates' ? snapshot.templates
        : view === 'doctor' ? {
            status: snapshot.status,
            provider: snapshot.provider,
            sandbox: snapshot.sandbox,
            nextAction: snapshot.nextAction,
          }
          : view === 'first-mission' ? snapshot.safeDemo
            : snapshot;
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return 0;
  }

  if (view === 'templates') {
    return printCliPanel('Onboarding templates', [
      ...snapshot.templates.map((template: any) =>`- ${template.id}: ${template.label} | risk=${template.defaultRisk} | mutate=${template.requiresMutation ? 'yes' : 'no'}`,
      ),
    ], 'info');
  }
  if (view === 'doctor') {
    return printCliPanel('Onboarding doctor', [
      `status: ${snapshot.status}`,
      `provider: ${snapshot.provider.status}`,
      `provider ready: ${snapshot.provider.ready}`,
      `missing auth: ${snapshot.provider.missingAuth}`,
      `needs probe: ${snapshot.provider.needsProbe}`,
      `sandbox: ${snapshot.sandbox.status}`,
      `mutation mode: ${snapshot.sandbox.mutationMode}`,
      `next: ${snapshot.nextAction}`,
    ], snapshot.status === 'ready' ? 'success' : 'warning');
  }
  if (view === 'first-mission') {
    return printCliPanel('Onboarding first mission', [
      snapshot.safeDemo.command,
      snapshot.safeDemo.summary,
    ], 'info');
  }

  process.stdout.write(service.renderText(snapshot));
  return 0;
}

export async function runSensitiveActionFlow(rawArgs: string[] = []): Promise<number> {
  const { ZavorthSensitiveActionFlowService } = await import('../../services/ZavorthSensitiveActionFlowService.js');
  const service = new ZavorthSensitiveActionFlowService();
  const request = readFlexibleStringFlag(rawArgs, 'request')
    || rawArgs.filter((arg) => !arg.startsWith('--')).join(' ')
    || 'Review this workspace in read-only mode.';
  const snapshot = service.buildSnapshot({
    request,
    decision: readFlexibleStringFlag(rawArgs, 'decision') as any,
    approvalId: readFlexibleStringFlag(rawArgs, 'approval-id'),
    sandboxReady: rawArgs.includes('--sandbox-ready'),
    source: 'cli',
  });

  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderText(snapshot));
  }

  return 0;
}

export async function runProviderReadiness(rawArgs: string[] = []): Promise<number> {
  const action = String(rawArgs[0] || 'matrix').trim().toLowerCase();
  if (action === 'cockpit' || action === 'zavorthControl') {
    const { ZavorthControlProviderCockpitService } = await import('../../services/ZavorthControlProviderCockpitService.js');
    const service = new ZavorthControlProviderCockpitService();
    const projection = await service.buildProjection({
      includeAdvanced: rawArgs.includes('--advanced'),
      providerId: readFlexibleStringFlag(rawArgs, 'provider') || rawArgs[1],
      selectedProviderId: readFlexibleStringFlag(rawArgs, 'selected-provider') || readFlexibleStringFlag(rawArgs, 'provider') || rawArgs[1],
      live: rawArgs.includes('--live'),
      allowAllLive: rawArgs.includes('--all'),
    });
    if (rawArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(projection, null, 2)}\n`);
    } else {
      process.stdout.write(service.renderText(projection));
    }
    return 0;
  }
  if (action === 'select' || action === 'use' || action === 'choose' || action === 'switch') {
    const { ZavorthProviderSelectionUxService } = await import('../../services/ZavorthProviderSelectionUxService.js');
    const service = new ZavorthProviderSelectionUxService();
    const target = readFlexibleStringFlag(rawArgs, 'provider')
      || readFlexibleStringFlag(rawArgs, 'target')
      || rawArgs[1];
    const snapshot = await service.buildSnapshot({
      includeAdvanced: rawArgs.includes('--advanced'),
      target,
      providerId: target,
      intent: readFlexibleStringFlag(rawArgs, 'intent') || readFlexibleStringFlag(rawArgs, 'profile') || rawArgs[2],
      requireLiveEvidence: rawArgs.includes('--require-live') || rawArgs.includes('--live-proof'),
      live: rawArgs.includes('--live'),
    });
    if (rawArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    } else {
      process.stdout.write(service.renderText(snapshot));
    }
    return 0;
  }
  if (action === 'apply' || action === 'persist' || action === 'save') {
    const { ZavorthProviderPreferencePersistenceService } = await import('../../services/ZavorthProviderPreferencePersistenceService.js');
    const service = new ZavorthProviderPreferencePersistenceService();
    const target = readFlexibleStringFlag(rawArgs, 'provider')
      || readFlexibleStringFlag(rawArgs, 'target')
      || rawArgs[1];
    const snapshot = await service.apply({
      includeAdvanced: rawArgs.includes('--advanced'),
      target,
      providerId: target,
      modelId: readFlexibleStringFlag(rawArgs, 'model'),
      intent: readFlexibleStringFlag(rawArgs, 'intent') || readFlexibleStringFlag(rawArgs, 'profile') || rawArgs[2],
      requireLiveEvidence: rawArgs.includes('--require-live') || rawArgs.includes('--live-proof'),
      live: rawArgs.includes('--live'),
      approvalId: readFlexibleStringFlag(rawArgs, 'approval-id'),
      confirm: rawArgs.includes('--confirm') || rawArgs.includes('--yes'),
      dryRun: rawArgs.includes('--dry-run') || rawArgs.includes('--preview'),
    });
    if (rawArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    } else {
      process.stdout.write(service.renderText(snapshot));
    }
    return snapshot.status === 'denied' ? 2 : 0;
  }
  if (action === 'preference' || action === 'current') {
    const { ZavorthProviderPreferencePersistenceService } = await import('../../services/ZavorthProviderPreferencePersistenceService.js');
    const service = new ZavorthProviderPreferencePersistenceService();
    const preference = await service.readPreference();
    if (rawArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify({
        surface: 'provider-preference',
        preference,
        safety: {
          rawSecretsSerialized: false,
          mutatesConfig: false,
        },
      }, null, 2)}\n`);
    } else {
      await printCliPanel('Provider preference', [
        `provider: ${preference?.providerId || 'none'}`,
        `model: ${preference?.modelId || 'none'}`,
        `receipt: ${preference?.receiptId || 'none'}`,
      ], preference ? 'success' : 'info');
    }
    return 0;
  }
  if (action === 'rollback') {
    const { ZavorthProviderPreferencePersistenceService } = await import('../../services/ZavorthProviderPreferencePersistenceService.js');
    const service = new ZavorthProviderPreferencePersistenceService();
    const snapshot = await service.rollback({
      receiptId: readFlexibleStringFlag(rawArgs, 'receipt') || rawArgs[1],
      approvalId: readFlexibleStringFlag(rawArgs, 'approval-id'),
      confirm: rawArgs.includes('--confirm') || rawArgs.includes('--yes'),
      dryRun: rawArgs.includes('--dry-run') || rawArgs.includes('--preview'),
    });
    if (rawArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    } else {
      process.stdout.write(service.renderText(snapshot));
    }
    return snapshot.status === 'denied' ? 2 : 0;
  }
  if (action === 'visual-approval' || action === 'visual-pack' || action === 'approval-pack') {
    const { ZavorthControlVisualApprovalPackService } = await import('../../services/ZavorthControlVisualApprovalPackService.js');
    const service = new ZavorthControlVisualApprovalPackService();
    const pack = await service.buildPack({
      includeAdvanced: rawArgs.includes('--advanced'),
      providerId: readFlexibleStringFlag(rawArgs, 'provider') || rawArgs[1],
      selectedProviderId: readFlexibleStringFlag(rawArgs, 'selected-provider') || readFlexibleStringFlag(rawArgs, 'provider') || rawArgs[1],
      includeDetailsDrawer: rawArgs.includes('--details-drawer'),
    });
    if (rawArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(pack, null, 2)}\n`);
    } else {
      process.stdout.write(service.renderText(pack));
    }
    return 0;
  }
  const { ZavorthProviderReadinessMatrixService } = await import('../../services/ZavorthProviderReadinessMatrixService.js');
  const { ZavorthProviderLiveProofStoreService } = await import('../../services/ZavorthProviderLiveProofStoreService.js');
  const providerId = readFlexibleStringFlag(rawArgs, 'provider')
    || (action === 'test' ? rawArgs[1] : rawArgs.find((arg) => !arg.startsWith('--') && arg !== 'matrix' && arg !== 'live'));
  const live = rawArgs.includes('--live') || action === 'live';
  const service = new ZavorthProviderReadinessMatrixService({
    liveProofStore: live ? new ZavorthProviderLiveProofStoreService() : null,
  });
  const snapshot = await service.buildLiveSnapshot({
    includeAdvanced: rawArgs.includes('--advanced'),
    providerId: providerId && providerId !== 'test' ? providerId : null,
    probe: action === 'test' || rawArgs.includes('--probe'),
    live,
    allowAllLive: rawArgs.includes('--all'),
  });

  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderText(snapshot));
  }

  return 0;
}

export async function runDynamicWorkflows(rawArgs: string[] = []): Promise<number> {
  if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
    return printCliPanel('Zavorth Dynamic Workflows', [
      'Usage: zavorth workflows "<objective>" [options]',
      '       zavorth workflows preview "<objective>" [options]',
      '       zavorth workflows launch <workflowId> --approval-id <approvalId>',
      '',
      'Creates a governed wide-work plan: cheap fanout workers, bounded concurrency, cost guard, saved preview and final synthesis through Swarm V2.',
      '',
      'Options:',
      '  --fanout <n>              Number of workers, capped by policy',
      '  --max-concurrency <n>     Parallel worker cap',
      '  --worker-model <class>    cheap, standard or premium',
      '  --synthesis-model <class> cheap, standard or premium',
      '  --max-cents <n>           Budget cap in cents',
      '  --storage-dir <path>      Preview/receipt storage override',
      '  --json                    Output machine-readable JSON',
    ], 'info');
  }
  const { ZavorthDynamicWorkflowService } = await import('../../services/ZavorthDynamicWorkflowService.js');
  const service = new ZavorthDynamicWorkflowService({
    storageDir: readFlexibleStringFlag(rawArgs, 'storage-dir'),
  });
  const positionalValues: string[] = [];
  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index] || '';
    if (arg.startsWith('--')) {
      if (!arg.includes('=') && rawArgs[index + 1] && !rawArgs[index + 1].startsWith('--')) {
        index += 1;
      }
      continue;
    }
    positionalValues.push(arg);
  }
  const dynamicPositionals = positionalValues[0] === 'preview'
    ? positionalValues.slice(1)
    : positionalValues;
  const positionalObjective = dynamicPositionals.join(' ').trim();
  if (positionalValues[0] === 'launch') {
    const result = service.launchSavedWorkflow(
      readFlexibleStringFlag(rawArgs, 'workflow-id') || positionalValues[1] || '',
      { approvalId: readFlexibleStringFlag(rawArgs, 'approval-id') || readFlexibleStringFlag(rawArgs, 'approval') },
    );
    if (rawArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      process.stdout.write([
        'Zavorth Dynamic Workflow Launch',
        `status: ${result.status}`,
        `workflow: ${result.workflowId}`,
        `receipt: ${result.receiptId || 'none'}`,
        result.reason ? `reason: ${result.reason}` : null,
      ].filter((line): line is string => Boolean(line)).join('\n'));
      process.stdout.write('\n');
    }
    return result.status === 'blocked' && rawArgs.includes('--require-pass') ? 1 : 0;
  }
  const toNumber = (value: string | null): number | null => {
    if (!value) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const snapshot = service.buildPreview({
    objective: readFlexibleStringFlag(rawArgs, 'objective')
      || readFlexibleStringFlag(rawArgs, 'request')
      || positionalObjective,
    requestedFanout: toNumber(readFlexibleStringFlag(rawArgs, 'fanout') || readFlexibleStringFlag(rawArgs, 'workers')),
    maxConcurrency: toNumber(readFlexibleStringFlag(rawArgs, 'max-concurrency') || readFlexibleStringFlag(rawArgs, 'concurrency')),
    maxCents: toNumber(readFlexibleStringFlag(rawArgs, 'max-cents') || readFlexibleStringFlag(rawArgs, 'budget-cents')),
    workerModelClass: readFlexibleStringFlag(rawArgs, 'worker-model') || readFlexibleStringFlag(rawArgs, 'worker-model-class'),
    synthesisModelClass: readFlexibleStringFlag(rawArgs, 'synthesis-model') || readFlexibleStringFlag(rawArgs, 'synthesis-model-class'),
  });
  const previewRegistry = service.savePreview(snapshot);

  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify({ ...snapshot, previewRegistry }, null, 2)}\n`);
  } else {
    process.stdout.write(`${service.renderText(snapshot)}\npreview: ${previewRegistry.status} ${previewRegistry.receiptId || ''}\n`);
  }

  return snapshot.status === 'blocked' && rawArgs.includes('--require-pass') ? 1 : 0;
}

export async function runEffortControl(rawArgs: string[] = []): Promise<number> {
  const { ZavorthEffortControlService } = await import('../../services/ZavorthEffortControlService.js');
  const service = new ZavorthEffortControlService();
  const positional = collectEffortControlPositionals(rawArgs);
  const knownLevel = /^(low|light|fast|standard|high|deep|heavy|ultra|ultra-code|ultra_code|ultracode|max|massive)$/i;
  const first = positional[0] || null;
  const level = readFlexibleStringFlag(rawArgs, 'level') || (first && knownLevel.test(first) ? first : null);
  const positionalRequest = positional.slice(level ? 1 : 0).join(' ').trim();
  const snapshot = service.buildSnapshot({
    level,
    request: readFlexibleStringFlag(rawArgs, 'request') || positionalRequest,
    profile: readFlexibleStringFlag(rawArgs, 'profile'),
    maxCents: readFlexibleStringFlag(rawArgs, 'max-cents') || readFlexibleStringFlag(rawArgs, 'budget-cents'),
  });

  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(`${service.renderText(snapshot)}\n`);
  }

  return 0;
}

export function collectEffortControlPositionals(rawArgs: string[]): string[] {
  const flagsWithValues = new Set(['level', 'request', 'profile', 'max-cents', 'budget-cents']);
  const positional: string[] = [];
  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index] || '';
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    const flagName = arg.slice(2).split('=')[0]?.toLowerCase() || '';
    if (!arg.includes('=') && flagsWithValues.has(flagName) && rawArgs[index + 1] && !rawArgs[index + 1].startsWith('--')) {
      index += 1;
    }
  }
  return positional;
}

export async function runProviderLongTailActivation(rawArgs: string[] = []): Promise<number> {
  return npmInherited(['exec', 'tsx', '--', 'scripts/provider-long-tail-activation.ts', ...rawArgs], projectRoot);
}

export async function runChannelLongTailActivation(rawArgs: string[] = []): Promise<number> {
  return npmInherited(['exec', 'tsx', '--', 'scripts/channel-long-tail-activation.ts', ...rawArgs], projectRoot);
}

export function normalizeMeshActivationArgs(kind: 'provider' | 'channel', action: string, args: string[]): string[] {
  const profile = action === 'canary' ? 'staging-live' : 'configured';
  const forwarded = ['--profile', profile, ...args.slice(1)];
  const hasTargetFlag = forwarded.some((arg) => arg === `--${kind}` || arg.startsWith(`--${kind}=`));
  const positional = args.slice(1).find((arg) => !arg.startsWith('--'));
  if (!hasTargetFlag && positional) {
    forwarded.push(`--${kind}`, positional);
  }
  return forwarded;
}

export function resolveProductizationView(rawArgs: string[]): 'all' | 'journey' | 'templates' | 'missions' | 'receipts' | 'sandbox' {
  const view = String(readFlexibleStringFlag(rawArgs, 'view') || rawArgs[0] || '').trim().toLowerCase();
  if (['journey', 'templates', 'missions', 'receipts', 'sandbox'].includes(view)) {
    return view as 'journey' | 'templates' | 'missions' | 'receipts' | 'sandbox';
  }
  return 'all';
}
