import { ZAVORTH_SETUP_STUDIO_PROVIDER_OPTIONS } from '../ZavorthSetupStudioService.js';
import type {
  ZavorthSetupStudioSection,
  ZavorthSetupStudioSnapshot,
  ZavorthSetupWizardContract,
  ZavorthSetupWizardStep,
} from './ZavorthSetupStudioSchema.js';

export function buildZavorthSetupWizardContract(
  snapshot: Omit<ZavorthSetupStudioSnapshot, 'wizard'>,
): ZavorthSetupWizardContract {
  const section = normalizeSetupSection(snapshot.setupSection);
  const steps = buildAllWizardSteps(snapshot).filter((step) => (
    section === 'all' || step.section === section
  ));
  return {
    contractVersion: 'zavorth-setup-wizard-contract/1',
    generatedAt: snapshot.generatedAt,
    locale: 'en',
    section,
    steps,
  };
}

export function normalizeSetupSection(value: unknown): ZavorthSetupStudioSection {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'provider' || normalized === 'model' || normalized === 'models') {
    return 'provider';
  }
  if (normalized === 'channels' || normalized === 'channel' || normalized === 'surfaces') {
    return 'channels';
  }
  if (normalized === 'tools' || normalized === 'tooling' || normalized === 'skills' || normalized === 'hooks' || normalized === 'search') {
    return 'tools';
  }
  if (normalized === 'agent' || normalized === 'workspace' || normalized === 'trust' || normalized === 'memory') {
    return 'agent';
  }
  return 'all';
}

