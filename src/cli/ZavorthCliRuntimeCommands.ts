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
import { runCapabilityFabricCli } from './CapabilityFabricCli.js';
import { runReachFabricCli } from './ReachFabricCli.js';
import { runPowerFabricCli } from './PowerFabricCli.js';
import { runProductFabricCli } from './ProductFabricCli.js';
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

export async function runCliExperienceConsistency(rawArgs: string[] = []): Promise<number> {
  if (!rawArgs.includes('--legacy')) {
    const { ZavorthCliTuiPolishService } = await import('../services/ZavorthCliTuiPolishService.js');
    const service = new ZavorthCliTuiPolishService();
    const snapshot = await service.buildSnapshot({
      refreshProviders: rawArgs.includes('--refresh-providers') || rawArgs.includes('--live'),
      includeAdvancedProviders: rawArgs.includes('--advanced'),
      userId: readFlexibleStringFlag(rawArgs, 'user-id') || 'local-user',
      sessionId: readFlexibleStringFlag(rawArgs, 'session-id') || 'cli-home',
      workspaceHint: readFlexibleStringFlag(rawArgs, 'workspace') || projectRoot,
    });
    if (rawArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    } else {
      process.stdout.write(service.renderCli(snapshot));
    }
    return snapshot.status === 'blocked' || ((rawArgs.includes('--require-pass') || rawArgs.includes('--strict')) && snapshot.status !== 'ready') ? 1 : 0;
  }

  const { ZavorthCliExperienceCertificationService } = await import('../services/ZavorthCliExperienceCertificationService.js');
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
  const { ZavorthExperienceLayerDailyUseCertificationService } = await import('../services/ZavorthExperienceLayerDailyUseCertificationService.js');
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
  const { GatewayChannelRegistryService } = await import('../services/GatewayChannelRegistryService.js');
  const { GatewaySpineService } = await import('../services/GatewaySpineService.js');
  const view = String(rawArgs[0] || 'status')
    .trim()
    .toLowerCase();
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
      view === 'sessions' ? snapshot.sessions : view === 'channels' ? snapshot.channels : view === 'approvals' ? snapshot.approvals : view === 'receipts' ? snapshot.receipts : view === 'artifacts' ? snapshot.artifacts : snapshot;
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return 0;
  }

  if (view === 'sessions') {
    return printCliPanel('Gateway sessions', [`total: ${snapshot.sessions.total}`, `active: ${snapshot.sessions.active}`, `source: ${snapshot.sessions.source}`], 'info');
  }
  if (view === 'channels') {
    return printCliPanel(
      'Gateway channels',
      [
        `total: ${snapshot.channels.summary.total}`,
        `ready: ${snapshot.channels.summary.ready}`,
        `partial: ${snapshot.channels.summary.partial}`,
        '',
        ...snapshot.channels.entries.map((entry) => `- ${entry.id}: ${entry.readiness} | ${entry.transport}`),
      ],
      'info',
    );
  }
  if (view === 'approvals') {
    return printCliPanel('Gateway approvals', [`pending: ${snapshot.approvals.pending}`, `total: ${snapshot.approvals.total}`, `source: ${snapshot.approvals.source}`], snapshot.approvals.pending > 0 ? 'warning' : 'success');
  }
  if (view === 'receipts') {
    return printCliPanel('Gateway receipts', [`total: ${snapshot.receipts.total}`, `source: ${snapshot.receipts.source}`], 'info');
  }
  if (view === 'artifacts') {
    return printCliPanel('Gateway artifacts', [`total: ${snapshot.artifacts.total}`, `source: ${snapshot.artifacts.source}`], 'info');
  }

  process.stdout.write(service.renderText(snapshot));
  return 0;
}

