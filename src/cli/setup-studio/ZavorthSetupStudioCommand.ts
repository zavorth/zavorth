import { applyZavorthSetupStudioEnvPlan, resolveSetupStudioProvider, ZAVORTH_SETUP_STUDIO_PROVIDER_OPTIONS } from '../ZavorthSetupStudioService.js';
import { buildZavorthSetupStudioSnapshot, type BuildZavorthSetupStudioSnapshotInput } from './ZavorthSetupStudioState.js';
import {
  renderZavorthOnboardingBrandLine,
  renderZavorthOnboardingPrelude,
  renderZavorthOnboardingWordmark,
  renderZavorthSetupAppliedSummary,
  renderZavorthSetupStudioFinalReview,
  renderZavorthSetupSecurityNotice,
  renderZavorthSetupStudioSnapshot,
} from './ZavorthSetupStudioFlow.js';
import { renderZavorthSetupStudioInk } from './ZavorthSetupStudioInkRenderer.js';
import { ZavorthSetupStudioProgressStore } from './ZavorthSetupStudioProgressStore.js';
import {
  renderZavorthChannelLiveValidationResult,
  validateZavorthChannelLive,
} from './ZavorthChannelLiveValidationService.js';
import {
  renderZavorthProviderLiveValidationResult,
  validateZavorthProviderLive,
  writeZavorthProviderLiveValidationProof,
} from '../ZavorthProviderLiveValidationService.js';
import type { ZavorthSetupStudioSnapshot } from './ZavorthSetupStudioSchema.js';
import { ZavorthFirstBootDetectionService } from '../../services/ZavorthFirstBootDetectionService.js';
import { FirstRunPersonalizationService } from '../../services/FirstRunPersonalizationService.js';
import { ZavorthConversationalSetupService } from '../../services/ZavorthConversationalSetupService.js';
import { orange, sanitizeOutput, withTimeout } from './ZavorthSetupStudioCommandUtils.js';

export type RunZavorthSetupStudioInput = {
  projectRoot: string;
  args?: string[];
  json?: boolean;
  now?: () => Date;
  forceInteractive?: boolean;
};

export type RunZavorthSetupStudioResult = {
  exitCode: number;
  output: string;
  snapshot: ZavorthSetupStudioSnapshot;
  applied: boolean;
  writtenKeys: string[];
};

type SetupStudioCliAnswers = {
  zavorthHome: string | null;
  skillsGovernanceMode: 'casual' | 'governed';
  wakeDetectorMode: 'disabled' | 'default-local' | 'custom-command';
  wakeCommand: string | null;
  wakeArgs: string | null;
  providerId: string;
  modelId: string | null;
  providerSecret: string | null;
  telegramBotToken: string | null;
  telegramAllowedUserIds: string | null;
  discordBotToken: string | null;
  slackBotToken: string | null;
  emailSmtpUrl: string | null;
  searchProvider: 'skip' | 'local' | 'ollama-web' | 'brave' | 'google' | 'grok' | 'kimi' | 'minimax' | 'perplexity' | 'tavily' | 'firecrawl';
  searchSecret: string | null;
  enableHooks: boolean;
  memoryMode: 'off' | 'local-metadata' | 'local-summary';
  vaultScope: 'skip' | 'documents' | 'downloads' | 'custom' | 'whole-pc';
  scanDirs: string[];
};

class SetupStudioCancelled extends Error {
  constructor() {
    super('First Light cancelled. Nothing was changed.');
  }
}

export function renderZavorthSetupCancelledMessage(): string {
  return [
    'First Light cancelled.',
    'Nothing was changed.',
    'Resume anytime: zavorth setup',
  ].join('\n');
}

export async function runZavorthSetupStudioCommand(
  input: RunZavorthSetupStudioInput,
): Promise<RunZavorthSetupStudioResult> {
  const args = input.args || [];
  const json = input.json || args.includes('--json');
  const nonInteractive = args.includes('--non-interactive');
  const apply = args.includes('--apply') || (nonInteractive && !args.includes('--dry-run') && !args.includes('--preview'));
  const dryRun = args.includes('--dry-run') || args.includes('--preview') || !apply;
  const wantsTui = args.includes('--tui') || args.includes('--fullscreen');
  const interactive = input.forceInteractive === true || (
    Boolean(process.stdin?.isTTY && process.stdout?.isTTY)
    && !json
    && !nonInteractive
    && (wantsTui || !hasDirectConfiguration(args))
  );
  let answers: SetupStudioCliAnswers;
  try {
    answers = interactive
      ? await collectInteractiveAnswers(input.projectRoot)
      : collectArgsAnswers(args);
  } catch (error) {
    if (error instanceof SetupStudioCancelled) {
      const snapshot = buildZavorthSetupStudioSnapshot({
        projectRoot: input.projectRoot,
        ...defaultAnswers(),
        dryRun,
        now: input.now,
      });
      const output = interactive ? '' : `${renderZavorthSetupCancelledMessage()}\n`;
      return { exitCode: 0, output, snapshot, applied: false, writtenKeys: [] };
    }
    throw error;
  }
  const progressStore = new ZavorthSetupStudioProgressStore(input.projectRoot);
  const answersWithProgress = mergeAnswersWithProgress(answers, progressStore.read(), args);
  const snapshotInput: BuildZavorthSetupStudioSnapshotInput = {
    projectRoot: input.projectRoot,
    providerId: answersWithProgress.providerId,
    modelId: answersWithProgress.modelId,
    providerSecret: answersWithProgress.providerSecret,
    zavorthHome: answersWithProgress.zavorthHome,
    skillsGovernanceMode: answersWithProgress.skillsGovernanceMode,
    wakeDetectorMode: answersWithProgress.wakeDetectorMode,
    wakeCommand: answersWithProgress.wakeCommand,
    wakeArgs: answersWithProgress.wakeArgs,
    telegramBotToken: answersWithProgress.telegramBotToken,
    telegramAllowedUserIds: answersWithProgress.telegramAllowedUserIds,
    discordBotToken: answersWithProgress.discordBotToken,
    slackBotToken: answersWithProgress.slackBotToken,
    emailSmtpUrl: answersWithProgress.emailSmtpUrl,
    searchProvider: answersWithProgress.searchProvider,
    searchSecret: answersWithProgress.searchSecret,
    enableHooks: answersWithProgress.enableHooks,
    memoryMode: answersWithProgress.memoryMode,
    vaultScope: answersWithProgress.vaultScope,
    scanDirs: answersWithProgress.scanDirs,
    dryRun,
    now: input.now,
  };
  const snapshot = buildZavorthSetupStudioSnapshot(snapshotInput);

  if (interactive && !apply) {
    const p = await import('@clack/prompts');
    p.note(renderZavorthSetupStudioFinalReview(snapshot), 'Review');
    const confirmed = await p.confirm({
      message: 'Apply this First Light setup now?',
      initialValue: false,
    });
    if (p.isCancel(confirmed) || confirmed !== true) {
      p.cancel('First Light cancelled. Nothing was changed.');
      return { exitCode: 0, output: '', snapshot, applied: false, writtenKeys: [] };
    }
    return applySnapshot(snapshot, json);
  }

  if (apply) {
    const res = applySnapshot(snapshot, json);
    if (!dryRun && nonInteractive && !args.includes('--skip-conversational')) {
      try {
        const detectionService = new ZavorthFirstBootDetectionService({ cwd: input.projectRoot });
        const workspaceHint = detectionService.detectWorkspace();

        const personalization = new FirstRunPersonalizationService({ projectRoot: input.projectRoot });

        const convService = new ZavorthConversationalSetupService({ personalization });

        const userName = process.env.USERNAME || process.env.USER || 'Operator';
        const convSnapshot = convService.buildSnapshot({
          agentName: 'Zavorth',
          userName,
          preferredAddress: userName,
          language: 'en-US',
          primaryUse: workspaceHint.suggestedMission,
          intent: workspaceHint.suggestedMission,
          apply: true,
          confirmLocalProfile: true,
          completeBootstrap: true,
        });

        if (json) {
          try {
            const parsedOutput = JSON.parse(res.output);
            parsedOutput.conversationalSetup = {
              status: convSnapshot.status,
              mission: workspaceHint.suggestedMission,
            };
            res.output = `${JSON.stringify(parsedOutput, null, 2)}\n`;
          } catch {}
        } else {
          res.output += `\nConversational setup completed automatically with workspace mission: "${workspaceHint.suggestedMission}"\n`;
        }
      } catch (e) {
        if (json) {
          try {
            const parsedOutput = JSON.parse(res.output);
            parsedOutput.conversationalSetupError = e instanceof Error ? e.message : String(e);
            res.output = `${JSON.stringify(parsedOutput, null, 2)}\n`;
          } catch {}
        } else {
          res.output += `\nWarning: Auto conversational setup failed: ${e instanceof Error ? e.message : String(e)}\n`;
        }
      }
    }
    return res;
  }

  if (wantsTui && !json) {
    const inkResult = await renderZavorthSetupStudioInk(snapshot);
    if (inkResult.rendered) {
      writeSetupProgress(input.projectRoot, inkResult.snapshot, inkResult.channelId);
      if (inkResult.action === 'apply') {
        return applySnapshot(inkResult.snapshot, json);
      }
      if (inkResult.action === 'doctor') {
        return runSetupStudioDoctor(input.projectRoot);
      }
      if (inkResult.action === 'skills') {
        return runSetupStudioSkillsVerification(input.projectRoot);
      }
      if (inkResult.action === 'provider-live') {
        return runSetupStudioProviderLive(input.projectRoot, inkResult.snapshot);
      }
      if (inkResult.action === 'channel-live') {
        return runSetupStudioChannelLive(input.projectRoot, inkResult.snapshot, inkResult.channelId || 'telegram');
      }
      if (inkResult.action === 'hatch') {
        return runSetupStudioHatch(input.projectRoot, inkResult.snapshot);
      }
      if (inkResult.action === 'channel') {
        const channelId = inkResult.channelId || 'telegram';
        const output = [
          `Channel setup selected: ${channelId}`,
          `Run: zavorth channels ${channelId}`,
          '',
        ].join('\n');
        return {
          exitCode: 0,
          output,
          snapshot: inkResult.snapshot,
          applied: false,
          writtenKeys: [],
        };
      }
      return {
        exitCode: 0,
        output: inkResult.output,
        snapshot: inkResult.snapshot,
        applied: false,
        writtenKeys: [],
      };
    }
    const fallbackOutput = [
      inkResult.output.trim(),
      renderZavorthSetupStudioSnapshot(snapshot),
    ].filter(Boolean).join('\n');
    return {
      exitCode: 0,
      output: `${fallbackOutput}\n`,
      snapshot,
      applied: false,
      writtenKeys: [],
    };
  }

  const output = json
    ? `${JSON.stringify(redactSnapshotForOutput(snapshot), null, 2)}\n`
    : `${renderZavorthSetupStudioSnapshot(snapshot)}\n`;
  return {
    exitCode: 0,
    output,
    snapshot,
    applied: false,
    writtenKeys: [],
  };
}

