import {
  buildApprovalSurfaceResponseExample,
  buildModelsSurfaceResponseExample,
  buildStatusSurfaceResponseExample,
  renderSurfaceResponseForTarget,
  type SurfaceRenderedResponse,
  type SurfaceResponse,
} from '../domain/surface/application/surface-response/index.js';
import {
  CHANNEL_CAPABILITY_CONTRACT_VERSION,
  type ChannelCapabilityAdaptedResponse,
  type ChannelCapabilityChannel,
  type ChannelCapabilityCheck,
  type ChannelCapabilityNativeMode,
  type ChannelCapabilityProfile,
  type ChannelCapabilitySnapshot,
} from '../contracts/ChannelCapabilityContract.js';
import { getSharedSurfaceCommandContract } from './SharedSurfaceCommandContract.js';


type Runtime = {
  now?: () => Date;
};

const REQUIRED_CHANNELS: ChannelCapabilityChannel[] = [
  'telegram',
  'discord',
  'whatsapp',
  'signal',
  'imessage',
  'cli',
  'web',
];

const FALLBACK_CHANNELS = new Set<ChannelCapabilityChannel>([
  'whatsapp',
  'signal',
  'imessage',
  'slack',
  'instagram',
  'teams',
  'email',
]);

export class ZavorthChannelCapabilityAwarenessService {
  private readonly now: () => Date;

  public constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildSnapshot(input: { channel?: ChannelCapabilityChannel | null } = {}): ChannelCapabilitySnapshot {
    const generatedAt = this.now().toISOString();
    const profiles = buildProfiles();
    const selected = normalizeChannel(input.channel);
    const visibleProfiles = selected
      ? profiles.filter((profile) => profile.channel === selected)
      : profiles;
    const examples = buildExamples();
    const adaptedExamples = visibleProfiles.flatMap((profile) =>
      examples.map((response) => this.adaptResponse(profile.channel, response)));
    const checks = buildChecks(visibleProfiles, adaptedExamples, examples);
    const summary = summarize(visibleProfiles, adaptedExamples, checks);
    const status = resolveStatus(summary);

    return {
      generatedAt,
      contractVersion: CHANNEL_CAPABILITY_CONTRACT_VERSION,
      source: 'ZavorthChannelCapabilityAwarenessService',
      gate: 'channel-capability-awareness',
      phase: 'checkpoint-7-channel-capability-awareness',
      status,
      profiles: visibleProfiles,
      adaptedExamples,
      checks,
      summary,
      safety: {
        sharedResponseContract: true,
        noTelegramPrivileging: true,
        channelSpecificRenderingOnly: true,
        noZavorthControlVisualMutation: true,
        rawSecretsSerialized: false,
      },
      commands: {
        report: 'npx tsx scripts/zavorth-channel-capability-awareness.ts',
        json: 'npx tsx scripts/zavorth-channel-capability-awareness.ts --json',
        selected: 'npx tsx scripts/zavorth-channel-capability-awareness.ts --json --channel=<channel>',
        check: 'node scripts/zavorth-channel-capability-awareness-check.mjs',
      },
      narrative: narrativeForStatus(status, summary),
    };
  }

  public adaptResponse(
    channel: ChannelCapabilityChannel,
    response: SurfaceResponse,
  ): ChannelCapabilityAdaptedResponse {
    const profile = findProfile(channel);
    const rendered = renderSurfaceResponseForTarget(profile.renderTarget, response, {
      maxActionsPerRow: profile.limits.maxActionsPerRow,
      maxTextLength: profile.limits.maxTextLength,
    });
    const capabilityUsed = inspectCapabilities(profile, rendered);
    const status = capabilityUsed.nativeButtons || capabilityUsed.denseTable || capabilityUsed.webPayload
      ? profile.nativeMode === 'web_api_payload' ? 'projection' : 'native'
      : capabilityUsed.fallbackText ? 'fallback' : 'blocked';

    return {
      channel,
      renderTarget: profile.renderTarget,
      nativeMode: profile.nativeMode,
      responseId: response.id,
      intent: response.intent,
      rendered,
      capabilityUsed,
      status,
      summary: summarizeAdaptation(profile, response, rendered, capabilityUsed),
    };
  }

  public renderReport(snapshot = this.buildSnapshot()): string {
    const lines = [
      'Channel Capability Awareness - Surface controls',
      '',
      `Status: ${snapshot.status}`,
      snapshot.narrative.operatorSummary,
      `Profiles: ${snapshot.summary.requiredProfiles}/${snapshot.summary.profiles} required covered`,
      `Native channels: ${snapshot.summary.nativeChannels}`,
      `Fallback channels: ${snapshot.summary.fallbackChannels}`,
      '',
      'Profiles:',
      ...snapshot.profiles.map((profile) =>
        `- ${profile.label}: ${profile.nativeMode} | buttons=${profile.support.buttons} | fallback=${profile.support.fallbackText}`),
      '',
      'Checks:',
      ...snapshot.checks.slice(0, 12).map((check) => `- ${check.kind}/${check.channel}: ${check.status} | ${check.summary}`),
      '',
      `Next: ${snapshot.narrative.nextAction}`,
    ];
    return lines.join('\n');
  }
}

