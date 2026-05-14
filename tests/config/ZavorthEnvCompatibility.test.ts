import { buildExecutionHostConfig } from '../../src/config/sections/executionHostConfig';

describe('Zavorth env compatibility', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.ZAVORTH_FIRECRACKER_ENABLED;
    delete process.env.ZAVORTH_CAPABILITY_POLICY;
    delete process.env.ZAVORTH_SELFMOD_POLICY;
    delete process.env.ZAVORTH_ALLOW_STARTUP_INSTALL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('uses canonical ZAVORTH_* settings for execution host configuration', () => {
    process.env.ZAVORTH_FIRECRACKER_ENABLED = 'false';
    process.env.ZAVORTH_CAPABILITY_POLICY = 'ask-on-demand';
    process.env.ZAVORTH_SELFMOD_POLICY = 'owner_trusted';
    process.env.ZAVORTH_ALLOW_STARTUP_INSTALL = 'false';

    const config = buildExecutionHostConfig(process.cwd(), 'core', 'builder');

    expect(config.firecrackerEnabled).toBe(false);
    expect(config.zavorthCapabilityPolicy).toBe('ask-on-demand');
    expect(config.zavorthSelfmodPolicy).toBe('owner_trusted');
    expect(config.zavorthAllowStartupInstall).toBe(false);
  });
});
