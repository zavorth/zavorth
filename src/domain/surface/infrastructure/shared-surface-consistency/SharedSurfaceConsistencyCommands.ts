import type { SharedSurfaceCommandContractEntry } from '../../../../services/SharedSurfaceCommandContract.js';
import type {
  SurfaceConsistencyCategory,
  SurfaceConsistencyCommandSnapshot,
  SurfaceConsistencyReadiness,
} from './SharedSurfaceConsistencyTypes.js';

export const RECOMMENDED_COMMANDS = new Set([
  '/help',
  '/status',
  '/task',
  '/auto',
  '/workflow',
  '/access',
  '/autorepair',
]);

export function mapCommand(
  entry: SharedSurfaceCommandContractEntry,
  discordSlashMap: Map<string, SharedSurfaceCommandContractEntry>,
  readiness: SurfaceConsistencyReadiness,
): SurfaceConsistencyCommandSnapshot {
  const discordSlash = discordSlashMap.get(entry.commandType) || null;
  const surfaceCommand = String(entry.surfaceCommand || entry.commandType || '').trim();
  const discordSlashCommand = discordSlash
    ? `/${String(discordSlash.discordSlashName || entry.discordSlashName || entry.commandType || '').replace(/^\/+/, '')}`
    : null;
  return {
    commandType: entry.commandType,
    surfaceCommand,
    description: String(entry.description || '').trim() || 'Acao compartilhada entre as superficies do Zavorth.',
    handler: entry.handler,
    category: resolveCategory(entry.commandType),
    equivalents: {
      webPrompt: surfaceCommand,
      telegramCommand: surfaceCommand,
      discordSlashCommand,
    },
    availability: {
      web: readiness.webReady ? 'ready' : 'pending',
      telegram: readiness.telegramReady ? 'ready' : 'pending',
      discord: discordSlash ? 'slash' : 'hidden',
    },
    discord: {
      slashName: discordSlash?.discordSlashName || entry.discordSlashName || null,
      visibility: entry.discordSlashVisibility,
    },
  };
}

export function resolveCategory(commandType: string): SurfaceConsistencyCategory {
  const normalized = String(commandType || '').trim().toLowerCase();
  if (normalized === '/task' || normalized === '/auto' || normalized === '/plan' || normalized === '/dryrun') {
    return 'chat';
  }
  if (normalized === '/workflow') {
    return 'workflow';
  }
  if (normalized === '/status' || normalized === '/changes' || normalized === '/selfupdate' || normalized === '/autorepair') {
    return 'operations';
  }
  if (
    normalized === '/gateway'
    || normalized === '/tools'
    || normalized === '/hooks'
    || normalized === '/runtime'
    || normalized === '/access'
    || normalized === '/bootstrap'
    || normalized === '/transports'
    || normalized === '/channels'
    || normalized === '/plugins'
    || normalized === '/platform'
    || normalized === '/memoryplane'
    || normalized === '/sessions'
    || normalized === '/sessionhistory'
    || normalized === '/sessionsend'
    || normalized === '/sessionspawn'
    || normalized === '/nodes'
    || normalized === '/nodepair'
    || normalized === '/nodeinvoke'
    || normalized === '/capabilities'
    || normalized === '/integrations'
    || normalized === '/connect'
  ) {
    return 'control-plane';
  }
  return 'runtime';
}

export function buildSummary(input: {
  totalCommands: number;
  actionCount: number;
  webReady: boolean;
  telegramReady: boolean;
  discordSlashReadyCount: number;
}): string {
  const parts: string[] = [`${input.totalCommands} acao(oes) compartilhadas no contrato de superficies.`];
  if (input.actionCount > 0) {
    parts.push(`${input.actionCount} acao(oes) contextuais equivalentes prontas no estado atual.`);
  }
  parts.push(input.webReady ? 'Web pronta.' : 'Web pendente.');
  parts.push(input.telegramReady ? 'Telegram pronto.' : 'Telegram pendente.');
  if (input.discordSlashReadyCount > 0) {
    parts.push(`${input.discordSlashReadyCount} tambem exposta(s) como slash no Discord.`);
  } else {
    parts.push('Discord ainda em exposicao controlada.');
  }
  return parts.join(' ');
}