function buildProfiles(): ChannelCapabilityProfile[] {
  const commands = getSharedSurfaceCommandContract()
    .filter((entry) => entry.handler === 'shared-service' || entry.fallbackVisible)
    .map((entry) => entry.surfaceCommand);
  return [
    profile('telegram', 'Telegram', 'telegram', 'telegram_inline_keyboard', true, {
      buttons: true,
      menus: true,
      pagetion: true,
      tables: true,
      lists: false,
      safeMarkdown: true,
      attachments: true,
      qrLogin: false,
      threadBinding: false,
      fallbackText: true,
    }, { maxTextLength: 4096, maxActionsPerRow: 2, maxButtons: 20 }, commands),
    profile('discord', 'Discord', 'discord', 'discord_components', true, {
      buttons: true,
      menus: true,
      pagetion: true,
      tables: true,
      lists: false,
      safeMarkdown: true,
      attachments: true,
      qrLogin: false,
      threadBinding: true,
      fallbackText: true,
    }, { maxTextLength: 2000, maxActionsPerRow: 5, maxButtons: 25 }, commands),
    profile('whatsapp', 'WhatsApp', 'whatsapp', 'structured_text_fallback', true, {
      buttons: false,
      menus: false,
      pagetion: true,
      tables: true,
      lists: true,
      safeMarkdown: false,
      attachments: true,
      qrLogin: true,
      threadBinding: false,
      fallbackText: true,
    }, { maxTextLength: 3500, maxActionsPerRow: 1, maxButtons: 0 }, commands),
    profile('signal', 'Signal', 'signal', 'structured_text_fallback', true, {
      buttons: false,
      menus: false,
      pagetion: true,
      tables: true,
      lists: true,
      safeMarkdown: false,
      attachments: true,
      qrLogin: false,
      threadBinding: false,
      fallbackText: true,
    }, { maxTextLength: 1800, maxActionsPerRow: 1, maxButtons: 0 }, commands),
    profile('imessage', 'iMessage', 'imessage', 'structured_text_fallback', true, {
      buttons: false,
      menus: false,
      pagetion: true,
      tables: true,
      lists: true,
      safeMarkdown: false,
      attachments: true,
      qrLogin: false,
      threadBinding: false,
      fallbackText: true,
    }, { maxTextLength: 1800, maxActionsPerRow: 1, maxButtons: 0 }, commands),
    profile('cli', 'CLI', 'cli', 'dense_cli', true, {
      buttons: false,
      menus: false,
      pagetion: true,
      tables: true,
      lists: true,
      safeMarkdown: false,
      attachments: false,
      qrLogin: false,
      threadBinding: false,
      fallbackText: true,
    }, { maxTextLength: 8000, maxActionsPerRow: 1, maxButtons: 0 }, commands),
    profile('web', 'Web/API', 'web', 'web_api_payload', true, {
      buttons: true,
      menus: true,
      pagetion: true,
      tables: true,
      lists: true,
      safeMarkdown: true,
      attachments: true,
      qrLogin: true,
      threadBinding: true,
      fallbackText: true,
    }, { maxTextLength: 6000, maxActionsPerRow: 3, maxButtons: 30 }, commands),
    profile('slack', 'Slack', 'slack', 'structured_text_fallback', false, {
      buttons: false,
      menus: false,
      pagetion: true,
      tables: true,
      lists: true,
      safeMarkdown: true,
      attachments: true,
      qrLogin: false,
      threadBinding: true,
      fallbackText: true,
    }, { maxTextLength: 3000, maxActionsPerRow: 1, maxButtons: 0 }, commands),
    profile('instagram', 'Instagram', 'instagram', 'structured_text_fallback', false, {
      buttons: false,
      menus: false,
      pagetion: true,
      tables: false,
      lists: true,
      safeMarkdown: false,
      attachments: true,
      qrLogin: false,
      threadBinding: false,
      fallbackText: true,
    }, { maxTextLength: 3500, maxActionsPerRow: 1, maxButtons: 0 }, commands),
    profile('teams', 'Teams', 'teams', 'structured_text_fallback', false, {
      buttons: false,
      menus: false,
      pagetion: true,
      tables: true,
      lists: true,
      safeMarkdown: true,
      attachments: true,
      qrLogin: false,
      threadBinding: true,
      fallbackText: true,
    }, { maxTextLength: 3000, maxActionsPerRow: 1, maxButtons: 0 }, commands),
    profile('email', 'Email', 'email', 'structured_text_fallback', false, {
      buttons: false,
      menus: false,
      pagetion: false,
      tables: true,
      lists: true,
      safeMarkdown: false,
      attachments: true,
      qrLogin: false,
      threadBinding: false,
      fallbackText: true,
    }, { maxTextLength: 8000, maxActionsPerRow: 1, maxButtons: 0 }, commands),
  ];
}

