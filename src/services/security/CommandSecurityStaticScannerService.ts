
export type SecurityViolationKind =
  | 'homoglyph_spoof'
  | 'pipe_to_interpreter'
  | 'destructive_root_target'
  | 'reverse_shell_pattern'
  | 'encoded_payload';

export interface SecurityViolation {
  readonly kind: SecurityViolationKind;
  readonly severity: 'warning' | 'critical';
  readonly message: string;
  readonly matchedSubstring: string;
}

export interface CommandSecurityScanResult {
  readonly safe: boolean;
  readonly blocked: boolean;
  readonly violations: readonly SecurityViolation[];
  readonly sanitizedCommand: string;
}

export interface ScanOptions {
  readonly workspaceRoot?: string;
  readonly allowPipes?: boolean;
}

export class CommandSecurityStaticScannerService {
  private static readonly DANGEROUS_PIPE_PATTERNS = [
    /curl\s+[^|]+\|\s*(?:bash|sh|zsh|python|node|perl)/i,
    /wget\s+[^|]+\|\s*(?:bash|sh|zsh|python|node|perl)/i,
    /(?:Invoke-Expression|IEX)\s*(?:\(|\[)?\s*(?:New-Object|iwr|Invoke-WebRequest)/i,
    /(?:powershell|pwsh)\s+-(?:enc|encodedcommand)\s+[A-Za-z0-9+/=]{10,}/i,
    /base64\s+-d\s*\|\s*(?:bash|sh|python)/i,
  ];

  private static readonly DESTRUCTIVE_ROOT_PATTERNS = [
    /(?:rm\s+-rf|rmdir\s+\/s\s+\/q|Remove-Item\s+-Recurse)\s+(?:\/|\\|C:\\|C:\/|~|\/etc|\/usr|\/bin)\s*$/i,
    /(?:format\s+[A-Za-z]:)/i,
  ];

  private static readonly REVERSE_SHELL_PATTERNS = [
    /nc\s+(?:-e|--exec)\s+\/bin\/(?:sh|bash)/i,
    /\/dev\/tcp\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d+/i,
    /python\s+-c\s+["'].*import\s+socket,subprocess,os.*["']/i,
  ];

  // Non-ASCII lookalike characters in common CLI binary names
  private static readonly HOMOGLYPH_MAP: Record<string, string> = {
    '\u0430': 'a', // Cyrillic a
    '\u0441': 'c', // Cyrillic c
    '\u0445': 'x', // Cyrillic x
    '\u0435': 'e', // Cyrillic e
    '\u043E': 'o', // Cyrillic o
    '\u0440': 'p', // Cyrillic p
    '\u03BF': 'o', // Greek omicron
  };

  public scan(command: string, options: ScanOptions = {}): CommandSecurityScanResult {
    const trimmed = command.trim();
    const violations: SecurityViolation[] = [];

    // 1. Check for homoglyphs in binary names
    const homoglyphViolation = this.checkHomoglyphs(trimmed);
    if (homoglyphViolation) {
      violations.push(homoglyphViolation);
    }

    // 2. Check for pipe-to-interpreter
    if (!options.allowPipes) {
      for (const pattern of CommandSecurityStaticScannerService.DANGEROUS_PIPE_PATTERNS) {
        const match = trimmed.match(pattern);
        if (match) {
          violations.push({
            kind: 'pipe_to_interpreter',
            severity: 'critical',
            message: 'Execution of remote untrusted script piped directly to an interpreter is blocked.',
            matchedSubstring: match[0],
          });
          break;
        }
      }
    }

    // 3. Check for destructive root/system deletion
    for (const pattern of CommandSecurityStaticScannerService.DESTRUCTIVE_ROOT_PATTERNS) {
      const match = trimmed.match(pattern);
      if (match) {
        violations.push({
          kind: 'destructive_root_target',
          severity: 'critical',
          message: 'Destructive deletion targeting root, home, or system directory is blocked.',
          matchedSubstring: match[0],
        });
        break;
      }
    }

    // 4. Check for reverse shell patterns
    for (const pattern of CommandSecurityStaticScannerService.REVERSE_SHELL_PATTERNS) {
      const match = trimmed.match(pattern);
      if (match) {
        violations.push({
          kind: 'reverse_shell_pattern',
          severity: 'critical',
          message: 'Reverse shell payload pattern detected.',
          matchedSubstring: match[0],
        });
        break;
      }
    }

    const hasCritical = violations.some((v) => v.severity === 'critical');

    return {
      safe: violations.length === 0,
      blocked: hasCritical,
      violations,
      sanitizedCommand: trimmed,
    };
  }

  private checkHomoglyphs(command: string): SecurityViolation | null {
    const firstWord = command.split(/\s+/)[0] || '';
    for (let i = 0; i < firstWord.length; i++) {
      const char = firstWord[i];
      if (CommandSecurityStaticScannerService.HOMOGLYPH_MAP[char]) {
        return {
          kind: 'homoglyph_spoof',
          severity: 'critical',
          message: `Executable name contains deceptive non-ASCII homoglyph character '${char}' (U+${char.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}).`,
          matchedSubstring: firstWord,
        };
      }
    }
    return null;
  }
}
