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

import {
  silenceConsoleLogToStderr,
  runGatewayMatrix,
  runExecutionBackends,
  runSkillEcosystem,
  runAcp,
  buildAcpGenericChannelFrame,
  runRuntimeGuidedFixes,
  runRuntimeReadinessFix,
  runRuntimeReadinessFixProvider,
} from './ZavorthCliAcpCommands.js';
export {
  silenceConsoleLogToStderr,
  runGatewayMatrix,
  runExecutionBackends,
  runSkillEcosystem,
  runAcp,
  buildAcpGenericChannelFrame,
  runRuntimeGuidedFixes,
  runRuntimeReadinessFix,
  runRuntimeReadinessFixProvider,
} from './ZavorthCliAcpCommands.js';

export function buildQuickSandboxHostReadiness() {
  return {
    inspect: () => {
      const generatedAt = new Date().toISOString();
      return {
        gate: 'sandbox-host-readiness' as const,
        generatedAt,
        platform: process.platform,
        osRelease: 'quick-projection',
        summary: {
          ok: true,
          readyTiers: ['local-jail' as const],
          dormantTiers: ['docker' as const, 'gvisor' as const, 'firecracker' as const],
          unavailableStrongTiers: ['docker' as const, 'gvisor' as const, 'firecracker' as const],
          blockingIssues: [],
        },
        defaultPolicy: {
          strongSandboxReady: false,
          liveMutationDefault: 'dry-run-only' as const,
          safeWithoutStrongSandbox: ['read-only' as const, 'preview' as const, 'doctor' as const, 'receipt' as const],
          blockedWithoutStrongSandbox: ['workspace-write' as const, 'host-command' as const, 'network-write' as const, 'channel-send' as const, 'live-skill-apply' as const],
          explanation: 'Quick projection never claims live mutations; use advanced doctor to confirm Docker, gVisor or Firecracker.',
        },
        tiers: [
          {
            id: 'local-jail' as const,
            label: 'local jail sandbox',
            status: 'ready' as const,
            canRun: true,
            strongBoundary: false,
            startsOnRead: false as const,
            platform: process.platform,
            reasons: ['Quick projection keeps read-only and preview available without probing Docker.'],
            checks: [],
          },
          {
            id: 'docker' as const,
            label: 'Docker hardened sandbox',
            status: 'dormant' as const,
            canRun: false,
            strongBoundary: true,
            startsOnRead: false as const,
            platform: process.platform,
            reasons: ['Run zavorth doctor --advanced or zavorth product --view=sandbox --probe to inspect Docker.'],
            checks: [],
          },
          {
            id: 'gvisor' as const,
            label: 'gVisor runsc sandbox',
            status: 'dormant' as const,
            canRun: false,
            strongBoundary: true,
            startsOnRead: false as const,
            platform: process.platform,
            reasons: ['Run the advanced sandbox doctor for runtime-specific details.'],
            checks: [],
          },
          {
            id: 'firecracker' as const,
            label: 'Firecracker MicroVM sandbox',
            status: 'dormant' as const,
            canRun: false,
            strongBoundary: true,
            startsOnRead: false as const,
            platform: process.platform,
            reasons: ['Run the advanced sandbox doctor on a Linux/KVM-capable host.'],
            checks: [],
          },
        ],
        actions: ['Run zavorth doctor --advanced for a live sandbox probe.'],
        contracts: ['Quick product projections do not start Docker, VM, sidecar or persistent process.', 'Mutable actions remain dry-run unless a strong sandbox is confirmed.'],
      };
    },
  };
}

export async function runProductizationProtectedRuntime(view: 'all' | 'journey' | 'templates' | 'missions' | 'receipts' | 'sandbox', rawArgs: string[] = []): Promise<number> {
  const { ZavorthProductizationProtectedRuntimeService } = await import('../services/ZavorthProductizationProtectedRuntimeService.js');
  const shouldProbeSandbox = rawArgs.includes('--advanced') || rawArgs.includes('--probe');
  const service = new ZavorthProductizationProtectedRuntimeService(shouldProbeSandbox ? {} : { sandboxHostReadiness: buildQuickSandboxHostReadiness() });
  const detailMode = rawArgs.includes('--advanced') ? 'advanced' : rawArgs.includes('--simple') ? 'simple' : readFlexibleStringFlag(rawArgs, 'detail');
  const snapshot = service.buildSnapshot({
    dailyMode: readFlexibleStringFlag(rawArgs, 'mode'),
    detailMode,
    selectedTemplateId: readFlexibleStringFlag(rawArgs, 'template'),
    request: readFlexibleStringFlag(rawArgs, 'request'),
  });

  if (rawArgs.includes('--json')) {
    const payload = view === 'journey' ? snapshot.firstRun : view === 'templates' ? snapshot.templates : view === 'missions' ? snapshot.mission : view === 'receipts' ? snapshot.receipt : view === 'sandbox' ? snapshot.sandbox : snapshot;
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderText(snapshot, view));
  }

  return 0;
}