function profile(
  channel: ChannelCapabilityChannel,
  label: string,
  renderTarget: ChannelCapabilityProfile['renderTarget'],
  nativeMode: ChannelCapabilityNativeMode,
  required: boolean,
  support: ChannelCapabilityProfile['support'],
  limits: ChannelCapabilityProfile['limits'],
  commandSurface: string[],
): ChannelCapabilityProfile {
  return {
    channel,
    label,
    renderTarget,
    required,
    nativeMode,
    support,
    limits,
    fallbackStrategy: support.buttons ? 'native-controls-with-text-fallback' : 'structured-text-fallback',
    commandSurface: [...new Set(commandSurface)].sort(),
    safety: {
      mentionsSafe: channel !== 'discord' || nativeMode === 'discord_components',
      mutatingActionsRequireApproval: true,
      untrustedContentDelimited: true,
      rawSecretsSerialized: false,
    },
  };
}

function buildExamples(): SurfaceResponse[] {
  return [
    buildStatusSurfaceResponseExample(),
    buildModelsSurfaceResponseExample(),
    buildApprovalSurfaceResponseExample(),
  ];
}

function inspectCapabilities(
  profile: ChannelCapabilityProfile,
  rendered: SurfaceRenderedResponse,
): ChannelCapabilityAdaptedResponse['capabilityUsed'] {
  const native = rendered.native as { replyMarkup?: { inline_keyboard?: unknown[] }; components?: unknown[] } | null | undefined;
  const telegramButtons = Boolean(native?.replyMarkup?.inline_keyboard?.length);
  const discordComponents = Boolean(native?.components?.length);
  return {
    nativeButtons: telegramButtons || discordComponents,
    nativeMenus: (telegramButtons || discordComponents) && profile.support.menus,
    fallbackText: rendered.text.length > 0 && (profile.support.fallbackText || FALLBACK_CHANNELS.has(profile.channel)),
    denseTable: profile.channel === 'cli' && rendered.text.includes('|'),
    webPayload: profile.channel === 'web' && rendered.actions.length > 0,
  };
}

function buildChecks(
  profiles: ChannelCapabilityProfile[],
  adapted: ChannelCapabilityAdaptedResponse[],
  examples: SurfaceResponse[],
): ChannelCapabilityCheck[] {
  const requiredProfiles = profiles.filter((profile) => profile.required);
  const checks: ChannelCapabilityCheck[] = [
    check('same-response-contract', 'all', examples.every((example) => example.version === 'surface-response/v1'), 'same-response-contract', 'All examples use the shared SurfaceResponse contract.', 'Use SurfaceResponse for every channel response.'),
  ];
  for (const profile of requiredProfiles) {
    const channelAdapted = adapted.filter((entry) => entry.channel === profile.channel);
    checks.push(
      check(`${profile.channel}-profile`, profile.channel, true, 'profile-defined', `${profile.label} has a capability profile.`, null),
      check(`${profile.channel}-render`, profile.channel, channelAdapted.length === examples.length && channelAdapted.every((entry) => entry.rendered.text.length > 0), 'surface-rendered', `${profile.label} rendered ${channelAdapted.length}/${examples.length} examples.`, 'Fix channel renderer before exposing commands.'),
      check(`${profile.channel}-safety`, profile.channel, profile.safety.mentionsSafe && profile.safety.mutatingActionsRequireApproval && profile.safety.rawSecretsSerialized === false, 'safety', `${profile.label} preserves mention safety, approval and no-secret invariants.`, 'Keep channel native payloads behind policy.'),
    );
    if (profile.nativeMode === 'telegram_inline_keyboard' || profile.nativeMode === 'discord_components') {
      checks.push(check(
        `${profile.channel}-native-buttons`,
        profile.channel,
        channelAdapted.some((entry) => entry.capabilityUsed.nativeButtons),
        'native-buttons',
        `${profile.label} exposes native interactive controls when the response has actions.`,
        'Expose buttons/components or fall back explicitly.',
      ));
    }
    if (profile.nativeMode === 'structured_text_fallback') {
      checks.push(check(
        `${profile.channel}-fallback`,
        profile.channel,
        channelAdapted.every((entry) => entry.capabilityUsed.fallbackText && entry.rendered.native === null),
        'fallback-text',
        `${profile.label} uses structured textual fallback without channel-specific logic.`,
        'Render command hints in text fallback.',
      ));
    }
    if (profile.nativeMode === 'dense_cli') {
      checks.push(check(
        `${profile.channel}-dense-cli`,
        profile.channel,
        channelAdapted.some((entry) => entry.capabilityUsed.denseTable),
        'dense-cli',
        'CLI renders dense operational tables/lists from the same response.',
        'Keep CLI rendering table-friendly.',
      ));
    }
    if (profile.nativeMode === 'web_api_payload') {
      checks.push(check(
        `${profile.channel}-web-payload`,
        profile.channel,
        channelAdapted.some((entry) => entry.capabilityUsed.webPayload),
        'web-payload',
        'Web/API receives rich action payload projection from the same response.',
        'Expose actions in API projection before adding visual UI.',
      ));
    }
  }
  return checks;
}