async function runSetupStudioDoctor(projectRoot: string): Promise<RunZavorthSetupStudioResult> {
  const { runZavorthDoctorPremium } = await import('../doctor/index.js');
  const result = runZavorthDoctorPremium({ projectRoot, strict: false });
  const snapshot = buildZavorthSetupStudioSnapshot({ projectRoot, dryRun: true });
  return {
    exitCode: result.exitCode,
    output: result.output,
    snapshot,
    applied: false,
    writtenKeys: [],
  };
}

async function runSetupStudioSkillsVerification(projectRoot: string): Promise<RunZavorthSetupStudioResult> {
  const { runZavorthDoctorPremium } = await import('../doctor/index.js');
  const result = runZavorthDoctorPremium({ projectRoot, strict: false });
  const snapshot = buildZavorthSetupStudioSnapshot({ projectRoot, dryRun: true });
  return {
    exitCode: result.exitCode,
    output: [
      'Zavorth skill verification',
      '',
      result.output,
    ].join('\n'),
    snapshot,
    applied: false,
    writtenKeys: [],
  };
}

async function runSetupStudioProviderLive(
  projectRoot: string,
  snapshot: ZavorthSetupStudioSnapshot,
): Promise<RunZavorthSetupStudioResult> {
  const validation = await validateZavorthProviderLive({
    projectRoot,
    providerId: snapshot.plan.provider.id,
    modelId: snapshot.plan.provider.modelId,
    providerSecret: readEnvUpdateValue(snapshot, snapshot.plan.provider.secretEnvKey),
    explicitUserConsent: true,
  });
  const proof = writeZavorthProviderLiveValidationProof(projectRoot, validation);
  const output = [
    renderZavorthProviderLiveValidationResult(validation),
    proof.written && proof.path ? `Proof: ${proof.path}` : null,
    '',
  ].filter(Boolean).join('\n');
  return {
    exitCode: validation.status === 'passed' ? 0 : 1,
    output,
    snapshot,
    applied: false,
    writtenKeys: [],
  };
}

async function runSetupStudioChannelLive(
  projectRoot: string,
  snapshot: ZavorthSetupStudioSnapshot,
  channelId: string,
): Promise<RunZavorthSetupStudioResult> {
  const tokenKey = channelId === 'telegram'
    ? 'TELEGRAM_BOT_TOKEN'
    : channelId === 'discord'
      ? 'DISCORD_BOT_TOKEN'
      : channelId === 'slack'
        ? 'SLACK_BOT_TOKEN'
        : null;
  const result = await validateZavorthChannelLive({
    channelId,
    token: tokenKey ? readEnvUpdateValue(snapshot, tokenKey) : null,
    smtpUrl: channelId === 'email' ? readEnvUpdateValue(snapshot, 'EMAIL_SMTP_URL') : null,
    explicitUserConsent: true,
  });
  return {
    exitCode: result.status === 'passed' || result.status === 'unsupported' ? 0 : 1,
    output: `${renderZavorthChannelLiveValidationResult(result)}\n`,
    snapshot,
    applied: false,
    writtenKeys: [],
  };
}

async function runSetupStudioHatch(
  projectRoot: string,
  snapshot?: ZavorthSetupStudioSnapshot,
): Promise<RunZavorthSetupStudioResult> {
  if (snapshot && snapshot.plan.provider.id !== 'deferred') {
    const live = await runLiveHatchConversation(snapshot);
    if (live) {
      return {
        exitCode: live.ok ? 0 : 1,
        output: live.output,
        snapshot,
        applied: false,
        writtenKeys: [],
      };
    }
  }
  const { runZavorthCliHatch } = await import('../hatch/index.js');
  const result = runZavorthCliHatch({ projectRoot });
  const fallbackSnapshot = snapshot || buildZavorthSetupStudioSnapshot({ projectRoot, dryRun: true });
  return {
    exitCode: result.exitCode,
    output: result.output,
    snapshot: fallbackSnapshot,
    applied: false,
    writtenKeys: [],
  };
}

