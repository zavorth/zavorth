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
        'Discord esta marcado como obrigatorio no boot, mas nenhum transporte foi configurado. Defina DISCORD_BOT_TOKEN ou habilite o bridge do Discord.',
      );
    }
  }

  public shouldFailClosed(input: DiscordBootPolicyInput): boolean {
    return input.requiredOnBoot;
  }
}
