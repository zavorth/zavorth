import {
  RotatingKeyClient,
  type KeyRotationHooks,
  type StreamingKeyOperation,
} from '../../../src/providers/transports/RotatingKeyClient';

type HookRecord = { keyNumber: number; totalKeys: number; error?: unknown };

type HooksBundle = {
  hooks: KeyRotationHooks;
  failures: HookRecord[];
  successes: HookRecord[];
};

function makeHooks(overrides: Partial<KeyRotationHooks> = {}): HooksBundle {
  const failures: HookRecord[] = [];
  const successes: HookRecord[] = [];
  const hooks: KeyRotationHooks = {
    onKeyFailure: (keyNumber, totalKeys, error) => {
      failures.push({ keyNumber, totalKeys, error });
    },
    onFailoverSuccess: (keyNumber, totalKeys) => {
      successes.push({ keyNumber, totalKeys });
    },
    exhaustionError: (lastError) => lastError,
    ...overrides,
  };
  return { hooks, failures, successes };
}

async function collectEvents<T>(generator: AsyncGenerator<T>): Promise<T[]> {
  const events: T[] = [];
  for await (const event of generator) {
    events.push(event);
  }
  return events;
}

async function* iterOf(items: string[], failure?: unknown): AsyncIterable<string> {
  for (const item of items) {
    yield item;
  }
  if (failure) {
    throw failure;
  }
}

