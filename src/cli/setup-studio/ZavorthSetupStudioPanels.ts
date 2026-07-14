import type { ZavorthSetupStudioSnapshot } from './ZavorthSetupStudioSchema.js';
import {
  renderZavorthOnboardingBrandLine,
  renderZavorthOnboardingPrelude,
  renderZavorthOnboardingWordmark,
} from './ZavorthSetupStudioFlow.js';

export function renderExistingConfigPanel(snapshot: ZavorthSetupStudioSnapshot): string {
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

export function renderHomeSelectionPanel(home: string | null, previousSource: string): string {
  return [
    home
      ? `Selected ZAVORTH_HOME: ${home}`
      : `Keeping current home mode: ${previousSource}`,
    'Setup writes the selection only after final confirmation.',
    'You can switch later with: zavorth home switch --home <path> --apply',
  ].join('\n');
}

export function renderSkillGovernanceIntroPanel(): string {
  return [
    'Casual: fewer prompts for normal personal skill imports.',
    'Governed: stricter review for teams, legal/compliance, or sensitive workspaces.',
    'Both modes keep hard blockers active for exfiltration, destructive scripts, unsafe paths and restricted licenses.',
    'You can switch later with: zavorth skills governance governed --apply',
  ].join('\n');
}

export function renderSkillGovernanceSelectionPanel(mode: string): string {
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

export function resolveSetupHomeChoice(projectRoot: string, choice: string, customHome: string, currentHome: string): string | null {
  if (choice === '__custom__') {
    return customHome.trim() || currentHome;
  }
  if (choice === '__default__') {
    return `${projectRoot.replace(/[\\/]$/u, '')}${projectRoot.includes('\\') ? '\\' : '/'}${'.zavorth-home'}`;
  }
  return null;
}

export function renderModelCheckPanel(providerId: string, needsSecret: boolean, secretKey: string | null, secretProvided: boolean): string {
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

export function renderHowChannelsWorkPanel(): string {
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
    'ZavorthControl: local visual control plane for approvals, diffs and evidence.',
  ].join('\n');
}

export function renderWebSearchIntroPanel(): string {
  return [
    'Web search lets Zavorth look things up online when the LLM needs current sources.',
    'Some providers need an API key; local/model context keeps the agent local-first.',
    'Search adapters must return verifiable URLs or citations before results are treated as web evidence.',
  ].join('\n');
}

export function renderWebSearchProviderPanel(provider: string, secretProvided: boolean): string {
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

export function renderSkillsStatusPanel(snapshot: ZavorthSetupStudioSnapshot): string {
  return [
    `Eligible: ${snapshot.skills.eligible}`,
    `Missing requirements: ${snapshot.skills.missingRequirements}`,
    `Unsupported on this OS: ${snapshot.skills.unsupportedOnThisOs}`,
    `Blocked by policy: ${snapshot.skills.blockedByPolicy}`,
    '',
    ...snapshot.skills.highlights.map((item) => `- ${item}`),
  ].join('\n');
}

export function renderAutomationHooksPanel(enabled: boolean): string {
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

export function renderGatewayPanel(snapshot: ZavorthSetupStudioSnapshot): string {
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

export function renderControlUiPanel(snapshot: ZavorthSetupStudioSnapshot): string {
  return [
    `Web UI: ${snapshot.controlUi.url}`,
    `Token: ${snapshot.controlUi.tokenStatus}`,
    `Open: ${snapshot.controlUi.openCommand}`,
    `Docs: ${snapshot.controlUi.docsCommand}`,
  ].join('\n');
}

export function renderHatchPanel(snapshot: ZavorthSetupStudioSnapshot): string {
  return [
    'Your workspace is ready for a first terminal chat once a provider is configured.',
    `Recommended mode: ${snapshot.hatch.recommendedMode}`,
    `First prompt: ${snapshot.hatch.bootstrapPrompt}`,
    '',
    ...snapshot.hatch.commands.map((command) => `- ${command}`),
  ].join('\n');
}

export function providerHint(providerId: string, defaultModel: string): string {
  if (providerId === 'openai') return 'ChatGPT/Codex API key';
  if (providerId === 'anthropic') return 'Claude API key';
  if (providerId === 'gemini') return 'Gemini API key';
  if (providerId === 'openrouter') return 'multi-provider gateway';
  if (providerId === 'local') return 'no key; local-first';
  return defaultModel;
}

export function searchSecretEnvLabel(provider: string): string | null {
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

export async function renderSetupStudioHero(): Promise<string> {
  return [
    renderZavorthOnboardingPrelude(),
    '',
    renderZavorthOnboardingWordmark(),
    renderZavorthOnboardingBrandLine(),
    '',
    '',
  ].join('\n');
}
