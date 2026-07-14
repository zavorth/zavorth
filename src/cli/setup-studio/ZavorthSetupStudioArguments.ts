import type { ZavorthSetupStudioSnapshot } from './ZavorthSetupStudioSchema.js';

export function readFlag(args: string[], name: string): string | null {
  const inline = args.find((arg) => arg.startsWith(`--${name}=`));
  if (inline) {
    return inline.slice(name.length + 3);
  }
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] && !args[index + 1].startsWith('--') ? args[index + 1] : null;
}

export function readAllFlags(args: string[], name: string): string[] {
  const values: string[] = [];
  const prefix = `--${name}=`;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg.startsWith(prefix)) {
      values.push(arg.slice(prefix.length));
    } else if (arg === `--${name}` && args[index + 1] && !args[index + 1].startsWith('--')) {
      values.push(args[index + 1]);
      index += 1;
    }
  }
  return values;
}

export function readEnvUpdateValue(snapshot: ZavorthSetupStudioSnapshot, key: string | null): string | null {
  if (!key) {
    return null;
  }
  return snapshot.plan.envUpdates.find((entry) => entry.key === key)?.value || null;
}

export function snapshotEnvironment(snapshot: ZavorthSetupStudioSnapshot): Map<string, string | undefined> {
  const keys = new Set([
    'ZAVORTH_DEFAULT_PROVIDER',
    ...snapshot.plan.envUpdates.map((entry) => entry.key),
  ]);
  return new Map(Array.from(keys).map((key) => [key, process.env[key]]));
}

export function restoreEnvironment(snapshot: Map<string, string | undefined>): void {
  for (const [key, value] of snapshot.entries()) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}