describe('RotatingKeyClient.run', () => {
  it('resolves through the first key and keeps the sticky index', async () => {
    const client = new RotatingKeyClient(['k1', 'k2']);
    const { hooks, failures, successes } = makeHooks();
    const operation = jest.fn(async (apiKey: string) => `result:${apiKey}`);

    await expect(client.run(operation, hooks)).resolves.toBe('result:k1');

    expect(client.size).toBe(2);
    expect(client.currentIndex).toBe(0);
    expect(operation).toHaveBeenCalledTimes(1);
    expect(operation).toHaveBeenCalledWith('k1');
    expect(failures).toEqual([]);
    expect(successes).toEqual([]);
  });

  it('fails over to the next key, fires both hooks, and sticks to the winner', async () => {
    const client = new RotatingKeyClient(['k1', 'k2', 'k3']);
    const quotaError = new Error('quota exceeded');
    const { hooks, failures, successes } = makeHooks();
    const operation = jest.fn(async (apiKey: string) => {
      if (apiKey === 'k1') {
        throw quotaError;
      }
      return `result:${apiKey}`;
    });

    await expect(client.run(operation, hooks)).resolves.toBe('result:k2');

    expect(client.currentIndex).toBe(1);
    expect(failures).toEqual([{ keyNumber: 1, totalKeys: 3, error: quotaError }]);
    expect(successes).toEqual([{ keyNumber: 2, totalKeys: 3 }]);
    expect(operation).toHaveBeenCalledTimes(2);

    await expect(client.run(operation, hooks)).resolves.toBe('result:k2');
    expect(operation).toHaveBeenLastCalledWith('k2');
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('rethrows an AbortError without attempting the remaining keys', async () => {
    const client = new RotatingKeyClient(['k1', 'k2']);
    const abortError = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
    const { hooks, failures, successes } = makeHooks();
    const operation = jest.fn(async () => {
      throw abortError;
    });

    await expect(client.run(operation, hooks)).rejects.toBe(abortError);

    expect(operation).toHaveBeenCalledTimes(1);
    expect(client.currentIndex).toBe(0);
    expect(failures).toEqual([]);
    expect(successes).toEqual([]);
  });

  it('passes the last failure through when exhaustionError is an identity hook', async () => {
    const client = new RotatingKeyClient(['k1', 'k2']);
    const firstError = new Error('first down');
    const secondError = new Error('second down');
    const { hooks } = makeHooks();
    const operation = jest.fn()
      .mockRejectedValueOnce(firstError)
      .mockRejectedValueOnce(secondError);

    await expect(client.run(operation, hooks)).rejects.toBe(secondError);
  });

  it('lets exhaustionError replace the last failure with a synthetic error', async () => {
    const client = new RotatingKeyClient(['k1', 'k2']);
    const firstError = new Error('first down');
    const secondError = new Error('second down');
    const syntheticError = new Error('synthetic exhaustion');
    let receivedLastError: unknown;
    const { hooks } = makeHooks({
      exhaustionError: (lastError) => {
        receivedLastError = lastError;
        return syntheticError;
      },
    });
    const operation = jest.fn()
      .mockRejectedValueOnce(firstError)
      .mockRejectedValueOnce(secondError);

    await expect(client.run(operation, hooks)).rejects.toBe(syntheticError);
    expect(receivedLastError).toBe(secondError);
  });
});

describe('RotatingKeyClient.stream', () => {
  it('yields the prologue followed by projected chunk events in order', async () => {
    const client = new RotatingKeyClient(['k1']);
    const { hooks } = makeHooks();
    const operation: StreamingKeyOperation<string, string, string> = {
      open: async () => iterOf(['c1', 'c2']),
      prologue: () => ['prologue'],
      project: (chunk) => [`event:${chunk}`],
    };

    await expect(collectEvents(client.stream(operation, hooks))).resolves.toEqual([
      'prologue',
      'event:c1',
      'event:c2',
    ]);
    expect(client.currentIndex).toBe(0);
  });

  it('retries open on the next key and emits the prologue for the winning attempt', async () => {
    const client = new RotatingKeyClient(['k1', 'k2']);
    const openFailure = new Error('open rejected');
    const { hooks, failures, successes } = makeHooks();
    const open = jest.fn()
      .mockRejectedValueOnce(openFailure)
      .mockResolvedValueOnce(iterOf(['chunk']));
    const operation: StreamingKeyOperation<string, string, string> = {
      open,
      prologue: () => ['prologue'],
      project: (chunk) => [`event:${chunk}`],
    };

    await expect(collectEvents(client.stream(operation, hooks))).resolves.toEqual([
      'prologue',
      'event:chunk',
    ]);

    expect(client.currentIndex).toBe(1);
    expect(failures).toEqual([{ keyNumber: 1, totalKeys: 2, error: openFailure }]);
    expect(successes).toEqual([{ keyNumber: 2, totalKeys: 2 }]);
  });

  it('replays the full prologue and projected sequence when iteration fails mid-flight', async () => {
    const client = new RotatingKeyClient(['k1', 'k2']);
    const midFlightFailure = new Error('stream disconnected');
    const { hooks, failures } = makeHooks();
    const open = jest.fn()
      .mockResolvedValueOnce(iterOf(['c1'], midFlightFailure))
      .mockResolvedValueOnce(iterOf(['c2']));
    const operation: StreamingKeyOperation<string, string, string> = {
      open,
      prologue: () => ['prologue'],
      project: (chunk) => [`event:${chunk}`],
    };

    await expect(collectEvents(client.stream(operation, hooks))).resolves.toEqual([
      'prologue',
      'event:c1',
      'prologue',
      'event:c2',
    ]);

    expect(open).toHaveBeenCalledTimes(2);
    expect(client.currentIndex).toBe(1);
    expect(failures).toEqual([{ keyNumber: 1, totalKeys: 2, error: midFlightFailure }]);
  });

  it('propagates an AbortError raised during iteration without retrying', async () => {
    const client = new RotatingKeyClient(['k1', 'k2']);
    const abortError = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
    const { hooks, failures } = makeHooks();
    const open = jest.fn()
      .mockResolvedValueOnce(iterOf(['c1'], abortError))
      .mockResolvedValueOnce(iterOf(['c2']));
    const operation: StreamingKeyOperation<string, string, string> = {
      open,
      prologue: () => ['prologue'],
      project: (chunk) => [`event:${chunk}`],
    };

    const collected: string[] = [];
    const consume = async (): Promise<void> => {
      for await (const event of client.stream(operation, hooks)) {
        collected.push(event);
      }
    };

    await expect(consume()).rejects.toBe(abortError);

    expect(collected).toEqual(['prologue', 'event:c1']);
    expect(open).toHaveBeenCalledTimes(1);
    expect(client.currentIndex).toBe(0);
    expect(failures).toEqual([]);
  });

  it('throws the exhaustion value after every key fails to stream', async () => {
    const client = new RotatingKeyClient(['k1', 'k2']);
    const firstError = new Error('first down');
    const secondError = new Error('second down');
    let receivedLastError: unknown;
    const { hooks, failures } = makeHooks({
      exhaustionError: (lastError) => {
        receivedLastError = lastError;
        return new Error(`exhausted: ${String(lastError instanceof Error ? lastError.message : lastError)}`);
      },
    });
    const open = jest.fn()
      .mockRejectedValueOnce(firstError)
      .mockRejectedValueOnce(secondError);
    const operation: StreamingKeyOperation<string, string, string> = {
      open,
      project: (chunk) => [`event:${chunk}`],
    };

    await expect(collectEvents(client.stream(operation, hooks))).rejects.toThrow('exhausted: second down');

    expect(receivedLastError).toBe(secondError);
    expect(failures.map((failure) => failure.keyNumber)).toEqual([1, 2]);
  });

  it('preserves multiple projected events per chunk in emission order', async () => {
    const client = new RotatingKeyClient(['k1']);
    const { hooks } = makeHooks();
    const operation: StreamingKeyOperation<string, string, string> = {
      open: async () => iterOf(['c1', 'c2']),
      project: (chunk) => [`${chunk}-a`, `${chunk}-b`, `${chunk}-c`],
    };

    await expect(collectEvents(client.stream(operation, hooks))).resolves.toEqual([
      'c1-a',
      'c1-b',
      'c1-c',
      'c2-a',
      'c2-b',
      'c2-c',
    ]);
  });
});