async function runLiveHatchConversation(snapshot: ZavorthSetupStudioSnapshot): Promise<{ ok: boolean; output: string } | null> {
  const provider = resolveSetupStudioProvider(snapshot.plan.provider.id);
  if (provider.needsSecret && !readEnvUpdateValue(snapshot, provider.secretEnvKeys[0] || null)) {
    return null;
  }
  const envSnapshot = snapshotEnvironment(snapshot);
  try {
    for (const entry of snapshot.plan.envUpdates) {
      process.env[entry.key] = entry.value;
    }
    process.env.ZAVORTH_DEFAULT_PROVIDER = provider.id;
    const { ProviderFactory } = await import('../../providers/ProviderFactory.js');
    ProviderFactory.clearCache();
    const llm = ProviderFactory.create(provider.id);
    const response = await withTimeout(
      () => llm.chat([
        {
          role: 'system',
          content: 'You are Zavorth during setup hatch. Reply briefly, confidently, and do not expose secrets.',
        },
        {
          role: 'user',
          content: 'Introduce yourself in one short paragraph and tell me the next safe step after setup.',
        },
      ], [], { modelName: snapshot.plan.provider.modelId }),
      25000,
    );
    ProviderFactory.clearCache();
    return {
      ok: true,
      output: [
        'Zavorth live hatch',
        '',
        sanitizeOutput(response.content || 'Provider answered, but returned an empty message.', snapshot),
        '',
      ].join('\n'),
    };
  } catch (error) {
    return {
      ok: false,
      output: [
        'Zavorth live hatch failed.',
        sanitizeOutput(error instanceof Error ? error.message : String(error), snapshot),
        '',
        'No persistent runtime was started. Fix the provider settings or run zavorth doctor.',
        '',
      ].join('\n'),
    };
  } finally {
    restoreEnvironment(envSnapshot);
    const { ProviderFactory } = await import('../../providers/ProviderFactory.js');
    ProviderFactory.clearCache();
  }
}

function redactSnapshotForOutput(snapshot: ZavorthSetupStudioSnapshot): ZavorthSetupStudioSnapshot {
  return {
    ...snapshot,
    plan: {
      ...snapshot.plan,
      envUpdates: snapshot.plan.envUpdates.map((entry) => ({
        ...entry,
        value: entry.redactedValue,
      })),
    },
  };
}

function applySnapshot(snapshot: ZavorthSetupStudioSnapshot, json: boolean): RunZavorthSetupStudioResult {
  const result = applyZavorthSetupStudioEnvPlan(snapshot.plan);
  writeSetupProgress(snapshot.projectRoot, snapshot, null);
  const outputPayload = {
    contractVersion: 'zavorth-setup-studio-apply/1',
    generatedAt: snapshot.generatedAt,
    envFile: result.envFile,
    written: result.written,
    keys: result.keys,
    nextCommands: snapshot.plan.nextCommands,
    safety: snapshot.safety,
  };
  const output = json
    ? `${JSON.stringify(outputPayload, null, 2)}\n`
    : `${renderZavorthSetupAppliedSummary({
      ...snapshot,
      safety: {
        ...snapshot.safety,
        dryRun: false,
      },
    }, result)}\n`;
  return {
    exitCode: 0,
    output,
    snapshot,
    applied: result.written,
    writtenKeys: result.keys,
  };
}

function writeSetupProgress(projectRoot: string, snapshot: ZavorthSetupStudioSnapshot, channelId?: string | null): void {
  new ZavorthSetupStudioProgressStore(projectRoot).write({
    providerId: snapshot.plan.provider.id,
    modelId: snapshot.plan.provider.modelId,
    webSearchProvider: snapshot.plan.webSearch.provider,
    hooksEnabled: snapshot.plan.hooks.enabled,
    lastPage: null,
    lastChannelId: channelId || null,
  });
}