export async function runUnifiedOnboarding(rawArgs: string[] = []): Promise<number> {
  const { ProviderDoctorService } = await import('../services/ProviderDoctorService.js');
  const { ZavorthUnifiedOnboardingService } = await import('../services/ZavorthUnifiedOnboardingService.js');
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
  const view = String(rawArgs.find((arg) => !arg.startsWith('--')) || 'journey')
    .trim()
    .toLowerCase();

  if (rawArgs.includes('--json')) {
    const payload =
      view === 'templates'
        ? snapshot.templates
        : view === 'doctor'
          ? {
              status: snapshot.status,
              provider: snapshot.provider,
              sandbox: snapshot.sandbox,
              nextAction: snapshot.nextAction,
            }
          : view === 'first-mission'
            ? snapshot.safeDemo
            : snapshot;
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return 0;
  }

  if (view === 'templates') {
    return printCliPanel('Onboarding templates', [...snapshot.templates.map((template) => `- ${template.id}: ${template.label} | risk=${template.defaultRisk} | mutate=${template.requiresMutation ? 'yes' : 'no'}`)], 'info');
  }
  if (view === 'doctor') {
    return printCliPanel(
      'Onboarding doctor',
      [
        `status: ${snapshot.status}`,
        `provider: ${snapshot.provider.status}`,
        `provider ready: ${snapshot.provider.ready}`,
        `missing auth: ${snapshot.provider.missingAuth}`,
        `needs probe: ${snapshot.provider.needsProbe}`,
        `sandbox: ${snapshot.sandbox.status}`,
        `mutation mode: ${snapshot.sandbox.mutationMode}`,
        `next: ${snapshot.nextAction}`,
      ],
      snapshot.status === 'ready' ? 'success' : 'warning',
    );
  }
  if (view === 'first-mission') {
    return printCliPanel('Onboarding first mission', [snapshot.safeDemo.command, snapshot.safeDemo.summary], 'info');
  }

  process.stdout.write(service.renderText(snapshot));
  return 0;
}

