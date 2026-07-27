#!/usr/bin/env node

import path from 'path';
import * as p from '@clack/prompts';
import color from 'picocolors';
import {
  formatZavorthOnboardBanner,
  formatZavorthOnboardNonInteractiveHint,
} from '../src/cli/ZavorthCliOnboardRenderer.js';
import { ZAVORTH_CLI_BRAND_NAME } from '../src/cli/ZavorthCliMascot.js';
import { formatZavorthFailureExplanation } from '../src/cli/ZavorthCliFailureExplanation.js';
import {
  ZAVORTH_SETUP_STUDIO_PROVIDER_OPTIONS,
  applyZavorthSetupStudioEnvPlan,
  buildZavorthSetupStudioPlan,
  resolveSetupStudioProvider,
} from '../src/cli/ZavorthSetupStudioService.js';
import {
  type ZavorthProviderLiveValidationResult,
  renderZavorthProviderLiveValidationResult,
  validateZavorthProviderLive,
  writeZavorthProviderLiveValidationProof,
} from '../src/cli/ZavorthProviderLiveValidationService.js';
import {
  FirstRunWorkspaceBootstrapProfileService,
} from '../src/services/FirstRunWorkspaceBootstrapProfileService.js';
import {
  buildZavorthSetupStudioDryRunScreen,
  buildZavorthSetupStudioSnapshot,
  renderZavorthSetupStudioSnapshot,
} from '../src/cli/setup-studio/index.js';
import type {
  ZavorthFirstRunBootstrapAnswers,
  ZavorthFirstRunMemoryMode,
  ZavorthFirstRunSafetyPosture,
  ZavorthFirstRunTonePreference,
} from '../src/contracts/FirstRunWorkspaceBootstrapContract.js';

type SetupFlags = {
  help: boolean;
  dryRun: boolean;
  json: boolean;
  nonInteractive: boolean;
};

type SetupStudioAnswers = ZavorthFirstRunBootstrapAnswers & {
  providerSecret?: string | null;
  providerLiveValidation?: ZavorthProviderLiveValidationResult | null;
  telegramBotToken?: string | null;
  telegramAllowedUserIds?: string | null;
  vaultScope: 'skip' | 'documents' | 'downloads' | 'custom' | 'whole-pc';
  scanDirs: string[];
};

const RAW_ARGS = process.argv.slice(2);
const SETUP_FLAGS = parseSetupFlags(RAW_ARGS);
const STORAGE_ROOT = path.resolve(process.env.ZAVORTH_FIRST_RUN_STORAGE_ROOT || process.cwd());
const WORKSPACE_ROOT = path.resolve(process.cwd());
const SETUP_CANCELLED_MESSAGE = 'Setup cancelled. Nothing was changed.';

