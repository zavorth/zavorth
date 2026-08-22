import { ILlmProvider } from './ILlmProvider.js';
import type { ProviderFactoryRuntimeTarget } from './ProviderFactory.js';

export type ProviderFactoryFn = (target: ProviderFactoryRuntimeTarget) => ILlmProvider;

export interface ProviderRegistration {
  name: string;
  aliases?: string[];
  factory: ProviderFactoryFn;
}

export class ProviderRegistry {
  private static entries = new Map<string, ProviderRegistration>();
  private static aliasMap = new Map<string, string>();

  public static register(registration: ProviderRegistration): void {
    const canonical = registration.name.toLowerCase().trim();
    this.entries.set(canonical, registration);
    for (const alias of registration.aliases ?? []) {
      this.aliasMap.set(alias.toLowerCase().trim(), canonical);
    }
  }

  public static resolve(name: string): ProviderRegistration | null {
    const normalized = name.toLowerCase().trim();
    return this.entries.get(normalized) ?? this.entries.get(this.aliasMap.get(normalized) ?? '') ?? null;
  }

  public static has(name: string): boolean {
    return this.resolve(name) !== null;
  }

  public static create(name: string, target: ProviderFactoryRuntimeTarget): ILlmProvider | null {
    const registration = this.resolve(name);
    if (!registration) return null;
    return registration.factory(target);
  }

  public static names(): string[] {
    return Array.from(this.entries.keys());
  }
}
