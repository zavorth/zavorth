import {
  FailureSemanticsRegistry,
} from '../../../src/runtime/agent/index.js';

describe('FailureSemanticsRegistry', () => {
  it('normalizes explicit failure semantics without becoming an executor', () => {
    const registry = new FailureSemanticsRegistry();

    const semantics = registry.resolve({
      source: 'tool',
      code: 'filesystem_write_blocked',
      message: 'Write preview rejected.',
      retryable: false,
      compensatable: true,
      requiresPreview: true,
      requiresApproval: true,
      rollbackStrategy: 'restore_previous_file',
      externalSideEffect: true,
      metadata: {
        toolId: 'write_file',
      },
    });

    expect(semantics).toEqual({
      source: 'tool',
      code: 'filesystem_write_blocked',
      message: 'Write preview rejected.',
      retryable: false,
      compensatable: true,
      requiresPreview: true,
      requiresApproval: true,
      rollbackStrategy: 'restore_previous_file',
      externalSideEffect: true,
      severity: 'error',
      metadata: {
        source: 'FailureSemanticsRegistry',
        toolId: 'write_file',
      },
    });
  });

  it('infers retryable executor failures from transient errors', () => {
    const registry = new FailureSemanticsRegistry();
    const error = Object.assign(new Error('network timeout while calling provider'), {
      code: 'ETIMEDOUT',
    });

    const semantics = registry.fromError(error, {
      source: 'executor',
    });

    expect(semantics).toEqual(expect.objectContaining({
      source: 'executor',
      code: 'ETIMEDOUT',
      message: 'network timeout while calling provider',
      retryable: true,
      severity: 'warning',
    }));
  });
});
