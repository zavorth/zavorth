import type { TrustLevel } from './TrustLevel.js';
import { isTrustedInstructionLevel } from './TrustLevel.js';

export type InstructionAuthority =
  | 'instruction-authority'
  | 'evidence-only'
  | 'unknown';

export function resolveInstructionAuthority(level: TrustLevel): InstructionAuthority {
  if (isTrustedInstructionLevel(level)) {
    return 'instruction-authority';
  }
  if (level === 'tool-output' || level === 'untrusted-content') {
    return 'evidence-only';
  }
  return 'unknown';
}

export function canAuthorizeAction(level: TrustLevel): boolean {
  return resolveInstructionAuthority(level) === 'instruction-authority';
}
