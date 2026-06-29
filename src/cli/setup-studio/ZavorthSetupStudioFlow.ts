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
    `profile: ${snapshot.existingConfig.profileExists ? 'detected' : 'not found'}`,
    `.env: ${snapshot.existingConfig.envExists ? 'detected' : 'not found'}`,
    `provider: ${snapshot.existingConfig.configuredProvider || 'not configured'}`,
    `model: ${snapshot.existingConfig.configuredModel || 'not configured'}`,
    `channels: ${snapshot.existingConfig.configuredChannels.join(', ') || 'none'}`,
  ];
  const selectedChannels = [
    snapshot.plan.channels.telegram !== 'skip' ? `Telegram: ${snapshot.plan.channels.telegram}` : null,
    snapshot.plan.channels.discord !== 'skip' ? `Discord: ${snapshot.plan.channels.discord}` : null,
    snapshot.plan.channels.slack !== 'skip' ? `Slack: ${snapshot.plan.channels.slack}` : null,
    snapshot.plan.channels.email !== 'skip' ? `Email: ${snapshot.plan.channels.email}` : null,
  ].filter(Boolean) as string[];
  const channelSummary = selectedChannels.length > 0
    ? selectedChannels
    : ['No remote channel selected. Terminal and Dashboard remain available.'];
  const readinessLines = [
    `Tools: ${snapshot.skills.eligible} available, ${snapshot.skills.missingRequirements} need setup`,
    `Unsupported here: ${snapshot.skills.unsupportedOnThisOs}`,
    `Blocked by policy: ${snapshot.skills.blockedByPolicy}`,
  ];
  const capabilityActionLines = [
    `Available: ${snapshot.capabilityActions.exposed}`,
    `Receipts: ${snapshot.capabilityActions.receipts}`,
    'Activation: preview and owner approval remain required.',
    `Status: ${snapshot.capabilityActions.statusCommand}`,
    ...snapshot.capabilityActions.items.slice(0, 3).map((entry) => `- ${entry.title}: ${entry.nextAction}`),
  ];
  const modelCheckLines = snapshot.plan.provider.id === 'deferred'
    ? [
      'No model is selected yet.',
      'You can finish setup, but live agent replies need a provider or a local model.',
      'Next: choose a provider here, use Ollama locally, or keep configuration for later.',
    ]
    : [
      `Selected: ${snapshot.plan.provider.id} / ${snapshot.plan.provider.modelId}`,
      snapshot.plan.provider.secretEnvKey
        ? 'Credential will be captured as a secret and never printed.'
        : 'No API key is required for this choice.',
      'Live validation runs only after explicit confirmation.',
    ];
  const surfacesLines = [
    'Terminal and Dashboard are local control surfaces.',
    'Remote surfaces require pairing or allowlists before messages can reach tools.',
    'Unknown senders stay outside the tool boundary until you approve them.',
    '',
    ...channelSummary,
  ];
  const gatewayLines = [
    `Runtime: ${snapshot.gateway.recommendedRuntime}`,
    `Gateway: ${snapshot.gateway.installed ? 'detected' : 'not installed yet'}`,
    `Dashboard: ${snapshot.controlUi.url}`,
    snapshot.gateway.installed
      ? 'Setup will not restart persistent services automatically.'
      : 'Setup can finish now; start the runtime later when you are ready.',
  ];
  const providerLine = snapshot.plan.provider.id === 'deferred'
    ? 'Provider: configure later'
    : `Provider: ${snapshot.plan.provider.id} / ${snapshot.plan.provider.modelId}`;
  const envLine = snapshot.plan.envUpdates.length === 0
    ? '.env updates: none'
    : `.env updates: ${snapshot.plan.envUpdates.length} key(s), secrets redacted`;
  const automationLine = snapshot.plan.hooks.enabled
    ? `Automation: ${snapshot.plan.hooks.templates.length} template(s), disabled until reviewed`
    : 'Automation: skip';
  const sections = [
    onboardingSection('Security', setupSecurityNoticeLines({ compact: true })),
    onboardingSection('Workspace', [
      snapshot.safety.dryRun ? 'Preview only. No files will be changed.' : 'Guided setup for provider, channels, Mnemos and trust.',
      `Path: ${snapshot.projectRoot}`,
      `Home: ${snapshot.home.root}`,
      `Home mode: ${snapshot.home.source}${snapshot.home.isolated ? ' / isolated' : ' / compat'}`,
      `Skill governance: ${snapshot.plan.skillGovernance.mode}`,
      `Mode: ${snapshot.mode}`,
      `Config: ${snapshot.configHandling}`,
      ...existingConfig,
    ]),
    onboardingSection('Plan', [
      providerLine,
      `Skill governance: ${snapshot.plan.skillGovernance.mode} (${snapshot.plan.skillGovernance.summary})`,
      `Web/search: ${snapshot.webSearch.provider}`,
      `Mnemos: ${snapshot.plan.memory.mode} / ${snapshot.plan.memory.vaultScope}`,
      automationLine,
      envLine,
    ]),
    onboardingSection('Model check', modelCheckLines),
    onboardingSection('Surfaces', surfacesLines),
    onboardingSection('Readiness', readinessLines),
    onboardingSection('Capability actions', capabilityActionLines),
    onboardingSection('Gateway runtime', gatewayLines),
    onboardingSection('Zavorth Home', [
      `Active: ${snapshot.home.root}`,
      `Source: ${snapshot.home.source}`,
      `Isolated: ${snapshot.home.isolated ? 'yes' : 'no'}`,
      `Status: ${snapshot.home.statusCommand}`,
      `Switch: ${snapshot.home.switchCommand}`,
      `Migrate: ${snapshot.home.migratePreviewCommand}`,
    ]),
    onboardingSection('Skill Governance', [
      `Mode: ${snapshot.plan.skillGovernance.mode}`,
      snapshot.plan.skillGovernance.summary,
      'Switch later: zavorth skills governance governed --apply',
    ]),
    onboardingSection('What happens next', [
      'Setup does not start persistent services automatically.',
      'Sensitive work still uses policy, approval and evidence.',
      '',
      ...snapshot.hatch.commands.slice(0, 2).map((command) => `- ${command}`),
      '',
      ...snapshot.nextActions.slice(0, 3)
      .map((action) => `> ${action.label}\n  ${action.command}${action.detail ? `\n  ${action.detail}` : ''}`)
      .flatMap((line) => line.split('\n')),
    ]),
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
    `o  ${orange('First Light')}`,
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
    `Home: ${snapshot.home.root} (${snapshot.home.source}${snapshot.home.isolated ? ', isolated' : ', compat'})`,
    `Automation: ${snapshot.plan.hooks.enabled ? `${snapshot.plan.hooks.templates.length} templates prepared disabled` : 'skip'}`,
    `.env updates: ${updates === 0 ? 'none' : `${updates} key(s), secrets redacted`}`,
    '',
    'No persistent runtime service will be started.',
    'Sensitive actions still require policy, approval and evidence.',
  ];
  return compactSection('First Light review', lines);
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
    `Home: ${snapshot.home.root}`,
    snapshot.plan.hooks.enabled
      ? `Automation templates prepared in .zavorth/hooks (${snapshot.plan.hooks.templates.length}).`
      : 'Automation templates skipped.',
    '',
    'Next commands:',
    ...snapshot.plan.nextCommands.map((command) => `- ${command}`),
  ];
  return compactSection('First Light complete', lines);
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

