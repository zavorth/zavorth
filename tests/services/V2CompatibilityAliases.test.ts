import {
  SessionV2Service,
  ExperimentalSessionV2Service,
} from '../../src/services/SessionV2Service.js';
import {
  SwarmV2Service,
  ExperimentalSwarmV2Service,
} from '../../src/services/SwarmV2Service.js';

describe('V2 compatibility aliases', () => {
  it('keeps SessionV2 canonical while preserving the legacy experimental export', () => {
    expect(ExperimentalSessionV2Service).toBe(SessionV2Service);
  });

  it('keeps SwarmV2 canonical while preserving the legacy experimental export', () => {
    expect(ExperimentalSwarmV2Service).toBe(SwarmV2Service);
  });
});
