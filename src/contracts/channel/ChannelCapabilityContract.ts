import type {
  SurfaceRenderedResponse,
  SurfaceRenderTarget,
  SurfaceResponse,
} from '../../domain/surface/application/surface-response/SurfaceResponseContract.js';

export const CHANNEL_CAPABILITY_CONTRACT_VERSION =
  '2026-05-12.channel-capability-awareness-checkpoint-7' as const;

export type ChannelCapabilityChannel =
  | 'telegram'
  | 'discord'
  | 'whatsapp'
  | 'signal'
  | 'imessage'
  | 'cli'
  | 'web'
  | 'slack'
  | 'instagram'
  | 'teams'
  | 'email';

export type ChannelCapabilityNativeMode =
  | 'telegram_inline_keyboard'
  | 'discord_components'
  | 'structured_text_fallback'
  | 'dense_cli'
  | 'web_api_payload';

export type ChannelCapabilitySupport = {
  buttons: boolean;
  menus: boolean;
  pagination: boolean;
  tables: boolean;
  lists: boolean;
  safeMarkdown: boolean;
  attachments: boolean;
  qrLogin: boolean;
  threadBinding: boolean;
  fallbackText: boolean;
};

export type ChannelCapabilityLimits = {
  maxTextLength: number;
  maxActionsPerRow: number;
  maxButtons: number;
};

export type ChannelCapabilityProfile = {
  channel: ChannelCapabilityChannel;
  label: string;
  renderTarget: SurfaceRenderTarget;
  required: boolean;
  nativeMode: ChannelCapabilityNativeMode;
  support: ChannelCapabilitySupport;
  limits: ChannelCapabilityLimits;
  fallbackStrategy: string;
  commandSurface: string[];
  safety: {
    mentionsSafe: boolean;
    mutatingActionsRequireApproval: boolean;
    untrustedContentDelimited: boolean;
    rawSecretsSerialized: false;
  };
};

export type ChannelCapabilityAdaptedResponse = {
  channel: ChannelCapabilityChannel;
  renderTarget: SurfaceRenderTarget;
  nativeMode: ChannelCapabilityNativeMode;
  responseId: string;
  intent: SurfaceResponse['intent'];
  rendered: SurfaceRenderedResponse;
  capabilityUsed: {
    nativeButtons: boolean;
    nativeMenus: boolean;
    fallbackText: boolean;
    denseTable: boolean;
    webPayload: boolean;
  };
  status: 'native' | 'fallback' | 'projection' | 'blocked';
  summary: string;
};

export type ChannelCapabilityCheck = {
  id: string;
  channel: ChannelCapabilityChannel | 'all';
  status: 'pass' | 'warn' | 'fail';
  kind:
    | 'profile-defined'
    | 'surface-rendered'
    | 'native-buttons'
    | 'fallback-text'
    | 'dense-cli'
    | 'web-payload'
    | 'same-response-contract'
    | 'safety';
  summary: string;
  recommendation: string | null;
};

export type ChannelCapabilitySnapshot = {
  generatedAt: string;
  contractVersion: typeof CHANNEL_CAPABILITY_CONTRACT_VERSION;
  source: 'ZavorthChannelCapabilityAwarenessService';
  phase: 'checkpoint-7-channel-capability-awareness';
  status: 'ready' | 'attention' | 'blocked';
  profiles: ChannelCapabilityProfile[];
  adaptedExamples: ChannelCapabilityAdaptedResponse[];
  checks: ChannelCapabilityCheck[];
  summary: {
    profiles: number;
    requiredProfiles: number;
    nativeChannels: number;
    fallbackChannels: number;
    passedChecks: number;
    warningChecks: number;
    failedChecks: number;
    telegramPrivileged: false;
    allRequiredChannelsCovered: boolean;
  };
  safety: {
    sharedResponseContract: true;
    noTelegramPrivileging: true;
    channelSpecificRenderingOnly: true;
    noZavorthControlVisualMutation: true;
    rawSecretsSerialized: false;
  };
  commands: {
    report: 'npx tsx scripts/zavorth-channel-capability-awareness.ts';
    json: 'npx tsx scripts/zavorth-channel-capability-awareness.ts --json';
    selected: 'npx tsx scripts/zavorth-channel-capability-awareness.ts --json --channel=<channel>';
    check: 'node scripts/zavorth-channel-capability-awareness-check.mjs';
  };
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
};
