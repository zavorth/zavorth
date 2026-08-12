import { DiscordBootPolicyService } from '../../src/services/DiscordBootPolicyService';

describe('DiscordBootPolicyService', () => {
  it('fails when Discord is required on boot and no transport is configured', () => {
    const service = new DiscordBootPolicyService();

    expect(() =>
      service.assertConfiguration({
        requiredOnBoot: true,
        nativeTokenConfigured: false,
        bridgeConfigured: false,
      }),
    ).toThrow('Discord esta marcado como obrigatorio no boot');
  });

  it('allows boot when Discord is optional or configured', () => {
    const service = new DiscordBootPolicyService();

    expect(() =>
      service.assertConfiguration({
        requiredOnBoot: false,
        nativeTokenConfigured: false,
        bridgeConfigured: false,
      }),
    ).not.toThrow();

    expect(() =>
      service.assertConfiguration({
        requiredOnBoot: true,
        nativeTokenConfigured: true,
        bridgeConfigured: false,
      }),
    ).not.toThrow();

    expect(
      service.shouldFailClosed({
        requiredOnBoot: true,
        nativeTokenConfigured: true,
        bridgeConfigured: false,
      }),
    ).toBe(true);
  });
});