export async function runExperienceProfiles(rawArgs: string[] = []): Promise<number> {
  const { ZavorthExperienceProfileService } = await import('../services/ZavorthExperienceProfileService.js');
  const service = new ZavorthExperienceProfileService();
  const positionalIntent = rawArgs
    .filter((arg) => !arg.startsWith('--'))
    .join(' ')
    .trim();
  const contract = service.buildContract({
    profile: readFlexibleStringFlag(rawArgs, 'profile'),
    intent: readFlexibleStringFlag(rawArgs, 'intent') || positionalIntent,
    dailyMode: readFlexibleStringFlag(rawArgs, 'mode') || readFlexibleStringFlag(rawArgs, 'daily-mode'),
    detailMode: readFlexibleStringFlag(rawArgs, 'detail') || readFlexibleStringFlag(rawArgs, 'detail-mode'),
  });

  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(contract, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderText(contract));
  }

  return 0;
}

export async function runConversationalSetup(rawArgs: string[] = []): Promise<number> {
  const { ZavorthConversationalSetupService } = await import('../services/ZavorthConversationalSetupService.js');
  const service = new ZavorthConversationalSetupService();
  const positionalIntent = rawArgs
    .filter((arg) => !arg.startsWith('--'))
    .join(' ')
    .trim();
  const snapshot = service.buildSnapshot({
    agentName: readFlexibleStringFlag(rawArgs, 'agent-name'),
    userName: readFlexibleStringFlag(rawArgs, 'user-name'),
    preferredAddress: readFlexibleStringFlag(rawArgs, 'call-me') || readFlexibleStringFlag(rawArgs, 'preferred-address'),
    language: readFlexibleStringFlag(rawArgs, 'language') || readFlexibleStringFlag(rawArgs, 'lang'),
    primaryUse: readFlexibleStringFlag(rawArgs, 'primary-use') || readFlexibleStringFlag(rawArgs, 'use-case') || readFlexibleStringFlag(rawArgs, 'intent') || positionalIntent,
    intent: readFlexibleStringFlag(rawArgs, 'intent') || positionalIntent,
    experienceProfile: readFlexibleStringFlag(rawArgs, 'profile') || readFlexibleStringFlag(rawArgs, 'experience-profile'),
    detailLevel: readFlexibleStringFlag(rawArgs, 'detail') || readFlexibleStringFlag(rawArgs, 'detail-level'),
    approvalChannel: readFlexibleStringFlag(rawArgs, 'approval-channel') || readFlexibleStringFlag(rawArgs, 'approvals'),
    firstSafeMission: readFlexibleStringFlag(rawArgs, 'first-mission') || readFlexibleStringFlag(rawArgs, 'mission'),
    preferredTone: readFlexibleStringFlag(rawArgs, 'tone'),
    apply: rawArgs.includes('--apply'),
    confirmLocalProfile: rawArgs.includes('--confirm-local-profile') || rawArgs.includes('--yes'),
    completeBootstrap: rawArgs.includes('--complete-bootstrap'),
  });

  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderText(snapshot));
  }

  return snapshot.status === 'blocked' ? 2 : 0;
}

export async function runGuidedMissions(rawArgs: string[] = []): Promise<number> {
  const { ZavorthGuidedMissionsService } = await import('../services/ZavorthGuidedMissionsService.js');
  const service = new ZavorthGuidedMissionsService();
  const positionalIntent = rawArgs
    .filter((arg) => !arg.startsWith('--'))
    .join(' ')
    .trim();
  const snapshot = service.buildContract({
    profile: readFlexibleStringFlag(rawArgs, 'profile'),
    intent: readFlexibleStringFlag(rawArgs, 'intent') || positionalIntent,
    missionId: readFlexibleStringFlag(rawArgs, 'mission') || readFlexibleStringFlag(rawArgs, 'template'),
    category: readFlexibleStringFlag(rawArgs, 'category'),
  });

  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderText(snapshot));
  }

  return 0;
}