async function collectInteractiveAnswers(projectRoot: string): Promise<SetupStudioCliAnswers> {
  const p = await import('@clack/prompts');

  console.clear();
  console.log(await renderSetupStudioHero());
  p.intro(`${orange('ZAVORTH')} First Light`);
  p.note(renderZavorthSetupSecurityNotice(), orange('Security'));

  const accepted = await p.confirm({
    message: 'I understand Zavorth should run with explicit trust boundaries. Continue?',
    initialValue: true,
  });
  if (p.isCancel(accepted) || accepted !== true) {
    p.cancel('First Light cancelled. Nothing was changed.');
    throw new SetupStudioCancelled();
  }

  const baselineSnapshot = buildZavorthSetupStudioSnapshot({
    projectRoot,
    ...defaultAnswers(),
    dryRun: true,
  });
  p.note(renderExistingConfigPanel(baselineSnapshot), orange('Current config'));

  const homeChoice = await p.select({
    message: 'Where should Zavorth store this instance home?',
    options: [
      { value: '__current__', label: baselineSnapshot.home.isolated ? 'Keep current ZAVORTH_HOME' : 'Compat mode in this project', hint: baselineSnapshot.home.source },
      { value: '__default__', label: 'Use isolated home beside this project', hint: '.zavorth-home' },
      { value: '__custom__', label: 'Choose a custom home path' },
    ],
    initialValue: baselineSnapshot.home.isolated ? '__current__' : '__default__',
  });
  if (p.isCancel(homeChoice)) {
    p.cancel('First Light cancelled. Nothing was changed.');
    throw new SetupStudioCancelled();
  }
  const customHome = homeChoice === '__custom__'
    ? await p.text({ message: 'ZAVORTH_HOME path', initialValue: baselineSnapshot.home.root })
    : '';
  if (p.isCancel(customHome)) {
    p.cancel('First Light cancelled. Nothing was changed.');
    throw new SetupStudioCancelled();
  }
  const zavorthHome = resolveSetupHomeChoice(projectRoot, String(homeChoice), String(customHome || ''), baselineSnapshot.home.root);
  p.note(renderHomeSelectionPanel(zavorthHome, baselineSnapshot.home.source), orange('Zavorth Home'));

  p.note(renderSkillGovernanceIntroPanel(), orange('Skill governance'));
  const skillsGovernanceMode = await p.select({
    message: 'How should Zavorth handle imported skills?',
    options: [
      { value: 'casual', label: 'Casual', hint: 'recommended for personal use; fast imports, hard blockers remain' },
      { value: 'governed', label: 'Governed', hint: 'stricter enterprise review for risk, license and audit' },
    ],
    initialValue: baselineSnapshot.plan.skillGovernance.mode,
  });
  if (p.isCancel(skillsGovernanceMode)) {
    p.cancel('First Light cancelled. Nothing was changed.');
    throw new SetupStudioCancelled();
  }
  p.note(renderSkillGovernanceSelectionPanel(String(skillsGovernanceMode)), orange('Skill governance'));

  const wakeDetectorMode = await p.select({
    message: 'Enable Echo wake word setup?',
    options: [
      { value: 'default-local', label: 'Default local detector', hint: 'opt-in per session; local first; recommended' },
      { value: 'custom-command', label: 'Custom detector command', hint: 'use your own local/API bridge process' },
      { value: 'disabled', label: 'Keep off', hint: 'configure later with zavorth echo wake setup' },
    ],
    initialValue: baselineSnapshot.plan.wakeDetector.mode,
  });
  if (p.isCancel(wakeDetectorMode)) {
    p.cancel('First Light cancelled. Nothing was changed.');
    throw new SetupStudioCancelled();
  }
  const wakeCommand = wakeDetectorMode === 'custom-command'
    ? await p.text({ message: 'Wake detector command', placeholder: 'local-wake-detector' })
    : '';
  if (p.isCancel(wakeCommand)) {
    p.cancel('First Light cancelled. Nothing was changed.');
    throw new SetupStudioCancelled();
  }
  const wakeArgs = wakeDetectorMode === 'custom-command'
    ? await p.text({ message: 'Wake detector args', placeholder: '--model local' })
    : '';
  if (p.isCancel(wakeArgs)) {
    p.cancel('First Light cancelled. Nothing was changed.');
    throw new SetupStudioCancelled();
  }

  const setupMode = await p.select({
    message: 'Setup mode',
    options: [
      { value: 'quickstart', label: 'QuickStart', hint: 'recommended' },
      { value: 'safe', label: 'Safe', hint: 'stricter approvals' },
      { value: 'advanced', label: 'Advanced', hint: 'show more controls later' },
    ],
    initialValue: 'quickstart',
  });
  if (p.isCancel(setupMode)) {
    p.cancel('First Light cancelled. Nothing was changed.');
    throw new SetupStudioCancelled();
  }
  void setupMode;

  const configHandling = await p.select({
    message: 'How should First Light handle existing config?',
    options: [
      { value: 'keep', label: 'Keep current values', hint: 'recommended' },
      { value: 'review', label: 'Review and update' },
      { value: 'reset', label: 'Reset before setup', hint: 'preview until apply' },
    ],
    initialValue: baselineSnapshot.configHandling,
  });
  if (p.isCancel(configHandling)) {
    p.cancel('First Light cancelled. Nothing was changed.');
    throw new SetupStudioCancelled();
  }
  void configHandling;

  const providerId = await selectSetupProvider(p);
  if (p.isCancel(providerId)) {
    p.cancel('First Light cancelled. Nothing was changed.');
    throw new SetupStudioCancelled();
  }
  const provider = resolveSetupStudioProvider(providerId);
  const modelChoice = await p.select({
    message: 'Default model',
    options: [
      { value: '__current__', label: `Keep current/default (${provider.defaultModel})` },
      { value: '__manual__', label: 'Enter model manually' },
    ],
    initialValue: '__current__',
  });
  if (p.isCancel(modelChoice)) {
    p.cancel('First Light cancelled. Nothing was changed.');
    throw new SetupStudioCancelled();
  }
  const modelId = modelChoice === '__manual__'
    ? await p.text({
      message: 'Model ID',
      initialValue: provider.defaultModel,
    })
    : provider.defaultModel;
  if (p.isCancel(modelId)) {
    p.cancel('First Light cancelled. Nothing was changed.');
    throw new SetupStudioCancelled();
  }
  const providerSecret = provider.needsSecret
    ? await p.password({
      message: `Paste ${provider.secretEnvKeys[0]} now, or leave empty to configure later`,
    })
    : '';
  if (p.isCancel(providerSecret)) {
    p.cancel('First Light cancelled. Nothing was changed.');
    throw new SetupStudioCancelled();
  }
  p.note(renderModelCheckPanel(provider.id, provider.needsSecret, provider.secretEnvKeys[0] || null, Boolean(providerSecret)), orange('Model check'));

  p.note(renderHowChannelsWorkPanel(), orange('Communication surfaces'));

  const selectedRemoteChannels = await selectSetupChannels(p, projectRoot);
  if (p.isCancel(selectedRemoteChannels)) {
    p.cancel('First Light cancelled. Nothing was changed.');
    throw new SetupStudioCancelled();
  }
  const selectedChannelSet = new Set((selectedRemoteChannels as string[]).map((channel) => channel.toLowerCase()));
  const telegramBotToken = selectedChannelSet.has('telegram')
    ? await p.password({ message: 'Telegram bot token' })
    : '';
  if (p.isCancel(telegramBotToken)) {
    p.cancel('First Light cancelled. Nothing was changed.');
    throw new SetupStudioCancelled();
  }
  const telegramAllowedUserIds = selectedChannelSet.has('telegram')
    ? await p.text({ message: 'Telegram allowed user IDs, comma-separated', initialValue: '' })
    : '';
  if (p.isCancel(telegramAllowedUserIds)) {
    p.cancel('First Light cancelled. Nothing was changed.');
    throw new SetupStudioCancelled();
  }
  const discordBotToken = selectedChannelSet.has('discord')
    ? await p.password({ message: 'Discord bot token, or leave empty to configure later' })
    : '';
  if (p.isCancel(discordBotToken)) {
    p.cancel('First Light cancelled. Nothing was changed.');
    throw new SetupStudioCancelled();
  }
  const slackBotToken = selectedChannelSet.has('slack')
    ? await p.password({ message: 'Slack bot token, or leave empty to configure later' })
    : '';
  if (p.isCancel(slackBotToken)) {
    p.cancel('First Light cancelled. Nothing was changed.');
    throw new SetupStudioCancelled();
  }
  const emailSmtpUrl = selectedChannelSet.has('email')
    ? await p.password({ message: 'Email SMTP URL, or leave empty to configure later' })
    : '';
  if (p.isCancel(emailSmtpUrl)) {
    p.cancel('First Light cancelled. Nothing was changed.');
    throw new SetupStudioCancelled();
  }

  p.note(renderWebSearchIntroPanel(), orange('Web search'));
  const searchProvider = await selectSetupSearchProvider(p);
  if (p.isCancel(searchProvider)) {
    p.cancel('First Light cancelled. Nothing was changed.');
    throw new SetupStudioCancelled();
  }
  const normalizedSearchProvider = normalizeSearchProvider(String(searchProvider));
  const searchSecretLabel = searchSecretEnvLabel(normalizedSearchProvider);
  const searchSecret = searchSecretLabel
    ? await p.password({
      message: `Paste ${searchSecretLabel} now, or leave empty to configure later`,
    })
    : '';
  if (p.isCancel(searchSecret)) {
    p.cancel('First Light cancelled. Nothing was changed.');
    throw new SetupStudioCancelled();
  }
  p.note(renderWebSearchProviderPanel(normalizedSearchProvider, Boolean(searchSecret)), orange('Web search'));

  const skillsSnapshot = buildZavorthSetupStudioSnapshot({
    projectRoot,
    providerId,
    zavorthHome,
    modelId: String(modelId || provider.defaultModel),
    providerSecret: String(providerSecret || ''),
    searchProvider: normalizedSearchProvider,
    searchSecret: String(searchSecret || ''),
    dryRun: true,
  });
  p.note(renderSkillsStatusPanel(skillsSnapshot), orange('Ability readiness'));
  const configureSkills = await p.confirm({
    message: 'Review optional tool helpers now?',
    initialValue: true,
  });
  if (p.isCancel(configureSkills)) {
    p.cancel('First Light cancelled. Nothing was changed.');
    throw new SetupStudioCancelled();
  }
  if (configureSkills === true) {
    const skillChoices = await p.multiselect({
      message: 'Prepare optional tool helpers',
      options: [
        { value: 'skip', label: 'Skip for now', hint: 'continue without installing dependencies' },
        { value: 'onepassword', label: '1password' },
        { value: 'playwright', label: 'playwright' },
        { value: 'ffmpeg', label: 'ffmpeg' },
        { value: 'imagemagick', label: 'imagemagick' },
        { value: 'openai-whisper', label: 'openai-whisper' },
        { value: 'signal-cli', label: 'signal-cli' },
        { value: 'yt-dlp', label: 'yt-dlp' },
      ],
      initialValues: ['skip'],
      required: false,
    });
    if (p.isCancel(skillChoices)) {
      p.cancel('First Light cancelled. Nothing was changed.');
      throw new SetupStudioCancelled();
    }
    for (const prompt of [
      'Set GOOGLE_PLACES_API_KEY for location tools?',
      'Set OPENAI_API_KEY for speech tools?',
      'Set ELEVENLABS_API_KEY for voice output?',
    ]) {
      const answer = await p.confirm({ message: prompt, initialValue: false });
      if (p.isCancel(answer)) {
        p.cancel('First Light cancelled. Nothing was changed.');
        throw new SetupStudioCancelled();
      }
    }
  }

  const memoryMode = await p.select({
    message: 'Memory mode',
    options: [
      { value: 'local-metadata', label: 'Local metadata (preferences, approvals and usage signals)', hint: 'recommended' },
      { value: 'local-summary', label: 'Local summaries (short project/context summaries)', hint: 'more context' },
      { value: 'off', label: 'Off (do not use Mnemos during setup)', hint: 'no memory setup now' },
    ],
    initialValue: 'local-metadata',
  });
  if (p.isCancel(memoryMode)) {
    p.cancel('First Light cancelled. Nothing was changed.');
    throw new SetupStudioCancelled();
  }

  const vaultScope = await p.select({
    message: 'Memory scan scope',
    options: [
      { value: 'skip', label: 'Skip for now (do not scan files during setup)', hint: 'safest' },
      { value: 'documents', label: 'Documents (scan user documents for local context)' },
      { value: 'downloads', label: 'Downloads (scan downloaded files for local context)' },
      { value: 'custom', label: 'Custom path (choose one folder manually)' },
      { value: 'whole-pc', label: 'Whole PC (broad scan; sensitive)', hint: 'not recommended' },
    ],
    initialValue: 'skip',
  });
  if (p.isCancel(vaultScope)) {
    p.cancel('First Light cancelled. Nothing was changed.');
    throw new SetupStudioCancelled();
  }
  const customScanDir = vaultScope === 'custom'
    ? await p.text({ message: 'Custom scan path', initialValue: projectRoot })
    : '';
  if (p.isCancel(customScanDir)) {
    p.cancel('First Light cancelled. Nothing was changed.');
    throw new SetupStudioCancelled();
  }
  const enableHooks = await p.confirm({
    message: 'Prepare automation templates? (disabled until you review and enable them)',
    initialValue: false,
  });
  if (p.isCancel(enableHooks)) {
    p.cancel('First Light cancelled. Nothing was changed.');
    throw new SetupStudioCancelled();
  }
  p.note(renderAutomationHooksPanel(enableHooks === true), orange(enableHooks === true ? 'Automation templates' : 'Automation templates skipped'));
  p.note(renderGatewayPanel(baselineSnapshot), orange('Runtime service'));
  const gatewayAction = await p.select({
    message: baselineSnapshot.gateway.installed ? 'Runtime service already installed' : 'Runtime service',
    options: [
      { value: 'restart', label: baselineSnapshot.gateway.installed ? 'Show restart command' : 'Show start command', hint: 'setup will not start persistent processes' },
      { value: 'install', label: baselineSnapshot.gateway.installed ? 'Show reinstall command' : 'Show service preparation command' },
      { value: 'skip', label: 'Skip for now' },
    ],
    initialValue: baselineSnapshot.gateway.installed ? 'restart' : 'skip',
  });
  if (p.isCancel(gatewayAction)) {
    p.cancel('First Light cancelled. Nothing was changed.');
    throw new SetupStudioCancelled();
  }
  void gatewayAction;
  p.note(renderControlUiPanel(baselineSnapshot), orange('Dashboard'));
  p.note(renderHatchPanel(baselineSnapshot), orange('Start the agent'));
  const hatchMode = await p.select({
    message: 'How do you want to start your agent after setup?',
    options: [
      { value: 'terminal', label: 'Hatch in Terminal', hint: 'recommended' },
      { value: 'browser', label: 'Hatch in Dashboard' },
      { value: 'later', label: 'Hatch later' },
    ],
    initialValue: 'terminal',
  });
  if (p.isCancel(hatchMode)) {
    p.cancel('First Light cancelled. Nothing was changed.');
    throw new SetupStudioCancelled();
  }
  void hatchMode;

  return {
    zavorthHome,
    skillsGovernanceMode: normalizeSkillsGovernanceMode(String(skillsGovernanceMode)),
    wakeDetectorMode: normalizeWakeDetectorMode(String(wakeDetectorMode)),
    wakeCommand: String(wakeCommand || ''),
    wakeArgs: String(wakeArgs || ''),
    providerId,
    modelId: String(modelId || provider.defaultModel),
    providerSecret: String(providerSecret || ''),
    telegramBotToken: String(telegramBotToken || ''),
    telegramAllowedUserIds: String(telegramAllowedUserIds || ''),
    discordBotToken: String(discordBotToken || ''),
    slackBotToken: String(slackBotToken || ''),
    emailSmtpUrl: String(emailSmtpUrl || ''),
    searchProvider: normalizedSearchProvider,
    searchSecret: String(searchSecret || ''),
    enableHooks: enableHooks === true,
    memoryMode: normalizeMemoryMode(String(memoryMode)),
    vaultScope: normalizeVaultScope(String(vaultScope)),
    scanDirs: customScanDir ? [String(customScanDir)] : [],
  };
}

