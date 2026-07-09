import net from 'net';
import { logger } from '../../logger.js';

export type ZavorthChannelLiveValidationStatus = 'not-requested' | 'passed' | 'failed' | 'unsupported';

export type ZavorthChannelLiveValidationInput = {
  channelId: string;
  token?: string | null;
  smtpUrl?: string | null;
  explicitUserConsent: boolean;
  timeoutMs?: number;
};

export type ZavorthChannelLiveValidationResult = {
  contractVersion: 'zavorth-channel-live-validation/1';
  channelId: string;
  status: ZavorthChannelLiveValidationStatus;
  message: string;
  safety: {
    explicitUserConsent: boolean;
    networkCallPerformed: boolean;
    noMessageSent: true;
    rawSecretInOutput: false;
  };
};

export async function validateZavorthChannelLive(
  input: ZavorthChannelLiveValidationInput,
): Promise<ZavorthChannelLiveValidationResult> {
  const channelId = String(input.channelId || '').trim().toLowerCase();
  const timeoutMs = input.timeoutMs || 12000;
  if (!input.explicitUserConsent) {
    return result(input, channelId, 'not-requested', 'Live channel test was not requested.', false);
  }
  try {
    if (channelId === 'telegram') {
      const token = requireSecret(input.token, 'Telegram bot token');
      const response = await withTimeout(
        () => fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/getMe`),
        timeoutMs,
      );
      return response.ok
        ? result(input, channelId, 'passed', 'Telegram getMe passed. No message was sent.', true)
        : result(input, channelId, 'failed', `Telegram getMe failed with HTTP ${response.status}.`, true);
    }
    if (channelId === 'slack') {
      const token = requireSecret(input.token, 'Slack token');
      const response = await withTimeout(
        () => fetch('https://slack.com/api/auth.test', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        timeoutMs,
      );
      const body = await response.text();
      return response.ok && /"ok"\s*:\s*true/.test(body)
        ? result(input, channelId, 'passed', 'Slack auth.test passed. No message was sent.', true)
        : result(input, channelId, 'failed', `Slack auth.test failed with HTTP ${response.status}.`, true);
    }
    if (channelId === 'discord') {
      const token = requireSecret(input.token, 'Discord bot token');
      const response = await withTimeout(
        () => fetch('https://discord.com/api/v10/users/@me', {
          headers: { Authorization: `Bot ${token}` },
        }),
        timeoutMs,
      );
      return response.ok
        ? result(input, channelId, 'passed', 'Discord bot identity check passed. No message was sent.', true)
        : result(input, channelId, 'failed', `Discord identity check failed with HTTP ${response.status}.`, true);
    }
    if (channelId === 'email') {
      const smtpUrl = requireSecret(input.smtpUrl, 'SMTP URL');
      await tcpProbe(smtpUrl, timeoutMs);
      return result(input, channelId, 'passed', 'SMTP host accepted a TCP connection. No email was sent.', true);
    }
    return result(input, channelId, 'unsupported', `${channelId || 'unknown'} does not have a live setup test yet.`, false);
  } catch (error: any) { const err = error; const e = error;
    logger.warn('[Zavorth Channel Live Validation] connection failed', error);
    return result(
      input,
      channelId,
      'failed',
      sanitizeMessage(error instanceof Error ? error.message : String(error), [input.token, input.smtpUrl]),
      true,
    );
  }
}

export function renderZavorthChannelLiveValidationResult(resultValue: ZavorthChannelLiveValidationResult): string {
  return `Channel live test: ${resultValue.status} (${resultValue.channelId}) - ${resultValue.message}`;
}

function result(
  input: ZavorthChannelLiveValidationInput,
  channelId: string,
  status: ZavorthChannelLiveValidationStatus,
  message: string,
  networkCallPerformed: boolean,
): ZavorthChannelLiveValidationResult {
  return {
    contractVersion: 'zavorth-channel-live-validation/1',
    channelId,
    status,
    message: sanitizeMessage(message, [input.token, input.smtpUrl]),
    safety: {
      explicitUserConsent: input.explicitUserConsent,
      networkCallPerformed,
      noMessageSent: true,
      rawSecretInOutput: false,
    },
  };
}

function requireSecret(value: string | null | undefined, label: string): string {
  const secret = String(value || '').trim();
  if (!secret) {
    throw new Error(`${label} is required for a live test.`);
  }
  return secret;
}

async function withTimeout<T>(operation: () => Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation(),
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`Live test timed out after ${timeoutMs}ms.`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

async function tcpProbe(rawUrl: string, timeoutMs: number): Promise<void> {
  const url = new URL(rawUrl);
  const port = Number(url.port || (url.protocol === 'smtps:' ? 465 : 587));
  await new Promise<void>((resolve, reject) => {
    const socket = net.createConnection({ host: url.hostname, port });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`SMTP TCP probe timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
    socket.once('connect', () => {
      clearTimeout(timer);
      socket.end();
      resolve();
    });
    socket.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function sanitizeMessage(message: string, secrets: Array<string | null | undefined>): string {
  let output = String(message || '');
  for (const secret of secrets.map((entry) => String(entry || '')).filter(Boolean)) {
    output = output.split(secret).join('[redacted]');
  }
  return output
    .replace(/\b[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{12,}\b/g, '[redacted]')
    .replace(/\bxox[baprs]-[0-9A-Za-z-]{10,}\b/g, '[redacted]')
    .replace(/\/\/[^/@\s]+:[^/@\s]+@/g, '//[redacted]:[redacted]@');
}
