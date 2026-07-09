/**
 * Guided domain wizards for Command Center hero cards.
 */

import type { CommandCenterAction } from './commandCenter';

export type WizardId = 'absorb-skill' | 'channel-doctor' | 'power-backend';

export type WizardStep = {
  id: string;
  titleKey: string;
  bodyKey: string;
  optional?: boolean;
};

export type DomainWizard = {
  id: WizardId;
  titleKey: string;
  subtitleKey?: string;
  steps: WizardStep[];
  completeAction: CommandCenterAction;
};

export const DOMAIN_WIZARDS: DomainWizard[] = [
  {
    id: 'absorb-skill',
    titleKey: 'wizard.absorb.title',
    subtitleKey: 'wizard.absorb.subtitle',
    completeAction: { type: 'panel', panel: 'skills' },
    steps: [
      {
        id: 'absorb-1',
        titleKey: 'wizard.absorb.step1.title',
        bodyKey: 'wizard.absorb.step1.body',
      },
      {
        id: 'absorb-2',
        titleKey: 'wizard.absorb.step2.title',
        bodyKey: 'wizard.absorb.step2.body',
      },
      {
        id: 'absorb-3',
        titleKey: 'wizard.absorb.step3.title',
        bodyKey: 'wizard.absorb.step3.body',
        optional: true,
      },
      {
        id: 'absorb-4',
        titleKey: 'wizard.absorb.step4.title',
        bodyKey: 'wizard.absorb.step4.body',
      },
    ],
  },
  {
    id: 'channel-doctor',
    titleKey: 'wizard.channelDoctor.title',
    subtitleKey: 'wizard.channelDoctor.subtitle',
    completeAction: { type: 'panel', panel: 'channels' },
    steps: [
      {
        id: 'channel-1',
        titleKey: 'wizard.channelDoctor.step1.title',
        bodyKey: 'wizard.channelDoctor.step1.body',
      },
      {
        id: 'channel-2',
        titleKey: 'wizard.channelDoctor.step2.title',
        bodyKey: 'wizard.channelDoctor.step2.body',
      },
      {
        id: 'channel-3',
        titleKey: 'wizard.channelDoctor.step3.title',
        bodyKey: 'wizard.channelDoctor.step3.body',
      },
    ],
  },
  {
    id: 'power-backend',
    titleKey: 'wizard.powerBackend.title',
    subtitleKey: 'wizard.powerBackend.subtitle',
    completeAction: { type: 'settings', tab: 'providers' },
    steps: [
      {
        id: 'power-1',
        titleKey: 'wizard.powerBackend.step1.title',
        bodyKey: 'wizard.powerBackend.step1.body',
      },
      {
        id: 'power-2',
        titleKey: 'wizard.powerBackend.step2.title',
        bodyKey: 'wizard.powerBackend.step2.body',
      },
      {
        id: 'power-3',
        titleKey: 'wizard.powerBackend.step3.title',
        bodyKey: 'wizard.powerBackend.step3.body',
      },
    ],
  },
];

const HERO_TO_WIZARD: Record<string, WizardId> = {
  'hero:skills': 'absorb-skill',
  'hero:channels': 'channel-doctor',
  'hero:power': 'power-backend',
};

export function getWizard(id: WizardId | string | null | undefined): DomainWizard | null {
  if (!id) return null;
  return DOMAIN_WIZARDS.find(wizard => wizard.id === id) ?? null;
}

export function wizardIdFromHero(heroId: string | null | undefined): WizardId | null {
  if (!heroId) return null;
  return HERO_TO_WIZARD[String(heroId)] ?? null;
}

export function isWizardHero(heroId: string | null | undefined): boolean {
  return wizardIdFromHero(heroId) != null;
}

export function wizardProgress(
  stepIndex: number,
  total: number,
): {
  current: number;
  total: number;
  ratio: number;
  isLast: boolean;
  isFirst: boolean;
} {
  if (total <= 0) {
    return { current: 0, total: 0, ratio: 0, isLast: true, isFirst: true };
  }
  const current = Math.max(0, Math.min(total - 1, Math.floor(stepIndex)));
  return {
    current,
    total,
    ratio: (current + 1) / total,
    isLast: current >= total - 1,
    isFirst: current <= 0,
  };
}

export function nextWizardStep(stepIndex: number, total: number): number {
  if (total <= 0) return 0;
  const current = Math.max(0, Math.min(total - 1, Math.floor(stepIndex)));
  return Math.min(total - 1, current + 1);
}

export function prevWizardStep(stepIndex: number): number {
  if (!Number.isFinite(stepIndex)) return 0;
  return Math.max(0, Math.floor(stepIndex) - 1);
}
