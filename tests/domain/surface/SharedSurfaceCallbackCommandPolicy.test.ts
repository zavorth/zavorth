import {
  evaluateSharedSurfaceCommandCallback,
  isSharedSurfaceChannelCallbackAction,
  isSharedSurfaceOperationalCallbackCommand,
  normalizeSharedSurfaceCommandCallback,
} from '../../../src/domain/surface/presentation/shared-surface/SharedSurfaceCallbackCommandPolicy';

describe('SharedSurfaceCallbackCommandPolicy', () => {
  it('normalizes read-only shared-surface callbacks', () => {
    expect(normalizeSharedSurfaceCommandCallback('  /channels   status   whatsapp  ')).toBe('/channels status whatsapp');
    expect(normalizeSharedSurfaceCommandCallback('/channels consistency')).toBe('/channels consistency');
    expect(normalizeSharedSurfaceCommandCallback('/channels consistency whatsapp')).toBe('/channels consistency whatsapp');
    expect(normalizeSharedSurfaceCommandCallback('/commands page 2')).toBe('/commands page 2');
    expect(normalizeSharedSurfaceCommandCallback('/model gemma-2-27b-it')).toBe('/model gemma-2-27b-it');
    expect(normalizeSharedSurfaceCommandCallback('/readiness')).toBe('/readiness');
    expect(normalizeSharedSurfaceCommandCallback('/ready')).toBe('/ready');
    expect(normalizeSharedSurfaceCommandCallback('/stayonline')).toBe('/stayonline');
    expect(normalizeSharedSurfaceCommandCallback('/fixes')).toBe('/fixes');
    expect(normalizeSharedSurfaceCommandCallback('/zavorthControl')).toBe('/zavorthcontrol');
    expect(normalizeSharedSurfaceCommandCallback('/echoapprovals')).toBe('/echoapprovals');
  });

  it('blocks forged mutating channel callbacks', () => {
    expect(evaluateSharedSurfaceCommandCallback('/channels logout whatsapp')).toEqual(
      expect.objectContaining({
        allowed: false,
        reason: 'Acao de canal exige comando explicito.',
      }),
    );
    expect(normalizeSharedSurfaceCommandCallback('/channels repair discord')).toBeNull();
    expect(normalizeSharedSurfaceCommandCallback('/channels broadcast-test telegram')).toBeNull();
  });

  it('rejects malformed or argument-smuggling callbacks', () => {
    expect(normalizeSharedSurfaceCommandCallback('/status extra')).toBeNull();
    expect(normalizeSharedSurfaceCommandCallback('/commands page 2;rm')).toBeNull();
    expect(normalizeSharedSurfaceCommandCallback('/channels status whatsapp\n/channels logout whatsapp')).toBeNull();
  });

  it('classifies public and operational callbacks for channel surfaces', () => {
    expect(isSharedSurfaceOperationalCallbackCommand('/commands channel')).toBe(false);
    expect(isSharedSurfaceOperationalCallbackCommand('/help')).toBe(false);
    expect(isSharedSurfaceOperationalCallbackCommand('/channels status whatsapp')).toBe(true);
    expect(isSharedSurfaceChannelCallbackAction('login-qr')).toBe(true);
    expect(isSharedSurfaceChannelCallbackAction('logout')).toBe(false);
  });
});
