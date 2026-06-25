import path from 'path';
import { resolveCliHelpTopic } from './ZavorthCliSurfaceHelpers.js';
import { resolveZavorthSimpleCommand } from './SimpleCommandRouter.js';
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
  readNumberFlag,
  readStringFlag,
  readFlexibleStringFlag,
  readStringListFlag,
  readTaskPositional,
  readDurationMsFlag,
  resolveCommandSuggestion,
  printCommandSuggestion
} from './ZavorthCliCommonInfrastructure.js';
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
  runExperienceProfiles, runConversationalSetup, runGuidedMissions, runCapabilityStore, runDoItWithMe, runTrustPanel, runTrustApprovalUxFinal, runAutonomySlider, runModelCostGuard, runVisualReceiptsV2, runSatelliteApprovalCompanion, runNaturalRuntimeQuestions, runDashboardExperienceHome, runRuntimeReadiness, runReadyToGo, runOneCommandOperatorCheck, runStayOnline, runSmartCommands, runExternalAgentOnboarding, runExternalAgentMigrationPack, runExternalAgentGateway, runAgentManager, runCapabilityMesh, runAgentReview, runSkillCurator, runPersistentApprovals, runSkillExpansionPack, runCapabilityCertification, runProviderConsistency, runProviderCapabilityCatalog, runProviderCapabilityMatrix, runNativeIntegrations, runProviderChannelWizard, runChannelCapabilityCatalog, runChannelCapabilityAtlas, runChannelDeepening, runNativeLearningLoop, runZavorthConvergenceDoctor, runZavorthProductHardeningDoctor, runGatewayMatrix, runExecutionBackends, runSkillEcosystem, runAcp, runRuntimeGuidedFixes, runRuntimeReadinessFix, runRuntimeReadinessFixProvider, runCliExperienceConsistency, runExperienceLayerDailyUseCertification, runGatewaySpine, runUnifiedOnboarding, runSensitiveActionFlow, runProviderReadiness, runDynamicWorkflows, runEffortControl, collectEffortControlPositionals, runProviderLongTailActivation, runChannelLongTailActivation, normalizeMeshActivationArgs, resolveProductizationView
} from './ZavorthCliPremiumHandlers.js';

