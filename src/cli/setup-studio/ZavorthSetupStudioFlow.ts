import { renderZavorthSetupStudioPlan } from '../ZavorthSetupStudioService.js';
import type { ZavorthSetupStudioSnapshot } from './ZavorthSetupStudioSchema.js';
import {
  buildZavorthSetupStudioSnapshot,
  type BuildZavorthSetupStudioSnapshotInput,
} from './ZavorthSetupStudioState.js';

export function buildZavorthSetupStudioDryRunScreen(
  input: BuildZavorthSetupStudioSnapshotInput,
): string {
  return renderZavorthSetupStudioSnapshot(
    buildZavorthSetupStudioSnapshot({ ...input, dryRun: true }),
  );
}

export function renderZavorthSetupStudioSnapshot(snapshot: ZavorthSetupStudioSnapshot): string {
  const existingConfig = [
    `profile   ${snapshot.existingConfig.profileExists ? 'detected' : 'not found'}`,
    `.env      ${snapshot.existingConfig.envExists ? 'detected' : 'not found'}`,
    `provider  ${snapshot.existingConfig.configuredProvider || 'not configured'}`,
    `model     ${snapshot.existingConfig.configuredModel || 'not configured'}`,
    `channels  ${snapshot.existingConfig.configuredChannels.join(', ') || 'none'}`,
  ];
  const channelLines = snapshot.channelGuide.map((channel) => {
    const status = channel.status === 'ready'
      ? 'ready'
      : channel.status === 'recommended'
        ? 'recommended'
        : channel.status === 'missing-config'
          ? 'needs config'
          : 'available';
    return `- ${channel.label}: ${status} (${channel.setupCommand})`;
  });
  const skillLines = [
    `eligible              ${snapshot.skills.eligible}`,
    `missing requirements  ${snapshot.skills.missingRequirements}`,
    `unsupported on OS     ${snapshot.skills.unsupportedOnThisOs}`,
    `blocked by policy     ${snapshot.skills.blockedByPolicy}`,
    '',
    ...snapshot.skills.highlights.map((item) => `- ${item}`),
  ];
  const gatewayLines = [
    `runtime  ${snapshot.gateway.recommendedRuntime}`,
    `gateway  ${snapshot.gateway.installed ? 'detected' : 'needs build'}`,
    `start    ${snapshot.gateway.startCommand}`,
    `control  ${snapshot.controlUi.url}`,
    `token    ${snapshot.controlUi.tokenStatus}`,
    '',
    snapshot.gateway.detail,
  ];
  const sections = [
    onboardingSection('Security', setupSecurityNoticeLines()),
    onboardingSection('Setup Studio', [
      snapshot.safety.dryRun ? 'Dry-run preview. No files will be changed.' : 'Guided setup for provider, channels, Mnemos and trust.',
      `Workspace: ${snapshot.projectRoot}`,
      `Mode: ${snapshot.mode}`,
      `Config handling: ${snapshot.configHandling}`,
      'Safety: preview + approval + receipts',
    ]),
    onboardingSection('Existing config', existingConfig),
    onboardingSection('Setup plan', renderZavorthSetupStudioPlan(snapshot.plan).split('\n')),
    onboardingSection('Channels', channelLines),
    onboardingSection('Web search', [
      `provider  ${snapshot.webSearch.provider}`,
      `status    ${snapshot.webSearch.status}`,
      '',
      ...snapshot.webSearch.options.map((option) => `- ${option.label}: ${option.detail}${option.requiresSecret ? ' [key]' : ''}`),
    ]),
    onboardingSection('Skills status', skillLines),
    onboardingSection('Automation templates', [
      snapshot.hooks.configured ? 'Automation templates prepared.' : 'No automation templates prepared yet.',
      'Optional templates for reminders, receipts and Mnemos summaries.',
      'They stay disabled until you review and enable them.',
      `Setup: ${snapshot.hooks.setupCommand}`,
      '',
      ...snapshot.hooks.examples.map((example) => `- ${example}`),
    ]),
    onboardingSection('Gateway service runtime', gatewayLines),
    onboardingSection('Hatch your agent', [
      `mode: ${snapshot.hatch.recommendedMode}`,
      `prompt: ${snapshot.hatch.bootstrapPrompt}`,
      '',
      ...snapshot.hatch.commands.map((command) => `- ${command}`),
    ]),
    onboardingSection('Next actions', snapshot.nextActions
      .map((action) => `> ${action.label}\n  ${action.command}${action.detail ? `\n  ${action.detail}` : ''}`)
      .flatMap((line) => line.split('\n'))),
  ];
  if (snapshot.existingConfig.warnings.length > 0) {
    sections.push(onboardingSection('Attention', snapshot.existingConfig.warnings));
  }
  return [
    '',
    renderZavorthOnboardingPrelude(),
    '',
    renderZavorthOnboardingWordmark(),
    renderZavorthOnboardingBrandLine(),
    '',
    '',
    'o  Zavorth first light',
    '|',
    ...sections.flat(),
  ].join('\n');
}

