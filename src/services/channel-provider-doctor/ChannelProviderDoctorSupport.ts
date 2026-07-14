import fs from 'fs';
import path from 'path';
import type { ChannelProviderDoctorItem, ChannelProviderDoctorReport } from '../ChannelProviderDoctorService.js';
import { logger } from '../../logger.js';

export type ChannelProviderDoctorEnvironment = {
  platform: NodeJS.Platform | string;
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
      summary: 'Signal bridge nao esta habilitado neste runtime.',
      error: null,
      recommendedAction: null,
      details: ['Defina SIGNAL_ENABLED=true e configure signal-cli para ativar o doctor do Signal.'],
    };
  }

  const missing: string[] = [];
  if (!environment.envValue('SIGNAL_CLI_PATH') && !environment.envValue('SIGNAL_JSONRPC_URL')) {
    missing.push('SIGNAL_CLI_PATH ou SIGNAL_JSONRPC_URL');
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
      summary: 'Signal bridge foi habilitado, mas ainda faltam prerequisitos operacionais.',
      error: `Campos ausentes: ${missing.join(', ')}.`,
      recommendedAction: 'npm run test:channels:smoke',
      details: ['Signal usa bridge local via signal-cli/JSON-RPC; mantenha uma conta dedicada e allowlist fechada.'],
    };
  }

  if (status?.started === false) {
    return {
      channelId: 'signal',
      mode: 'signal-cli',
      enabled: true,
      configured: true,
      status: 'failed',
      summary: 'Signal bridge ainda nao confirmou runtime pronto.',
      error: 'O snapshot do Signal indica started=false.',
      recommendedAction: 'npm run test:channels:smoke',
      details: ['Suba o daemon/bridge do signal-cli antes de abrir o canal no mesh.'],
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
      details: ['Revise o ultimo erro do snapshot antes de ampliar o rollout do Signal.'],
    };
  }

  return {
    channelId: 'signal',
    mode: 'signal-cli',
    enabled: true,
    configured: true,
    status: 'passed',
    summary: 'Signal bridge validado localmente pela configuracao e pelo snapshot.',
    error: null,
    recommendedAction: null,
    details: [
      `Recipients permitidos: ${environment.envList('SIGNAL_ALLOWED_RECIPIENTS').length}.`,
      'Aviso: este canal depende de signal-cli e nao de uma Bot API oficial do Signal.',
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
      summary: 'iMessage Mac bridge nao esta habilitado neste runtime.',
      error: null,
      recommendedAction: null,
      details: ['Defina IMESSAGE_ENABLED=true e vincule um Node Host macOS para ativar o doctor.'],
    };
  }

  const missing: string[] = [];
  if (!environment.envValue('IMESSAGE_NODE_ID') && !environment.envValue('IMESSAGE_BRIDGE_SCRIPT') && status?.started !== true) {
    missing.push('IMESSAGE_NODE_ID ou IMESSAGE_BRIDGE_SCRIPT');
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
      summary: 'iMessage Mac bridge foi habilitado, mas ainda faltam prerequisitos operacionais.',
      error: `Campos ausentes: ${missing.join(', ')}.`,
      recommendedAction: 'npm run test:channels:smoke',
      details: ['iMessage precisa de um host macOS/Node Mesh; comece em read-only antes de permitir envio.'],
    };
  }

  if (status?.started === false) {
    return {
      channelId: 'imessage',
      mode: 'mac-bridge',
      enabled: true,
      configured: true,
      status: 'failed',
      summary: 'iMessage Mac bridge ainda nao confirmou runtime pronto.',
      error: 'O snapshot do iMessage indica started=false.',
      recommendedAction: 'npm run test:channels:smoke',
      details: ['Suba o Node Host macOS antes de abrir a bridge para envio.'],
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
      details: ['Revise o ultimo erro do snapshot antes de permitir envio por iMessage.'],
    };
  }

  return {
    channelId: 'imessage',
    mode: 'mac-bridge',
    enabled: true,
    configured: true,
    status: 'passed',
    summary: 'iMessage Mac bridge validado localmente pelo host macOS e pela allowlist.',
    error: null,
    recommendedAction: null,
    details: [
      `Recipients permitidos: ${environment.envList('IMESSAGE_ALLOWED_RECIPIENTS').length}.`,
      environment.envBoolean('IMESSAGE_READ_ONLY', true)
        ? 'Modo read-only esta ativo; envio continua exigindo promocao explicita.'
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
      summary: 'Teams Graph/Bot Framework nao esta habilitado neste runtime.',
      error: null,
      recommendedAction: null,
      details: ['Defina TEAMS_ENABLED=true e configure credenciais Microsoft para ativar o doctor.'],
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
    missing.push('TEAMS_APP_PASSWORD ou TEAMS_CLIENT_SECRET');
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
      summary: 'Teams foi habilitado, mas ainda faltam prerequisitos operacionais.',
      error: `Campos ausentes: ${missing.join(', ')}.`,
      recommendedAction: 'npm run test:channels:smoke',
      details: ['Teams deve ser promovido com app/tenant/secret e allowlist de conversas.'],
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
      details: ['Revise o Bot Framework/Graph antes de abrir o canal em tenant real.'],
    };
  }

  return {
    channelId: 'teams',
    mode: 'graph-bot',
    enabled: true,
    configured: true,
    status: 'passed',
    summary: 'Teams validado localmente pela configuracao e pelo snapshot.',
    error: null,
    recommendedAction: null,
    details: [`Conversas permitidas: ${environment.envList('TEAMS_ALLOWED_CONVERSATION_IDS').length}.`],
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
      summary: 'Email ainda nao esta habilitado neste runtime.',
      error: null,
      recommendedAction: null,
      details: ['Defina EMAIL_ENABLED=true e EMAIL_ALLOWED_RECIPIENTS para ativar o doctor em local-outbox; SMTP continua opcional.'],
    };
  }

  if (allowedRecipients.length < 1) {
    return {
      channelId: 'email',
      mode,
      enabled: true,
      configured: false,
      status: 'failed',
      summary: 'Email foi habilitado, mas ainda faltam prerequisitos operacionais.',
      error: 'Campos ausentes: EMAIL_ALLOWED_RECIPIENTS.',
      recommendedAction: 'npm run test:channels:smoke',
      details: ['Defina ao menos EMAIL_ALLOWED_RECIPIENTS; SMTP e opcional quando o rollout usar local-outbox.'],
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
      details: ['Revise SMTP/IMAP antes de abrir approval por email.'],
    };
  }

  return {
    channelId: 'email',
    mode,
    enabled: true,
    configured: true,
    status: 'passed',
    summary: smtpConfigured
      ? 'Email validado localmente pela configuracao SMTP e pela allowlist.'
      : 'Email validado localmente em modo local-outbox com allowlist de recipients.',
    error: null,
    recommendedAction: null,
    details: [
      `Recipients permitidos: ${allowedRecipients.length}.`,
      smtpConfigured
        ? 'SMTP configurado para outbound real.'
        : 'SMTP ainda nao configurado; o rollout atual usa local-outbox supervisionado.',
      imapConfigured
        ? 'IMAP configurado para inbound/approval polling.'
        : 'IMAP nao configurado; o canal cobre notificacao outbound neste momento.',
    ],
  };
}

export async function safeReadChannelProviderDoctorJson(response: Response): Promise<Record<string, any> | null> {
  try {
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
