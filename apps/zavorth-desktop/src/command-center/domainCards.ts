import type { CommandCenterAction } from './commandCenter';

/** Hero domain cards shown above the detailed command list for IA clarity. */
export type DomainHeroCard = {
  id: string;
  titleKey: string;
  subtitleKey: string;
  action: CommandCenterAction;
};

/**
 * Six entry points that map to Zavorth product domains.
 * Actions open in-app panels/settings only — no external product names.
 */
export const DOMAIN_HERO_CARDS: DomainHeroCard[] = [
  {
    id: 'hero:capability-map',
    titleKey: 'cc.hero.capabilityMap.title',
    subtitleKey: 'cc.hero.capabilityMap.subtitle',
    action: { type: 'capability-map' },
  },
  {
    id: 'hero:skills',
    titleKey: 'cc.hero.skills.title',
    subtitleKey: 'cc.hero.skills.subtitle',
    action: { type: 'panel', panel: 'skills' },
  },
  {
    id: 'hero:channels',
    titleKey: 'cc.hero.channels.title',
    subtitleKey: 'cc.hero.channels.subtitle',
    action: { type: 'panel', panel: 'channels' },
  },
  {
    id: 'hero:automations',
    titleKey: 'cc.hero.automations.title',
    subtitleKey: 'cc.hero.automations.subtitle',
    action: { type: 'panel', panel: 'automations' },
  },
  {
    id: 'hero:agents',
    titleKey: 'cc.hero.agents.title',
    subtitleKey: 'cc.hero.agents.subtitle',
    action: { type: 'panel', panel: 'agents' },
  },
  {
    id: 'hero:power',
    titleKey: 'cc.hero.power.title',
    subtitleKey: 'cc.hero.power.subtitle',
    action: { type: 'panel', panel: 'analytics' },
  },
  {
    id: 'hero:product',
    titleKey: 'cc.hero.product.title',
    subtitleKey: 'cc.hero.product.subtitle',
    action: { type: 'panel', panel: 'settings' },
  },
];