export async function runBuiltinLauncherPart2(command: string, restArgs: string[], rawArgs: string[]): Promise<number | null> {
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
      const { runZavorthCli } = await import('./ZavorthCli.js');
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

  if (command === 'mock-gateway') {
    if (restArgs.includes('--help') || restArgs.includes('-h')) {
      return printCliPanel('Zavorth mock-gateway', [
        'Usage: zavorth mock-gateway [options]',
        '',
        'Simulates a channel gateway dialogue session offline using stub adapters.',
        '',
        'Options:',
        '  -h, --help           Display help for command',
        '  --channel=<channel>  Channel to mock (slack, whatsapp, teams, imessage, signal, email, instagram, discord). Default: slack',
        '  --userId=<userId>    Simulated sender user ID. Default: mock-user',
        '  --chatId=<chatId>    Simulated conversation/channel ID. Default: mock-chat',
        '  --isGroup            Simulate a group message (defaults to false)',
        '',
        'Examples:',
        '  zavorth mock-gateway --channel=slack',
        '  zavorth mock-gateway --channel=whatsapp --userId=operator',
      ], 'info');
    }
    const { runZavorthMockGatewayCommand } = await import('./ZavorthMockGatewayCommand.js');
    return runZavorthMockGatewayCommand(restArgs);
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
      'seguranca',
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
    && ['security', 'seguranca', 'seguranÃ§a'].includes(String(restArgs[0] || '').trim().toLowerCase())
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

  if (command === 'doctor' && ['capabilities', 'capability-registry'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
    const { MinimalCapabilityRegistry } = await import('../core/MinimalCapabilityRegistry.js');
    const { MinimalRuntimeProfileRegistry } = await import('../core/MinimalRuntimeProfileRegistry.js');
    const profileArg = restArgs.find((arg) => arg.startsWith('--profile='))?.split('=').slice(1).join('=')
      || process.env.ZAVORTH_RUNTIME_PROFILE
      || process.env.ZAVORTH_PROFILE
      || 'minimal';
    const profileDir = restArgs.find((arg) => arg.startsWith('--profile-dir='))?.split('=').slice(1).join('=')
      || path.join(projectRoot, 'config', 'runtime-profiles');
    const profileSnapshot = new MinimalRuntimeProfileRegistry({ profileDir }).load(profileArg);
    const manifestDir = restArgs.find((arg) => arg.startsWith('--manifest-dir='))?.split('=').slice(1).join('=')
      || path.join(projectRoot, 'config', 'capability-manifests');
    const snapshot = new MinimalCapabilityRegistry({
      manifestDir,
      profileId: profileSnapshot.selectedProfile.id,
      bootOverrides: profileSnapshot.selectedProfile.capabilityBootOverrides,
    }).load();
    if (restArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    } else {
      await printCliPanel('Capability registry doctor', [
        `profile: ${profileSnapshot.selectedProfile.id}`,
        `budget: ${profileSnapshot.selectedProfile.budgetProfile}`,
        `total: ${snapshot.total}`,
        `boot: ${snapshot.activeOnBoot}`,
        `on-demand: ${snapshot.onDemand}`,
        `sidecars: ${snapshot.sidecars}`,
        `disabled: ${snapshot.disabled}`,
        `invalid: ${snapshot.invalid}`,
        '',
        `capabilities: ${snapshot.capabilities.map((capability) => `${capability.id}:${capability.boot}`).join(', ')}`,
      ], snapshot.invalid > 0 ? 'warning' : 'success');
    }
    return snapshot.invalid > 0 ? 1 : 0;
  }

  if (command === 'doctor' && ['profiles', 'runtime-profiles'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
    const { MinimalRuntimeProfileRegistry } = await import('../core/MinimalRuntimeProfileRegistry.js');
    const profileArg = restArgs.find((arg) => arg.startsWith('--profile='))?.split('=').slice(1).join('=')
      || process.env.ZAVORTH_RUNTIME_PROFILE
      || process.env.ZAVORTH_PROFILE
      || 'minimal';
    const profileDir = restArgs.find((arg) => arg.startsWith('--profile-dir='))?.split('=').slice(1).join('=')
      || path.join(projectRoot, 'config', 'runtime-profiles');
    const snapshot = new MinimalRuntimeProfileRegistry({ profileDir }).load(profileArg);
    if (restArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    } else {
      const selected = snapshot.selectedProfile;
      await printCliPanel('Runtime profile doctor', [
        `selected: ${selected.id}`,
        `budget: ${selected.budgetProfile}`,
        `posture: ${selected.resourcePosture}`,
        `polling: ${selected.pollingMode}`,
        `maintenance: ${selected.maintenanceMode}`,
        `sidecars: ${selected.maxActiveSidecars}`,
        '',
        `overrides: ${Object.entries(selected.capabilityBootOverrides).map(([id, boot]) => `${id}:${boot}`).join(', ')}`,
      ], snapshot.invalid > 0 ? 'warning' : 'success');
    }
    return snapshot.invalid > 0 ? 1 : 0;
  }

  if (command === 'doctor' && ['contracts', 'runtime-contracts'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
    const { MinimalRuntimeContractService } = await import('../core/MinimalRuntimeContractService.js');
    const profileArg = restArgs.find((arg) => arg.startsWith('--profile='))?.split('=').slice(1).join('=')
      || process.env.ZAVORTH_RUNTIME_PROFILE
      || process.env.ZAVORTH_PROFILE
      || 'minimal';
    const manifestDir = restArgs.find((arg) => arg.startsWith('--manifest-dir='))?.split('=').slice(1).join('=')
      || path.join(projectRoot, 'config', 'capability-manifests');
    const profileDir = restArgs.find((arg) => arg.startsWith('--profile-dir='))?.split('=').slice(1).join('=')
      || path.join(projectRoot, 'config', 'runtime-profiles');
    const report = new MinimalRuntimeContractService({
      projectRoot,
      manifestDir,
      profileDir,
    }).buildReport(profileArg);
    if (restArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      await printCliPanel('Runtime contract doctor', [
        `status: ${report.status}`,
        `selected profile: ${report.selectedProfileId}`,
        `capabilities: declared ${report.capabilitySummary.declared} | manifest ${report.capabilitySummary.manifest} | boot ${report.capabilitySummary.activeOnBoot} | sidecars ${report.capabilitySummary.sidecars}`,
        `profiles: total ${report.profileSummary.total} | invalid ${report.profileSummary.invalid}`,
        '',
        ...report.issues.slice(0, 12).map((issue) => `! ${issue.severity} ${issue.id} ${issue.subject}: ${issue.message}`),
      ], report.status === 'failed' ? 'error' : report.status === 'warning' ? 'warning' : 'success');
    }
    return report.status === 'failed' || (restArgs.includes('--strict') && report.status === 'warning') ? 1 : 0;
  }

  if (command === 'doctor' && ['activation', 'capability-activation'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
    const { MinimalCapabilityActivationPlanner } = await import('../core/MinimalCapabilityActivationPlanner.js');
    const profileArg = restArgs.find((arg) => arg.startsWith('--profile='))?.split('=').slice(1).join('=')
      || process.env.ZAVORTH_RUNTIME_PROFILE
      || process.env.ZAVORTH_PROFILE
      || 'minimal';
    const manifestDir = restArgs.find((arg) => arg.startsWith('--manifest-dir='))?.split('=').slice(1).join('=')
      || path.join(projectRoot, 'config', 'capability-manifests');
    const profileDir = restArgs.find((arg) => arg.startsWith('--profile-dir='))?.split('=').slice(1).join('=')
      || path.join(projectRoot, 'config', 'runtime-profiles');
    const capabilityId = restArgs.find((arg) => arg.startsWith('--capability='))?.split('=').slice(1).join('=');
    const planner = new MinimalCapabilityActivationPlanner({
      projectRoot,
      manifestDir,
      profileDir,
      dataDir: path.join(projectRoot, 'data', 'runtime'),
    });
    if (capabilityId) {
      const result = await planner.activate(capabilityId, {
        profile: profileArg,
        apply: restArgs.includes('--apply'),
        operation: restArgs.includes('--apply') ? 'activate' : 'plan',
      });
      if (restArgs.includes('--json')) {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      } else {
        await printCliPanel('Capability activation doctor', [
          `profile: ${result.plan.profileId}`,
          `capability: ${result.plan.capabilityId}`,
          `status: ${result.plan.status}`,
          `mode: ${result.plan.mode}`,
          `action: ${result.plan.action}`,
          `result: ${result.message}`,
        ], ['blocked', 'missing'].includes(result.plan.status) ? 'warning' : 'success');
      }
      return restArgs.includes('--strict') && ['blocked', 'missing'].includes(result.plan.status) ? 1 : 0;
    }
    const report = planner.buildReport(profileArg);
    if (restArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      await printCliPanel('Capability activation doctor', [
        `status: ${report.status}`,
        `profile: ${report.profileId}`,
        `contract: ${report.contractStatus}`,
        `plans: total ${report.total} | active ${report.active} | ready ${report.ready} | manual ${report.manual} | disabled ${report.disabled} | invalid enabled ${report.invalidEnabled}`,
      ], report.status === 'failed' ? 'error' : report.invalidEnabled > 0 ? 'warning' : 'success');
    }
    return report.status === 'failed' || (restArgs.includes('--strict') && report.invalidEnabled > 0) ? 1 : 0;
  }

  if (command === 'doctor' && ['activation-ledger', 'activation-receipts', 'receipts'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
    const { MinimalCapabilityActivationLedger } = await import('../core/MinimalCapabilityActivationLedger.js');
    const profileArg = restArgs.find((arg) => arg.startsWith('--profile='))?.split('=').slice(1).join('=');
    const capabilityId = restArgs.find((arg) => arg.startsWith('--capability='))?.split('=').slice(1).join('=');
    const ledgerFile = restArgs.find((arg) => arg.startsWith('--ledger-file='))?.split('=').slice(1).join('=')
      || path.join(projectRoot, 'data', 'runtime', 'capability-activation-ledger.jsonl');
    const limit = readNumberFlag(restArgs, 'limit') || 20;
    const snapshot = new MinimalCapabilityActivationLedger({
      projectRoot,
      dataDir: path.join(projectRoot, 'data', 'runtime'),
      ledgerFile,
    }).buildSnapshot({ profile: profileArg || null, capability: capabilityId || null, limit });
    if (restArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    } else {
      await printCliPanel('Capability activation ledger', [
        `status: ${snapshot.status}`,
        `exists: ${snapshot.exists}`,
        `total: ${snapshot.total}`,
        `returned: ${snapshot.returned}`,
        `invalid lines: ${snapshot.invalidLines}`,
        `counts: plan ${snapshot.counts.plan} | activate ${snapshot.counts.activate} | dry-run ${snapshot.counts.dryRun} | applied ${snapshot.counts.applied}`,
        '',
        ...snapshot.receipts.slice(0, 10).map((receipt) =>
          `- ${receipt.createdAt} ${receipt.operation}/${receipt.profileId}/${receipt.capabilityId}: ${receipt.status}/${receipt.mode}`,
        ),
      ], snapshot.invalidLines > 0 ? 'warning' : 'success');
    }
    return restArgs.includes('--strict') && snapshot.invalidLines > 0 ? 1 : 0;
  }

  if (command === 'doctor' && ['activation-replay', 'activation-rollback', 'replay'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
    const { MinimalCapabilityActivationReplayService } = await import('../core/MinimalCapabilityActivationReplayService.js');
    const action = String(restArgs[0] || '').trim().toLowerCase() === 'activation-rollback' || restArgs.includes('--rollback')
      ? 'rollback'
      : 'replay';
    const profileArg = restArgs.find((arg) => arg.startsWith('--profile='))?.split('=').slice(1).join('=');
    const capabilityId = restArgs.find((arg) => arg.startsWith('--capability='))?.split('=').slice(1).join('=');
    const receiptId = restArgs.find((arg) => arg.startsWith('--receipt-id='))?.split('=').slice(1).join('=');
    const ledgerFile = restArgs.find((arg) => arg.startsWith('--ledger-file='))?.split('=').slice(1).join('=')
      || path.join(projectRoot, 'data', 'runtime', 'capability-activation-ledger.jsonl');
    const limit = readNumberFlag(restArgs, 'limit') || 20;
    const service = new MinimalCapabilityActivationReplayService({
      projectRoot,
      dataDir: path.join(projectRoot, 'data', 'runtime'),
      ledgerFile,
    });
    if (restArgs.includes('--execute') || restArgs.includes('--apply')) {
      const result = await service.execute(action, {
        profile: profileArg || null,
        capability: capabilityId || null,
        receiptId: receiptId || null,
        limit,
        apply: restArgs.includes('--apply'),
      });
      if (restArgs.includes('--json')) {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      } else {
        await printCliPanel('Capability activation replay', [
          `action: ${result.action}`,
          `apply: ${result.apply}`,
          `status: ${result.plan.status}`,
          `executable: ${result.plan.executable}`,
          `command: ${result.plan.command}`,
          `result: ${result.message}`,
        ], ['blocked', 'missing'].includes(result.plan.status) ? 'warning' : 'success');
      }
      return restArgs.includes('--strict') && ['blocked', 'missing'].includes(result.plan.status) ? 1 : 0;
    }
    const report = service.buildReport(action, {
      profile: profileArg || null,
      capability: capabilityId || null,
      receiptId: receiptId || null,
      limit,
    });
    if (restArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      await printCliPanel('Capability activation replay', [
        `action: ${report.action}`,
        `status: ${report.status}`,
        `total: ${report.total}`,
        `ready: ${report.ready}`,
        `noop: ${report.noop}`,
        `manual: ${report.manual}`,
        '',
        ...report.plans.slice(0, 10).map((plan) => `- ${plan.profileId}/${plan.capabilityId}: ${plan.status} | ${plan.message}`),
      ], report.status === 'failed' || report.blocked > 0 ? 'warning' : 'success');
    }
    return report.status === 'failed' || (restArgs.includes('--strict') && report.blocked > 0) ? 1 : 0;
  }

  return null;
}
