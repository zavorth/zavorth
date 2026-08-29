import {
  resolveUserModelConfig,
  userModelConfigSchema,
} from '../../../src/contracts/user-model/UserModelConfigContract.js';

describe('UserModelConfigContract', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('resolves default configuration when no overrides or env vars are present', () => {
    delete process.env.ZAVORTH_USER_MODEL_ENABLED;
    delete process.env.ZAVORTH_USER_MODEL_TOKEN_BUDGET;
    delete process.env.ZAVORTH_USER_MODEL_DECAY_DAYS;
    delete process.env.ZAVORTH_USER_MODEL_ACTIVATION_THRESHOLD;
    delete process.env.ZAVORTH_USER_MODEL_WEIGHT_EXPLICIT;
    delete process.env.ZAVORTH_USER_MODEL_WEIGHT_CORRECTION;
    delete process.env.ZAVORTH_USER_MODEL_WEIGHT_LLM;

    const config = resolveUserModelConfig();
    expect(config.enabled).toBe(true);
    expect(config.maxInjectionTokens).toBe(300);
    expect(config.decayHalfLifeDays).toBe(30);
    expect(config.activationConfidenceThreshold).toBe(0.7);
    expect(config.sourceAuthorityWeights.explicit).toBe(1.0);
    expect(config.sourceAuthorityWeights.userCorrection).toBe(0.85);
    expect(config.sourceAuthorityWeights.behavioralPattern).toBe(0.8);
    expect(config.sourceAuthorityWeights.llmInference).toBe(0.6);
    expect(config.sourceAuthorityWeights.migration).toBe(0.5);
  });

  it('reads configuration from environment variables', () => {
    process.env.ZAVORTH_USER_MODEL_ENABLED = 'false';
    process.env.ZAVORTH_USER_MODEL_TOKEN_BUDGET = '450';
    process.env.ZAVORTH_USER_MODEL_DECAY_DAYS = '60';
    process.env.ZAVORTH_USER_MODEL_ACTIVATION_THRESHOLD = '0.85';
    process.env.ZAVORTH_USER_MODEL_WEIGHT_EXPLICIT = '0.95';
    process.env.ZAVORTH_USER_MODEL_WEIGHT_CORRECTION = '0.90';
    process.env.ZAVORTH_USER_MODEL_WEIGHT_LLM = '0.55';

    const config = resolveUserModelConfig();
    expect(config.enabled).toBe(false);
    expect(config.maxInjectionTokens).toBe(450);
    expect(config.decayHalfLifeDays).toBe(60);
    expect(config.activationConfidenceThreshold).toBe(0.85);
    expect(config.sourceAuthorityWeights.explicit).toBe(0.95);
    expect(config.sourceAuthorityWeights.userCorrection).toBe(0.9);
    expect(config.sourceAuthorityWeights.llmInference).toBe(0.55);
  });

  it('allows explicit object overrides to supersede env variables', () => {
    process.env.ZAVORTH_USER_MODEL_TOKEN_BUDGET = '450';

    const config = resolveUserModelConfig({
      maxInjectionTokens: 500,
    });
    expect(config.maxInjectionTokens).toBe(500);
  });

  it('validates schema bounds strictly', () => {
    expect(() =>
      userModelConfigSchema.parse({
        enabled: true,
        maxInjectionTokens: -10,
        decayHalfLifeDays: 30,
        activationConfidenceThreshold: 0.7,
        sourceAuthorityWeights: {},
      }),
    ).toThrow();
  });
});