export function renderZavorthSetupStudioFinalReview(snapshot: ZavorthSetupStudioSnapshot): string {
  const updates = snapshot.plan.envUpdates.length;
  const provider = snapshot.plan.provider.id === 'deferred'
    ? 'Configure later'
    : `${snapshot.plan.provider.id}/${snapshot.plan.provider.modelId}`;
  const channels = [
    snapshot.plan.channels.telegram !== 'skip' ? 'Telegram' : null,
    snapshot.plan.channels.discord !== 'skip' ? 'Discord' : null,
    snapshot.plan.channels.slack !== 'skip' ? 'Slack' : null,
    snapshot.plan.channels.email !== 'skip' ? 'Email' : null,
  ].filter(Boolean).join(', ') || 'none';
  const lines = [
    `Provider: ${provider}`,
    `Web/search: ${snapshot.plan.webSearch.provider}`,
    `Channels: ${channels}`,
    `Mnemos: ${snapshot.plan.memory.mode} / ${snapshot.plan.memory.vaultScope}`,
    `Automation: ${snapshot.plan.hooks.enabled ? `${snapshot.plan.hooks.templates.length} templates prepared disabled` : 'skip'}`,
    `.env updates: ${updates === 0 ? 'none' : `${updates} key(s), secrets redacted`}`,
    '',
    'No runtime service will be started.',
    'Sensitive actions still require policy, approval and receipts.',
  ];
  return compactSection('Setup review', lines);
}

export function renderZavorthSetupAppliedSummary(snapshot: ZavorthSetupStudioSnapshot, result: {
  written: boolean;
  keys: string[];
  envFile: string;
}): string {
  const lines = [
    result.written
      ? `Updated ${result.keys.length} key(s) in ${result.envFile}`
      : 'No .env updates were needed.',
    snapshot.plan.hooks.enabled
      ? `Automation templates prepared in .zavorth/hooks (${snapshot.plan.hooks.templates.length}).`
      : 'Automation templates skipped.',
    '',
    'Next commands:',
    ...snapshot.plan.nextCommands.map((command) => `- ${command}`),
  ];
  return compactSection('Setup complete', lines);
}

export function renderZavorthOnboardingWordmark(): string {
  return ZAVORTH_ONBOARDING_WORDMARK
    .map((line) => `  ${paintBannerLine(line)}`)
    .join('\n');
}

export function renderZavorthOnboardingBrandLine(): string {
  const title = '🦊 ZAVORTH 🦊';
  const bannerWidth = Math.max(...ZAVORTH_ONBOARDING_WORDMARK.map((line) => visibleLength(line)));
  const pad = Math.max(0, bannerWidth - visibleLength(title));
  return `${' '.repeat(2 + Math.floor(pad / 2))}${orange(title)}`;
}

export function renderZavorthOnboardingPrelude(): string {
  return [
    `${orange('🦊 Zavorth')} ${soft('1.1.0')} ${muted('(local)')}`,
    `  ${warm('Trust boundaries exist because capable agents deserve clear consent.')}`,
  ].join('\n');
}

export function renderZavorthSetupSecurityNotice(): string {
  return setupSecurityNoticeLines().flatMap((line) => wrapLine(line, 78)).map((line) => {
    if (line === 'Security warning - please read.') return orange(line);
    if (line.startsWith('Recommended baseline') || line.startsWith('Run regularly')) return orange(line);
    if (line.startsWith('zavorth ')) return orange(line);
    return line;
  }).join('\n');
}

function setupSecurityNoticeLines(): string[] {
  return [
    'Security warning - please read.',
    '',
    'Zavorth is a local-first AI agent and still needs explicit trust boundaries.',
    'By default, Zavorth is a personal operator boundary: one trusted user, one local workspace, governed tools.',
    'If channels or shared inboxes are enabled, unknown senders should be paired or allowlisted before they can reach tools.',
    '',
    'Zavorth can read files, call providers, route channel messages and prepare local actions when capabilities are enabled.',
    'Sensitive work stays behind preview, policy, approval, sandbox and receipts.',
    'A bad prompt or misconfigured channel can still attempt unsafe actions if you enable broad capabilities.',
    '',
    'Recommended baseline:',
    '- Pairing/allowlists for every remote channel.',
    '- Separate trust boundaries for shared or multi-user use.',
    '- Sandbox and least-privilege tools for mutations.',
    '- Keep secrets out of prompts, logs, screenshots and reachable files.',
    '- Use the strongest available model for tool-enabled or untrusted inboxes.',
    '',
    'Run regularly:',
    'zavorth security audit',
    'zavorth certify',
  ];
}

