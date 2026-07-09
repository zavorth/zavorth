import React, { useMemo, useRef, useState } from 'react';
import type { PremiumTheme } from '../theme/premiumThemes';
import { exportPremiumThemeState, premiumThemeFonts, premiumThemeMarketplace, type PremiumThemeState } from '../theme/premiumThemes';
import { t } from '../i18n';
import { asErrorLike } from '../lib/errors';

type ThemeMode = 'light' | 'dark' | 'system';
type AccentPreset = 'orange' | 'purple' | 'navy';

export function ThemeStudioPanel(props: {
  profile: string;
  theme: ThemeMode;
  accent: AccentPreset;
  premiumThemeId: string;
  premiumFont: string;
  premiumThemePreviewId?: string | null;
  marketplaceThemes?: PremiumTheme[];
  customThemes?: PremiumTheme[];
  themeState?: PremiumThemeState;
  onTheme(value: ThemeMode): void;
  onAccent(value: AccentPreset): void;
  onPremiumTheme(themeId: string): void;
  onPremiumThemeSession(themeId: string): void;
  onPremiumFont(fontFamily: string): void;
  onPremiumThemePreview(themeId: string | null): void;
  onPremiumThemeImport(payload: string): PremiumTheme;
}) {
  const [selectedThemeId, setSelectedThemeId] = useState(props.premiumThemePreviewId || props.premiumThemeId);
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const themes = useMemo(() => [
    ...(props.marketplaceThemes || premiumThemeMarketplace),
    ...(props.customThemes || []),
  ], [props.customThemes, props.marketplaceThemes]);
  const activeThemeId = props.premiumThemePreviewId || selectedThemeId || props.premiumThemeId;

  const previewTheme = (themeId: string | null) => {
    setSelectedThemeId(themeId || props.premiumThemeId);
    props.onPremiumThemePreview(themeId);
  };

  const applyTheme = () => {
    const nextThemeId = selectedThemeId || activeThemeId || props.premiumThemeId;
    props.onPremiumTheme(nextThemeId);
    props.onPremiumThemePreview(null);
  };

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = props.onPremiumThemeImport(String(reader.result || ''));
        setImportError('');
        setSelectedThemeId(imported.id);
        props.onPremiumThemePreview(imported.id);
      } catch (error: unknown) {
        const err = asErrorLike(error);
        setImportError(error instanceof Error ? error.message : t('invalidTheme'));
      } finally {
        event.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleExport = () => {
    const state = props.themeState || {
      selectedByProfile: { [props.profile]: props.premiumThemeId },
      selectedBySession: {},
      fontByProfile: { [props.profile]: props.premiumFont },
      customThemes: props.customThemes || [],
    };
    const blob = new Blob([exportPremiumThemeState(state)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'zavorth-premium-themes.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="zvd-theme-studio" aria-label="Theme Studio">
      <header className="zvd-theme-studio-header">
        <div>
          <span className="zvd-theme-eyebrow">{t('premiumTheme')}</span>
          <h3>Theme Studio</h3>
          <p>{t('themeStudioDescription')} {props.profile}.</p>
        </div>
        <div className="zvd-theme-studio-actions">
          <button type="button" className="zvd-theme-ghost" onClick={() => fileInputRef.current?.click()}>
            {t('importVsCodeTheme')}
          </button>
          <button type="button" className="zvd-theme-ghost" onClick={handleExport}>
            {t('exportTheme')}
          </button>
          <button type="button" className="zvd-theme-primary" onClick={applyTheme}>
            {t('applyToProfile')}
          </button>
          <button type="button" className="zvd-theme-ghost" onClick={() => props.onPremiumThemeSession(selectedThemeId || activeThemeId)}>
            {t('applyToSession')}
          </button>
          <input ref={fileInputRef} type="file" accept="application/json,.json,.jsonc" onChange={handleImportFile} />
        </div>
      </header>

      <div className="zvd-theme-controls">
        <label>
          <span>{t('appearance')}</span>
          <select value={props.theme} onChange={event => props.onTheme(event.target.value as ThemeMode)}>
            <option value="system">{t('systemTheme')}</option>
            <option value="light">{t('lightTheme')}</option>
            <option value="dark">{t('darkTheme')}</option>
          </select>
        </label>
        <label>
          <span>{t('accentBase')}</span>
          <select value={props.accent} onChange={event => props.onAccent(event.target.value as AccentPreset)}>
            <option value="orange">Zavorth</option>
            <option value="purple">Violeta</option>
            <option value="navy">Navy</option>
          </select>
        </label>
        <label>
          <span>{t('profileFont')}</span>
          <select value={props.premiumFont} onChange={event => props.onPremiumFont(event.target.value)}>
            {premiumThemeFonts.map(font => <option key={font} value={font}>{font}</option>)}
          </select>
        </label>
      </div>

      {importError && (
        <div className="zvd-theme-import-error" role="alert">
          {importError}
        </div>
      )}

      <div className="zvd-theme-marketplace" aria-label={t('themeMarketplace')}>
        {themes.map(theme => {
          const isActive = theme.id === activeThemeId;
          return (
            <button
              type="button"
              key={theme.id}
              className={`zvd-theme-card ${isActive ? 'is-active' : ''}`}
              data-theme-id={theme.id}
              onClick={() => previewTheme(theme.id)}
              onFocus={() => previewTheme(theme.id)}
              onMouseEnter={() => previewTheme(theme.id)}
            >
              <span className="zvd-theme-preview" style={theme.cssVars as React.CSSProperties}>
                <span />
                <span />
                <span />
              </span>
              <span className="zvd-theme-card-body">
                <strong>{theme.name}</strong>
                <small>{theme.description}</small>
                <em>{theme.translucency === 'glass' ? t('glassTheme') : theme.translucency === 'soft' ? t('softTheme') : t('solidTheme')}</em>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