function renderExistingConfigPanel(snapshot: ZavorthSetupStudioSnapshot): string {
  return [
    `Workspace: ${snapshot.projectRoot}`,
    `Home: ${snapshot.home.root} (${snapshot.home.source}${snapshot.home.isolated ? ', isolated' : ', compat'})`,
    `Gateway: ${snapshot.gateway.installed ? 'local detected' : 'not installed'} via loopback`,
    `Profile: ${snapshot.existingConfig.profileExists ? 'detected' : 'not found'}`,
    `.env: ${snapshot.existingConfig.envExists ? 'detected' : 'not found'}`,
    `Provider: ${snapshot.existingConfig.configuredProvider || 'not configured'}`,
    `Channels: ${snapshot.existingConfig.configuredChannels.join(', ') || 'none'}`,
  ].join('\n');
}

function renderHomeSelectionPanel(home: string | null, previousSource: string): string {
  return [
    home
      ? `Selected ZAVORTH_HOME: ${home}`
      : `Keeping current home mode: ${previousSource}`,
    'Setup writes the selection only after final confirmation.',
    'You can switch later with: zavorth home switch --home <path> --apply',
  ].join('\n');
}

function renderSkillGovernanceIntroPanel(): string {
  return [
    'Casual: fewer prompts for normal personal skill imports.',
    'Governed: stricter review for teams, legal/compliance, or sensitive workspaces.',
    'Both modes keep hard blockers active for exfiltration, destructive scripts, unsafe paths and restricted licenses.',
    'You can switch later with: zavorth skills governance governed --apply',
  ].join('\n');
}