function buildAllWizardSteps(snapshot: Omit<ZavorthSetupStudioSnapshot, 'wizard'>): ZavorthSetupWizardStep[] {
  return [
    {
      id: 'setup-mode',
      section: 'agent',
      type: 'select',
      title: 'Setup mode',
      message: 'Choose the default posture for this setup run.',
      options: [
        { value: 'quickstart', label: 'QuickStart', hint: 'balanced defaults' },
        { value: 'safe', label: 'Safe', hint: 'conservative defaults' },
        { value: 'advanced', label: 'Advanced', hint: 'show detailed controls' },
        { value: 'blank-slate', label: 'Blank Slate', hint: 'minimal opt-in setup' },
      ],
      initialValue: snapshot.mode,
    },
    {
      id: 'config-handling',
      section: 'agent',
      type: 'select',
      title: 'Existing config',
      message: 'Choose how this run handles existing local setup values.',
      options: [
        { value: 'keep', label: 'Keep current values' },
        { value: 'review', label: 'Review and update' },
        { value: 'reset', label: 'Reset managed setup keys with backup' },
      ],
      initialValue: snapshot.configHandling,
    },
    {
      id: 'home',
      section: 'agent',
      type: 'text',
      title: 'Instance home',
      message: 'Choose the local Zavorth home path for this instance.',
      initialValue: snapshot.home.root,
      placeholder: snapshot.projectRoot,
    },
    {
      id: 'provider',
      section: 'provider',
      type: 'select',
      title: 'Model provider',
      message: 'Choose the default provider route.',
      options: ZAVORTH_SETUP_STUDIO_PROVIDER_OPTIONS.map((provider) => ({
        value: provider.id,
        label: provider.label,
        hint: provider.defaultModel,
      })),
      initialValue: snapshot.plan.provider.id,
    },
    {
      id: 'model',
      section: 'provider',
      type: 'text',
      title: 'Default model',
      message: 'Choose the model id used by the selected provider.',
      initialValue: snapshot.plan.provider.modelId,
      placeholder: 'model-id',
    },
    {
      id: 'provider-secret',
      section: 'provider',
      type: 'text',
      title: 'Provider credential',
      message: 'Capture the provider credential through a secret field.',
      sensitive: true,
      placeholder: snapshot.plan.provider.secretEnvKey || 'configure later',
    },
    {
      id: 'channels',
      section: 'channels',
      type: 'multiselect',
      title: 'Communication surfaces',
      message: 'Choose remote surfaces to prepare now.',
      options: snapshot.channelGuide
        .filter((channel) => channel.id !== 'terminal' && channel.id !== 'zavorthControl' && channel.id !== 'control')
        .map((channel) => ({
          value: channel.id,
          label: channel.label,
          hint: channel.detail,
        })),
      initialValue: selectedChannelIds(snapshot),
    },
    {
      id: 'telegram-token',
      section: 'channels',
      type: 'text',
      title: 'Telegram token',
      message: 'Capture the Telegram bot token through a secret field.',
      sensitive: true,
      placeholder: 'TELEGRAM_BOT_TOKEN',
    },
    {
      id: 'telegram-users',
      section: 'channels',
      type: 'text',
      title: 'Telegram allowlist',
      message: 'Enter allowed Telegram user ids, separated by commas.',
      placeholder: '123456789',
    },
    {
      id: 'discord-token',
      section: 'channels',
      type: 'text',
      title: 'Discord token',
      message: 'Capture the Discord bot token through a secret field.',
      sensitive: true,
      placeholder: 'DISCORD_BOT_TOKEN',
    },
    {
      id: 'slack-token',
      section: 'channels',
      type: 'text',
      title: 'Slack token',
      message: 'Capture the Slack bot token through a secret field.',
      sensitive: true,
      placeholder: 'SLACK_BOT_TOKEN',
    },
    {
      id: 'email-smtp-url',
      section: 'channels',
      type: 'text',
      title: 'Email SMTP URL',
      message: 'Capture the SMTP connection URL through a secret field.',
      sensitive: true,
      placeholder: 'EMAIL_SMTP_URL',
    },
    {
      id: 'web-search',
      section: 'tools',
      type: 'select',
      title: 'Web/search',
      message: 'Choose how the agent should gather current source-backed context.',
      options: snapshot.webSearch.options.map((option) => ({
        value: option.id,
        label: option.label,
        hint: option.detail,
      })),
      initialValue: snapshot.plan.webSearch.provider,
    },
    {
      id: 'search-secret',
      section: 'tools',
      type: 'text',
      title: 'Search credential',
      message: 'Capture the search credential through a secret field when required.',
      sensitive: true,
      placeholder: snapshot.plan.webSearch.secretEnvKey || 'optional',
    },
    {
      id: 'skills',
      section: 'tools',
      type: 'progress',
      title: 'Skills readiness',
      message: `${snapshot.skills.eligible} eligible, ${snapshot.skills.missingRequirements} missing requirements.`,
      command: snapshot.skills.recommendedSetupCommand,
    },
    {
      id: 'hooks',
      section: 'tools',
      type: 'confirm',
      title: 'Automation templates',
      message: 'Prepare disabled automation templates for review.',
      initialValue: snapshot.plan.hooks.enabled,
      command: snapshot.hooks.setupCommand,
    },
    {
      id: 'memory',
      section: 'agent',
      type: 'select',
      title: 'Memory mode',
      message: 'Choose the local memory posture for this setup run.',
      options: [
        { value: 'local-metadata', label: 'local metadata' },
        { value: 'local-summary', label: 'local summaries' },
        { value: 'off', label: 'Off' },
      ],
      initialValue: snapshot.plan.memory.mode,
    },
    {
      id: 'vault-scope',
      section: 'agent',
      type: 'select',
      title: 'Memory scan scope',
      message: 'Choose which local files may be considered for memory setup.',
      options: [
        { value: 'skip', label: 'Skip for now' },
        { value: 'documents', label: 'Documents' },
        { value: 'downloads', label: 'Downloads' },
        { value: 'custom', label: 'Custom path' },
        { value: 'whole-pc', label: 'Whole PC' },
      ],
      initialValue: snapshot.plan.memory.vaultScope,
    },
    {
      id: 'wake-detector',
      section: 'agent',
      type: 'select',
      title: 'Wake detector',
      message: 'Choose whether setup should prepare local wake detection.',
      options: [
        { value: 'default-local', label: 'Default local detector' },
        { value: 'custom-command', label: 'Custom detector command' },
        { value: 'disabled', label: 'Keep off' },
      ],
      initialValue: snapshot.plan.wakeDetector.mode,
    },
    {
      id: 'gateway',
      section: 'agent',
      type: 'action',
      title: 'Runtime service',
      message: snapshot.gateway.detail,
      command: snapshot.gateway.startCommand,
    },
    {
      id: 'control-ui',
      section: 'agent',
      type: 'action',
      title: 'ZavorthControl',
      message: `Token status: ${snapshot.controlUi.tokenStatus}`,
      command: snapshot.controlUi.openCommand,
    },
    {
      id: 'hatch',
      section: 'agent',
      type: 'action',
      title: 'Hatch agent',
      message: snapshot.hatch.bootstrapPrompt,
      command: snapshot.hatch.commands[0] || 'zavorth hatch',
    },
  ];
}

function selectedChannelIds(snapshot: Omit<ZavorthSetupStudioSnapshot, 'wizard'>): string[] {
  return [
    snapshot.plan.channels.telegram !== 'skip' ? 'telegram' : null,
    snapshot.plan.channels.discord !== 'skip' ? 'discord' : null,
    snapshot.plan.channels.slack !== 'skip' ? 'slack' : null,
    snapshot.plan.channels.email !== 'skip' ? 'email' : null,
  ].filter((value): value is string => Boolean(value));
}
