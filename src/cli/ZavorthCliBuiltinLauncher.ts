import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { resolveCliHelpTopic } from './ZavorthCliSurfaceHelpers.js';
import { getCommandAliases } from './locales/localeManager.js';
import { resolveZavorthSimpleCommand, type ZavorthSimpleCommandPlan } from './SimpleCommandRouter.js';
import {
  formatZavorthCertificationHelp,
  formatZavorthConsistencyPreparedNotice,
  isZavorthConsistencyStubCommand,
} from './ZavorthCliCertificationCommands.js';
import {
  isZavorthLiveNamespaceCommand,
  runZavorthLiveNamespaceCommand,
} from './ZavorthCliLiveNamespaces.js';
import { runDiskMutationGateCommand } from './disk/ZavorthCliDiskMutationNamespace.js';


import { runProjectConstitutionCommand } from './constitution/ZavorthCliConstitutionNamespace.js';
import { runBuiltinLauncherPart2 } from './ZavorthCliBuiltinLauncherPart2.js';
import { runBuiltinLauncherPart3 } from './ZavorthCliBuiltinLauncherPart3.js';
import { runMigrationUX } from './MigrationCli.js';
import { runCapabilityFabricCli } from './CapabilityFabricCli.js';
// LearnSkillCli is dynamically imported on the learn-skill path to keep launcher light.
import { runReachFabricCli } from './ReachFabricCli.js';
import { runPowerFabricCli } from './PowerFabricCli.js';
import { runProductFabricCli } from './ProductFabricCli.js';
import { runProofLedgerCli } from './ProofLedgerCli.js';
import {
  runApprovalPresentationCli,
  shouldRunApprovalPresentationCli,
  normalizeApprovalPresentationArgs,
} from './ApprovalPresentationCli.js';
import { runRiskBudgetCli } from './RiskBudgetCli.js';
import { runChangePreviewCli } from './ChangePreviewCli.js';
import { runMemoryPrivacyCli } from './MemoryPrivacyCli.js';
import { naturalizeCliArgv } from './CliNaturalConvention.js';
import {
  formatConnectHelp,
  resolveConnectIntent,
  resolveLearnIntent,
} from './ZavorthCliIntentCommands.js';

// Shared infrastructure imports
import {
  projectRoot,
  logCliError,
  printCliPanel,
  spawnInherited,
  npmInherited,
  readPackageVersion,
  entryDir,
  runningFromDist,
  printBuiltinHelp,
  printGeneralHelp,
  readNumberFlag,
  readStringFlag,
  readFlexibleStringFlag,
  readStringListFlag,
  readTaskPositional,
  readDurationMsFlag,
  resolveCommandSuggestion,
  printCommandSuggestion
} from './ZavorthCliCommonInfrastructure.js';

// Premium and sub-command handlers
import {
  runRuntimeResourceDoctor, runOperationalSecurityDoctor, runPremiumDoctor, runDiagnosticsExport,
  runPremiumHome, runZavorthHomeCommand, writeZavorthHomeEnvSelection,
  runZavorthEchoWakeCommand,
  runZavorthTasksCommand, runZavorthFriendlyWorkCommand,
  runPremiumHatch, runPremiumQuickStart, runPremiumApprovalDiff,
  runPremiumHud, resolveDailyHudArgs,
  runPremiumSetupStudio,
  runGitWorkflowCommand,
  runContinuousSecurityMonitor, runSecurityOperationalPreset, runMinimalKernel, runAiFirstOwnerControlledDefault,
  runPromotedScript, buildQuickSandboxHostReadiness,
  runProductizationProtectedRuntime,
  runExperienceProfiles, runConversationalSetup, runGuidedMissions, runCapabilityStore, runDoItWithMe, runTrustPanel, runTrustApprovalUxFinal, runAutonomySlider, runModelCostGuard, runVisualReceiptsV2, runSatelliteApprovalCompanion, runNaturalRuntimeQuestions, runZavorthControlExperienceHome, runRuntimeReadiness, runReadyToGo, runOneCommandOperatorCheck, runStayOnline, runSmartCommands, runExternalAgentOnboarding, runExternalAgentMigrationPack, runExternalAgentGateway, runAgentManager, runCapabilities, runCapabilityMesh, runAgentReview, runSkillCurator, runPersistentApprovals, runSkillExpansionPack, runCapabilityCertification, runProviderConsistency, runProviderCapabilityCatalog, runProviderCapabilityMatrix, runNativeIntegrations, runProviderChannelWizard, runChannelCapabilityCatalog, runChannelCapabilityAtlas, runChannelDeepening, runNativeLearningLoop, runZavorthConvergenceDoctor, runZavorthProductHardeningDoctor, runGatewayMatrix, runExecutionBackends, runSkillEcosystem, runAcp, runRuntimeGuidedFixes, runRuntimeReadinessFix, runRuntimeReadinessFixProvider, runCliExperienceConsistency, runExperienceLayerDailyUseCertification, runGatewaySpine, runUnifiedOnboarding, runSensitiveActionFlow, runProviderReadiness, runDynamicWorkflows, runEffortControl, collectEffortControlPositionals, runProviderLongTailActivation, runChannelLongTailActivation, normalizeMeshActivationArgs, resolveProductizationView
} from './ZavorthCliPremiumHandlers.js';