function onboardingSection(title: string, lines: string[]): string[] {
  const cleanLines = lines.length ? lines : [''];
  const width = Math.min(82, Math.max(
    50,
    title.length + 8,
    ...cleanLines.map((line) => Math.min(visibleLength(line) + 4, 82)),
  ));
  const top = `o  ${orange(title)} ${'-'.repeat(Math.max(1, width - title.length - 5))}+`;
  const body = cleanLines.flatMap((line) => wrapLine(line, width - 4))
    .map((line) => `|  ${line.padEnd(width - 4)} |`);
  return [
    top,
    ...body,
    `+${'-'.repeat(width - 1)}+`,
    '|',
  ];
}

function compactSection(title: string, lines: string[]): string {
  const cleanLines = lines.length ? lines : [''];
  const width = Math.min(72, Math.max(
    44,
    title.length + 8,
    ...cleanLines.map((line) => Math.min(visibleLength(line) + 4, 72)),
  ));
  const top = `o  ${orange(title)} ${'-'.repeat(Math.max(1, width - title.length - 5))}+`;
  const body = cleanLines.flatMap((line) => wrapLine(line, width - 4))
    .map((line) => `|  ${line.padEnd(width - 4)} |`);
  return [
    top,
    ...body,
    `+${'-'.repeat(width - 1)}+`,
  ].join('\n');
}

function wrapLine(value: string, width: number): string[] {
  if (!value) return [''];
  if (visibleLength(value) <= width) return [value];
  const out: string[] = [];
  let current = '';
  for (const word of value.split(/\s+/u)) {
    const next = current ? `${current} ${word}` : word;
    if (visibleLength(next) > width && current) {
      out.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) out.push(current);
  return out;
}

function visibleLength(value: string): number {
  return String(value).replace(/\x1b\[[0-9;]*m/gu, '').length;
}

function orange(value: string): string {
  if (String(process.env.NO_COLOR || '').trim()) return value;
  if (!process.stdout?.isTTY && !String(process.env.FORCE_COLOR || '').trim()) return value;
  return `\u001b[38;2;255;111;31m${value}\u001b[0m`;
}

function warm(value: string): string {
  if (String(process.env.NO_COLOR || '').trim()) return value;
  if (!process.stdout?.isTTY && !String(process.env.FORCE_COLOR || '').trim()) return value;
  return `\u001b[38;2;255;151;109m${value}\u001b[0m`;
}

function soft(value: string): string {
  if (String(process.env.NO_COLOR || '').trim()) return value;
  if (!process.stdout?.isTTY && !String(process.env.FORCE_COLOR || '').trim()) return value;
  return `\u001b[38;2;255;214;179m${value}\u001b[0m`;
}

function muted(value: string): string {
  if (String(process.env.NO_COLOR || '').trim()) return value;
  if (!process.stdout?.isTTY && !String(process.env.FORCE_COLOR || '').trim()) return value;
  return `\u001b[38;2;150;142;137m${value}\u001b[0m`;
}

function paintBannerLine(value: string): string {
  if (String(process.env.NO_COLOR || '').trim()) return value;
  if (!process.stdout?.isTTY && !String(process.env.FORCE_COLOR || '').trim()) return value;
  return Array.from(value).map((char) => {
    if (char === '█') return `\u001b[38;2;255;111;31m${char}\u001b[0m`;
    if ('╗╔╝╚║═'.includes(char)) return `\u001b[38;2;166;72;23m${char}\u001b[0m`;
    return char;
  }).join('');
}

const ZAVORTH_ONBOARDING_WORDMARK = [
  '███████╗ █████╗ ██╗   ██╗ ██████╗ ██████╗ ████████╗██╗  ██╗',
  '╚══███╔╝██╔══██╗██║   ██║██╔═══██╗██╔══██╗╚══██╔══╝██║  ██║',
  '  ███╔╝ ███████║██║   ██║██║   ██║██████╔╝   ██║   ███████║',
  ' ███╔╝  ██╔══██║╚██╗ ██╔╝██║   ██║██╔══██╗   ██║   ██╔══██║',
  '███████╗██║  ██║ ╚████╔╝ ╚██████╔╝██║  ██║   ██║   ██║  ██║',
  '╚══════╝╚═╝  ╚═╝  ╚═══╝   ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝',
];
