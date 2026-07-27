import { AuthProvider } from './types.js';

const registry = new Map<string, AuthProvider>();

export function registerAuth(authType: string, provider: AuthProvider): void {
  registry.set(authType, provider);
}

export function getAuth(authType: string): AuthProvider | undefined {
  return registry.get(authType);
}