export async function runCapabilityStore(rawArgs: string[] = []): Promise<number> {
  const { ZavorthCapabilityStoreService } = await import('../services/ZavorthCapabilityStoreService.js');
  const service = new ZavorthCapabilityStoreService();
  const positionalQuery = rawArgs
    .filter((arg) => !arg.startsWith('--'))
    .join(' ')
    .trim();
  const snapshot = service.buildContract({
    query: readFlexibleStringFlag(rawArgs, 'query') || positionalQuery,
    category: readFlexibleStringFlag(rawArgs, 'category'),
    selectedId: readFlexibleStringFlag(rawArgs, 'select') || readFlexibleStringFlag(rawArgs, 'id'),
  });

  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderText(snapshot));
  }

  return 0;
}

export async function runDoItWithMe(rawArgs: string[] = []): Promise<number> {
  const { ZavorthDoItWithMeService } = await import('../services/ZavorthDoItWithMeService.js');
  const service = new ZavorthDoItWithMeService();
  const positionalRequest = rawArgs
    .filter((arg) => !arg.startsWith('--'))
    .join(' ')
    .trim();
  const snapshot = service.buildContract({
    request: readFlexibleStringFlag(rawArgs, 'request') || positionalRequest,
    capabilityId: readFlexibleStringFlag(rawArgs, 'capability') || readFlexibleStringFlag(rawArgs, 'select'),
    missionId: readFlexibleStringFlag(rawArgs, 'mission'),
    category: readFlexibleStringFlag(rawArgs, 'category'),
    profile: readFlexibleStringFlag(rawArgs, 'profile'),
  });

  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderText(snapshot));
  }

  return 0;
}

export async function runTrustPanel(rawArgs: string[] = []): Promise<number> {
  const { ZavorthTrustPanelService } = await import('../services/ZavorthTrustPanelService.js');
  const service = new ZavorthTrustPanelService();
  const positionalQuery = rawArgs
    .filter((arg) => !arg.startsWith('--'))
    .join(' ')
    .trim();
  const snapshot = service.buildContract({
    profile: readFlexibleStringFlag(rawArgs, 'profile'),
    query: readFlexibleStringFlag(rawArgs, 'query') || positionalQuery,
    category: readFlexibleStringFlag(rawArgs, 'category'),
  });

  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderText(snapshot));
  }

  return 0;
}

export async function runTrustApprovalUxFinal(rawArgs: string[] = []): Promise<number> {
  return npmInherited(['exec', 'tsx', '--', 'scripts/zavorth-trust-approval-ux-final.ts', ...rawArgs], projectRoot);
}

export async function runAutonomySlider(rawArgs: string[] = []): Promise<number> {
  const { ZavorthAutonomySliderService } = await import('../services/ZavorthAutonomySliderService.js');
  const service = new ZavorthAutonomySliderService();
  const positionalIntent = rawArgs
    .filter((arg) => !arg.startsWith('--'))
    .join(' ')
    .trim();
  const snapshot = service.buildContract({
    profile: readFlexibleStringFlag(rawArgs, 'profile'),
    level: readFlexibleStringFlag(rawArgs, 'level') || readFlexibleStringFlag(rawArgs, 'autonomy'),
    intent: readFlexibleStringFlag(rawArgs, 'intent') || positionalIntent,
  });

  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderText(snapshot));
  }

  return 0;
}

export async function runModelCostGuard(rawArgs: string[] = []): Promise<number> {
  const { ZavorthModelCostGuardService } = await import('../services/ZavorthModelCostGuardService.js');
  const service = new ZavorthModelCostGuardService();
  const positionalRequest = rawArgs
    .filter((arg) => !arg.startsWith('--'))
    .join(' ')
    .trim();
  const snapshot = service.buildContract({
    profile: readFlexibleStringFlag(rawArgs, 'profile'),
    autonomy: readFlexibleStringFlag(rawArgs, 'autonomy') || readFlexibleStringFlag(rawArgs, 'level'),
    request: readFlexibleStringFlag(rawArgs, 'request') || positionalRequest,
    maxCents: readFlexibleStringFlag(rawArgs, 'max-cents') || readFlexibleStringFlag(rawArgs, 'budget-cents'),
    provider: readFlexibleStringFlag(rawArgs, 'provider'),
  });

  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderText(snapshot));
  }

  return 0;
}