function renderSkillGovernanceSelectionPanel(mode: string): string {
  return mode === 'governed'
    ? [
        'Selected: Governed.',
        'Skill imports will require stricter risk/license review and clearer audit evidence.',
      ].join('\n')
    : [
        'Selected: Casual.',
        'Zavorth keeps daily imports smooth, but does not bypass hard security or license blockers.',
      ].join('\n');
}

function resolveSetupHomeChoice(projectRoot: string, choice: string, customHome: string, currentHome: string): string | null {
  if (choice === '__custom__') {
    return customHome.trim() || currentHome;
  }
  if (choice === '__default__') {
    return `${projectRoot.replace(/[\\/]$/u, '')}${projectRoot.includes('\\') ? '\\' : '/'}${'.zavorth-home'}`;
  }
  return null;
}

function renderModelCheckPanel(providerId: string, needsSecret: boolean, secretKey: string | null, secretProvided: boolean): string {
  if (providerId === 'deferred') {
    return [
      'No model was selected yet.',
      'Zavorth can still prepare local setup, but LLM tasks need a provider before live use.',
      'Run: zavorth providers',
    ].join('\n');
  }
  if (!needsSecret || secretProvided) {
    return [
      `Provider "${providerId}" is configured for setup.`,
      'Live validation still runs only after explicit consent.',
    ].join('\n');
  }
  return [
    `No auth configured for provider "${providerId}".`,
    `The agent may fail until ${secretKey || 'the provider key'} is added.`,
    'Run: zavorth providers or repeat setup with a key.',
  ].join('\n');
}

function renderHowChannelsWorkPanel(): string {
  return [
    'Inbound channel safety defaults to pairing: unknown senders should get paired or allowlisted first.',
    'Remote channels can trigger tools only through policy, scope and evidence.',
    'For shared or public inboxes, keep trust boundaries separate.',
    '',
    'Common surfaces:',
    'Telegram: bot token + user allowlist.',
    'Discord: bot token and approved guild/channel scope.',
    'Slack: bot/socket token with channel allowlist.',
    'Signal/WhatsApp/iMessage/Matrix/LINE/Zalo/Teams/Google Chat: bridge or API credentials plus pairing.',
    'Dashboard: local visual control plane for approvals, diffs and evidence.',
  ].join('\n');
}

function renderWebSearchIntroPanel(): string {
  return [
    'Web search lets Zavorth look things up online when the LLM needs current sources.',
    'Some providers need an API key; local/model context keeps the agent local-first.',
    'Search adapters must return verifiable URLs or citations before results are treated as web evidence.',
  ].join('\n');
}

function renderWebSearchProviderPanel(provider: string, secretProvided: boolean): string {
  if (provider === 'skip') {
    return [
      'Web search is skipped.',
      'Zavorth will use model knowledge, local files and configured tools only.',
    ].join('\n');
  }
  if (provider === 'local') {
    return [
      'Local/model context selected.',
      'No external web request is made by this provider.',
    ].join('\n');
  }
  return [
    `${provider} selected.`,
    secretProvided
      ? 'A key was captured through a secret field.'
      : 'No key was provided; this provider is configurable, not live yet.',
  ].join('\n');
}

function renderSkillsStatusPanel(snapshot: ZavorthSetupStudioSnapshot): string {
  return [
    `Eligible: ${snapshot.skills.eligible}`,
    `Missing requirements: ${snapshot.skills.missingRequirements}`,
    `Unsupported on this OS: ${snapshot.skills.unsupportedOnThisOs}`,
    `Blocked by policy: ${snapshot.skills.blockedByPolicy}`,
    '',
    ...snapshot.skills.highlights.map((item) => `- ${item}`),
  ].join('\n');
}

function renderAutomationHooksPanel(enabled: boolean): string {
  return [
    enabled
      ? 'Automation templates will be prepared in .zavorth/hooks.'
      : 'No automation templates will be prepared now.',
    'Templates stay disabled until you review and enable them.',
    'They can create local Mnemos summaries, evidence and governed notification outbox entries.',
    'They never run shell commands directly.',
    'Setup later: zavorth hooks',
  ].join('\n');
}

function renderGatewayPanel(snapshot: ZavorthSetupStudioSnapshot): string {
  return [
    `Runtime: ${snapshot.gateway.recommendedRuntime}`,
    `Gateway: ${snapshot.gateway.installed ? 'detected' : 'not detected'}`,
    `Start: ${snapshot.gateway.startCommand}`,
    `Control: ${snapshot.controlUi.url}`,
    `Token: ${snapshot.controlUi.tokenStatus}`,
    '',
    snapshot.gateway.detail,
  ].join('\n');
}

function renderControlUiPanel(snapshot: ZavorthSetupStudioSnapshot): string {
  return [
    `Web UI: ${snapshot.controlUi.url}`,
    `Token: ${snapshot.controlUi.tokenStatus}`,
    `Open: ${snapshot.controlUi.openCommand}`,
    `Docs: ${snapshot.controlUi.docsCommand}`,
  ].join('\n');
}

function renderHatchPanel(snapshot: ZavorthSetupStudioSnapshot): string {
  return [
    'Your workspace is ready for a first terminal chat once a provider is configured.',
    `Recommended mode: ${snapshot.hatch.recommendedMode}`,
    `First prompt: ${snapshot.hatch.bootstrapPrompt}`,
    '',
    ...snapshot.hatch.commands.map((command) => `- ${command}`),
  ].join('\n');
}

async function selectSetupProvider(p: typeof import('@clack/prompts')): Promise<string | symbol> {
  const popularIds = ['openai', 'anthropic', 'gemini', 'openrouter', 'local'];
  const popularOptions = popularIds
    .map((providerId) => resolveSetupStudioProvider(providerId))
    .map((provider) => ({
      value: provider.id,
      label: provider.label,
      hint: providerHint(provider.id, provider.defaultModel),
    }));

  const selected = await p.select({
    message: 'Model/auth provider',
    options: [
      ...popularOptions,
      {
        value: '__more_providers__',
        label: 'More providers...',
        hint: `${ZAVORTH_SETUP_STUDIO_PROVIDER_OPTIONS.length - popularOptions.length} additional native routes`,
      },
    ],
    initialValue: 'openai',
  });
  if (p.isCancel(selected) || selected !== '__more_providers__') {
    return selected;
  }

  return p.select({
    message: 'All native provider routes',
    options: ZAVORTH_SETUP_STUDIO_PROVIDER_OPTIONS.map((provider) => ({
      value: provider.id,
      label: provider.label,
      hint: providerHint(provider.id, provider.defaultModel),
    })),
    initialValue: 'openai',
  });
}

function providerHint(providerId: string, defaultModel: string): string {
  if (providerId === 'openai') return 'ChatGPT/Codex API key';
  if (providerId === 'anthropic') return 'Claude API key';
  if (providerId === 'gemini') return 'Gemini API key';
  if (providerId === 'openrouter') return 'multi-provider gateway';
  if (providerId === 'local') return 'no key; local-first';
  return defaultModel;
}

