import { SupervisedSecretsReadAdapter } from '../../../src/adapters/overlord/SupervisedSecretsReadAdapter.js';

describe('SupervisedSecretsReadAdapter', () => {
  it('returns masked env secret metadata instead of raw value', async () => {
    const adapter = new SupervisedSecretsReadAdapter({
      env: {
        TEST_SECRET: 'abcdef123456',
      } as any,
    });

    const result = await adapter.execute(
      {
        capability: 'secrets.read',
        command: JSON.stringify({
          secretName: 'TEST_SECRET',
        }),
      },
      {
        runtimeTarget: 'host',
      } as any,
    );

    expect(result.ok).toBe(true);
    expect(result.stdout).toContain('"present": true');
    expect(result.stdout).toContain('"maskedPreview": "ab********56"');
    expect(result.stdout).not.toContain('abcdef123456');
  });

  it('supports masked reads from node secret storage', async () => {
    const adapter = new SupervisedSecretsReadAdapter({
      env: {} as any,
      nodeRegistryService: {
        getSecretValue: jest.fn(() => 'pairing-secret'),
      } as any,
    });

    const result = await adapter.execute(
      {
        capability: 'secrets.read',
        command: JSON.stringify({
          source: 'node',
          nodeId: 'node-1',
          secretName: 'sharedSecret',
        }),
      },
      {
        runtimeTarget: 'host',
      } as any,
    );

    expect(result.ok).toBe(true);
    expect(result.stdout).toContain('"source": "node"');
    expect(result.stdout).toContain('"nodeId": "node-1"');
  });
});