export async function runBuiltinLauncher(rawArgs: string[]): Promise<number | null> {
  // Same natural UX as chat: empty → home/status, free text → primary action.
  const naturalized = naturalizeCliArgv(rawArgs);
  const effectiveArgs = naturalized.argv;
  const command = String(effectiveArgs[0] || '').trim().toLowerCase();
  const restArgs = effectiveArgs.slice(1);
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

  // Skill-first learn UX (fabric absorb under the hood)
  if (
    command === 'learn-skill'
    || command === 'skill-learn'
    || command === 'learnskill'
    || (command === 'learn' && ['skill', 'skills', '--skill'].includes(String(restArgs[0] || '').trim().toLowerCase()))
  ) {
    const { runLearnSkillCli } = await import('./LearnSkillCli.js');
    const args = command === 'learn'
      ? restArgs.slice(1)
      : restArgs;
    return runLearnSkillCli(args);
  }

  // Session export + mid-session model route
  if (
    command === 'session'
    || command === 'sessions-export'
    || command === 'session-export'
  ) {
    const { runSessionSurfaceCli } = await import('./SessionSurfaceCli.js');
    const args = command === 'session'
      ? restArgs
      : ['export', ...restArgs];
    return runSessionSurfaceCli(args);
  }

  if (command === 'model' || command === 'session-model') {
    const { runSessionSurfaceCli } = await import('./SessionSurfaceCli.js');
    return runSessionSurfaceCli(['model', ...restArgs]);
  }

  // Multi-model consensus (user-owned panel; same as /consensus on channels)
  if (
    command === 'consensus'
    || command === 'deliberate'
    || command === 'multi-model'
    || command === 'moa'
  ) {
    const { runConsensusCli } = await import('./ConsensusCli.js');
    return runConsensusCli(restArgs);
  }

  // Residual: cost savings dashboard
  if (
    command === 'cost-savings'
    || command === 'cost-dashboard'
    || command === 'savings'
  ) {
    const { CostSavingsDashboardService } = await import('../services/CostSavingsDashboardService.js');
    const snap = new CostSavingsDashboardService().buildSnapshot();
    if (restArgs.includes('--json')) {
      console.log(JSON.stringify(snap, null, 2));
    } else {
      console.log('Zavorth Cost Savings Dashboard');
      console.log(snap.narrative);
      console.log(`Sessions: ${snap.sessionsScanned}`);
      console.log(`Calls: ${snap.totals.calls}`);
      console.log(`Tokens in/out: ${snap.totals.inputTokens}/${snap.totals.outputTokens}`);
      console.log(`Est. cost: $${snap.totals.estimatedCostUsd.toFixed(4)}`);
      console.log(`Est. savings vs frontier: $${snap.totals.estimatedSavingsUsd.toFixed(4)}`);
      if (typeof snap.totals.backgroundRouteCalls === 'number') {
        console.log(`Background cost-route calls: ${snap.totals.backgroundRouteCalls}`);
      }
      console.log(snap.backgroundRouteHint);
      for (const row of snap.byModel.slice(0, 12)) {
        console.log(`  - ${row.modelKey}: ${row.calls} call(s), ~$${row.estimatedCostUsd.toFixed(4)}`);
      }
    }
    return 0;
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
    || command === 'where'
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

  if (command === 'risk-budget' || command === 'riskbudget') {
    return runRiskBudgetCli(restArgs);
  }

  // Top-level budget → Risk Budget OS (preserve `budget runtime` for resource doctor in Part2).
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
      const { runZavorthCli } = await import('./ZavorthCli.js');
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
    const { runZavorthMemoryEncryptionCommand } = await import('./ZavorthMemoryEncryptionCommand.js');
    const memoryArgs = ['encryption', 'encrypt', 'privacy'].includes(String(restArgs[0] || '').trim().toLowerCase())
      ? restArgs.slice(1)
      : restArgs;
    return runZavorthMemoryEncryptionCommand(memoryArgs);
  }

  // Phase 2–3 intent verbs (before live namespaces steal `connect` / `learn`).
  if (command === 'connect' || command === 'conectar') {
    const route = resolveConnectIntent(restArgs);
    if (route.kind === 'help-connect') {
      process.stdout.write(`${formatConnectHelp()}\n`);
      return 0;
    }
    if (route.kind === 'providers') {
      return runBuiltinLauncher(['providers', ...route.args]);
    }
    if (route.kind === 'channels') {
      return runBuiltinLauncher(['channels', ...route.args]);
    }
    if (route.kind === 'connectors') {
      return runBuiltinLauncher(['connectors', ...route.args]);
    }
  }

  {
    const learnRoute = resolveLearnIntent(command, restArgs);
    if (learnRoute.kind === 'anyone') {
      const { spawnSync } = await import('node:child_process');
      const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
      const result = spawnSync(npxCmd, ['tsx', 'scripts/zavorth-anyone-agent-path.ts', ...learnRoute.args], {
        cwd: projectRoot,
        stdio: 'inherit',
        env: process.env,
        windowsHide: true,
        shell: process.platform === 'win32',
      });
      return typeof result.status === 'number' ? result.status : 1;
    }
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
    const { runZavorthCliActionMode } = await import('./ZavorthCliActionMode.js');
    return runZavorthCliActionMode({ command, args: restArgs, cwd: process.cwd() });
  }

  if (command === 'chat' && restArgs.length > 0 && !restArgs.includes('--help') && !restArgs.includes('-h')) {
    const { runZavorthCliActionMode } = await import('./ZavorthCliActionMode.js');
    return runZavorthCliActionMode({ command: 'chat', args: restArgs, cwd: process.cwd() });
  }

  if (command === 'chat' || command === 'session') {
    const { runZavorthCli } = await import('./ZavorthCli.js');
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

  if (command === 'quickstart' || command === 'configure') {
    return runPremiumQuickStart(restArgs);
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

  if (command === 'setup' || command === 'init') {
    if (restArgs.includes('--help') || restArgs.includes('-h')) {
      return printBuiltinHelp('onboard');
    }
    if (String(restArgs[0] || '').trim().toLowerCase() === 'legacy') {
      return runPromotedScript('setup-v3', restArgs.slice(1));
    }
    return runPremiumSetupStudio(restArgs);
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

  if (command === 'start' || command === 'quickstart') {
    if (restArgs.includes('--help') || restArgs.includes('-h')) {
      return printBuiltinHelp('go');
    }
    return runPromotedScript('ops-go', restArgs);
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

  if (command === 'mnemos-learning' || command === 'native-learning-loop'
    || ((command === 'learn' || command === 'learning') && resolveLearnIntent(command, restArgs).kind === 'passthrough')) {
    const first = String(restArgs[0] || '').trim().toLowerCase();
    const forwarded = first === 'loop' || first === 'status' || first === 'native' ? restArgs.slice(1) : restArgs;
    return runNativeLearningLoop(forwarded);
  }

  if (command === 'whatsapp-bridge' || command === 'wa-bridge') {
    const { spawnSync } = await import('node:child_process');
    const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    const result = spawnSync(npxCmd, ['tsx', 'scripts/zavorth-whatsapp-bridge.ts', ...restArgs], {
      cwd: projectRoot,
      stdio: 'inherit',
      env: process.env,
      windowsHide: true,
      shell: process.platform === 'win32',
    });
    return typeof result.status === 'number' ? result.status : 1;
  }

  if (command === 'anyone' || command === 'for-everyone' || command === 'qualquer-pessoa' || command === 'human-path') {
    const { spawnSync } = await import('node:child_process');
    const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    const result = spawnSync(npxCmd, ['tsx', 'scripts/zavorth-anyone-agent-path.ts', ...restArgs], {
      cwd: projectRoot,
      stdio: 'inherit',
      env: process.env,
      windowsHide: true,
      shell: process.platform === 'win32',
    });
    return typeof result.status === 'number' ? result.status : 1;
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
      const { runZavorthCli } = await import('./ZavorthCli.js');
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

  if (command === 'agent' && restArgs.length > 0) {
    const subCommand = String(restArgs[0] || '').trim().toLowerCase();
    if (['add', 'list', 'run', 'chain', 'discover'].includes(subCommand)) {
      return runAgentManager(subCommand, restArgs.slice(1));
    }
  }

  if (
    command === 'capabilities'
    || command === 'what-can-i-do'
    || command === 'what-can-you-do'
    || command === 'features'
  ) {
    return runCapabilities(restArgs);
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

  // Chain to Part 2
  const part2Result = await runBuiltinLauncherPart2(command, restArgs, effectiveArgs);
  if (part2Result !== null) {
    return part2Result;
  }

  // Chain to Part 3
  const part3Result = await runBuiltinLauncherPart3(command, restArgs, effectiveArgs);
  if (part3Result !== null) {
    return part3Result;
  }

  return null;
}

