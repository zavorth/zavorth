import { errorMessage } from '../utils/errorLike.js';

export class CapabilityUnavailableError extends Error {
  public readonly capabilityId: string;
  public readonly dependencyName: string | null;
  public readonly remediation: string;

  constructor(options: {
    capabilityId: string;
    dependencyName?: string | null;
    reason: string;
  }) {
    const capabilityId = String(options.capabilityId || '').trim() || 'unknown';
    const dependencyName = String(options.dependencyName || '').trim() || null;
    const remediation =
      `Enable the capability with /enable ${capabilityId} and, if the host does not have the artifacts yet, run ` +
      `npm run capability:provision -- ${capabilityId}.`;
    super(`${options.reason} ${remediation}`.trim());
    this.name = 'CapabilityUnavailableError';
    this.capabilityId = capabilityId;
    this.dependencyName = dependencyName;
    this.remediation = remediation;
  }
}

export function isCapabilityUnavailableError(error: unknown): error is CapabilityUnavailableError {
  return Boolean(
    error
      && (
        error instanceof CapabilityUnavailableError
        || (
          typeof error === 'object'
          && (error as { name?: unknown }).name === 'CapabilityUnavailableError'
          && typeof (error as { capabilityId?: unknown }).capabilityId === 'string'
        )
      ),
  );
}

export async function loadOptionalDependency<T>(
  dependencyName: string,
  capabilityId: string,
  reason: string,
): Promise<T> {
  try {
    return await import(dependencyName) as T;
  } catch (error: unknown) {const message = String(errorMessage(error) || '').trim();
    if (
      message.includes(`Cannot find package '${dependencyName}'`)
      || message.includes(`Cannot find module '${dependencyName}'`)
      || message.includes(`Could not resolve "${dependencyName}"`)
    ) {
      throw new CapabilityUnavailableError({
        capabilityId,
        dependencyName,
        reason,
      });
    }
    throw error;
  }
}

export function buildCapabilityProvisionHint(capabilityId: string): string {
  return `Use /enable ${capabilityId} and, if necessary, npm run capability:provision -- ${capabilityId}.`;
}
