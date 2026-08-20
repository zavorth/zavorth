import { resolveIntegrationUiState } from './mocks/integrations-doctor-ui';
import { translate } from '../../../apps/zavorth-control-vite-shell/src/locale';
import { initThemeToggle } from '../../../apps/zavorth-control-vite-shell/src/theme';

describe('Control settings localization', () => {
  it('covers the settings, channels, history and readiness copy in both product locales', () => {
    const keysPtBr = [
      'app.settings',
      'app.channels',
      'app.approvals',
      'app.chat',
    ];

    const keysEsAr = [
      'app.settings',
      'app.channels',
      'app.approvals',
    ];

    for (const key of keysPtBr) {
      expect(translate(key, 'pt-BR')).not.toBe(key);
    }
    for (const key of keysEsAr) {
      expect(translate(key, 'es-AR')).not.toBe(key);
    }
  });

  it('understands the nested integration catalog contract without parsing free text', () => {
    expect(resolveIntegrationUiState({
      manifest: { id: 'openai', label: 'OpenAI' },
      readiness: 'ready',
      doctor: { status: 'ok', configured: true },
    })).toBe('ready');
    expect(resolveIntegrationUiState({
      manifest: { id: 'notion', label: 'Notion' },
      readiness: 'needs_configuration',
      doctor: { status: 'warn', configured: false },
    })).toBe('configure');
    expect(resolveIntegrationUiState({
      manifest: { id: 'broken', label: 'Broken' },
      readiness: 'ready',
      doctor: { status: 'error', configured: true },
    })).toBe('error');
  });

  it('switches theme state and persists both choices', () => {
    const originalDocument = globalThis.document;
    const originalLocalStorage = globalThis.localStorage;
    const attributes = new Map<string, string>();
    const stored = new Map<string, string>();
    const handlers: Record<string, () => void> = {};
    const iconSun = { style: { display: '' } };
    const iconMoon = { style: { display: '' } };
    const toggle = {
      querySelector: (selector: string) => selector === '.icon-sun' ? iconSun : iconMoon,
      addEventListener: (event: string, handler: () => void) => {
        handlers[event] = handler;
      },
    };

    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        documentElement: {
          setAttribute: (key: string, value: string) => attributes.set(key, value),
          getAttribute: (key: string) => attributes.get(key) || null,
        },
        getElementById: (id: string) => id === 'theme-toggle' ? toggle : null,
      },
    });
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => stored.get(key) || null,
        setItem: (key: string, value: string) => stored.set(key, value),
      },
    });

    try {
      initThemeToggle();
      expect(attributes.get('data-theme')).toBe('zavorth');

      handlers.click?.();
      expect(attributes.get('data-theme')).toBe('light');
      expect(stored.get('zavorth_theme')).toBe('light');

      handlers.click?.();
      expect(attributes.get('data-theme')).toBe('zavorth');
      expect(stored.get('zavorth_theme')).toBe('zavorth');
    } finally {
      Object.defineProperty(globalThis, 'document', { configurable: true, value: originalDocument });
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: originalLocalStorage });
    }
  });
});
