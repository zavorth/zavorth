import {
  channelMayClaimProduction,
  listChannelProductTiers,
  resolveChannelProductTier,
} from '../../../src/services/ZavorthChannelProductTier.js';

describe('ZavorthChannelProductTier', () => {
  it('lists T0-T3 catalog entries', () => {
    const tiers = listChannelProductTiers();
    expect(tiers.some((entry) => entry.tier === 'T0')).toBe(true);
    expect(tiers.some((entry) => entry.id === 'telegram' && entry.tier === 'T1')).toBe(true);
    expect(tiers.some((entry) => entry.id === 'whatsapp-baileys' && entry.tier === 'T2')).toBe(true);
    expect(tiers.some((entry) => entry.tier === 'T3')).toBe(true);
  });

  it('never allows experimental channels to claim production without live proof', () => {
    const baileys = resolveChannelProductTier('whatsapp-baileys');
    expect(baileys).not.toBeNull();
    expect(channelMayClaimProduction(baileys!, false)).toBe(false);
    expect(channelMayClaimProduction(baileys!, true)).toBe(false);
  });

  it('allows T1 production only when live certified', () => {
    const telegram = resolveChannelProductTier('telegram');
    expect(telegram).not.toBeNull();
    expect(channelMayClaimProduction(telegram!, false)).toBe(false);
    expect(channelMayClaimProduction(telegram!, true)).toBe(true);
  });

  it('defaults unknown channels to catalog-only T3', () => {
    const unknown = resolveChannelProductTier('some-new-channel');
    expect(unknown?.tier).toBe('T3');
    expect(unknown?.productionClaim).toBe('catalog-only');
  });
});