export async function runVisualReceiptsV2(rawArgs: string[] = []): Promise<number> {
  const { ZavorthVisualReceiptsV2Service } = await import('../services/ZavorthVisualReceiptsV2Service.js');
  const service = new ZavorthVisualReceiptsV2Service();
  const snapshot = service.buildSnapshot({
    includeAdvanced: rawArgs.includes('--advanced'),
    includeAdvancedStory: rawArgs.includes('--advanced-story') || rawArgs.includes('--advanced'),
  });

  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderText(snapshot));
  }

  return 0;
}

export async function runSatelliteApprovalCompanion(rawArgs: string[] = []): Promise<number> {
  const { ZavorthSatelliteApprovalCompanionService } = await import('../services/ZavorthSatelliteApprovalCompanionService.js');
  const service = new ZavorthSatelliteApprovalCompanionService();
  const snapshot = service.buildSnapshot({
    user: readFlexibleStringFlag(rawArgs, 'user') || 'local-operator',
    missionId: readFlexibleStringFlag(rawArgs, 'mission'),
    includeAdvanced: rawArgs.includes('--advanced'),
    includeAdvancedStory: rawArgs.includes('--advanced-story') || rawArgs.includes('--advanced'),
  });

  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderText(snapshot));
  }

  return 0;
}

export async function runNaturalRuntimeQuestions(rawArgs: string[] = []): Promise<number> {
  const { ZavorthNaturalRuntimeQuestionsService } = await import('../services/ZavorthNaturalRuntimeQuestionsService.js');
  const service = new ZavorthNaturalRuntimeQuestionsService();
  const positionalQuestion = rawArgs
    .filter((arg) => !arg.startsWith('--'))
    .join(' ')
    .trim();
  const snapshot = service.buildSnapshot({
    question: readFlexibleStringFlag(rawArgs, 'question') || positionalQuestion,
  });

  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderText(snapshot));
  }

  return 0;
}

export async function runZavorthControlExperienceHome(rawArgs: string[] = []): Promise<number> {
  const { ZavorthControlExperienceHomeService } = await import('../services/ZavorthControlExperienceHomeService.js');
  const service = new ZavorthControlExperienceHomeService();
  const snapshot = service.buildSnapshot();

  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderText(snapshot));
  }

  return 0;
}

