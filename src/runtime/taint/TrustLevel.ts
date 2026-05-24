export type TrustLevel =
  | 'trusted-system'
  | 'trusted-user'
  | 'trusted-runtime'
  | 'tool-output'
  | 'untrusted-content'
  | 'unknown';

export function isTrustedInstructionLevel(level: TrustLevel): boolean {
  return level === 'trusted-system' || level === 'trusted-user' || level === 'trusted-runtime';
}

export function isUntrustedEvidenceLevel(level: TrustLevel): boolean {
  return level === 'tool-output' || level === 'untrusted-content' || level === 'unknown';
}