function setupSecurityNoticeLines(options: { compact?: boolean } = {}): string[] {
  if (options.compact) {
    return [
      'Security warning - please read.',
      '',
      'Zavorth can route natural language into models, channels and local tools.',
      'Sensitive work stays behind preview, policy, approval, sandbox and evidence.',
      'Remote channels should be paired or allowlisted before they can reach tools.',
      '',
      'Baseline:',
      '- Keep secrets out of prompts, logs, screenshots and reachable files.',
      '- Use sandbox and least-privilege tools for mutations.',
    ];
  }
  return [
    'Security warning - please read.',
    '',
    'Zavorth is a local-first AI agent and still needs explicit trust boundaries.',
    'By default, Zavorth is a personal operator boundary: one trusted user, one local workspace, governed tools.',
    'If channels or shared inboxes are enabled, unknown senders should be paired or allowlisted before they can reach tools.',
    '',
    'Zavorth can read files, call models, route channel messages and prepare local actions when abilities are enabled.',
    'Sensitive work stays behind preview, policy, approval, sandbox and evidence.',
    'A bad prompt or misconfigured channel can still attempt unsafe actions if you enable broad abilities.',
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
  return `\u001b[38;2;6;182;212m${value}\u001b[0m`;
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
    if (char === '█') return `\u001b[38;2;6;182;212m${char}\u001b[0m`;
    if ('╗╔╝╚║═'.includes(char)) return `\u001b[38;2;8;145;178m${char}\u001b[0m`;
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