async function selectSetupChannels(
  p: typeof import('@clack/prompts'),
  projectRoot: string,
): Promise<string[] | symbol> {
  const snapshot = buildZavorthSetupStudioSnapshot({
    projectRoot,
    ...defaultAnswers(),
    dryRun: true,
  });
  const channelById = new Map(snapshot.channelGuide.map((channel) => [channel.id, channel]));
  const popularIds = ['telegram', 'discord', 'slack', 'email', 'whatsapp-cloud'];
  const popularOptions = popularIds
    .map((channelId) => channelById.get(channelId))
    .filter((channel): channel is NonNullable<typeof channel> => Boolean(channel))
    .map((channel) => ({
      value: channel.id,
      label: channel.label,
      hint: channel.detail,
    }));
  const selectedPopular = await p.multiselect({
    message: 'Communication surfaces',
    options: popularOptions,
    required: false,
  });
  if (p.isCancel(selectedPopular)) {
    return selectedPopular;
  }

  const selectedBase = new Set(selectedPopular as string[]);
  const browseAll = await p.select({
    message: 'More communication surfaces?',
    options: [
      {
        value: 'continue',
        label: 'Continue with selected surfaces',
        hint: selectedBase.size > 0 ? `${selectedBase.size} selected` : 'none selected',
      },
      {
        value: 'all',
        label: 'Browse all native surfaces',
        hint: `${Math.max(0, snapshot.channelGuide.length - popularOptions.length - 2)} additional native routes`,
      },
      {
        value: 'none',
        label: 'Configure later',
        hint: 'keep remote surfaces disabled for now',
      },
    ],
    initialValue: selectedBase.size > 0 ? 'continue' : 'all',
  });
  if (p.isCancel(browseAll)) {
    return browseAll;
  }
  if (browseAll === 'none') {
    return [];
  }
  if (browseAll !== 'all') {
    return Array.from(selectedBase);
  }

  const allSelected = await p.multiselect({
    message: 'All native communication surfaces',
    options: snapshot.channelGuide
      .filter((channel) => channel.id !== 'terminal' && channel.id !== 'control')
      .map((channel) => ({
        value: channel.id,
        label: channel.label,
        hint: `${channel.status}; ${channel.setupCommand}`,
      })),
    initialValues: Array.from(selectedBase),
    required: false,
  });
  if (p.isCancel(allSelected)) {
    return allSelected;
  }
  return Array.from(new Set([...(selectedBase.values()), ...(allSelected as string[])]));
}

async function selectSetupSearchProvider(
  p: typeof import('@clack/prompts'),
): Promise<string | symbol> {
  const selected = await p.select({
    message: 'Web/search provider',
    options: [
      { value: 'local', label: 'Local/model context', hint: 'recommended first; no external web' },
      { value: 'brave', label: 'Brave Search', hint: 'managed web search; requires key' },
      { value: 'google', label: 'Google/Gemini Search', hint: 'Google Search or Gemini grounding key' },
      { value: 'grok', label: 'Grok', hint: 'xAI web search; requires key' },
      { value: '__more_search__', label: 'More search providers...', hint: 'Kimi, MiniMax, Ollama, Perplexity, Tavily, Firecrawl' },
      { value: 'skip', label: 'Skip for now', hint: 'keep the agent local-first' },
    ],
    initialValue: 'local',
  });
  if (p.isCancel(selected) || selected !== '__more_search__') {
    return selected;
  }

  return p.select({
    message: 'All web/search providers',
    options: [
      { value: 'local', label: 'Local/model context', hint: 'no external web' },
      { value: 'ollama-web', label: 'Ollama Web Search', hint: 'local Ollama route; key-free when available' },
      { value: 'brave', label: 'Brave Search', hint: 'BRAVE_SEARCH_API_KEY' },
      { value: 'google', label: 'Google/Gemini Search', hint: 'GOOGLE_SEARCH_API_KEY or GEMINI_API_KEY' },
      { value: 'grok', label: 'Grok', hint: 'XAI_API_KEY' },
      { value: 'kimi', label: 'Kimi', hint: 'KIMI_API_KEY or MOONSHOT_API_KEY' },
      { value: 'minimax', label: 'MiniMax Search', hint: 'MiniMax token/API key' },
      { value: 'perplexity', label: 'Perplexity', hint: 'PERPLEXITY_API_KEY' },
      { value: 'tavily', label: 'Tavily', hint: 'TAVILY_API_KEY' },
      { value: 'firecrawl', label: 'Firecrawl', hint: 'FIRECRAWL_API_KEY' },
      { value: 'skip', label: 'Skip for now', hint: 'keeps the agent local-first' },
    ],
    initialValue: 'brave',
  });
}

function searchSecretEnvLabel(provider: string): string | null {
  switch (provider) {
    case 'brave':
      return 'BRAVE_SEARCH_API_KEY';
    case 'google':
      return 'GEMINI_API_KEY or GOOGLE_API_KEY';
    case 'grok':
      return 'XAI_API_KEY';
    case 'kimi':
      return 'KIMI_API_KEY or MOONSHOT_API_KEY';
    case 'minimax':
      return 'MINIMAX_CODE_PLAN_KEY, MINIMAX_CODING_API_KEY or MINIMAX_API_KEY';
    case 'perplexity':
      return 'PERPLEXITY_API_KEY';
    case 'tavily':
      return 'TAVILY_API_KEY';
    case 'firecrawl':
      return 'FIRECRAWL_API_KEY';
    default:
      return null;
  }
}

async function renderSetupStudioHero(): Promise<string> {
  return [
    renderZavorthOnboardingPrelude(),
    '',
    renderZavorthOnboardingWordmark(),
    renderZavorthOnboardingBrandLine(),
    '',
    '',
  ].join('\n');
}

function collectArgsAnswers(args: string[]): SetupStudioCliAnswers {
  const providerId = readFlag(args, 'provider')
    || readFlag(args, 'provider-id')
    || resolveProviderQuery(readFlag(args, 'provider-query') || readFlag(args, 'search-provider-name'))
    || 'deferred';
  const provider = resolveSetupStudioProvider(providerId);
  return {
    zavorthHome: readFlag(args, 'home') || readFlag(args, 'zavorth-home'),
    skillsGovernanceMode: normalizeSkillsGovernanceMode(
      readFlag(args, 'skills-governance')
      || readFlag(args, 'skill-governance')
      || readFlag(args, 'skills-governance-mode')
      || readFlag(args, 'skill-governance-mode')
      || process.env.ZAVORTH_SKILLS_GOVERNANCE_MODE
      || 'casual',
    ),
    wakeDetectorMode: normalizeWakeDetectorMode(
      readFlag(args, 'wake-detector')
      || readFlag(args, 'wake-mode')
      || (args.includes('--wake-disabled') ? 'disabled' : null)
      || (args.includes('--wake-custom-command') ? 'custom-command' : null)
      || (args.includes('--wake-default-local') ? 'default-local' : null),
    ),
    wakeCommand: readFlag(args, 'wake-command'),
    wakeArgs: readFlag(args, 'wake-args'),
    providerId,
    modelId: readFlag(args, 'model') || readFlag(args, 'model-id') || provider.defaultModel,
    providerSecret: readFlag(args, 'secret') || readFlag(args, 'provider-secret') || readFlag(args, 'key'),
    telegramBotToken: readFlag(args, 'telegram-token'),
    telegramAllowedUserIds: readFlag(args, 'telegram-users') || readFlag(args, 'allowed-users'),
    discordBotToken: readFlag(args, 'discord-token'),
    slackBotToken: readFlag(args, 'slack-token'),
    emailSmtpUrl: readFlag(args, 'email-smtp-url') || readFlag(args, 'smtp-url'),
    searchProvider: normalizeSearchProvider(readFlag(args, 'search-provider') || readFlag(args, 'web-search-provider')),
    searchSecret: readFlag(args, 'search-secret') || readFlag(args, 'web-search-secret'),
    enableHooks: args.includes('--enable-hooks') || args.includes('--hooks'),
    memoryMode: normalizeMemoryMode(readFlag(args, 'memory-mode')),
    vaultScope: normalizeVaultScope(readFlag(args, 'vault-scope')),
    scanDirs: readAllFlags(args, 'scan-dir'),
  };
}

