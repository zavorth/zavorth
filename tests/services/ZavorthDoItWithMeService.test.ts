import { describe, expect, it } from '@jest/globals';
import { ZavorthDoItWithMeService } from '../../src/services/ZavorthDoItWithMeService';

describe('ZavorthDoItWithMeService', () => {
  it('builds a guided setup flow for a communication capability', () => {
    const snapshot = new ZavorthDoItWithMeService().buildContract({
      request: 'help me configure Telegram approvals',
      category: 'communication',
    });

    expect(snapshot.surface).toBe('do-it-with-me');
    expect(snapshot.mode).toBe('setup_capability');
    expect(snapshot.projections.commandCenterCanExecute).toBe(false);
    expect(snapshot.safety.rawSecretsSerialized).toBe(false);
    expect(snapshot.steps.some((step) => step.kind === 'secretref')).toBe(true);
    expect(snapshot.steps.some((step) => step.kind === 'approval')).toBe(true);
  });

  it('builds a mission preview flow when the user asks for work instead of setup', () => {
    const snapshot = new ZavorthDoItWithMeService().buildContract({
      request: 'review this repo and find risky code',
      profile: 'developer',
    });

    expect(snapshot.mode).toBe('start_mission');
    expect(snapshot.target.kind).toBe('mission');
    expect(snapshot.projections.mission?.id).toBe('review-this-repository');
    expect(snapshot.steps[1]).toMatchObject({
      kind: 'preview',
      mutatesState: false,
    });
  });

  it('keeps readiness diagnosis read-only', () => {
    const snapshot = new ZavorthDoItWithMeService().buildContract({
      request: 'check whether OpenAI provider is ready',
      category: 'providers',
    });

    expect(snapshot.mode).toBe('diagnose_readiness');
    expect(snapshot.steps.some((step) => step.kind === 'safe_check')).toBe(true);
    expect(snapshot.steps.every((step) => step.mutatesState === false)).toBe(true);
  });
});