class ZavorthFirstRunSetupWizard {
  private readonly interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY && !SETUP_FLAGS.nonInteractive);
  private readonly profileService = new FirstRunWorkspaceBootstrapProfileService({
    storageRoot: STORAGE_ROOT,
    defaultWorkspaceRoot: WORKSPACE_ROOT,
  });

  public async run(): Promise<void> {
    if (SETUP_FLAGS.help) {
      printSetupHelp(this.profileService);
      return;
    }

    if (SETUP_FLAGS.json) {
      this.printJsonPlan();
      return;
    }

    if (SETUP_FLAGS.dryRun) {
      this.printDryRun();
      return;
    }

    if (!this.interactive) {
      console.log(formatZavorthOnboardBanner({ currentModel: 'deferred' }));
      console.log(formatZavorthOnboardNonInteractiveHint());
      console.log('');
      console.log(formatZavorthFailureExplanation({
        kind: 'non-interactive-terminal',
        whatHappened: 'The setup wizard needs an interactive terminal before it can ask questions.',
        likelyCause: 'This process is running without a TTY or prompts were disabled.',
        nextStep: 'Open an interactive terminal, or preview the setup plan without writing files.',
        tryCommand: 'zavorth setup --dry-run',
      }));
      console.log('');
      console.log('Automation preview: zavorth setup --json --dry-run');
      return;
    }

    console.clear();
    console.log(formatZavorthOnboardBanner({ currentModel: 'deferred' }));
    p.intro(`${color.green(ZAVORTH_CLI_BRAND_NAME)} First Light`);

    const existingProfile = this.profileService.readProfile();
    let overwriteExisting = false;
    if (existingProfile) {
      const choice = await p.select({
        message: 'A first-use profile already exists for this workspace.',
        options: [
          { value: 'view', label: 'View summary and exit', hint: 'No files are changed.' },
          { value: 'update', label: 'Update profile', hint: 'Shows a review before writing.' },
          { value: 'cancel', label: 'Cancel', hint: 'Keeps the current setup.' },
        ],
        initialValue: 'view',
      });
      if (p.isCancel(choice) || choice === 'cancel') {
        p.cancel(SETUP_CANCELLED_MESSAGE);
        return;
      }
      if (choice === 'view') {
        p.note([
          `User: ${existingProfile.preferredAddress}`,
          `Agent: ${existingProfile.agentDisplayName}`,
          `Workspace: ${existingProfile.workspaceRoot}`,
          `Mnemos: ${existingProfile.memoryMode}`,
          `Safety: ${existingProfile.safetyPosture}`,
        ].join('\n'), 'Current profile');
        return;
      }
      overwriteExisting = true;
    }

    const answers = await this.collectAnswers();
    const profileAnswers = this.toProfileAnswers(answers);
    const plan = this.profileService.buildPlan(profileAnswers, { overwriteExisting });
    const studioPlan = buildZavorthSetupStudioPlan({
      projectRoot: STORAGE_ROOT,
      providerId: String(answers.providerId || 'deferred'),
      modelId: answers.modelId,
      providerSecret: answers.providerSecret,
      telegramBotToken: answers.telegramBotToken,
      telegramAllowedUserIds: answers.telegramAllowedUserIds,
      memoryMode: answers.memoryMode as ZavorthFirstRunMemoryMode,
      vaultScope: answers.vaultScope,
      scanDirs: answers.scanDirs,
    });
    p.note(renderPlanSummary(plan, {
      provider: `${studioPlan.provider.id} / ${studioPlan.provider.modelId}`,
      envUpdateCount: studioPlan.envUpdates.length,
      memory: `${answers.memoryMode} / ${answers.vaultScope}`,
      telegram: answers.telegramBotToken ? 'configured with redacted token' : 'skip',
    }), 'First Light review');

    const confirmed = await p.confirm({
      message: 'Apply this First Light setup now...',
      initialValue: false,
    });
    if (p.isCancel(confirmed) || !confirmed) {
      const result = this.profileService.applyProfile(profileAnswers, {
        confirmed: false,
        overwriteExisting,
      });
      p.cancel(result.summary.join('\n'));
      return;
    }

    const result = this.profileService.applyProfile(profileAnswers, {
      confirmed: true,
      overwriteExisting,
    });
    if (result.status !== 'applied') {
      p.cancel(result.summary.join('\n'));
      return;
    }

    const envResult = applyZavorthSetupStudioEnvPlan(studioPlan);
    const proofResult = writeZavorthProviderLiveValidationProof(STORAGE_ROOT, answers.providerLiveValidation);

    p.outro([
      ...result.summary,
      envResult.written ? `First Light updated .env: ${envResult.keys.join(', ')}` : 'First Light did not need to update .env.',
      renderZavorthProviderLiveValidationResult(answers.providerLiveValidation),
      proofResult.written && proofResult.path ? `Sanitized proof: ${proofResult.path}` : 'Live proof: not written.',
      '',
      'Next:',
      ...result.nextCommands.map((command) => `  ${command}`),
    ].join('\n'));
  }

  private async collectAnswers(): Promise<SetupStudioAnswers> {
    const preferredAddress = await this.text({
      message: 'What should Zavorth call you...',
      initialValue: '',
      validate: (input) => String(input || '').trim() ? undefined : 'Enter the name Zavorth should use for you.',
    });

    const agentDisplayName = await this.text({
      message: 'What should this workspace agent be called...',
      initialValue: 'Zavorth',
      validate: (input) => String(input || '').trim() ? undefined : 'Enter a name for this agent.',
    });

    const tonePreference = await this.select<ZavorthFirstRunTonePreference>({
      message: 'Which response style should Zavorth start with...',
      options: [
        { value: 'conciso', label: 'Concise', hint: 'Short, direct, minimal extra detail.' },
        { value: 'equilibrado', label: 'Balanced', hint: 'Recommended default.' },
        { value: 'detalhado', label: 'Detailed', hint: 'More context and rationale.' },
      ],
      initialValue: 'equilibrado',
    });

    const workspaceRoot = await this.text({
      message: 'What is the main workspace...',
      initialValue: WORKSPACE_ROOT,
      validate: (input) => String(input || '').trim() ? undefined : 'Enter a workspace path.',
    });

    const providerId = await this.select<string>({
      message: 'Which model provider should be prepared...',
      options: ZAVORTH_SETUP_STUDIO_PROVIDER_OPTIONS.map((provider) => ({
        value: provider.id,
        label: provider.label,
        hint: provider.needsSecret ? 'Secret can be captured now.' : 'No secret required.',
      })),
      initialValue: 'deferred',
    });

    const provider = resolveSetupStudioProvider(providerId);
    let modelId = provider.defaultModel;
    if (providerId !== 'deferred') {
      modelId = await this.text({
        message: 'Which model should be the default for this provider...',
        initialValue: provider.defaultModel,
        validate: (input) => String(input || '').trim() ? undefined : 'Enter a model, or use model-not-selected.',
      });
    }

    let providerSecret: string | null = null;
    if (provider.needsSecret) {
      const shouldCaptureSecret = await p.confirm({
        message: `Enter the ${provider.label} key now...`,
        initialValue: false,
      });
      if (p.isCancel(shouldCaptureSecret)) {
        p.cancel(SETUP_CANCELLED_MESSAGE);
        process.exit(0);
      }
      if (shouldCaptureSecret) {
        providerSecret = await this.password({
          message: `Paste the ${provider.label} key. It will not be displayed.`,
          validate: (input) => String(input || '').trim() ? undefined : 'Paste the key, or go back and skip this step.',
        });
      }
    }
    const providerLiveValidation = await this.collectProviderLiveValidation({
      providerId,
      modelId,
      providerSecret,
      needsSecret: provider.needsSecret,
    });

    const memoryMode = await this.select<ZavorthFirstRunMemoryMode>({
      message: 'How should Mnemos local continuity work...',
      options: [
        { value: 'off', label: 'Off', hint: 'Do not record continuity.' },
        { value: 'local-metadata', label: 'local metadata', hint: 'Conservative default.' },
        { value: 'local-summary', label: 'local summary', hint: 'Keeps compact continuity notes.' },
      ],
      initialValue: 'local-metadata',
    });

    const vaultScope = await this.select<SetupStudioAnswers['vaultScope']>({
      message: 'Where may Mnemos look for documents...',
      options: [
        { value: 'skip', label: 'Configure later', hint: 'No vault scope yet.' },
        { value: 'documents', label: 'Documents', hint: 'Your Documents folder.' },
        { value: 'downloads', label: 'Downloads', hint: 'Useful for recent PDFs.' },
        { value: 'custom', label: 'Custom path', hint: 'You provide the folder.' },
        { value: 'whole-pc', label: 'Whole PC', hint: 'Broad scope; requires extra confirmation.' },
      ],
      initialValue: 'skip',
    });
    const scanDirs = await this.collectMnemosScanDirs(vaultScope);

    const safetyPosture = await this.select<ZavorthFirstRunSafetyPosture>({
      message: 'Which safety posture should be the default...',
      options: [
        { value: 'preview-first', label: 'Preview first', hint: 'Shows a plan before acting.' },
        { value: 'approval-required', label: 'Approval required', hint: 'Asks for approval more often.' },
        { value: 'local-only', label: 'local only', hint: 'Avoids external surfaces by default.' },
      ],
      initialValue: 'preview-first',
    });

    const configureTelegram = await p.confirm({
      message: 'Configure Telegram now...',
      initialValue: false,
    });
    if (p.isCancel(configureTelegram)) {
      p.cancel(SETUP_CANCELLED_MESSAGE);
      process.exit(0);
    }
    let telegramBotToken: string | null = null;
    let telegramAllowedUserIds: string | null = null;
    if (configureTelegram) {
      telegramBotToken = await this.password({
        message: 'Paste TELEGRAM_BOT_TOKEN. It will not be displayed.',
        validate: (input) => String(input || '').trim() ? undefined : 'Paste the token, or cancel to skip.',
      });
      telegramAllowedUserIds = await this.text({
        message: 'Which user IDs may use the bot... Separate with commas.',
        initialValue: '',
      });
    }

    return {
      userDisplayName: preferredAddress,
      preferredAddress,
      agentDisplayName,
      tonePreference,
      workspaceRoot,
      providerId,
      modelId,
      providerStatus: providerId === 'deferred' ? 'deferred' : 'configured-placeholder',
      memoryMode,
      safetyPosture,
      providerSecret,
      providerLiveValidation,
      telegramBotToken,
      telegramAllowedUserIds,
      vaultScope,
      scanDirs,
    };
  }

  private toProfileAnswers(answers: SetupStudioAnswers): ZavorthFirstRunBootstrapAnswers {
    return {
      userDisplayName: answers.userDisplayName,
      preferredAddress: answers.preferredAddress,
      agentDisplayName: answers.agentDisplayName,
      tonePreference: answers.tonePreference,
      workspaceRoot: answers.workspaceRoot,
      providerId: answers.providerId,
      modelId: answers.modelId,
      providerStatus: answers.providerStatus,
      memoryMode: answers.memoryMode,
      safetyPosture: answers.safetyPosture,
    };
  }

  private async collectMnemosScanDirs(vaultScope: SetupStudioAnswers['vaultScope']): Promise<string[]> {
    const home = process.env.USERPROFILE || process.env.HOME || WORKSPACE_ROOT;
    if (vaultScope === 'skip') {
      return [];
    }
    if (vaultScope === 'documents') {
      return [path.join(home, 'Documents')];
    }
    if (vaultScope === 'downloads') {
      return [path.join(home, 'Downloads')];
    }
    if (vaultScope === 'whole-pc') {
      p.note([
        'Scanning the whole PC can expose private files, caches, old downloads and sensitive data.',
        'Zavorth records this scope explicitly so you can review and revoke it later.',
      ].join('\n'), 'Broad Mnemos scope');
      const first = await p.confirm({
        message: 'Allow broad Mnemos scanning...',
        initialValue: false,
      });
      const second = !p.isCancel(first) && first ? await p.confirm({
        message: 'Final confirmation: register the whole PC as Mnemos scope...',
        initialValue: false,
      }) : false;
      if (p.isCancel(first) || p.isCancel(second) || !first || !second) {
        return [];
      }
      return [path.parse(WORKSPACE_ROOT).root || WORKSPACE_ROOT];
    }
    const custom = await this.text({
      message: 'Enter the exact Mnemos vault folder.',
      initialValue: path.join(home, 'Documents'),
      validate: (input) => String(input || '').trim() ? undefined : 'Enter a folder.',
    });
    return [custom];
  }

  private async collectProviderLiveValidation(input: {
    providerId: string;
    modelId: string;
    providerSecret: string | null;
    needsSecret: boolean;
  }): Promise<ZavorthProviderLiveValidationResult | null> {
    if (input.providerId === 'deferred') {
      return null;
    }
    if (input.needsSecret && !input.providerSecret) {
      return null;
    }
    const shouldTest = await p.confirm({
      message: 'Run a small live provider test now...',
      initialValue: false,
    });
    if (p.isCancel(shouldTest) || !shouldTest) {
      return null;
    }

    while (true) {
      const validation = await this.runProviderLiveValidation(input);
      p.note(renderZavorthProviderLiveValidationResult(validation), 'Provider live test');
      if (validation.status === 'passed' || validation.status === 'unsupported') {
        return validation;
      }
      const next = await p.select({
        message: 'The live test failed. How should First Light continue...',
        options: [
          { value: 'retry', label: 'Retry', hint: 'Repeats the ping with the same key/model.' },
          { value: 'save', label: 'Save anyway', hint: 'Writes config and stores sanitized failure proof.' },
          { value: 'skip', label: 'Skip test', hint: 'Writes config without live proof.' },
        ],
        initialValue: 'retry',
      });
      if (p.isCancel(next) || next === 'skip') {
        return null;
      }
      if (next === 'save') {
        return validation;
      }
    }
  }

  private async runProviderLiveValidation(input: {
    providerId: string;
    modelId: string;
    providerSecret: string | null;
  }): Promise<ZavorthProviderLiveValidationResult> {
    const spinner = p.spinner();
    spinner.start('Testing provider with a small live ping...');
    try {
      const validation = await validateZavorthProviderLive({
        projectRoot: STORAGE_ROOT,
        providerId: input.providerId,
        modelId: input.modelId,
        providerSecret: input.providerSecret,
        explicitUserConsent: true,
      });
      if (validation.status === 'passed') {
        spinner.stop('Provider validated.');
      } else {
        spinner.stop('Live test completed with attention.');
      }
      return validation;
    } catch (error: unknown) {
      spinner.stop('Live test failed.');
      throw error;
    }
  }

  private printDryRun(): void {
    const plan = this.profileService.buildPlan({}, {
      dryRun: true,
      nonInteractive: !this.interactive,
    });
    console.log(buildZavorthSetupStudioDryRunScreen({
      projectRoot: STORAGE_ROOT,
      providerId: plan.profile.provider.providerId,
      modelId: plan.profile.provider.modelId,
      memoryMode: plan.profile.memoryMode,
      vaultScope: 'skip',
      scanDirs: [],
      dryRun: true,
    }));
    void plan;
  }

  private printJsonPlan(): void {
    const plan = this.profileService.buildPlan({}, {
      dryRun: SETUP_FLAGS.dryRun || !this.interactive,
      nonInteractive: !this.interactive,
    });
    console.log(plan.redactedJson);
  }

  private async text(input: Parameters<typeof p.text>[0]): Promise<string> {
    const value = await p.text(input);
    if (p.isCancel(value)) {
      p.cancel(SETUP_CANCELLED_MESSAGE);
      process.exit(0);
    }
    return String(value || '').trim();
  }

  private async password(input: Parameters<typeof p.password>[0]): Promise<string> {
    const value = await p.password(input);
    if (p.isCancel(value)) {
      p.cancel(SETUP_CANCELLED_MESSAGE);
      process.exit(0);
    }
    return String(value || '').trim();
  }

  private async select<T extends string>(input: Parameters<typeof p.select>[0]): Promise<T> {
    const value = await p.select(input);
    if (p.isCancel(value)) {
      p.cancel(SETUP_CANCELLED_MESSAGE);
      process.exit(0);
    }
    return String(value || '').trim() as T;
  }
}

