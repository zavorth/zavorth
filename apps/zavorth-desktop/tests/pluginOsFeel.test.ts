import { describe, expect, it } from 'vitest';
import {
  humanPluginStatus,
  humanTrustLabel,
  friendlyMetricsLabelField,
} from '../src/desktop-state/pluginOsBridge';
import { pluginOsPlaneLabels, tPluginOs } from '../src/i18n/pluginOsPlane';
import { defaultPluginOsWizardProfiles } from '../src/views/panels/PluginOsOnboardingWizardPanel';

describe('Plugin OS feel helpers', () => {
  it('English UI strings avoid loadEligible / funnel jargon', () => {
    const labels = pluginOsPlaneLabels('en');
    expect(labels.eligible).toBe('Ready to load');
    expect(labels.funnel).toBe('Coverage');
    expect(labels.coverage).toBe('Coverage');
    expect(labels.emptyCtaPrimary).toMatch(/recommended/i);
    expect(labels.emptyNeverAuto.toLowerCase()).toContain('never auto-enables');
    expect(labels.wizardTitle).toBeTruthy();
    expect(JSON.stringify(labels).toLowerCase()).not.toContain('load eligible');
    expect(JSON.stringify(labels).toLowerCase()).not.toContain('load funnel');
  });

  it('Portuguese has human status and ready-to-load copy', () => {
    expect(tPluginOs('pluginOs.eligible', 'pt')).toBe('Pronto para carregar');
    expect(tPluginOs('pluginOs.funnel', 'pt')).toBe('Cobertura');
    expect(tPluginOs('pluginOs.statusActive', 'pt')).toBe('Ativo');
    expect(tPluginOs('pluginOs.trustReview', 'pt')).toBe('Precisa de revisão');
    expect(tPluginOs('pluginOs.wizardNext', 'pt')).toBe('Próximo');
  });

  it('default wizard profiles cover minimal/core/recommended/full', () => {
    const profiles = defaultPluginOsWizardProfiles();
    expect(profiles.map((p) => p.id)).toEqual(['minimal', 'core', 'recommended', 'full']);
    expect(profiles.every((p) => p.label && p.summary)).toBe(true);
  });

  it('status helpers stay soft and human-readable', () => {
    expect(humanPluginStatus({
      enabled: false,
      installed: true,
      trust: 'review',
      runtimeState: 'installed',
      loadEligible: false,
    })).toBe('needs_setup');
    expect(humanTrustLabel('trusted')).toBe('Trusted');
    expect(friendlyMetricsLabelField('funnel')).toBe('coverage');
  });
});
