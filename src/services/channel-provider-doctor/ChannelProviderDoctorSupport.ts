import fs from 'fs';
import path from 'path';
import type { ChannelProviderDoctorItem, ChannelProviderDoctorReport } from '../ChannelProviderDoctorService.js';
import { logger } from '../../logger.js';

export type ChannelProviderDoctorEnvironment = {
  platform: NodeJS.Platform | string;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  readStatusFile: (filePath: string) => Record<string, any> | null;
  envValue: (key: string) => string;
  envList: (key: string) => string[];
  envBoolean: (key: string, fallback?: boolean) => boolean;
  resolveExplicitEnabled: (key: string, fallback?: boolean) => boolean;
};

export function inspectSignalChannel(environment: ChannelProviderDoctorEnvironment): ChannelProviderDoctorItem {
  const status = environment.readStatusFile(environment.envValue('SIGNAL_STATUS_FILE'));
  const enabled = environment.resolveExplicitEnabled('SIGNAL_ENABLED', status?.enabled === true);
  if (!enabled) {
    return {
      channelId: 'signal',
      mode: 'unknown',
      enabled: false,
      configured: false,
      status: 'skipped',
      summary: 'Signal bridge is not enabled in this runtime.',
      error: null,
      recommendedAction: null,
      details: ['set SIGNAL_ENABLED=true and configure signal-cli to enable the Signal doctor.'],
    };
  }

  const missing: string[] = [];
  if (!environment.envValue('SIGNAL_CLI_PATH') && !environment.envValue('SIGNAL_JSONRPC_URL')) {
    missing.push('SIGNAL_CLI_PATH or SIGNAL_JSONRPC_URL');
  }
  if (!environment.envValue('SIGNAL_ACCOUNT_NUMBER') && status?.providerConfigured !== true) {
    missing.push('SIGNAL_ACCOUNT_NUMBER');
  }
  if (environment.envList('SIGNAL_ALLOWED_RECIPIENTS').length < 1) {
    missing.push('SIGNAL_ALLOWED_RECIPIENTS');
  }

  if (missing.length > 0) {
    return {
      channelId: 'signal',
      mode: 'signal-cli',
      enabled: true,
      configured: false,
      status: 'failed',
      summary: 'Signal bridge is enabled, but operational prerequisites are still missing.',
      error: `Missing fields: ${missing.join(', ')}.`,
      recommendedAction: 'npm run test:channels:smoke',
      details: ['Signal uses a local bridge through signal-cli/JSON-RPC; keep a dedicated account and closed allowlist.'],
    };
  }

  if (status?.started === false) {
    return {
      channelId: 'signal',
      mode: 'signal-cli',
      enabled: true,
      configured: true,
      status: 'failed',
      summary: 'Signal bridge has not confirmed runtime readiness yet.',
      error: 'O snapshot do Signal indica started=false.',
      recommendedAction: 'npm run test:channels:smoke',
      details: ['Start the signal-cli daemon/bridge before opening the channel in the mesh.'],
    };
  }

  if (typeof status?.lastError === 'string' && status.lastError.trim()) {
    return {
      channelId: 'signal',
      mode: 'signal-cli',
      enabled: true,
      configured: true,
      status: 'failed',
      summary: 'Signal bridge recorded a recent error.',
      error: status.lastError,
      recommendedAction: 'npm run test:channels:smoke',
      details: ['Revise o latest error do snapshot before ampliar o rollout do Signal.'],
    };
  }

  return {
    channelId: 'signal',
    mode: 'signal-cli',
    enabled: true,
    configured: true,
    status: 'passed',
    summary: 'Signal bridge validated locally by configuration and snapshot.',
    error: null,
    recommendedAction: null,
    details: [
      `Recipients permitidos: ${environment.envList('SIGNAL_ALLOWED_RECIPIENTS').length}.`,
      'Warning: this channel depends on signal-cli, not an official Signal Bot API.',
    ],
  };
}