export async function runRuntimeReadiness(rawArgs: string[] = []): Promise<number> {
  const action = String(rawArgs[0] || '')
    .trim()
    .toLowerCase();
  if (action === 'fixes' || rawArgs.includes('--fixes')) {
    return runRuntimeGuidedFixes(action === 'fixes' ? rawArgs.slice(1) : rawArgs);
  }
  if (action === 'fix') {
    return runRuntimeReadinessFix(rawArgs.slice(1));
  }
  const { ZavorthRuntimeReadinessService } = await import('../services/ZavorthRuntimeReadinessService.js');
  const { ZavorthRuntimeReadinessUxService } = await import('../services/ZavorthRuntimeReadinessUxService.js');
  const service = new ZavorthRuntimeReadinessService();
  const uxService = new ZavorthRuntimeReadinessUxService();
  const snapshot = await service.buildSnapshot({
    userId: readFlexibleStringFlag(rawArgs, 'user-id') || 'local-user',
    sessionId: readFlexibleStringFlag(rawArgs, 'session-id') || 'runtime-readiness',
    workspaceHint: readFlexibleStringFlag(rawArgs, 'workspace') || projectRoot,
  });
  const operatorUx = uxService.buildSnapshot(snapshot);

  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify({ ...snapshot, operatorUx }, null, 2)}\n`);
  } else if (rawArgs.includes('--technical') || rawArgs.includes('--raw')) {
    process.stdout.write(service.renderText(snapshot));
  } else {
    process.stdout.write(uxService.renderCli(operatorUx));
  }

  return snapshot.status === 'blocked' || ((rawArgs.includes('--require-pass') || rawArgs.includes('--strict')) && snapshot.status !== 'ready') ? 1 : 0;
}

export async function runReadyToGo(rawArgs: string[] = []): Promise<number> {
  if (rawArgs.includes('--watch') || rawArgs.includes('watch')) {
    return runStayOnline(rawArgs);
  }
  if (rawArgs.includes('--product') || rawArgs.includes('--certification') || rawArgs.includes('--final')) {
    const { ZavorthProductCertificationService } = await import('../services/ZavorthProductCertificationService.js');
    const service = new ZavorthProductCertificationService({
      projectRoot,
      includeDeepProductCheck: rawArgs.includes('--deep'),
    });
    const snapshot = await service.buildSnapshot();
    if (rawArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    } else {
      process.stdout.write(service.renderCli(snapshot));
    }
    return snapshot.status === 'blocked' || ((rawArgs.includes('--require-pass') || rawArgs.includes('--strict')) && snapshot.status !== 'ready') ? 1 : 0;
  }
  const { ZavorthReadyToGoService } = await import('../services/ZavorthReadyToGoService.js');
  const service = new ZavorthReadyToGoService();
  const snapshot = await service.buildSnapshot({
    refreshProviders: rawArgs.includes('--refresh-providers') || rawArgs.includes('--live'),
    includeAdvancedProviders: rawArgs.includes('--advanced'),
    userId: readFlexibleStringFlag(rawArgs, 'user-id') || 'local-user',
    sessionId: readFlexibleStringFlag(rawArgs, 'session-id') || 'ready-to-go',
    workspaceHint: readFlexibleStringFlag(rawArgs, 'workspace') || projectRoot,
  });
  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderCli(snapshot));
  }
  return snapshot.status === 'blocked' || ((rawArgs.includes('--require-pass') || rawArgs.includes('--strict')) && snapshot.status !== 'ready') ? 1 : 0;
}

export async function runOneCommandOperatorCheck(rawArgs: string[] = []): Promise<number> {
  const { ZavorthOneCommandOperatorCheckService } = await import('../services/ZavorthOneCommandOperatorCheckService.js');
  const service = new ZavorthOneCommandOperatorCheckService();
  const snapshot = await service.buildSnapshot({
    live: rawArgs.includes('--live'),
    strict: rawArgs.includes('--strict') || rawArgs.includes('--require-pass'),
    userId: readFlexibleStringFlag(rawArgs, 'user-id') || 'local-user',
    sessionId: readFlexibleStringFlag(rawArgs, 'session-id') || 'operator-check',
    workspaceHint: readFlexibleStringFlag(rawArgs, 'workspace') || projectRoot,
  });
  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderCli(snapshot));
  }
  return snapshot.status === 'blocked' || ((rawArgs.includes('--strict') || rawArgs.includes('--require-pass')) && snapshot.strictPass !== true) ? 1 : 0;
}

export async function runStayOnline(rawArgs: string[] = []): Promise<number> {
  return npmInherited(['exec', 'tsx', '--', 'scripts/zavorth-stay-online.ts', ...rawArgs], projectRoot);
}

export async function runSmartCommands(rawArgs: string[] = []): Promise<number> {
  return npmInherited(['exec', 'tsx', '--', 'scripts/zavorth-smart-commands.ts', ...rawArgs], projectRoot);
}

export async function runExternalAgentOnboarding(rawArgs: string[] = []): Promise<number> {
  return npmInherited(['exec', 'tsx', '--', 'scripts/zavorth-external-agent-onboarding.ts', ...rawArgs], projectRoot);
}

export async function runExternalAgentMigrationPack(rawArgs: string[] = []): Promise<number> {
  return npmInherited(['exec', 'tsx', '--', 'scripts/zavorth-external-agent-migration-pack.ts', ...rawArgs], projectRoot);
}

export async function runExternalAgentGateway(rawArgs: string[] = []): Promise<number> {
  return npmInherited(['exec', 'tsx', '--', 'scripts/zavorth-external-agent-gateway.ts', ...rawArgs], projectRoot);
}

export async function runCapabilityMesh(rawArgs: string[] = []): Promise<number> {
  return npmInherited(['exec', 'tsx', '--', 'scripts/zavorth-capability-mesh.ts', ...rawArgs], projectRoot);
}

export async function runAgentReview(rawArgs: string[] = []): Promise<number> {
  return npmInherited(['exec', 'tsx', '--', 'scripts/zavorth-agent-review.ts', ...rawArgs], projectRoot);
}

export async function runSkillCurator(rawArgs: string[] = []): Promise<number> {
  return npmInherited(['exec', 'tsx', '--', 'scripts/zavorth-skill-curator-live-loop.ts', ...rawArgs], projectRoot);
}

export async function runPersistentApprovals(rawArgs: string[] = []): Promise<number> {
  return npmInherited(['exec', 'tsx', '--', 'scripts/zavorth-persistent-approval-policy.ts', ...rawArgs], projectRoot);
}

export async function runSkillExpansionPack(rawArgs: string[] = []): Promise<number> {
  return npmInherited(['exec', 'tsx', '--', 'scripts/zavorth-skill-expansion-pack.ts', ...rawArgs], projectRoot);
}

export async function runCapabilityCertification(rawArgs: string[] = []): Promise<number> {
  return npmInherited(['exec', 'tsx', '--', 'scripts/zavorth-capability-certification.ts', ...rawArgs], projectRoot);
}

export async function runProviderConsistency(rawArgs: string[] = []): Promise<number> {
  return npmInherited(['exec', 'tsx', '--', 'scripts/zavorth-provider-certification.ts', ...rawArgs], projectRoot);
}

export async function runProviderCapabilityCatalog(rawArgs: string[] = []): Promise<number> {
  return npmInherited(['exec', 'tsx', '--', 'scripts/zavorth-provider-capability-catalog.ts', ...rawArgs], projectRoot);
}

export async function runProviderCapabilityMatrix(rawArgs: string[] = []): Promise<number> {
  return npmInherited(['exec', 'tsx', '--', 'scripts/zavorth-provider-capability-matrix.ts', ...rawArgs], projectRoot);
}

export async function runNativeIntegrations(rawArgs: string[] = []): Promise<number> {
  return npmInherited(['exec', 'tsx', '--', 'scripts/zavorth-native-integrations.ts', ...rawArgs], projectRoot);
}

export async function runProviderChannelWizard(rawArgs: string[] = []): Promise<number> {
  return npmInherited(['exec', 'tsx', '--', 'scripts/zavorth-provider-channel-wizard.ts', ...rawArgs], projectRoot);
}

export async function runChannelCapabilityCatalog(rawArgs: string[] = []): Promise<number> {
  const forwarded = rawArgs.includes('--json') ? ['--json'] : [];
  return npmInherited(['exec', 'tsx', '--', 'scripts/channel-long-tail-activation.ts', ...forwarded], projectRoot);
}

export async function runChannelCapabilityAtlas(rawArgs: string[] = []): Promise<number> {
  return npmInherited(['exec', 'tsx', '--', 'scripts/zavorth-channel-capability-atlas.ts', ...rawArgs], projectRoot);
}

export async function runChannelDeepening(rawArgs: string[] = []): Promise<number> {
  return npmInherited(['exec', 'tsx', '--', 'scripts/zavorth-channel-deepening.ts', ...rawArgs], projectRoot);
}

export async function runNativeLearningLoop(rawArgs: string[] = []): Promise<number> {
  return npmInherited(['exec', 'tsx', '--', 'scripts/zavorth-native-learning-loop.ts', ...rawArgs], projectRoot);
}

export async function runZavorthConvergenceDoctor(rawArgs: string[] = []): Promise<number> {
  const { ZavorthNativeConvergenceService } = await import('../services/ZavorthNativeConvergenceService.js');
  const restoreConsole = rawArgs.includes('--json') ? silenceConsoleLogToStderr() : () => undefined;
  const service = new ZavorthNativeConvergenceService({ projectRoot });
  const snapshot = await service.buildSnapshot();
  restoreConsole();
  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderText(snapshot));
  }
  return (rawArgs.includes('--strict') || rawArgs.includes('--require-pass')) && snapshot.status !== 'ready' ? 1 : 0;
}

export async function runZavorthProductHardeningDoctor(rawArgs: string[] = []): Promise<number> {
  const { ZavorthProductHardeningService } = await import('../services/ZavorthProductHardeningService.js');
  const restoreConsole = rawArgs.includes('--json') ? silenceConsoleLogToStderr() : () => undefined;
  const service = new ZavorthProductHardeningService({ projectRoot });
  const snapshot = await service.buildSnapshot();
  restoreConsole();
  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderText(snapshot));
  }
  return (rawArgs.includes('--strict') || rawArgs.includes('--require-pass')) && snapshot.status !== 'ready' ? 1 : 0;
}
