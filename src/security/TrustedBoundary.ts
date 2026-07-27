/**
 * TrustedBoundary - source and content trust classification.
 *
 * Fundamental rule: external content must never become an execution instruction.
 * Every executable action must originate from:
 * - A direct user instruction
 * - System policy
 * - A valid AI inference
 */

export type TrustLevel = 'trusted_instruction' | 'untrusted_content' | 'system_policy';

export interface TrustClassification {
  level: TrustLevel;
  source: string;
  reason: string;
  can_generate_execution: boolean;
}

export class TrustedBoundary {
  private static URL_PATTERN = /https?:\/\/[^\s<>()]+/i;

  // File extensions that indicate external content.
  private static UNTRUSTED_FILE_EXTENSIONS = [
    '.md', '.txt', '.log', '.json', '.yaml', '.yml',
    '.html', '.htm', '.xml', '.csv', '.tsv',
    '.js', '.ts', '.py', '.java', '.c', '.cpp', '.go', '.rs',
    '.sh', '.bash', '.ps1', '.bat', '.cmd',
    '.env', '.cfg', '.conf', '.ini', '.toml',
  ];

  // Content patterns that indicate a prompt-injection attempt.
  private static INJECTION_PATTERNS = [
    /ignore\s+(all\s+)...previous\s+instructions/i,
    /forget\s+(all\s+)...previous/i,
    /you\s+are\s+now/i,
    /new\s+instructions?:/i,
    /system\s+prompt:/i,
    /act\s+as\s+(a|an)\s+/i,
    /execute\s+the\s+following/i,
    /run\s+this\s+command/i,
    /\bsudo\b.*\bpasswd\b/i,
    /\beval\b\s*\(/i,
  ];

  /**
   * Classifies the origin of an input.
   */
  public static classify(content: string, source: string): TrustClassification {
    // Direct system instructions.
    if (source === 'system' || source === 'system_policy') {
      return {
        level: 'system_policy',
        source,
        reason: 'System policy is implicitly trusted.',
        can_generate_execution: true,
      };
    }

    // Direct instructions from authenticated surfaces.
    if (
      source === 'telegram_user' ||
      source === 'user_direct' ||
      source === 'discord_user' ||
      source === 'discord_public_user' ||
      source === 'discord_dm_user' ||
      source === 'discord_owner_dm' ||
      source === 'web_user'
    ) {
      if (this.containsInjectionPattern(content)) {
        return {
          level: 'untrusted_content',
          source,
          reason: 'User content contains a prompt-injection pattern.',
          can_generate_execution: false,
        };
      }

      return {
        level: 'trusted_instruction',
        source,
        reason:
          source === 'discord_public_user'
            ? 'Direct user instruction in an allowlisted public Discord channel.'
            : source === 'discord_owner_dm'
              ? 'Direct owner instruction in Discord DM.'
              : source === 'discord_dm_user'
                ? 'Direct user instruction in Discord DM.'
                : source === 'web_user'
                  ? 'Direct authenticated user instruction on the web.'
                  : 'Direct authenticated user instruction.',
        can_generate_execution: true,
      };
    }

    // File content.
    if (source === 'file_content' || source === 'file_read') {
      return {
        level: 'untrusted_content',
        source,
        reason: 'File content is always untrusted.',
        can_generate_execution: false,
      };
    }

    // Web content.
    if (source === 'web' || source === 'url' || source === 'scrape') {
      return {
        level: 'untrusted_content',
        source,
        reason: 'Web content is always untrusted.',
        can_generate_execution: false,
      };
    }

    // Logs.
    if (source === 'log' || source === 'stdout' || source === 'stderr') {
      return {
        level: 'untrusted_content',
        source,
        reason: 'Log/output content is always untrusted.',
        can_generate_execution: false,
      };
    }

    // Documents (PDF, etc.).
    if (source === 'document' || source === 'pdf') {
      return {
        level: 'untrusted_content',
        source,
        reason: 'Document content is always untrusted.',
        can_generate_execution: false,
      };
    }

    return {
      level: 'untrusted_content',
      source,
      reason: `Unknown origin '${source}' treated as untrusted by default.`,
      can_generate_execution: false,
    };
  }

  /**
   * Checks whether content contains prompt-injection patterns.
   */
  public static containsInjectionPattern(content: string): boolean {
    for (const pattern of this.INJECTION_PATTERNS) {
      if (pattern.test(content)) {
        return true;
      }
    }
    return false;
  }

  public static containsExternalUrl(content: string): boolean {
    return this.URL_PATTERN.test(String(content || ''));
  }

  /**
   * Checks whether file content can be treated as an instruction.
   * The answer is always no: file content is never an instruction.
   */
  public static canFileContentBeInstruction(filePath: string): boolean {
    return false;
  }

  /**
   * Determines trust level based on file extension.
   */
  public static classifyFileContent(filePath: string): TrustClassification {
    return {
      level: 'untrusted_content',
      source: `file:${filePath}`,
      reason: 'All file content is untrusted by definition.',
      can_generate_execution: false,
    };
  }

  /**
   * Validates whether an input can generate execution actions.
   * Returns true when allowed, false when blocked.
   */
  public static validateExecutionOrigin(content: string, source: string): boolean {
    const classification = this.classify(content, source);
    return classification.can_generate_execution;
  }
}
