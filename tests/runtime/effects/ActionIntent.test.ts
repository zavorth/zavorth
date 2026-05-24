import {
  createActionIntent,
  createResourceRef,
  isObservationIntent,
} from '../../../src/runtime/effects/index.js';

describe('ActionIntent contracts', () => {
  it('creates a normalized observation intent without granting execution authority', () => {
    const intent = createActionIntent({
      id: ' intent-time ',
      kind: 'observation',
      operation: 'get current time',
      summary: 'Tell the user the current time.',
      sourceTrust: 'trusted-user',
      targetScope: [
        createResourceRef({
          kind: 'time',
          uri: 'timezone:America/Sao_Paulo',
          sensitivity: 'public',
        }),
      ],
      createdAt: '2026-05-22T12:00:00.000Z',
    });

    expect(intent).toEqual(expect.objectContaining({
      id: 'intent-time',
      kind: 'observation',
      sourceTrust: 'trusted-user',
      targetScope: [expect.objectContaining({
        kind: 'time',
        uri: 'timezone:America/Sao_Paulo',
      })],
    }));
    expect(isObservationIntent(intent)).toBe(true);
  });
});
