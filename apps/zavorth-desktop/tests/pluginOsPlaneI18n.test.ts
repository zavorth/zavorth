import { describe, expect, it } from 'vitest';
import {
  PLUGIN_OS_PLANE_I18N,
  getPluginOsPlaneLabels,
  pluginOsPlaneLabels,
  resolveDesktopLocale,
  tPluginOs,
} from '../src/i18n/pluginOsPlane';

/** Locale keys mirrored from the unified plugin-tip catalog locales. */
const EXPECTED_LOCALES = [
  'en', 'pt', 'pt-BR', 'pt-PT', 'es', 'fr', 'de', 'it', 'already', 'zh', 'zh-CN',
  'zh-Hans', 'zh-Hant', 'zh-TW', 'ko', 'ru', 'uk', 'ar', 'hi', 'nl', 'pl',
  'tr', 'vi', 'id', 'th', 'sv', 'cs', 'ro', 'hu', 'el', 'he', 'fa', 'bn', 'ms',
];

describe('pluginOsPlane i18n', () => {
  it('covers the same locale set as the unified plugin-tip catalogs (30+)', () => {
    expect(Object.keys(PLUGIN_OS_PLANE_I18N).length).toBeGreaterThanOrEqual(30);
    for (const locale of EXPECTED_LOCALES) {
      expect(PLUGIN_OS_PLANE_I18N[locale]).toBeDefined();
      expect(PLUGIN_OS_PLANE_I18N[locale]['pluginOs.title']).toBeTruthy();
    }
  });

  it('getPluginOsPlaneLabels returns title for each major locale and falls back to en', () => {
    for (const locale of EXPECTED_LOCALES) {
      const labels = getPluginOsPlaneLabels(locale);
      expect(labels['pluginOs.title']).toBeTruthy();
    }
    const unknown = getPluginOsPlaneLabels('xx-YY');
    expect(unknown['pluginOs.title']).toBe(PLUGIN_OS_PLANE_I18N.en['pluginOs.title']);
  });

  it('pluginOsPlaneLabels maps friendly keys', () => {
    const labels = pluginOsPlaneLabels('pt-BR');
    expect(labels.title).toBeTruthy();
    expect(labels.enable).toBeTruthy();
    expect(labels.refresh).toBeTruthy();
  });

  it('tPluginOs falls back to en for missing keys', () => {
    expect(tPluginOs('pluginOs.title', 'en')).toBe('Plugin OS');
    expect(tPluginOs('pluginOs.no-such-key', 'de')).toBe('pluginOs.no-such-key');
  });

  it('resolveDesktopLocale normalizes tags', () => {
    expect(resolveDesktopLocale('pt_BR')).toBe('pt-BR');
    expect(resolveDesktopLocale('en-US')).toBe('en-US');
  });
});
