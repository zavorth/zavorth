/**
 * Canonical channel identifier normalization for factory, long-tail, live activation,
 * and continuity surfaces. Keeps alternate product aliases mapped to one mesh id.
 */

const ALIAS_TO_CANONICAL: Record<string, string> = {
  'google-chat': 'google-chat',
  googlechat: 'google-chat',
  'google_chat': 'google-chat',
  gchat: 'google-chat',
  teams: 'teams',
  msteams: 'teams',
  'ms-teams': 'teams',
  'microsoft-teams': 'teams',
  qq: 'qq',
  qqbot: 'qq',
  'qq-bot': 'qq',
  telegram: 'telegram',
  tg: 'telegram',
  discord: 'discord',
  slack: 'slack',
  whatsapp: 'whatsapp',
  wa: 'whatsapp',
  signal: 'signal',
  imessage: 'imessage',
  'i-message': 'imessage',
  email: 'email',
  mail: 'email',
  instagram: 'instagram',
  ig: 'instagram',
  matrix: 'matrix',
  line: 'line',
  feishu: 'feishu',
  lark: 'feishu',
  web: 'web',
  cli: 'cli',
  api: 'api',
};

export function normalizeChannelId(value: unknown, fallback = ''): string {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return fallback;
  const collapsed = raw.replace(/[\s_]+/g, '-');
  if (ALIAS_TO_CANONICAL[collapsed]) {
    return ALIAS_TO_CANONICAL[collapsed];
  }
  if (ALIAS_TO_CANONICAL[raw]) {
    return ALIAS_TO_CANONICAL[raw];
  }
  return collapsed || fallback;
}

export function channelIdsEqual(left: unknown, right: unknown): boolean {
  const a = normalizeChannelId(left);
  const b = normalizeChannelId(right);
  return Boolean(a) && a === b;
}

export function listChannelIdAliases(channelId: unknown): string[] {
  const canonical = normalizeChannelId(channelId);
  if (!canonical) return [];
  const aliases = Object.entries(ALIAS_TO_CANONICAL)
    .filter(([, value]) => value === canonical)
    .map(([key]) => key);
  return Array.from(new Set([canonical, ...aliases])).sort();
}