export function inspectIMessageChannel(environment: ChannelProviderDoctorEnvironment): ChannelProviderDoctorItem {
  const status = environment.readStatusFile(environment.envValue('IMESSAGE_STATUS_FILE'));
  const enabled = environment.resolveExplicitEnabled('IMESSAGE_ENABLED', status?.enabled === true);
  if (!enabled) {
    return {
      channelId: 'imessage',
      mode: 'unknown',
      enabled: false,
      configured: false,
      status: 'skipped',
      summary: 'iMessage Mac bridge is not enabled in this runtime.',
      error: null,
      recommendedAction: null,
      details: ['set IMESSAGE_ENABLED=true and bind a macOS Node Host to enable the doctor.'],
    };
  }

  const missing: string[] = [];
  if (!environment.envValue('IMESSAGE_NODE_ID') && !environment.envValue('IMESSAGE_BRIDGE_SCRIPT') && status?.started !== true) {
    missing.push('IMESSAGE_NODE_ID or IMESSAGE_BRIDGE_SCRIPT');
  }
  if (environment.envList('IMESSAGE_ALLOWED_RECIPIENTS').length < 1) {
    missing.push('IMESSAGE_ALLOWED_RECIPIENTS');
  }
  const macHostReady = status?.platform === 'darwin' || environment.platform === 'darwin';
  if (!macHostReady) {
    missing.push('Node Host macOS');
  }

  if (missing.length > 0) {
    return {
      channelId: 'imessage',
      mode: 'mac-bridge',
      enabled: true,
      configured: false,
      status: 'failed',
      summary: 'iMessage Mac bridge is enabled, but operational prerequisites are still missing.',
      error: `Missing fields: ${missing.join(', ')}.`,
      recommendedAction: 'npm run test:channels:smoke',
      details: ['iMessage needs a macOS/Node Mesh host; start read-only before allowing sends.'],
    };
  }

  if (status?.started === false) {
    return {
      channelId: 'imessage',
      mode: 'mac-bridge',
      enabled: true,
      configured: true,
      status: 'failed',
      summary: 'iMessage Mac bridge has not confirmed runtime readiness yet.',
      error: 'O snapshot do iMessage indica started=false.',
      recommendedAction: 'npm run test:channels:smoke',
      details: ['Start the macOS Node Host before opening the bridge for sending.'],
    };
  }

  if (typeof status?.lastError === 'string' && status.lastError.trim()) {
    return {
      channelId: 'imessage',
      mode: 'mac-bridge',
      enabled: true,
      configured: true,
      status: 'failed',
      summary: 'iMessage Mac bridge recorded a recent error.',
      error: status.lastError,
      recommendedAction: 'npm run test:channels:smoke',
      details: ['Review the latest snapshot error before allowing iMessage send.'],
    };
  }

  return {
    channelId: 'imessage',
    mode: 'mac-bridge',
    enabled: true,
    configured: true,
    status: 'passed',
    summary: 'iMessage Mac bridge locally validated by the macOS host and allowlist.',
    error: null,
    recommendedAction: null,
    details: [
      `Recipients permitidos: ${environment.envList('IMESSAGE_ALLOWED_RECIPIENTS').length}.`,
      environment.envBoolean('IMESSAGE_READ_ONLY', true) ? 'Read-only mode is active; sending still requires explicit promotion.'
        : 'Send enabled by env; keep approval/trust per recipient.',
    ],
  };
}

export function inspectTeamsChannel(environment: ChannelProviderDoctorEnvironment): ChannelProviderDoctorItem {
  const status = environment.readStatusFile(environment.envValue('TEAMS_STATUS_FILE'));
  const enabled = environment.resolveExplicitEnabled('TEAMS_ENABLED', status?.enabled === true);
  if (!enabled) {
    return {
      channelId: 'teams',
      mode: 'unknown',
      enabled: false,
      configured: false,
      status: 'skipped',
      summary: 'Teams Graph/Bot Framework is not enabled in this runtime.',
      error: null,
      recommendedAction: null,
      details: ['set TEAMS_ENABLED=true and configure Microsoft credentials to enable the doctor.'],
    };
  }

  const missing: string[] = [];
  if (!environment.envValue('TEAMS_APP_ID') && status?.providerConfigured !== true) {
    missing.push('TEAMS_APP_ID');
  }
  if (!environment.envValue('TEAMS_TENANT_ID') && status?.providerConfigured !== true) {
    missing.push('TEAMS_TENANT_ID');
  }
  if (!environment.envValue('TEAMS_APP_PASSWORD') && !environment.envValue('TEAMS_CLIENT_SECRET') && status?.providerConfigured !== true) {
    missing.push('TEAMS_APP_PASSWORD or TEAMS_CLIENT_SECRET');
  }
  if (environment.envList('TEAMS_ALLOWED_CONVERSATION_IDS').length < 1) {
    missing.push('TEAMS_ALLOWED_CONVERSATION_IDS');
  }

  if (missing.length > 0) {
    return {
      channelId: 'teams',
      mode: 'graph-bot',
      enabled: true,
      configured: false,
      status: 'failed',
      summary: 'Teams is enabled, but operational prerequisites are still missing.',
      error: `Missing fields: ${missing.join(', ')}.`,
      recommendedAction: 'npm run test:channels:smoke',
      details: ['Teams must be promoted with app/tenant/secret and conversation allowlist.'],
    };
  }

  if (status?.started === false || (typeof status?.lastError === 'string' && status.lastError.trim())) {
    return {
      channelId: 'teams',
      mode: 'graph-bot',
      enabled: true,
      configured: true,
      status: 'failed',
      summary: 'Teams recorded a bad runtime snapshot.',
      error: status?.started === false ? 'O snapshot do Teams indica started=false.' : status?.lastError,
      recommendedAction: 'npm run test:channels:smoke',
      details: ['Revise o Bot Framework/Graph before abrir o channel em tenant real.'],
    };
  }

  return {
    channelId: 'teams',
    mode: 'graph-bot',
    enabled: true,
    configured: true,
    status: 'passed',
    summary: 'Teams validated locally by configuration and snapshot.',
    error: null,
    recommendedAction: null,
    details: [`Allowed conversations: ${environment.envList('TEAMS_ALLOWED_CONVERSATION_IDS').length}.`],
  };
}

