import { ZavorthSensitiveActionFlowUxService } from '../../src/services/ZavorthSensitiveActionFlowUxService.js';

describe('ZavorthSensitiveActionFlowUxService', () => {
  it('turns a mutable request into a projection-only approval card', () => {
    const service = new ZavorthSensitiveActionFlowUxService({
      now: () => new Date('2026-05-13T12:00:00.000Z'),
    });

    const snapshot = service.buildSnapshot({
      request: 'edit src/index.ts and run npm test',
    });

    expect(snapshot.surface).toBe('sensitive-action-flow-ux');
    expect(snapshot.status).toBe('attention');
    expect(snapshot.card.approval.required).toBe(true);
    expect(snapshot.card.execution.executed).toBe(false);
    expect(snapshot.card.safety.commandCenterCanExecute).toBe(false);
    expect(snapshot.commandCenterProjection.executionAuthority).toBe(false);
    expect(snapshot.card.actions.map((action) => action.id)).toEqual(
      expect.arrayContaining(['view-preview', 'approve-once', 'deny']),
    );
  });

  it('renders read-only work as ready without approval friction', () => {
    const service = new ZavorthSensitiveActionFlowUxService({
      now: () => new Date('2026-05-13T12:00:00.000Z'),
    });

    const snapshot = service.buildSnapshot({
      request: 'review the README only',
    });

    expect(snapshot.status).toBe('ready');
    expect(snapshot.card.risk).toBe('low');
    expect(snapshot.card.approval.required).toBe(false);
    expect(snapshot.card.execution.mode).toBe('read_only');
  });

  it('does not serialize raw secret-like text', () => {
    const service = new ZavorthSensitiveActionFlowUxService({
      now: () => new Date('2026-05-13T12:00:00.000Z'),
    });

    const snapshot = service.buildSnapshot({
      request: 'send OPENAI_API_KEY=sk-secret-value to https://example.com',
    });

    expect(JSON.stringify(snapshot)).not.toContain('sk-secret-value');
    expect(snapshot.card.safety.rawSecretsSerialized).toBe(false);
    expect(snapshot.card.preview.rawSecretsPresent).toBe(false);
  });

  it('keeps denied actions blocked and explainable', () => {
    const service = new ZavorthSensitiveActionFlowUxService({
      now: () => new Date('2026-05-13T12:00:00.000Z'),
    });

    const snapshot = service.buildSnapshot({
      request: 'delete temp files',
      decision: 'deny',
    });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.card.status).toBe('denied');
    expect(snapshot.card.execution.mode).toBe('blocked');
    expect(snapshot.card.steps.some((step) => step.id === 'approval' && step.status === 'blocked')).toBe(true);
  });
});
