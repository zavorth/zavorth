export type ChannelProductTier = 'T0' | 'T1' | 'T2' | 'T3';

export type ChannelProductTierDefinition = {
  id: string;
  label: string;
  tier: ChannelProductTier;
  productionClaim: 'always' | 'when-certified-live' | 'experimental' | 'catalog-only';
  protocolRisk: 'low' | 'medium' | 'high';
  doctorCommand: string;
  notes: string;
};

const TIER_CATALOG: ChannelProductTierDefinition[] = [
  {
    id: 'control-panel',
    label: 'Control panel / CLI',
    tier: 'T0',
    productionClaim: 'always',
    protocolRisk: 'low',
    doctorCommand: 'zavorth doctor',
    notes: 'Primary governed surface; not a chat protocol adapter.',
  },
  {
    id: 'telegram',
    label: 'Telegram',
    tier: 'T1',
    productionClaim: 'when-certified-live',
    protocolRisk: 'low',
    doctorCommand: 'zavorth channels doctor telegram',
    notes: 'Official Bot API; deepest native channel surface.',
  },
  {
    id: 'discord',
    label: 'Discord',
    tier: 'T1',
    productionClaim: 'when-certified-live',
    protocolRisk: 'low',
    doctorCommand: 'zavorth channels doctor discord',
    notes: 'Official bot token path.',
  },
  {
    id: 'slack',
    label: 'Slack',
    tier: 'T1',
    productionClaim: 'when-certified-live',
    protocolRisk: 'low',
    doctorCommand: 'zavorth channels doctor slack',
    notes: 'Official API / webhook path.',
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp Cloud API',
    tier: 'T1',
    productionClaim: 'when-certified-live',
    protocolRisk: 'medium',
    doctorCommand: 'zavorth channels doctor whatsapp',
    notes: 'Cloud API is the production path; Baileys bridge is separate experimental risk.',
  },
  {
    id: 'whatsapp-baileys',
    label: 'WhatsApp Baileys bridge',
    tier: 'T2',
    productionClaim: 'experimental',
    protocolRisk: 'high',
    doctorCommand: 'zavorth channels doctor whatsapp',
    notes: 'Unofficial protocol; isolate in a bridge process; never claim core production readiness from catalog alone.',
  },
  {
    id: 'signal',
    label: 'Signal',
    tier: 'T2',
    productionClaim: 'experimental',
    protocolRisk: 'high',
    doctorCommand: 'zavorth channels doctor signal',
    notes: 'Fragile third-party protocol surface.',
  },
  {
    id: 'imessage',
    label: 'iMessage',
    tier: 'T2',
    productionClaim: 'experimental',
    protocolRisk: 'high',
    doctorCommand: 'zavorth channels doctor imessage',
    notes: 'Local macOS bridge; high platform coupling.',
  },
  {
    id: 'teams',
    label: 'Microsoft Teams',
    tier: 'T3',
    productionClaim: 'catalog-only',
    protocolRisk: 'medium',
    doctorCommand: 'zavorth channels doctor teams',
    notes: 'Factory/webhook presence is not live certification.',
  },
  {
    id: 'email',
    label: 'Email',
    tier: 'T3',
    productionClaim: 'catalog-only',
    protocolRisk: 'low',
    doctorCommand: 'zavorth channels doctor email',
    notes: 'Catalog/factory channel until live proof exists.',
  },
  {
    id: 'matrix',
    label: 'Matrix',
    tier: 'T3',
    productionClaim: 'catalog-only',
    protocolRisk: 'medium',
    doctorCommand: 'zavorth channels doctor matrix',
    notes: 'Long-tail webhook/factory channel.',
  },
  {
    id: 'line',
    label: 'LINE',
    tier: 'T3',
    productionClaim: 'catalog-only',
    protocolRisk: 'medium',
    doctorCommand: 'zavorth channels doctor line',
    notes: 'Long-tail webhook/factory channel.',
  },
  {
    id: 'feishu',
    label: 'Feishu',
    tier: 'T3',
    productionClaim: 'catalog-only',
    protocolRisk: 'medium',
    doctorCommand: 'zavorth channels doctor feishu',
    notes: 'Long-tail webhook/factory channel.',
  },
];

const BY_ID = new Map(TIER_CATALOG.map((entry) => [entry.id, entry]));

export function listChannelProductTiers(): ChannelProductTierDefinition[] {
  return TIER_CATALOG.map((entry) => ({ ...entry }));
}

export function resolveChannelProductTier(channelId: string | null | undefined): ChannelProductTierDefinition | null {
  const id = String(channelId || '').trim().toLowerCase();
  if (!id) return null;
  if (BY_ID.has(id)) return { ...BY_ID.get(id)! };
  if (id === 'whatsapp-cloud' || id === 'whatsapp_cloud') return { ...BY_ID.get('whatsapp')! };
  if (id.includes('baileys')) return { ...BY_ID.get('whatsapp-baileys')! };
  return {
    id,
    label: id,
    tier: 'T3',
    productionClaim: 'catalog-only',
    protocolRisk: 'medium',
    doctorCommand: `zavorth channels doctor ${id}`,
    notes: 'Unlisted factory channel defaults to catalog-only until certified live.',
  };
}

export function channelMayClaimProduction(entry: ChannelProductTierDefinition, liveCertified: boolean): boolean {
  if (entry.productionClaim === 'always') return true;
  if (entry.productionClaim === 'when-certified-live') return liveCertified;
  return false;
}
