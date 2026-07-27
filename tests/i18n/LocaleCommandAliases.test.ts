import { describe, it, expect, beforeEach, beforeAll } from '@jest/globals';
import {
  __resetLocaleCommandAliasPacksForTests,
  isLocaleCommandVerb,
  matchesLocaleCommand,
  resolveLocaleCommandToken,
  resolveLocaleCommandVerb,
} from '../../src/i18n/LocaleCommandAliases.js';

function loadPack(relativePath: string): void {
  const absolute = require.resolve(relativePath);
  delete require.cache[absolute];
  require(absolute);
}

describe('LocaleCommandAliases', () => {
  describe('canonical EN codes', () => {
    beforeEach(() => {
      __resetLocaleCommandAliasPacksForTests();
    });

    it('resolves on aliases', () => {
      for (const raw of ['on', 'enable', 'start', 'activate', 'ON', ' Enable ']) {
        expect(resolveLocaleCommandToken(raw, 'en')).toBe('on');
        expect(isLocaleCommandVerb(raw, 'on', 'en')).toBe(true);
        expect(matchesLocaleCommand(raw, 'on', 'en')).toBe(true);
      }
    });

    it('resolves off aliases', () => {
      for (const raw of ['off', 'disable', 'stop', 'deactivate']) {
        expect(resolveLocaleCommandToken(raw, 'en')).toBe('off');
        expect(isLocaleCommandVerb(raw, 'off', 'en')).toBe(true);
      }
    });

    it('resolves now / status / list / help / reset / next / short / pitch / checklist', () => {
      expect(resolveLocaleCommandToken('now', 'en')).toBe('now');
      expect(resolveLocaleCommandToken('status', 'en')).toBe('status');
      expect(resolveLocaleCommandToken('list', 'en')).toBe('list');
      expect(resolveLocaleCommandToken('overview', 'en')).toBe('list');
      expect(matchesLocaleCommand('overview', 'list', 'en')).toBe(true);
      expect(matchesLocaleCommand('overview', 'overview', 'en')).toBe(true);
      expect(resolveLocaleCommandToken('help', 'en')).toBe('help');
      expect(resolveLocaleCommandToken('reset', 'en')).toBe('reset');
      expect(resolveLocaleCommandToken('next', 'en')).toBe('next');
      expect(resolveLocaleCommandToken('short', 'en')).toBe('short');
      expect(resolveLocaleCommandToken('pitch', 'en')).toBe('pitch');
      expect(resolveLocaleCommandToken('checklist', 'en')).toBe('checklist');
    });

    it('returns null for unknown tokens', () => {
      expect(resolveLocaleCommandToken('foobar', 'en')).toBeNull();
      expect(resolveLocaleCommandVerb('foobar', 'en')).toBeNull();
      expect(isLocaleCommandVerb('foobar', 'on', 'en')).toBe(false);
    });

    it('does not require locale for canonical EN codes', () => {
      expect(resolveLocaleCommandToken('on')).toBe('on');
      expect(resolveLocaleCommandToken('now', null)).toBe('now');
    });
  });

  describe('pt pack', () => {
    beforeAll(() => {
      __resetLocaleCommandAliasPacksForTests();
      loadPack('../../src/i18n/localePacks/commandAliases.pt.js');
    });

    it('resolves on aliases (ligar/ativar)', () => {
      for (const raw of ['ligar', 'ativar', 'liga', 'ativa', 'Ativar']) {
        expect(resolveLocaleCommandToken(raw, 'pt')).toBe('on');
        expect(resolveLocaleCommandToken(raw, 'pt-BR')).toBe('on');
        expect(isLocaleCommandVerb(raw, 'on', 'pt-BR')).toBe(true);
        expect(matchesLocaleCommand(raw, 'on', 'pt')).toBe(true);
      }
    });

    it('resolves off aliases (desligar/desativar)', () => {
      for (const raw of ['desligar', 'desativar', 'desliga', 'desativa']) {
        expect(resolveLocaleCommandToken(raw, 'pt')).toBe('off');
        expect(isLocaleCommandVerb(raw, 'off', 'pt')).toBe(true);
      }
    });

    it('resolves now as agora', () => {
      expect(resolveLocaleCommandToken('agora', 'pt')).toBe('now');
      expect(matchesLocaleCommand('agora', 'now', 'pt-BR')).toBe(true);
      // PT-only synonym must not resolve under a different locale without that pack entry
      expect(resolveLocaleCommandToken('agora', 'en')).toBeNull();
    });

    it('resolves help as ajuda', () => {
      expect(matchesLocaleCommand('ajuda', 'help', 'pt')).toBe(true);
    });

    it('keeps EN codes working under pt locale', () => {
      expect(isLocaleCommandVerb('on', 'on', 'pt')).toBe(true);
      expect(matchesLocaleCommand('now', 'now', 'pt')).toBe(true);
    });
  });

  describe('es pack (optional)', () => {
    beforeAll(() => {
      __resetLocaleCommandAliasPacksForTests();
      loadPack('../../src/i18n/localePacks/commandAliases.es.js');
    });

    it('resolves on/off/now Spanish aliases', () => {
      expect(isLocaleCommandVerb('activar', 'on', 'es')).toBe(true);
      expect(isLocaleCommandVerb('desactivar', 'off', 'es-ES')).toBe(true);
      expect(matchesLocaleCommand('ahora', 'now', 'es')).toBe(true);
    });
  });
});
