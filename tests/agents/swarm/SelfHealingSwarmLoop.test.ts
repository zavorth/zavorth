import { describe, it, expect } from '@jest/globals';
import { SelfHealingSwarmLoop } from '../../../src/agents/swarm/SelfHealingSwarmLoop.js';

describe('SelfHealingSwarmLoop', () => {
  it('should pass with 1.0 consensus score when there are no errors in touched files', async () => {
    const result = await SelfHealingSwarmLoop.runVerificationLoop([]);
    expect(result.passed).toBe(true);
    expect(result.consensusScore).toBe(1.0);
    expect(result.remainingErrors.length).toBe(0);
  });
});
