/**
 * Phase 2–3 intent verbs: one short command per everyday intention.
 * Keeps platform namespaces available but off the default mental model.
 */

export const INTENT_CONNECT_CHANNEL_TOKENS = new Set([
  'telegram',
  'whatsapp',
  'discord',
  'slack',
  'email',
  'signal',
  'imessage',
  'matrix',
  'teams',
  'msteams',
]);

/** English-only intent sub-verbs (no multi-language CLI synonym packs). */
export const INTENT_ANYONE_LEARN_VERBS = new Set([
  '',
  'digest',
  'learned',
  'undo',
  'forget',
  'powers',
  'superpowers',
  'skills',
  'reach',
  'where',
  'learn-on',
  'learn-off',
  'learning-on',
  'learning-off',
  'onboard',
  'setup',
  'help',
  '--help',
  '-h',
]);

export type IntentRoute =
  | { kind: 'anyone'; args: string[] }
  | { kind: 'channels'; args: string[] }
  | { kind: 'providers'; args: string[] }
  | { kind: 'connectors'; args: string[] }
  | { kind: 'help-connect' }
  | { kind: 'passthrough' };

/** `zavorth connect …` → channels / providers / connectors */
export function resolveConnectIntent(restArgs: string[]): IntentRoute {
  const first = String(restArgs[0] || '').trim().toLowerCase();
  const rest = restArgs.slice(1);

  if (!first || first === 'help' || first === '--help' || first === '-h') {
    return { kind: 'help-connect' };
  }
  if (first === 'provider' || first === 'providers' || first === 'model' || first === 'models') {
    return { kind: 'providers', args: rest };
  }
  if (first === 'channel' || first === 'channels') {
    return { kind: 'channels', args: rest };
  }
  if (INTENT_CONNECT_CHANNEL_TOKENS.has(first)) {
    return { kind: 'channels', args: restArgs };
  }
  if (first === 'status' || first === 'doctor' || first === 'list' || first === 'add') {
    return { kind: 'connectors', args: restArgs };
  }
  if (first === 'connectors' || first === 'connector') {
    return { kind: 'connectors', args: rest };
  }
  // Unknown token: try channels path (product mirror for chat surfaces).
  return { kind: 'channels', args: restArgs };
}

/** Bare `learn` / human verbs → anyone path; advanced learning plane left alone. */
export function resolveLearnIntent(command: string, restArgs: string[]): IntentRoute {
  const cmd = String(command || '').trim().toLowerCase();
  if (cmd !== 'learn' && cmd !== 'learning') {
    return { kind: 'passthrough' };
  }
  const first = String(restArgs[0] || '').trim().toLowerCase();
  if (['skill', 'skills', '--skill', 'loop', 'native', 'plane', 'candidates', 'metrics', 'approve', 'reject', 'promote'].includes(first)) {
    return { kind: 'passthrough' };
  }
  if (INTENT_ANYONE_LEARN_VERBS.has(first)) {
    const args = !first || first === 'help' || first === '--help' || first === '-h'
      ? ['digest']
      : restArgs;
    return { kind: 'anyone', args };
  }
  // Unknown subcommand: still prefer anyone digest over live-namespace noise.
  if (!first) {
    return { kind: 'anyone', args: ['digest'] };
  }
  return { kind: 'passthrough' };
}

export function formatConnectHelp(): string {
  return [
    'Usage: zavorth connect [target]',
    '',
    'One verb to attach providers and channels.',
    '',
    'Examples:',
    '  zavorth connect                  Show this help',
    '  zavorth connect telegram         Configure Telegram',
    '  zavorth connect whatsapp         Configure WhatsApp',
    '  zavorth connect providers        Model providers',
    '  zavorth connect status           Connector readiness',
    '  zavorth connect list             List connectors',
    '',
    'Same surfaces as:',
    '  zavorth channels …',
    '  zavorth providers …',
    '  zavorth connectors …',
    '',
    'Day-to-day path: zavorth help',
    'Operator path:   zavorth help advanced',
  ].join('\n');
}