function summarize(
  profiles: ChannelCapabilityProfile[],
  adapted: ChannelCapabilityAdaptedResponse[],
  checks: ChannelCapabilityCheck[],
): ChannelCapabilitySnapshot['summary'] {
  const requiredProfiles = profiles.filter((profile) => profile.required);
  const failedChecks = checks.filter((check) => check.status === 'fail').length;
  return {
    profiles: profiles.length,
    requiredProfiles: requiredProfiles.length,
    nativeChannels: profiles.filter((profile) => profile.nativeMode === 'telegram_inline_keyboard' || profile.nativeMode === 'discord_components').length,
    fallbackChannels: profiles.filter((profile) => profile.nativeMode === 'structured_text_fallback').length,
    passedChecks: checks.filter((check) => check.status === 'pass').length,
    warningChecks: checks.filter((check) => check.status === 'warn').length,
    failedChecks,
    telegramPrivileged: false,
    allRequiredChannelsCovered: requiredProfiles.every((profile) =>
      adapted.some((entry) => entry.channel === profile.channel && entry.rendered.text.length > 0)),
  };
}

function resolveStatus(summary: ChannelCapabilitySnapshot['summary']): ChannelCapabilitySnapshot['status'] {
  if (summary.failedChecks > 0 || !summary.allRequiredChannelsCovered) return 'blocked';
  if (summary.warningChecks > 0) return 'attention';
  return 'ready';
}

function check(
  id: string,
  channel: ChannelCapabilityCheck['channel'],
  passed: boolean,
  kind: ChannelCapabilityCheck['kind'],
  summary: string,
  recommendation: string | null,
): ChannelCapabilityCheck {
  return {
    id,
    channel,
    status: passed ? 'pass' : 'fail',
    kind,
    summary,
    recommendation: passed ? null : recommendation,
  };
}

function findProfile(channel: ChannelCapabilityChannel): ChannelCapabilityProfile {
  return buildProfiles().find((profile) => profile.channel === channel)
    || buildProfiles().find((profile) => profile.channel === 'web')!;
}

function normalizeChannel(value: unknown): ChannelCapabilityChannel | null {
  const normalized = String(value || '').trim().toLowerCase();
  return buildProfiles().some((profile) => profile.channel === normalized)
    ? normalized as ChannelCapabilityChannel
    : null;
}

function summarizeAdaptation(
  profile: ChannelCapabilityProfile,
  response: SurfaceResponse,
  rendered: SurfaceRenderedResponse,
  capability: ChannelCapabilityAdaptedResponse['capabilityUsed'],
): string {
  if (capability.nativeButtons) {
    return `${profile.label} rendered ${response.intent} with native controls and ${rendered.actions.length} action row(s).`;
  }
  if (capability.denseTable) {
    return `${profile.label} rendered ${response.intent} as dense CLI text.`;
  }
  if (capability.webPayload) {
    return `${profile.label} projected ${response.intent} as Web/API action payload.`;
  }
  return `${profile.label} rendered ${response.intent} with structured text fallback.`;
}

function narrativeForStatus(
  status: ChannelCapabilitySnapshot['status'],
  summary: ChannelCapabilitySnapshot['summary'],
): ChannelCapabilitySnapshot['narrative'] {
  if (status === 'ready') {
    return {
      headline: 'Channel capability awareness is ready.',
      operatorSummary: `${summary.requiredProfiles} required channels are covered; Telegram is not privileged over other channels.`,
      nextAction: 'Use shared SurfaceResponse renderers for new channel commands.',
    };
  }
  return {
    headline: 'Channel capability awareness needs attention.',
    operatorSummary: `${summary.failedChecks} check(s) failed across ${summary.requiredProfiles} required channel profiles.`,
    nextAction: 'Fix failed channel render/capability checks before marking Surface controls complete.',
  };
}
