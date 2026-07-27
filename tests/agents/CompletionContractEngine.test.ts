import { CompletionContractEngine } from './stubs/completion-contract';

describe('CompletionContractEngine', () => {
  it('does not accept evidence from a different requirement', async () => {
    const engine = new CompletionContractEngine();
    const contract = engine.createContract('task', [
      {
        type: 'file-exists',
        description: 'first file',
        required: true,
        check: async () => ({
          passed: true,
          evidence: {
            type: 'file-exists',
            description: 'first file exists',
            timestamp: new Date().toISOString(),
          },
        }),
      },
      {
        type: 'file-exists',
        description: 'second file',
        required: true,
        check: async () => ({ passed: false }),
      },
    ]);

    const result = await engine.verifyContract(contract);

    expect(result.status).toBe('failed');
    expect(engine.getContractStatus(contract)).toBe('failed');
    expect(contract.evidence).toEqual([
      expect.objectContaining({
        requirementId: 'task:1',
        data: expect.objectContaining({ passed: true }),
      }),
    ]);
  });

  it('records failed evidence without allowing it to complete the contract', async () => {
    const engine = new CompletionContractEngine();
    const contract = engine.createContract('failed-evidence', [
      {
        type: 'output-contains',
        description: 'verified result',
        required: true,
        check: async () => ({
          passed: false,
          evidence: {
            type: 'output-contains',
            description: 'output captured',
            timestamp: new Date().toISOString(),
            data: { length: 20 },
          },
        }),
      },
    ]);

    await engine.verifyContract(contract);

    expect(contract.evidence[0]?.data?.passed).toBe(false);
    expect(engine.getContractStatus(contract)).toBe('failed');
  });
});
