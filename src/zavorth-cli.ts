#!/usr/bin/env node
import {
  formatZavorthCertificationHelp,
  formatZavorthConsistencyPreparedNotice,
  isZavorthConsistencyStubCommand,
} from './cli/ZavorthCliCertificationCommands.js';
import {
  isZavorthLiveNamespaceCommand,
  runZavorthLiveNamespaceCommand,
} from './cli/ZavorthCliLiveNamespaces.js';
import { asErrorLike } from './utils/errorLike';
import { spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { formatCliHelp, resolveCliHelpTopic } from './cli/ZavorthCliSurfaceHelpers.js';
import { getCommandAliases } from './cli/locales/localeManager.js';
import {
  resolveZavorthSimpleCommand,
  type ZavorthSimpleCommandPlan,
} from './cli/SimpleCommandRouter.js';


import type { DiskMutationGateRequestedOperation } from './contracts/DiskMutationGateContract.js';
import { runDiskMutationGateCommand } from './cli/disk/ZavorthCliDiskMutationNamespace.js';
import { runProjectConstitutionCommand } from './cli/constitution/ZavorthCliConstitutionNamespace.js';
import { runMigrationUX } from './cli/MigrationCli.js';
import { runCapabilityFabricCli } from './cli/CapabilityFabricCli.js';
import { runReachFabricCli } from './cli/ReachFabricCli.js';
import { runPowerFabricCli } from './cli/PowerFabricCli.js';
import { runProductFabricCli } from './cli/ProductFabricCli.js';
import { runProofLedgerCli } from './cli/ProofLedgerCli.js';
import {
  runApprovalPresentationCli,
  shouldRunApprovalPresentationCli,
  normalizeApprovalPresentationArgs,
} from './cli/ApprovalPresentationCli.js';
import { runRiskBudgetCli } from './cli/RiskBudgetCli.js';
import { runChangePreviewCli } from './cli/ChangePreviewCli.js';
import { runMemoryPrivacyCli } from './cli/MemoryPrivacyCli.js';
import { runZavorthMinimalRuntimeNamespace } from './cli/ZavorthCliMinimalRuntimeNamespace.js';

import {
  PUBLIC_COMMANDS,
  args,
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
  simpleCommandPlan,
  spawnInherited,
  runSimpleCommandPlan,
} from './cli/ZavorthCliCommandRuntime.js';
import {
  runRuntimeResourceDoctor,
  runOperationalSecurityDoctor,
  runPremiumDoctor,
  runDiagnosticsExport,
  runPremiumHome,
  runZavorthHomeCommand,
  writeZavorthHomeEnvSelection,
  runZavorthEchoWakeCommand,
  runZavorthTasksCommand,
  runZavorthFriendlyWorkCommand,
  runPremiumHatch,
  runPremiumQuickStart,
  runPremiumApprovalDiff,
  runPremiumHud,
  resolveDailyHudArgs,
  runPremiumSetupStudio,
  runGitWorkflowCommand,
  runContinuousSecurityMonitor,
  runSecurityOperationalPreset,
  runMinimalKernel,
  runAiFirstOwnerControlledDefault,
  runPromotedScript,
} from './cli/ZavorthCliSystemCommands.js';
import {
  buildQuickSandboxHostReadiness,
  runProductizationProtectedRuntime,
  runExperienceProfiles,
  runConversationalSetup,
  runGuidedMissions,
  runCapabilityStore,
  runDoItWithMe,
  runTrustPanel,
  runTrustApprovalUxFinal,
  runAutonomySlider,
  runModelCostGuard,
  runVisualReceiptsV2,
  runSatelliteApprovalCompanion,
  runNaturalRuntimeQuestions,
  runZavorthControlExperienceHome,
  runRuntimeReadiness,
  runReadyToGo,
  runOneCommandOperatorCheck,
  runStayOnline,
  runSmartCommands,
  runExternalAgentOnboarding,
  runExternalAgentMigrationPack,
  runExternalAgentGateway,
  runCapabilityMesh,
  runAgentReview,
  runSkillCurator,
  runPersistentApprovals,
  runSkillExpansionPack,
  runCapabilityCertification,
  runProviderConsistency,
  runProviderCapabilityCatalog,
  runProviderCapabilityMatrix,
  runNativeIntegrations,
  runProviderChannelWizard,
  runChannelCapabilityCatalog,
  runChannelCapabilityAtlas,
  runChannelDeepening,
  runNativeLearningLoop,
  runZavorthConvergenceDoctor,
  runZavorthProductHardeningDoctor,
  silenceConsoleLogToStderr,
  runGatewayMatrix,
  runExecutionBackends,
  runSkillEcosystem,
  runAcp,
  buildAcpGenericChannelFrame,
  runRuntimeGuidedFixes,
  runRuntimeReadinessFix,
  runRuntimeReadinessFixProvider,
} from './cli/ZavorthCliExperienceCommands.js';
import {
  runCliExperienceConsistency,
  runExperienceLayerDailyUseCertification,
  runGatewaySpine,
  runUnifiedOnboarding,
  runSensitiveActionFlow,
  runProviderReadiness,
  runDynamicWorkflows,
  runEffortControl,
  collectEffortControlPositionals,
  runProviderLongTailActivation,
  runChannelLongTailActivation,
  normalizeMeshActivationArgs,
  resolveProductizationView,
  runInstanceCommand,
  writeInstanceEnv,
} from './cli/ZavorthCliRuntimeCommands.js';
async function runBuiltinLauncher(rawArgs: string[]): Promise<number | null> {
  const command = String(rawArgs[0] || '').trim().toLowerCase();
  const restArgs = rawArgs.slice(1);
  if (!command) {
    return null;
  }

  if (command === '--version' || command === '-v' || command === 'version') {
    process.stdout.write(`Zavorth ${readPackageVersion()}\n`);
    return 0;
  }

  if (command === '--help' || command === '-h' || command === 'help') {
    if (restArgs.includes('--json')) {
      return null;
    }
    return printBuiltinHelp(restArgs[0]);
  }

  if (command === 'workflows' && (restArgs.includes('--help') || restArgs.includes('-h'))) {
    return runDynamicWorkflows(['--help']);
  }

  // Universal Capability Fabric — absorb capabilities + import workspaces
  if (
    command === 'absorb'
    || command === 'capability-absorb'
    || command === 'capabilities-absorb'
    || command === 'fetch-capability'
    || command === 'import-workspace'
    || command === 'workspace-import'
    || command === 'universal-import'
  ) {
    return runCapabilityFabricCli(restArgs);
  }

  if (
    command === 'migrate'
    || command === 'workspace-migrate'
    || command === 'import-agent-home'
  ) {
    return runMigrationUX(restArgs);
  }

  if (
    command === 'reach'
    || command === 'reach-fabric'
    || command === 'channel-tiers'
    || command === 'node-mesh'
  ) {
    return runReachFabricCli(restArgs);
  }

  if (
    command === 'power'
    || command === 'power-fabric'
    || command === 'trusted-operator'
    || command === 'elastic-backends'
  ) {
    return runPowerFabricCli(restArgs);
  }

  if (
    command === 'product'
    || command === 'product-fabric'
    || command === 'productize'
    || command === 'daily-product'
  ) {
    return runProductFabricCli(restArgs);
  }

  if (
    command === 'proof'
    || command === 'proof-ledger'
    || command === 'trust-loop'
  ) {
    return runProofLedgerCli(restArgs);
  }

  // Trust Loop approval presentation facade (does not replace premium approve flow).
  if (
    command === 'approval-presentation'
    || command === 'approval-os'
    || shouldRunApprovalPresentationCli(command, restArgs)
  ) {
    const args = command === 'approval-presentation' || command === 'approval-os'
      ? restArgs
      : normalizeApprovalPresentationArgs(restArgs);
    return runApprovalPresentationCli(args);
  }

  // Trust Loop Risk Budget (compose autonomy/trusted-operator; do not replace them).
  if (command === 'risk-budget' || command === 'riskbudget') {
    return runRiskBudgetCli(restArgs);
  }
  if (command === 'budget' && String(restArgs[0] || '').trim().toLowerCase() !== 'runtime') {
    return runRiskBudgetCli(restArgs);
  }

  // Trust Loop change preview / counterfactual product face.
  if (
    command === 'change-preview'
    || command === 'preview-change'
    || command === 'what-changes'
  ) {
    return runChangePreviewCli(restArgs);
  }

  // Memory Privacy OS (Mnemos product narrative — does not replace dream/forget engine).
  if (
    command === 'memory-privacy'
    || command === 'memory-privacy-os'
    || command === 'privacy-memory'
  ) {
    return runMemoryPrivacyCli(restArgs);
  }

  const helpTopic = resolveCliHelpTopic(command);
  if (helpTopic !== 'root' && (restArgs.includes('--help') || restArgs.includes('-h'))) {
    return printBuiltinHelp(command);
  }

  if (command === 'advanced') {
    if (restArgs.length === 0 || restArgs.includes('--help') || restArgs.includes('-h')) {
      return printBuiltinHelp('advanced');
    }
    return runBuiltinLauncher(restArgs);
  }

  if (command === 'ops') {
    if (restArgs.length === 0 || restArgs.includes('--help') || restArgs.includes('-h')) {
      return printBuiltinHelp('ops');
    }
    return runBuiltinLauncher(restArgs);
  }

  if (command === 'dev') {
    if (restArgs.length === 0 || restArgs.includes('--help') || restArgs.includes('-h')) {
      return printCliPanel('Zavorth dev', [
        'Usage: zavorth dev [command]',
        '',
        'Developer and local QA helpers for maintainers.',
        '',
        'Commands:',
        '  test              Run the default CLI/runtime checks',
        '  test cli          Run CLI checks',
        '  test runtime      Run TypeScript runtime checks',
        '  build             Build the local package',
        '  install           Install local dependencies',
        '',
        'Examples:',
        '  zavorth dev test',
        '  zavorth dev build',
      ], 'info');
    }
    return runBuiltinLauncher(restArgs);
  }

  if (command === 'gateway') {
    const gatewayControlSubcommand = String(restArgs[0] || 'status').trim().toLowerCase();
    if ([
      'status',
      'providers',
      'models',
      'combos',
      'combo',
      'cache',
      'rate-limits',
      'rate-limit',
      'ratelimits',
      'doctor',
    ].includes(gatewayControlSubcommand)) {
      const { runZavorthCli } = await import('./cli/ZavorthCli.js');
      return runZavorthCli(['gateway', ...restArgs]);
    }
  }

  if (['todo', 'later', 'work', 'done', 'retry', 'cancel'].includes(command)) {
    return runZavorthFriendlyWorkCommand(command as 'todo' | 'later' | 'work' | 'done' | 'retry' | 'cancel', restArgs);
  }

  if (command === 'tasks' || command === 'task') {
    return runZavorthTasksCommand(restArgs);
  }

  if (command === 'memory' && ['encryption', 'encrypt', 'privacy', 'status', 'migrate', 'migration', 'preview', 'plan', 'apply', 'enable', 'rollback', 'restore'].includes(String(restArgs[0] || 'status').trim().toLowerCase())) {
    const { runZavorthMemoryEncryptionCommand } = await import('./cli/ZavorthMemoryEncryptionCommand.js');
    const memoryArgs = ['encryption', 'encrypt', 'privacy'].includes(String(restArgs[0] || '').trim().toLowerCase())
      ? restArgs.slice(1)
      : restArgs;
    return runZavorthMemoryEncryptionCommand(memoryArgs);
  }

  if (command === 'setup' || command === 'init') {
    if (restArgs.includes('--help') || restArgs.includes('-h')) {
      return printBuiltinHelp('onboard');
    }
    const firstArg = String(restArgs[0] || '').trim().toLowerCase();
    if (firstArg === 'legacy') {
      return runPromotedScript('setup-v3', restArgs.slice(1));
    }
    const sections = ['provider', 'channels', 'skills', 'memory', 'agent', 'hooks', 'search', 'gateway'];
    if (sections.includes(firstArg)) {
      return runPremiumSetupStudio(['--section', firstArg, ...restArgs.slice(1)]);
    }
    return runPremiumSetupStudio(restArgs);
  }

  if (isZavorthLiveNamespaceCommand(command)) {
    const result = await runZavorthLiveNamespaceCommand({ projectRoot, command, args: restArgs });
    process.stdout.write(result.output);
    return result.exitCode;
  }

  if (isZavorthConsistencyStubCommand(command)) {
    const help = formatZavorthCertificationHelp(command);
    if (restArgs.length === 0 || restArgs.includes('--help') || restArgs.includes('-h')) {
      process.stdout.write(help || '');
      return 0;
    }
    const notice = formatZavorthConsistencyPreparedNotice(command, restArgs);
    process.stdout.write(notice || help || '');
    return 0;
  }

  if (command === 'home') {
    const homeSubcommand = String(restArgs[0] || '').trim().toLowerCase();
    if (['status', 'doctor', 'migrate', 'switch'].includes(homeSubcommand) || restArgs.includes('--home') || restArgs.some((arg) => arg.startsWith('--home='))) {
      return runZavorthHomeCommand(restArgs);
    }
    return runPremiumHome(restArgs);
  }

  if (command === 'ask' || command === 'edit' || command === 'apply') {
    const { runZavorthCliActionMode } = await import('./cli/ZavorthCliActionMode.js');
    return runZavorthCliActionMode({ command, args: restArgs, cwd: process.cwd() });
  }

  if (command === 'chat' && restArgs.length > 0 && !restArgs.includes('--help') && !restArgs.includes('-h')) {
    const { runZavorthCliActionMode } = await import('./cli/ZavorthCliActionMode.js');
    return runZavorthCliActionMode({ command: 'chat', args: restArgs, cwd: process.cwd() });
  }

  if (command === 'chat' || command === 'session') {
    const { runZavorthCli } = await import('./cli/ZavorthCli.js');
    return runZavorthCli(restArgs);
  }

  if (command === 'tui') {
    return runPremiumHud(['runtime', ...restArgs]);
  }

  if (command === 'hud' || command === 'cockpit') {
    return runPremiumHud(resolveDailyHudArgs(restArgs));
  }

  if (command === 'hatch') {
    return runPremiumHatch(restArgs);
  }

  if (command === 'configure') {
    return runPremiumSetupStudio(restArgs);
  }

  if (command === 'constitution' || command === 'project-constitution') {
    return runProjectConstitutionCommand(restArgs);
  }

  if (command === 'disk' || command === 'disk-gate' || command === 'mutation-gate') {
    return runDiskMutationGateCommand(restArgs);
  }

  if (command === 'git-status') {
    return runGitWorkflowCommand('status', restArgs);
  }

  if (command === 'branch') {
    return runGitWorkflowCommand('branch', restArgs);
  }

  if (command === 'commit') {
    return runGitWorkflowCommand('commit', restArgs);
  }

  if (command === 'pr' || command === 'pull-request') {
    return runGitWorkflowCommand('pr', restArgs);
  }

  if (command === 'approve' || command === 'approval' || command === 'approvals') {
    if (restArgs.includes('--help') || restArgs.includes('-h')) {
      return printCliPanel('Zavorth approvals', [
        'Usage: zavorth approve [options] [approvalId]',
        '',
        'Review and decide governed actions. Approval never applies host changes by itself.',
        '',
        'Options:',
        '  -h, --help       Display help for command',
        '  --json           Output JSON when supported',
        '  --yes            Confirm the approval/rejection action',
        '',
        'Commands:',
        '  list             Show pending approvals',
        '  approve          Approve a plan only',
        '  reject           Reject a plan',
        '  diff             Inspect associated sandbox diff',
        '',
        'Examples:',
        '  zavorth approve',
        '    Show pending approvals.',
        '  zavorth approve <id> --yes',
        '    Approve a plan only; host application still follows policy.',
        '  zavorth diff <id>',
        '    Inspect the diff before deciding.',
        '',
        'Docs: zavorth help reference',
      ], 'warning');
    }
    const firstApprovalArg = String(restArgs[0] || '').trim().toLowerCase();
    if (command === 'approvals' && ['always', 'auto', 'policy', 'permito-sempre', 'break-glass'].includes(firstApprovalArg)) {
      return runPersistentApprovals(restArgs.slice(1));
    }
    return runPremiumApprovalDiff('approvals', restArgs);
  }

  if (command === 'diff' || command === 'diffs') {
    if (restArgs.includes('--help') || restArgs.includes('-h')) {
      return printCliPanel('Zavorth diff', [
        'Usage: zavorth diff [approvalId]',
        '',
        'Inspect sandbox changes before approving sensitive work.',
        '',
        'Examples:',
        '  zavorth diff',
        '    Show available governed diff previews.',
        '  zavorth diff <id>',
        '    Inspect one pending plan before deciding.',
        '  zavorth approve <id> --yes',
        '    Approve the plan after review.',
      ], 'info');
    }
    return runPremiumApprovalDiff('diff', restArgs);
  }

  if (command === 'onboard' || command === 'onboarding') {
    if (restArgs.includes('--help') || restArgs.includes('-h')) {
      return printBuiltinHelp('onboard');
    }
    if (['conversation', 'conversational', 'calibrate', 'profile'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
      return runConversationalSetup(restArgs.slice(1));
    }
    if (['journey', 'legacy', 'overview', 'doctor', 'templates', 'first-mission'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
      const forwarded = String(restArgs[0] || '').trim().toLowerCase() === 'journey'
        ? restArgs.slice(1)
        : restArgs;
      return runUnifiedOnboarding(forwarded);
    }
    if (['apply', 'run', 'setup'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
      return runPremiumSetupStudio(restArgs.slice(1));
    }
    return runPremiumSetupStudio(restArgs);
  }

  if (command === 'instance') {
    return runInstanceCommand(restArgs);
  }

  if (command === 'go') {
    if (restArgs.includes('--help') || restArgs.includes('-h')) {
      return printBuiltinHelp('go');
    }
    return runPromotedScript('ops-go', restArgs);
  }

  if (command === 'open' || command === 'control') {
    if (restArgs.includes('--help') || restArgs.includes('-h')) {
      return printBuiltinHelp('control');
    }
    return runPromotedScript('ops-go', restArgs);
  }

  if (command === 'start') {
    if (restArgs.includes('--help') || restArgs.includes('-h')) {
      return printBuiltinHelp('go');
    }
    return runPromotedScript('ops-go', restArgs);
  }

  if (command === 'memory-drafts' || command === 'memory-draft') {
    return npmInherited(['exec', 'tsx', '--', 'scripts/memory-drafts-run.ts', ...restArgs], projectRoot);
  }

  if (command === 'value-test' || command === 'value-tests') {
    return npmInherited(['exec', 'node', '--', 'scripts/value-test-all.mjs', ...restArgs], projectRoot);
  }

  if (command === 'killer' || command === 'killer-missions') {
    return npmInherited(['exec', 'tsx', '--', 'scripts/killer-missions-run.ts', ...restArgs], projectRoot);
  }

  if (command === 'demo') {
    if (restArgs.includes('--help') || restArgs.includes('-h')) {
      return printBuiltinHelp('demo');
    }
    return npmInherited(['exec', 'tsx', '--', 'scripts/zavorth-product-demo.ts', ...restArgs], projectRoot);
  }

  if (command === 'connectors' || command === 'connector') {
    if (restArgs.includes('--help') || restArgs.includes('-h')) {
      return printBuiltinHelp('connectors');
    }
    return npmInherited(['exec', 'tsx', '--', 'scripts/zavorth-connectors.ts', ...restArgs], projectRoot);
  }

  if (command === 'channels' || command === 'channel') {
    // [gateway channels] Product mirror for channel setup, proofs and readiness.
    const channelAction = String(restArgs[0] || '').trim().toLowerCase();
    const channelSubAction = String(restArgs[1] || '').trim().toLowerCase();
    const phase2Channels = new Set([
      'api',
      'bluebubbles',
      'cli',
      'clickclack',
      'discord',
      'email',
      'feishu',
      'googlechat',
      'home-assistant',
      'imessage',
      'instagram',
      'irc',
      'lark',
      'line',
      'matrix',
      'mattermost',
      'msteams',
      'nextcloud-talk',
      'nostr',
      'qqbot',
      'signal',
      'slack',
      'sms',
      'synology-chat',
      'telegram',
      'tlon',
      'twitch',
      'web',
      'webhooks',
      'wecom',
      'weixin',
      'whatsapp',
      'whatsapp-baileys',
      'whatsapp-cloud',
      'yuanbao',
      'zalo',
      'zalouser',
    ]);
    const phase2Actions = new Set([
      'doctor',
      'health',
      'inspect',
      'outbox',
      'pair',
      'pairing',
      'proof',
      'read',
      'send',
      'send-test',
      'setup',
      'status',
      'test',
    ]);
    if (restArgs.includes('--help') || restArgs.includes('-h')) {
      return printBuiltinHelp('channels');
    }
    if (['atlas', 'matrix', 'capability-atlas', 'capabilities', 'coverage'].includes(channelAction)) {
      return runChannelCapabilityAtlas(restArgs.slice(1));
    }
    if (['doctor', 'canary', 'activate'].includes(channelAction)) {
      return runChannelLongTailActivation(normalizeMeshActivationArgs('channel', channelAction, restArgs));
    }
    if (['catalog', 'list', 'all', 'inventory', 'status', 'coverage', 'deepening'].includes(channelAction)) {
      return runChannelDeepening(restArgs);
    }
    if (phase2Channels.has(channelAction) && (channelSubAction === '' || phase2Actions.has(channelSubAction))) {
      return runChannelDeepening(restArgs);
    }
    if ([
      'add',
      'setup',
      'configure',
      'telegram',
      'discord',
      'slack',
      'whatsapp',
      'signal',
      'email',
    ].includes(channelAction)) {
      return runProviderChannelWizard(['channels', ...restArgs]);
    }
    return runGatewayMatrix(restArgs);
  }

  if (command === 'templates') {
    if (restArgs.includes('--help') || restArgs.includes('-h')) {
      return printBuiltinHelp('templates');
    }
    if (restArgs.includes('--guided') || restArgs.includes('--experience')) {
      return runGuidedMissions(restArgs);
    }
    return runProductizationProtectedRuntime('templates', restArgs);
  }

  if (command === 'missions') {
    if (restArgs.includes('--help') || restArgs.includes('-h')) {
      return printBuiltinHelp('missions');
    }
    if (['guide', 'guided', 'catalog', 'recommend'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
      return runGuidedMissions(restArgs.slice(1));
    }
    return runProductizationProtectedRuntime('missions', restArgs);
  }

  if (command === 'receipts') {
    if (restArgs.includes('--help') || restArgs.includes('-h')) {
      return printBuiltinHelp('receipts');
    }
    return runProductizationProtectedRuntime('receipts', restArgs);
  }

  if (command === 'product' || command === 'daily-use') {
    return runProductizationProtectedRuntime(resolveProductizationView(restArgs), restArgs);
  }

  if (command === 'experience' || command === 'profile' || command === 'profiles') {
    return runExperienceProfiles(restArgs);
  }

  if (command === 'learn' || command === 'learning' || command === 'mnemos-learning' || command === 'native-learning-loop') {
    const first = String(restArgs[0] || '').trim().toLowerCase();
    const forwarded = first === 'loop' || first === 'status' || first === 'native' ? restArgs.slice(1) : restArgs;
    return runNativeLearningLoop(forwarded);
  }

  if (command === 'conversation' || command === 'conversational-setup' || command === 'calibrate') {
    return runConversationalSetup(restArgs);
  }

  if (command === 'guided-missions' || command === 'mission-guide') {
    return runGuidedMissions(restArgs);
  }

  if (command === 'capability-store' || command === 'store') {
    return runCapabilityStore(restArgs);
  }

  if (command === 'do-it-with-me' || command === 'with-me' || command === 'guide-me') {
    return runDoItWithMe(restArgs);
  }

  if (command === 'trust' || command === 'trust-approval' || command === 'approval-ux') {
    if (String(restArgs[0] || '').trim().toLowerCase() === 'budget') {
      return runRiskBudgetCli(restArgs.slice(1));
    }
    return runTrustApprovalUxFinal(restArgs);
  }

  if (command === 'trust-panel' || command === 'safety-panel') {
    if (String(restArgs[0] || '').trim().toLowerCase() === 'budget') {
      return runRiskBudgetCli(restArgs.slice(1));
    }
    return runTrustPanel(restArgs);
  }

  if (command === 'autonomy' || command === 'autonomy-slider') {
    return runAutonomySlider(restArgs);
  }

  if (command === 'model-cost' || command === 'cost-guard' || command === 'budget-guard') {
    return runModelCostGuard(restArgs);
  }

  if (command === 'workflows' || command === 'dynamic-workflows' || command === 'workflow') {
    if (command === 'workflows' && ['status', 'process'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
      const { runZavorthCli } = await import('./cli/ZavorthCli.js');
      return runZavorthCli(['workflows', ...restArgs]);
    }
    return runDynamicWorkflows(restArgs);
  }

  if (command === 'effort' || command === 'reasoning-effort' || command === 'thinking-effort') {
    return runEffortControl(restArgs);
  }

  if (command === 'visual-receipts' || command === 'receipts-v2') {
    return runVisualReceiptsV2(restArgs);
  }

  if (command === 'satellite-approvals' || command === 'satellite-approval' || command === 'mobile-approvals') {
    return runSatelliteApprovalCompanion(restArgs);
  }

  if (command === 'ask-runtime' || command === 'runtime-question' || command === 'runtime-ask') {
    return runNaturalRuntimeQuestions(restArgs);
  }

  if (command === 'zavorthControl-home' || command === 'experience-home' || command === 'zavorthControl-home') {
    return runZavorthControlExperienceHome(restArgs);
  }

  if (command === 'status' || command === 'ready' || command === 'ready-to-go') {
    if (restArgs.includes('--help') || restArgs.includes('-h')) {
      return printBuiltinHelp('status');
    }
    return runReadyToGo(restArgs);
  }

  if (
    command === 'operator-check'
    || command === 'operator'
    || command === 'opcheck'
    || command === 'one-check'
  ) {
    return runOneCommandOperatorCheck(restArgs);
  }

  if (command === 'stay-online' || command === 'stayonline') {
    return runStayOnline(restArgs);
  }

  if (
    command === 'smart-command'
    || command === 'smart-commands'
    || command === 'slash'
    || command === 'slash-command'
    || command === 'commands-certification'
  ) {
    return runSmartCommands(restArgs);
  }

  if ([
    'new',
    'reset',
    'model',
    'personality',
    'persona',
    'retry',
    'undo',
    'compress',
    'usage',
    'insights',
    'skills',
    'skill',
    'stop',
    'platforms',
    'sethome',
  ].includes(command)) {
    return runSmartCommands([`/${command}`, ...restArgs]);
  }

  if (command === 'acp' || command === 'acpx') {
    return runAcp(restArgs);
  }

  // agent import -> governed external agent migration pack
  if (
    (command === 'agent' || command === 'agents')
    && ['import', 'migrate', 'migration'].includes(String(restArgs[0] || '').trim().toLowerCase())
  ) {
    return runExternalAgentMigrationPack(restArgs.slice(1));
  }

  if (
    command === 'external-agent-migration'
    || command === 'external-agent-migration-pack'
    || command === 'agent-import'
    || command === 'agent-migrate'
    || command === 'agents-import'
  ) {
    return runExternalAgentMigrationPack(restArgs);
  }

  if (
    command === 'external-agent-onboarding'
    || command === 'agent-onboarding'
    || command === 'agents-onboarding'
  ) {
    return runExternalAgentOnboarding(restArgs);
  }

  if (
    command === 'external-agent'
    || command === 'external-agents'
    || command === 'agent-gateway'
    || command === 'agents-gateway'
  ) {
    return runExternalAgentGateway(restArgs);
  }

  if (
    command === 'capability-mesh'
    || command === 'capabilities-mesh'
    || command === 'skill-broker'
    || command === 'capability-broker'
  ) {
    return runCapabilityMesh(restArgs);
  }

  if (
    command === 'agent-review'
    || command === 'review'
    || command === 'code-review'
    || command === 'repo-review'
  ) {
    return runAgentReview(restArgs);
  }

  if (
    command === 'skill-curator'
    || command === 'skills-curator'
    || command === 'curator'
    || command === 'curate-skills'
  ) {
    return runSkillCurator(restArgs);
  }

  if (
    command === 'persistent-approvals'
    || command === 'approval-policy'
    || command === 'auto-approval'
    || command === 'always-allow'
    || command === 'permito-sempre'
    || command === 'break-glass'
    || command === 'modo-extremo'
    || command === 'responsabilidade-total'
  ) {
    return runPersistentApprovals(restArgs);
  }

  if (command === 'approvals' && ['always', 'auto', 'policy', 'permito-sempre', 'break-glass'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
    return runPersistentApprovals(restArgs.slice(1));
  }

  if (
    command === 'skill-expansion-pack'
    || command === 'skills-expansion-pack'
    || command === 'expand-skills'
    || command === 'absorb-skills'
  ) {
    return runSkillExpansionPack(restArgs);
  }

  if (command === 'capability-certification' || command === 'native-certification' || command === 'certification-pack') {
    return runCapabilityCertification(restArgs);
  }

  if (command === 'provider-certification' || command === 'providers-certification') {
    return runProviderConsistency(restArgs);
  }

  if (command === 'gateway-matrix' || command === 'channels-matrix') {
    return runGatewayMatrix(restArgs);
  }

  if (command === 'execution-backends' || command === 'backends' || command === 'sandbox-backends') {
    return runExecutionBackends(restArgs);
  }

  if (command === 'skill-ecosystem' || command === 'skills-ecosystem') {
    return runSkillEcosystem(restArgs);
  }

  if (command === 'readiness' || command === 'runtime-readiness') {
    return runRuntimeReadiness(restArgs);
  }

  if (command === 'daily' || command === 'cli-home' || command === 'start-here' || command === 'home') {
    return runCliExperienceConsistency(restArgs);
  }

  if (command === 'experience-certify' || command === 'daily-certify') {
    return runExperienceLayerDailyUseCertification(restArgs);
  }

  if (command === 'gateway') {
    const gatewayControlSubcommand = String(restArgs[0] || 'status').trim().toLowerCase();
    if ([
      'status',
      'providers',
      'models',
      'combos',
      'combo',
      'cache',
      'rate-limits',
      'rate-limit',
      'ratelimits',
      'doctor',
    ].includes(gatewayControlSubcommand)) {
      const { runZavorthCli } = await import('./cli/ZavorthCli.js');
      return runZavorthCli(['gateway', ...restArgs]);
    }
    if (String(restArgs[0] || '').trim().toLowerCase() === 'matrix') {
      return runGatewayMatrix(restArgs.slice(1));
    }
    if (restArgs.includes('--help') || restArgs.includes('-h')) {
      return printCliPanel('Zavorth AI Gateway', [
        'Usage:',
        '  zavorth gateway status',
        '  zavorth gateway providers',
        '  zavorth gateway models',
        '  zavorth gateway combos',
        '  zavorth gateway cache stats',
        '  zavorth gateway rate-limits',
        '  zavorth gateway doctor',
        '  zavorth gateway matrix',
        '',
        'Legacy runtime projections:',
        '  zavorth gateway sessions',
        '  zavorth gateway channels',
        '  zavorth gateway approvals',
        '  zavorth gateway receipts',
        '  zavorth gateway artifacts',
        '',
        'Shows provider readiness, active route, fallback, cache, cost, latency and health.',
        '',
        'Options:',
        '  --json    Print the same AI Gateway projection as JSON.',
      ], 'info');
    }
    return runGatewaySpine(restArgs);
  }

  if (command === 'preview' || command === 'sensitive-flow' || command === 'sensitive-action') {
    return runSensitiveActionFlow(restArgs);
  }

  if (command === 'providers' || command === 'models') {
    const providerAction = String(restArgs[0] || '').trim().toLowerCase();
    if (['doctor', 'canary', 'activate'].includes(providerAction)) {
      return runProviderLongTailActivation(normalizeMeshActivationArgs('provider', providerAction, restArgs));
    }
    if (restArgs.includes('--help') || restArgs.includes('-h')) {
      return printCliPanel('Zavorth models', [
        'Usage: zavorth models [options] [command]',
        '',
        'Model/provider discovery, readiness and configuration',
        '',
        'Options:',
        '  -h, --help       Display help for command',
        '  --json           Output JSON when supported',
        '',
        'Commands:',
        '  status           Show configured provider readiness',
        '  catalog          Show provider catalog and capabilities',
        '  matrix           Show canonical provider capability matrix',
        '  add              Configure a provider',
        '  add --discover   Auto-discover models from provider API',
        '  setup            Guided provider setup',
        '  switch           Change active provider/model',
        '  consistency           Show provider readiness inventory',
        '',
        'Examples:',
        '  zavorth models status',
        '  zavorth models catalog',
        '  zavorth models add --provider openai --model gpt-4.1',
        '  zavorth models add --discover --provider groq --base-url https://api.groq.com/openai/v1',
      ], 'info');
    }
    if (providerAction === 'consistency') {
      return runProviderConsistency(restArgs.slice(1));
    }
    if (['catalog', 'capabilities', 'capability-catalog', 'all', 'inventory'].includes(providerAction)) {
      return runProviderCapabilityCatalog(restArgs.slice(1));
    }
    if (['matrix', 'capability-matrix', 'coverage'].includes(providerAction)) {
      return runProviderCapabilityMatrix(restArgs.slice(1));
    }
    if (['add', 'setup', 'configure', 'switch'].includes(providerAction)) {
      return runProviderChannelWizard(['providers', ...restArgs]);
    }
    return runProviderReadiness(restArgs);
  }

  if (command === 'native' || command === 'integrations') {
    if (restArgs.includes('--help') || restArgs.includes('-h')) {
      return printCliPanel('Zavorth native', [
        'Usage: zavorth native [options] [command]',
        '',
        'Inspect native provider, channel and capability inventory.',
        '',
        'Options:',
        '  -h, --help       Display help for command',
        '  --json           Output JSON when supported',
        '',
        'Commands:',
        '  catalog          Show native-ready providers, channels and capabilities',
        '  list             Alias for catalog',
        '  ready            Show readiness-oriented inventory',
        '',
        'Examples:',
        '  zavorth native catalog',
        '    Inspect native adapters.',
        '  zavorth native catalog --json',
        '    Print machine-readable inventory.',
        '',
        'Docs: zavorth help reference',
      ], 'info');
    }
    const action = String(restArgs[0] || 'catalog').trim().toLowerCase();
    if (['catalog', 'list', 'inventory', 'ready'].includes(action)) {
      return runNativeIntegrations(restArgs.slice(1));
    }
  }

  if (command === 'diagnostics') {
    const action = String(restArgs[0] || '').trim().toLowerCase();
    if (action === 'export') {
      return runDiagnosticsExport(restArgs.slice(1));
    }
    return printCliPanel('Zavorth diagnostics', [
      'Usage: zavorth diagnostics export [options]',
      '',
      'Exports system diagnostics in a sanitized format.',
      '',
      'Options:',
      '  -o, --output=<path>   Custom output path for the JSON export file.',
      '  --json                Output raw JSON response to stdout.',
    ], 'info');
  }

  if (command === 'offline-gateway') {
    if (restArgs.includes('--help') || restArgs.includes('-h')) {
      return printCliPanel('Zavorth offline-gateway', [
        'Usage: zavorth offline-gateway [options]',
        '',
        'Runs an offline channel gateway dialogue session with local adapters.',
        '',
        'Options:',
        '  -h, --help           Display help for command',
        '  --channel=<channel>  Channel to run (slack, whatsapp, teams, imessage, signal, email, instagram, discord). Default: slack',
        '  --userId=<userId>    Sender user ID. Default: local-user',
        '  --chatId=<chatId>    Conversation/channel ID. Default: local-chat',
        '  --isGroup            Run a group message (defaults to false)',
        '',
        'Examples:',
        '  zavorth offline-gateway --channel=slack',
        '  zavorth offline-gateway --channel=whatsapp --userId=operator',
      ], 'info');
    }
    const { runZavorthLocalGatewayCommand } = await import('./cli/ZavorthLocalGatewayCommand.js');
    return runZavorthLocalGatewayCommand(restArgs);
  }

  if (command === 'doctor' && ['convergence', 'native-convergence'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
    return runZavorthConvergenceDoctor(restArgs.slice(1));
  }

  if (command === 'doctor' && ['product-hardening', 'hardening', 'maturity', 'product-maturity'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
    return runZavorthProductHardeningDoctor(restArgs.slice(1));
  }

  if (command === 'doctor') {
    const firstDoctorArg = String(restArgs.find((arg) => !arg.startsWith('--')) || '').trim().toLowerCase();
    const specializedDoctorTopics = new Set([
      'runtime',
      'security',
      'capabilities',
      'capability-registry',
      'profiles',
      'runtime-profiles',
      'contracts',
      'runtime-contracts',
      'activation',
      'capability-activation',
      'activation-ledger',
      'activation-receipts',
      'receipts',
      'activation-replay',
      'activation-rollback',
      'replay',
      'retention',
      'runtime-retention',
      'mode',
      'runtime-mode',
      'mode-governor',
      'sidecars',
      'sidecar-manager',
    ]);
    if (!firstDoctorArg || firstDoctorArg === 'premium') {
      return runPremiumDoctor(firstDoctorArg === 'premium' ? restArgs.slice(1) : restArgs);
    }
    if (!specializedDoctorTopics.has(firstDoctorArg) && !restArgs.includes('--simple') && !restArgs.includes('--advanced')) {
      return runPremiumDoctor(restArgs);
    }
  }

  if (
    command === 'doctor'
    && (restArgs.includes('--simple') || restArgs.includes('--advanced'))
  ) {
    return runProductizationProtectedRuntime('all', restArgs);
  }

  if (command === 'doctor' && String(restArgs[0] || '').trim().toLowerCase() === 'runtime') {
    return runRuntimeResourceDoctor(restArgs.slice(1), restArgs.includes('--budget') || restArgs.includes('--strict'));
  }

  if (
    command === 'doctor'
    && ['security'].includes(String(restArgs[0] || '').trim().toLowerCase())
  ) {
    return runOperationalSecurityDoctor(restArgs.slice(1));
  }

  if (
    command === 'security'
    && ['continuous', 'monitor', 'baseline'].includes(String(restArgs[0] || '').trim().toLowerCase())
  ) {
    return runContinuousSecurityMonitor(restArgs);
  }

  if (
    command === 'security'
    && ['preset', 'presets'].includes(String(restArgs[0] || '').trim().toLowerCase())
  ) {
    return runSecurityOperationalPreset(restArgs.slice(1));
  }

  if (
    command === 'security'
    && ['doctor', 'status', 'check'].includes(String(restArgs[0] || 'doctor').trim().toLowerCase())
  ) {
    return runOperationalSecurityDoctor(restArgs.slice(1));
  }

  if (command === 'budget' && String(restArgs[0] || '').trim().toLowerCase() === 'runtime') {
    return runRuntimeResourceDoctor(restArgs.slice(1), true);
  }

  if (
    (command === 'core' || command === 'start')
    && ['minimal', 'kernel'].includes(String(restArgs[0] || '').trim().toLowerCase())
  ) {
    return runMinimalKernel(restArgs.slice(1));
  }

  if (command === 'ai-first' || command === 'aifirst') {
    return runAiFirstOwnerControlledDefault(restArgs);
  }

  const minimalRuntimeExitCode = await runZavorthMinimalRuntimeNamespace({
    command,
    restArgs,
    projectRoot,
    logCliError,
    printCliPanel,
    readDurationMsFlag,
    readNumberFlag,
    readStringFlag,
  });
  if (minimalRuntimeExitCode !== null) {
    return minimalRuntimeExitCode;
  }

  if (command === 'echo' || command === 'voice' || command === 'voz') {
    if (String(restArgs[0] || '').trim().toLowerCase() === 'wake') {
      return runZavorthEchoWakeCommand(restArgs.slice(1));
    }
    return npmInherited(['start'], path.join(projectRoot, 'agent'));
  }

  if (command === 'serve' || command === 'server' || command === 'api') {
    if (runningFromDist) {
      return spawnInherited(process.execPath, [path.join(entryDir, 'gateway', 'index.js')], projectRoot);
    }
    return npmInherited(['exec', 'tsx', '--', 'src/gateway/index.ts'], projectRoot);
  }

  if (command === 'ui') {
    return spawnInherited(process.execPath, [path.join(projectRoot, 'scripts', 'start-echo-stack.mjs')], projectRoot);
  }

  if (isZavorthLiveNamespaceCommand(command)) {
    const result = await runZavorthLiveNamespaceCommand({
      projectRoot,
      command,
      args: restArgs,
    });
    process.stdout.write(result.output);
    return result.exitCode;
  }

  const suggestion = resolveCommandSuggestion(command);
  if (suggestion) {
    return printCommandSuggestion(command, suggestion);
  }

  return null;
}

function readPackageVersion(): string {
  try {
    const parsed = JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf8')) as { version?: string };
    return String(parsed.version || 'local');
  } catch {
    return 'local';
  }
}

function resolveCommandSuggestion(command: string): string[] | null {
  const normalized = String(command || '').trim().toLowerCase();
  if (normalized.length < 2 || normalized.includes(' ') || normalized.startsWith('-')) {
    return null;
  }
  if (PUBLIC_COMMANDS.includes(normalized)) {
    return null;
  }
  const prefixMatches = PUBLIC_COMMANDS
    .filter((item) => item.startsWith(normalized))
    .slice(0, 5);
  if (prefixMatches.length > 0) {
    return prefixMatches;
  }
  const nearMatches = PUBLIC_COMMANDS
    .map((item) => ({ item, distance: levenshtein(normalized, item) }))
    .filter((entry) => entry.distance <= 2)
    .sort((a, b) => a.distance - b.distance || a.item.localeCompare(b.item))
    .slice(0, 4)
    .map((entry) => entry.item);
  return nearMatches.length > 0 ? nearMatches : null;
}

async function printCommandSuggestion(command: string, suggestions: string[]): Promise<number> {
  const lines = [
    `Unknown command: ${command}`,
    '',
    'Did you mean...',
    ...suggestions.map((item) => `  zavorth ${item}`),
    '',
    `To send "${command}" as a message, use:`,
    `  zavorth ask "${command}"`,
  ].join('\n');
  if (process.stdout.isTTY && !process.argv.includes('--json')) {
    const { TerminalPanel } = await import('./cli/presentation/TerminalPanel.js');
    process.stdout.write(`${TerminalPanel.render(lines, {
      title: 'Command hint',
      type: 'warning',
      padding: 1,
      width: Math.max(56, Math.min(84, Number(process.stdout.columns || 86) - 4)),
    })}\n`);
  } else {
    process.stdout.write(`${lines}\n`);
  }
  return 1;
}

function levenshtein(a: string, b: string): number {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const temp = previous[j];
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diagonal = temp;
    }
  }
  return previous[b.length] ?? Math.max(a.length, b.length);
}

void runSimpleCommandPlan(simpleCommandPlan)
  .then((simpleExitCode) => simpleExitCode !== null ? simpleExitCode : runBuiltinLauncher(args))
  .then(async (handledExitCode) => {
    if (handledExitCode !== null) {
      return handledExitCode;
    }
    const { runZavorthCli } = await import('./cli/ZavorthCli.js');
    return runZavorthCli(args);
  })
  .then((exitCode) => {
    process.exit(exitCode);
  })
  .catch(async (error) => {
    const message = error instanceof Error ? error.message : String(error);
    const isTTY = process.stderr.isTTY && !process.argv.includes('--json');
    const isDebug = process.env.ZAVORTH_DEBUG === '1' || process.argv.includes('--debug') || process.argv.includes('--verbose');

    if (isTTY) {
      try {
        const { ZavorthSelfHealingUxService } = await import('./services/ZavorthSelfHealingUxService.js');
        const { formatZavorthSelfHealingProjection } = await import('./cli/ZavorthCliSelfHealingRenderer.js');
        const projection = new ZavorthSelfHealingUxService().buildProjection({
          attempted: `Run ${args.join(' ') || 'zavorth'}`,
          commandName: args[0] || null,
          commandText: args.join(' '),
          error,
          debug: isDebug,
        });
        process.stderr.write(`${formatZavorthSelfHealingProjection(projection)}\n`);
        if (isDebug && error instanceof Error && error.stack) {
          process.stderr.write(`\nDebug Stack Trace:\n${error.stack}\n`);
        }
      } catch {
        console.error([
          'Zavorth could not finish this command.',
          `Cause: ${message}`,
          'Zavorth can inspect the failure and propose a narrow repair before applying anything.',
          isDebug && error instanceof Error && error.stack ? `Debug:\n${error.stack}` : null,
        ].filter(Boolean).join('\n'));
      }
    } else {
      console.error([
        'Zavorth could not finish this command.',
        `Cause: ${message}`,
        'Zavorth can inspect the failure and propose a narrow repair before applying anything.',
        isDebug && error instanceof Error && error.stack ? `Debug:\n${error.stack}`
          : null,
      ].filter(Boolean).join('\n'));
    }
    process.exit(1);
  });