export function inspectEmailChannel(environment: ChannelProviderDoctorEnvironment): ChannelProviderDoctorItem {
  const status = environment.readStatusFile(environment.envValue('EMAIL_STATUS_FILE'));
  const enabled = environment.resolveExplicitEnabled('EMAIL_ENABLED', status?.enabled === true);
  const allowedRecipients = environment.envList('EMAIL_ALLOWED_RECIPIENTS');
  const smtpConfigured = Boolean(environment.envValue('EMAIL_SMTP_HOST') || environment.envValue('SMTP_HOST'));
  const imapConfigured = Boolean(environment.envValue('EMAIL_IMAP_HOST') || environment.envValue('IMAP_HOST'));
  const mode: ChannelProviderDoctorItem['mode'] = smtpConfigured ? 'smtp-imap' : 'local-outbox';
  if (!enabled) {
    return {
      channelId: 'email',
      mode: 'unknown',
      enabled: false,
      configured: false,
      status: 'skipped',
      summary: 'Email is not enabled in this runtime yet.',
      error: null,
      recommendedAction: null,
      details: ['set EMAIL_ENABLED=true and EMAIL_ALLOWED_RECIPIENTS to enable the doctor in local-outbox; SMTP remains optional.'],
    };
  }

  if (allowedRecipients.length < 1) {
    return {
      channelId: 'email',
      mode,
      enabled: true,
      configured: false,
      status: 'failed',
      summary: 'Email is enabled, but operational prerequisites are still missing.',
      error: 'Missing fields: EMAIL_ALLOWED_RECIPIENTS.',
      recommendedAction: 'npm run test:channels:smoke',
      details: ['set at least EMAIL_ALLOWED_RECIPIENTS; SMTP is optional when rollout uses local-outbox.'],
    };
  }

  if (status?.started === false || (typeof status?.lastError === 'string' && status.lastError.trim())) {
    return {
      channelId: 'email',
      mode,
      enabled: true,
      configured: true,
      status: 'failed',
      summary: 'Email recorded a bad runtime snapshot.',
      error: status?.started === false ? 'O snapshot de Email indica started=false.' : status?.lastError,
      recommendedAction: 'npm run test:channels:smoke',
      details: ['Revise SMTP/IMAP before abrir approval por email.'],
    };
  }

  return {
    channelId: 'email',
    mode,
    enabled: true,
    configured: true,
    status: 'passed',
    summary: smtpConfigured ? 'Email validated locally by SMTP configuration and allowlist.'
      : 'Email locally validated in local-outbox mode with recipient allowlist.',
    error: null,
    recommendedAction: null,
    details: [
      `Recipients permitidos: ${allowedRecipients.length}.`,
      smtpConfigured ? 'SMTP configured para outbound real.'
        : 'SMTP not configured yet; current rollout uses supervised local-outbox.',
      imapConfigured ? 'IMAP configured para inbound/approval polling.'
        : 'IMAP not configured; the channel covers outbound notifications right now.',
    ],
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function safeReadChannelProviderDoctorJson(response: Response): Promise<Record<string, any> | null> {
  try {
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await response.json() as Record<string, any>;
  } catch (error: unknown) {logger.warn('[Channel  Doctor] operation failed', error); return null; }
}

export async function writeChannelProviderDoctorReport(
  reportFilePath: string,
  report: ChannelProviderDoctorReport,
): Promise<void> {
  if (!reportFilePath) {
    return;
  }

  await fs.promises.mkdir(path.dirname(reportFilePath), { recursive: true });
  await fs.promises.writeFile(reportFilePath, JSON.stringify(report, null, 2), 'utf8');
}
