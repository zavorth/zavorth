/**
 * Resolve autopilot capability id without silent vendor defaults.
 * Never invents executor-gemini-cli when the operator did not choose one.
 */

export type AutopilotCapabilityResolution = {
  capabilityId: string | null;
  source: 'arg' | 'env' | 'none';
  error: string | null;
};

function readArg(argv: string[], prefix: string): string | null {
  const found = argv.find((arg) => arg.startsWith(prefix));
  if (!found) return null;
  const value = found.slice(prefix.length).trim();
  return value || null;
}

function normalizeCapabilityId(value: unknown): string | null {
  const normalized = String(value ?? '').trim();
  if (!normalized) return null;
  if (normalized.toLowerCase() === 'none' || normalized.toLowerCase() === 'null') return null;
  return normalized;
}

/**
 * Resolve capability for capability-autopilot* scripts.
 * Order: --capability= → ZAVORTH_AUTOPILOT_CAPABILITY / ZAVORTH_CAPABILITY_ID → none (fail closed).
 */
export function resolveAutopilotCapabilityId(
  argv: string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env,
): AutopilotCapabilityResolution {
  const fromArg = normalizeCapabilityId(readArg(argv, '--capability='));
  if (fromArg) {
    return { capabilityId: fromArg, source: 'arg', error: null };
  }

  const fromEnv = normalizeCapabilityId(
    env.ZAVORTH_AUTOPILOT_CAPABILITY || env.ZAVORTH_CAPABILITY_ID,
  );
  if (fromEnv) {
    return { capabilityId: fromEnv, source: 'env', error: null };
  }

  return {
    capabilityId: null,
    source: 'none',
    error:
      'No capability selected. Pass --capability=<id> or set ZAVORTH_AUTOPILOT_CAPABILITY. '
      + 'There is no silent default (gemini-cli is not assumed).',
  };
}

/** Require a capability or throw with a clear operator message. */
export function requireAutopilotCapabilityId(
  argv: string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env,
): string {
  const resolved = resolveAutopilotCapabilityId(argv, env);
  if (!resolved.capabilityId) {
    throw new Error(resolved.error || 'No capability selected.');
  }
  return resolved.capabilityId;
}