function parseSetupFlags(args: string[]): SetupFlags {
  const normalized = new Set(args.map((arg) => String(arg || '').trim().toLowerCase()));
  return {
    help: normalized.has('--help') || normalized.has('-h') || normalized.has('help'),
    dryRun: normalized.has('--dry-run') || normalized.has('dryrun'),
    json: normalized.has('--json'),
    nonInteractive: normalized.has('--non-interactive') || normalized.has('--noninteractive'),
  };
}

function renderPlanSummary(
  plan: ReturnType<FirstRunWorkspaceBootstrapProfileService['buildPlan']>,
  setup?: {
    provider: string;
    envUpdateCount: number;
    memory: string;
    telegram: string;
  },
): string {
  return [
    'First Light will prepare:',
    ...(setup ? [
      `- Provider: ${setup.provider}`,
      `- Mnemos: ${setup.memory}`,
      `- Telegram: ${setup.telegram}`,
      `- .env updates: ${setup.envUpdateCount} key(s), secrets redacted`,
      '',
    ] : []),
    'Profile files:',
    ...plan.writes.map((entry) => `- ${formatSetupPath(entry.path, plan.paths.storageRoot)} (${entry.action})`),
    '',
    'Guarantees:',
    '- no raw secrets are printed',
    '- no channel messages are sent',
    '- no persistent runtime service is started by setup',
    '- live tests only run after explicit confirmation',
    '',
    'After setup:',
    ...plan.nextCommands.map((command) => `- ${command}`),
    ...(plan.safety.blockers.length > 0 ? ['', 'Blockers:', ...plan.safety.blockers.map((line) => `- ${line}`)] : []),
  ].join('\n');
}

