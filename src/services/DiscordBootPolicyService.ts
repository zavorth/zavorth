export type DiscordBootPolicyInput = {
  requiredOnBoot: boolean;
  nativeTokenConfigured: boolean;
  bridgeConfigured: boolean;
};

export class DiscordBootPolicyService {
  public assertConfiguration(input: DiscordBootPolicyInput): void {
    if (!input.requiredOnBoot) {
      return;
    }

    if (!input.nativeTokenConfigured && !input.bridgeConfigured) {
      throw new Error(
        'Discord is marcado como required no boot, mas nenhum transporte foi configured. set DISCORD_BOT_TOKEN ou enable o bridge do Discord.',
      );
    }
  }

  public shouldFailClosed(input: DiscordBootPolicyInput): boolean {
    return input.requiredOnBoot;
  }
}