export async function runSensitiveActionFlow(rawArgs: string[] = []): Promise<number> {
  const { ZavorthSensitiveActionFlowService } = await import('../services/ZavorthSensitiveActionFlowService.js');
  const service = new ZavorthSensitiveActionFlowService();
  const request = readFlexibleStringFlag(rawArgs, 'request') || rawArgs.filter((arg) => !arg.startsWith('--')).join(' ') || 'Review this workspace in read-only mode.';
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
  const action = String(rawArgs[0] || 'matrix')
    .trim()
    .toLowerCase();
  if (action === 'cockpit' || action === 'zavorthControl') {
    const { ZavorthControlProviderCockpitService } = await import('../services/ZavorthControlProviderCockpitService.js');
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
    const { ZavorthProviderSelectionUxService } = await import('../services/ZavorthProviderSelectionUxService.js');
    const service = new ZavorthProviderSelectionUxService();
    const target = readFlexibleStringFlag(rawArgs, 'provider') || readFlexibleStringFlag(rawArgs, 'target') || rawArgs[1];
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
    const { ZavorthProviderPreferencePersistenceService } = await import('../services/ZavorthProviderPreferencePersistenceService.js');
    const service = new ZavorthProviderPreferencePersistenceService();
    const target = readFlexibleStringFlag(rawArgs, 'provider') || readFlexibleStringFlag(rawArgs, 'target') || rawArgs[1];
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
    const { ZavorthProviderPreferencePersistenceService } = await import('../services/ZavorthProviderPreferencePersistenceService.js');
    const service = new ZavorthProviderPreferencePersistenceService();
    const preference = await service.readPreference();
    if (rawArgs.includes('--json')) {
      process.stdout.write(
        `${JSON.stringify(
          {
            surface: 'provider-preference',
            preference,
            safety: {
              rawSecretsSerialized: false,
              mutatesConfig: false,
            },
          },
          null,
          2,
        )}\n`,
      );
    } else {
      await printCliPanel('Provider preference', [`provider: ${preference?.providerId || 'none'}`, `model: ${preference?.modelId || 'none'}`, `receipt: ${preference?.receiptId || 'none'}`], preference ? 'success' : 'info');
    }
    return 0;
  }
  if (action === 'rollback') {
    const { ZavorthProviderPreferencePersistenceService } = await import('../services/ZavorthProviderPreferencePersistenceService.js');
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
    const { ZavorthControlVisualApprovalPackService } = await import('../services/ZavorthControlVisualApprovalPackService.js');
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
  const { ZavorthProviderReadinessMatrixService } = await import('../services/ZavorthProviderReadinessMatrixService.js');
  const { ZavorthProviderLiveProofStoreService } = await import('../services/ZavorthProviderLiveProofStoreService.js');
  const providerId = readFlexibleStringFlag(rawArgs, 'provider') || (action === 'test' ? rawArgs[1] : rawArgs.find((arg) => !arg.startsWith('--') && arg !== 'matrix' && arg !== 'live'));
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
    return printCliPanel(
      'Zavorth Dynamic Workflows',
      [
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
      ],
      'info',
    );
  }
  const { ZavorthDynamicWorkflowService } = await import('../services/ZavorthDynamicWorkflowService.js');
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
  const dynamicPositionals = positionalValues[0] === 'preview' ? positionalValues.slice(1) : positionalValues;
  const positionalObjective = dynamicPositionals.join(' ').trim();
  if (positionalValues[0] === 'launch') {
    const result = service.launchSavedWorkflow(readFlexibleStringFlag(rawArgs, 'workflow-id') || positionalValues[1] || '', { approvalId: readFlexibleStringFlag(rawArgs, 'approval-id') || readFlexibleStringFlag(rawArgs, 'approval') });
    if (rawArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      process.stdout.write(
        ['Zavorth Dynamic Workflow Launch', `status: ${result.status}`, `workflow: ${result.workflowId}`, `receipt: ${result.receiptId || 'none'}`, result.reason ? `reason: ${result.reason}` : null]
          .filter((line): line is string => Boolean(line))
          .join('\n'),
      );
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
    objective: readFlexibleStringFlag(rawArgs, 'objective') || readFlexibleStringFlag(rawArgs, 'request') || positionalObjective,
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
  const { ZavorthEffortControlService } = await import('../services/ZavorthEffortControlService.js');
  const service = new ZavorthEffortControlService();
  const positional = collectEffortControlPositionals(rawArgs);
  const knownLevel = /^(low|light|fast|standard|high|deep|heavy|ultra|ultra-code|ultra_code|ultracode|max|massive)$/i;
  const first = positional[0] || null;
  const level = readFlexibleStringFlag(rawArgs, 'level') || (first && knownLevel.test(first) ? first : null);
  const positionalRequest = positional
    .slice(level ? 1 : 0)
    .join(' ')
    .trim();
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
  const view = String(readFlexibleStringFlag(rawArgs, 'view') || rawArgs[0] || '')
    .trim()
    .toLowerCase();
  if (['journey', 'templates', 'missions', 'receipts', 'sandbox'].includes(view)) {
    return view as 'journey' | 'templates' | 'missions' | 'receipts' | 'sandbox';
  }
  return 'all';
}

export async function runInstanceCommand(rawArgs: string[]): Promise<number> {
  const { listInstances, createInstance, deleteInstance, getInstanceName, instanceExists } = await import('../services/ZavorthInstanceService.js');
  const { tCli, tCommon } = await import('../i18n/cli.js');
  const action = String(rawArgs[0] || 'list')
    .trim()
    .toLowerCase();
  const asJson = rawArgs.includes('--json');
  const name = readFlexibleStringFlag(rawArgs, 'name') || rawArgs[1] || null;

  if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
    await printCliPanel(
      tCli('instance.title'),
      [
        tCli('instance.description'),
        '',
        tCli('instance.usage'),
        `  zavorth instance list                ${tCli('instance.commands.list')}`,
        `  zavorth instance current             ${tCli('instance.commands.current')}`,
        `  zavorth instance create <name>       ${tCli('instance.commands.create')}`,
        `  zavorth instance delete <name>       ${tCli('instance.commands.delete')}`,
        '',
        tCli('instance.env_hint'),
        '',
        tCli('instance.examples'),
        tCli('instance.example_1'),
        tCli('instance.example_2'),
        tCli('instance.example_3'),
      ],
      'info',
    );
    return 0;
  }

  if (action === 'current' || action === 'status') {
    const current = getInstanceName(process.env);
    if (asJson) {
      process.stdout.write(`${JSON.stringify({ instance: current, isDefault: current === 'default' })}\n`);
    } else {
      const label = current === 'default' ? tCli('instance.current_default', { name: current }) : tCli('instance.current_instance', { name: current });
      process.stdout.write(`${label}\n`);
      process.stdout.write(`${tCli('instance.switch_hint')}\n`);
    }
    return 0;
  }

  if (action === 'list') {
    const instances = listInstances(projectRoot);
    if (asJson) {
      process.stdout.write(`${JSON.stringify(instances, null, 2)}\n`);
    } else {
      const lines = instances.map((inst) => {
        const marker = inst.name === getInstanceName(process.env) ? ' *' : '';
        const created = inst.createdAt ? ` ${tCli('instance.created_at', { date: inst.createdAt })}` : '';
        const flags = [inst.hasMemory ? tCli('instance.has_memory') : null, inst.hasConfig ? tCli('instance.has_config') : null, inst.hasCredentials ? tCli('instance.has_creds') : null].filter(Boolean).join(', ');
        return `  ${inst.name.padEnd(20)}${created}${flags ? ` [${flags}]` : ''}${marker}`;
      });
      process.stdout.write(`${tCli('instance.list_header', { count: String(instances.length) })}\n${lines.join('\n')}\n`);
      process.stdout.write(`\n${tCli('instance.list_marker')}\n`);
    }
    return 0;
  }

  if (action === 'create') {
    if (!name) {
      await logCliError(tCli('instance.name_required'), tCommon('errors.generic.unexpected'));
      return 1;
    }
    try {
      const info = createInstance(projectRoot, name);
      if (asJson) {
        process.stdout.write(`${JSON.stringify(info, null, 2)}\n`);
      } else {
        process.stdout.write(`${tCli('instance.created', { name, path: info.homeRoot })}\n`);
        process.stdout.write(`${tCli('instance.use_hint', { name })}\n`);
      }
      return 0;
    } catch (error: unknown) {
      const err = asErrorLike(error);
      await logCliError(err.message || String(err), 'Instance Error');
      return 1;
    }
  }

  if (action === 'delete' || action === 'remove') {
    if (!name) {
      await logCliError(tCli('instance.name_required'), tCommon('errors.generic.unexpected'));
      return 1;
    }
    if (name === getInstanceName(process.env)) {
      await logCliError(tCli('instance.delete_active'), 'Instance Error');
      return 1;
    }
    try {
      deleteInstance(projectRoot, name, rawArgs.includes('--force'));
      if (asJson) {
        process.stdout.write(`${JSON.stringify({ deleted: name })}\n`);
      } else {
        process.stdout.write(`${tCli('instance.deleted', { name })}\n`);
      }
      return 0;
    } catch (error: unknown) {
      const err = asErrorLike(error);
      await logCliError(err.message || String(err), 'Instance Error');
      return 1;
    }
  }

  if (action === 'switch') {
    if (!name) {
      await logCliError(tCli('instance.name_required'), tCli('instance.unknown_action', { action: 'switch' }));
      return 1;
    }
    if (!instanceExists(projectRoot, name)) {
      await logCliError(tCli('instance.switch_not_found', { name }), 'Instance Error');
      return 1;
    }
    const current = getInstanceName(process.env);
    if (current === name) {
      if (asJson) {
        process.stdout.write(`${JSON.stringify({ switched: name, changed: false })}\n`);
      } else {
        process.stdout.write(`${tCli('instance.switch_no_change', { name })}\n`);
      }
      return 0;
    }
    const result = writeInstanceEnv(projectRoot, name);
    if (asJson) {
      process.stdout.write(`${JSON.stringify({ switched: name, changed: result.written, envFile: result.envFile })}\n`);
    } else {
      if (result.written) {
        process.stdout.write(`${tCli('instance.switched', { name, path: result.envFile })}\n`);
        process.stdout.write(`${tCli('instance.use_hint', { name })}\n`);
      } else {
        process.stdout.write(`${tCli('instance.switched', { name, path: result.envFile })}\n`);
      }
    }
    return 0;
  }

  await logCliError(tCli('instance.unknown_action', { action }), 'Usage Error');
  return 1;
}

export function writeInstanceEnv(root: string, instanceName: string): { written: boolean; envFile: string; key: string } {
  const envFile = path.join(root, '.env');
  const key = 'ZAVORTH_INSTANCE';
  const nextLine = `${key}=${instanceName}`;
  let current = '';
  try {
    current = existsSync(envFile) ? readFileSync(envFile, 'utf8') : '';
  } catch {
    current = '';
  }
  const lines = current.split(/\r...\n/u);
  let changed = false;
  let seen = false;
  const next = lines.map((line) => {
    if (!line.trim() || line.trim().startsWith('#')) {
      return line;
    }
    if (/^ZAVORTH_INSTANCE\s*=/u.test(line)) {
      seen = true;
      if (line === nextLine) {
        return line;
      }
      changed = true;
      return nextLine;
    }
    return line;
  });
  if (!seen) {
    if (next.length > 0 && next[next.length - 1] !== '') {
      next.push('');
    }
    next.push(nextLine);
    changed = true;
  }
  if (!changed) {
    return { written: false, envFile, key };
  }
  writeFileSync(envFile, `${next.join('\n').replace(/\n+$/u, '')}\n`, 'utf8');
  return { written: true, envFile, key };
}