function formatSetupPath(filePath: string, storageRoot: string): string {
  const relative = path.relative(storageRoot, filePath).replace(/\\/g, '/');
  if (!relative || relative === '') {
    return '.';
  }
  return relative;
}

function printSetupHelp(profileService: FirstRunWorkspaceBootstrapProfileService): void {
  const paths = profileService.resolvePaths();
  console.log([
    `${ZAVORTH_CLI_BRAND_NAME} setup`,
    '',
    'Runs First Light, the guided first-use journey for this workspace.',
    '',
    'Usage:',
    '  zavorth setup',
    '  zavorth setup --dry-run',
    '  zavorth setup --json --dry-run',
    '  npm run setup',
    '',
    'First Light asks:',
    '  - what Zavorth should call you',
    '  - the agent name for this workspace',
    '  - response style',
    '  - main workspace',
    '  - provider, model and optional secret capture',
    '  - optional explicit live provider test',
    '  - Mnemos continuity and vault scope',
    '  - optional Telegram setup',
    '  - default safety posture',
    '',
    'Zavorth-owned files:',
    `  profile:   ${paths.profilePath}`,
    `  workspace: ${paths.workspacePath}`,
    `  identity:  ${paths.identityPath}`,
    `  policy:    ${paths.policyPath}`,
    '',
    'Safe by default:',
    '  - keys are captured through secret prompts',
    '  - summaries and JSON never print secrets',
    '  - setup does not start persistent runtime services',
    '  - live tests only run after explicit confirmation',
    '  - dry-run writes nothing',
    '',
    'After setup:',
    '  zavorth ready',
    '  zavorth start',
    '  zavorth open',
  ].join('\n'));
}

new ZavorthFirstRunSetupWizard().run().catch((error) => {
  console.error(formatZavorthFailureExplanation({
    error,
    whatHappened: 'Zavorth setup stopped before it could finish.',
    nextStep: 'Run a dry-run preview, then use doctor if the same blocker remains.',
    tryCommand: 'zavorth setup --dry-run',
  }));
  process.exit(1);
});