function mergeAnswersWithProgress(
  answers: SetupStudioCliAnswers,
  progress: ReturnType<ZavorthSetupStudioProgressStore['read']>,
  args: string[],
): SetupStudioCliAnswers {
  if (!progress) {
    return answers;
  }
  const providerExplicit = hasAnyFlag(args, ['provider', 'provider-id', 'provider-query', 'search-provider-name']);
  const modelExplicit = hasAnyFlag(args, ['model', 'model-id']);
  const searchExplicit = hasAnyFlag(args, ['search-provider', 'web-search-provider']);
  const hooksExplicit = args.includes('--enable-hooks') || args.includes('--hooks');
  return {
    ...answers,
    providerId: !providerExplicit && answers.providerId === 'deferred' && progress.providerId
      ? progress.providerId
      : answers.providerId,
    modelId: !modelExplicit && progress.modelId ? progress.modelId : answers.modelId,
    searchProvider: !searchExplicit && progress.webSearchProvider ? progress.webSearchProvider : answers.searchProvider,
    enableHooks: !hooksExplicit && typeof progress.hooksEnabled === 'boolean' ? progress.hooksEnabled : answers.enableHooks,
  };
}

function defaultAnswers(): SetupStudioCliAnswers {
  return {
    zavorthHome: null,
    skillsGovernanceMode: normalizeSkillsGovernanceMode(process.env.ZAVORTH_SKILLS_GOVERNANCE_MODE || 'casual'),
    wakeDetectorMode: normalizeWakeDetectorMode(process.env.ZAVORTH_WAKE_EMBEDDED === '1' ? 'default-local' : process.env.ZAVORTH_WAKE_COMMAND ? 'custom-command' : 'default-local'),
    wakeCommand: process.env.ZAVORTH_WAKE_COMMAND || null,
    wakeArgs: process.env.ZAVORTH_WAKE_ARGS || null,
    providerId: 'deferred',
    modelId: null,
    providerSecret: null,
    telegramBotToken: null,
    telegramAllowedUserIds: null,
    discordBotToken: null,
    slackBotToken: null,
    emailSmtpUrl: null,
    searchProvider: 'local',
    searchSecret: null,
    enableHooks: false,
    memoryMode: 'local-metadata',
    vaultScope: 'skip',
    scanDirs: [],
  };
}

function hasAnyFlag(args: string[], names: string[]): boolean {
  return names.some((name) => args.some((arg) => arg === `--${name}` || arg.startsWith(`--${name}=`)));
}

function hasDirectConfiguration(args: string[]): boolean {
  return args.some((arg) => [
    '--provider',
    '--provider-id',
    '--provider-query',
    '--search-provider-name',
    '--model',
    '--model-id',
    '--telegram-token',
    '--telegram-users',
    '--discord-token',
    '--slack-token',
    '--email-smtp-url',
    '--smtp-url',
    '--search-provider',
    '--web-search-provider',
    '--search-secret',
    '--web-search-secret',
    '--memory-mode',
    '--vault-scope',
    '--scan-dir',
    '--home',
    '--zavorth-home',
    '--skills-governance',
    '--skill-governance',
    '--skills-governance-mode',
    '--skill-governance-mode',
    '--wake-detector',
    '--wake-mode',
    '--wake-command',
    '--wake-args',
    '--wake-disabled',
    '--wake-custom-command',
    '--wake-default-local',
    '--enable-hooks',
    '--hooks',
    '--key',
    '--skip-conversational',
  ].some((name) => arg === name || arg.startsWith(`${name}=`)));
}

function resolveProviderQuery(value: string | null): string | null {
  const query = String(value || '').trim().toLowerCase();
  if (!query) {
    return null;
  }
  const matches = ZAVORTH_SETUP_STUDIO_PROVIDER_OPTIONS
    .map((provider) => ({
      provider,
      score: provider.id === query
        ? 0
        : provider.id.startsWith(query)
          ? 1
          : provider.label.toLowerCase() === query
            ? 2
            : provider.label.toLowerCase().startsWith(query)
              ? 3
              : provider.id.includes(query)
                ? 4
                : provider.label.toLowerCase().includes(query)
                  ? 5
                  : provider.defaultModel.toLowerCase().includes(query)
                    ? 6
                    : 99,
    }))
    .filter((entry) => entry.score < 99)
    .sort((left, right) => left.score - right.score || left.provider.label.localeCompare(right.provider.label));
  const match = matches[0]?.provider || null;
  return match?.id || null;
}

function normalizeSearchProvider(value: string | null): SetupStudioCliAnswers['searchProvider'] {
  return value === 'skip'
    || value === 'brave'
    || value === 'ollama-web'
    || value === 'google'
    || value === 'grok'
    || value === 'kimi'
    || value === 'minimax'
    || value === 'perplexity'
    || value === 'tavily'
    || value === 'firecrawl'
    ? value
    : 'local';
}

function normalizeMemoryMode(value: string | null): SetupStudioCliAnswers['memoryMode'] {
  return value === 'off' || value === 'local-summary' ? value : 'local-metadata';
}

function normalizeVaultScope(value: string | null): SetupStudioCliAnswers['vaultScope'] {
  return value === 'documents' || value === 'downloads' || value === 'custom' || value === 'whole-pc'
    ? value
    : 'skip';
}

function normalizeSkillsGovernanceMode(value: string | null): SetupStudioCliAnswers['skillsGovernanceMode'] {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'governed' || normalized === 'strict' || normalized === 'enterprise'
    ? 'governed'
    : 'casual';
}

function normalizeWakeDetectorMode(value: string | null): SetupStudioCliAnswers['wakeDetectorMode'] {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'off' || normalized === 'disabled' || normalized === 'disable') return 'disabled';
  if (normalized === 'custom' || normalized === 'custom-command') return 'custom-command';
  return 'default-local';
}

function readFlag(args: string[], name: string): string | null {
  const inline = args.find((arg) => arg.startsWith(`--${name}=`));
  if (inline) {
    return inline.slice(name.length + 3);
  }
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] && !args[index + 1].startsWith('--') ? args[index + 1] : null;
}

function readAllFlags(args: string[], name: string): string[] {
  const values: string[] = [];
  const prefix = `--${name}=`;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg.startsWith(prefix)) {
      values.push(arg.slice(prefix.length));
    } else if (arg === `--${name}` && args[index + 1] && !args[index + 1].startsWith('--')) {
      values.push(args[index + 1]);
      index += 1;
    }
  }
  return values;
}

function readEnvUpdateValue(snapshot: ZavorthSetupStudioSnapshot, key: string | null): string | null {
  if (!key) {
    return null;
  }
  return snapshot.plan.envUpdates.find((entry) => entry.key === key)?.value || null;
}

function snapshotEnvironment(snapshot: ZavorthSetupStudioSnapshot): Map<string, string | undefined> {
  const keys = new Set([
    'ZAVORTH_DEFAULT_PROVIDER',
    ...snapshot.plan.envUpdates.map((entry) => entry.key),
  ]);
  return new Map(Array.from(keys).map((key) => [key, process.env[key]]));
}

function restoreEnvironment(snapshot: Map<string, string | undefined>): void {
  for (const [key, value] of snapshot.entries()) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}
