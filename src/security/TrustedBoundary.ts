/**
 * TrustedBoundary — Classificação de origem e confiança de conteúdo.
 * 
 * Regra fundamental: conteúdo externo NUNCA pode se tornar instrução de execução.
 * Toda ação executável deve ter origem em:
 *   - Instrução direta do usuário
 *   - Política do sistema
 *   - Inferência válida da IA
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

  // Extensões de arquivo que indicam conteúdo externo
  private static UNTRUSTED_FILE_EXTENSIONS = [
    '.md', '.txt', '.log', '.json', '.yaml', '.yml',
    '.html', '.htm', '.xml', '.csv', '.tsv',
    '.js', '.ts', '.py', '.java', '.c', '.cpp', '.go', '.rs',
    '.sh', '.bash', '.ps1', '.bat', '.cmd',
    '.env', '.cfg', '.conf', '.ini', '.toml',
  ];

  // Padrões de conteúdo que indicam tentativa de injection
  private static INJECTION_PATTERNS = [
    /ignore\s+(all\s+)?previous\s+instructions/i,
    /forget\s+(all\s+)?previous/i,
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
   * Classifica a origem de uma entrada.
   */
  public static classify(content: string, source: string): TrustClassification {
    // Instruções diretas do sistema
    if (source === 'system' || source === 'system_policy') {
      return {
        level: 'system_policy',
        source,
        reason: 'Política do sistema — confiável implicitamente.',
        can_generate_execution: true,
      };
    }

    // Instruções diretas de superfícies autenticadas.
    if (
      source === 'telegram_user' ||
      source === 'user_direct' ||
      source === 'discord_user' ||
      source === 'discord_public_user' ||
      source === 'discord_dm_user' ||
      source === 'discord_owner_dm' ||
      source === 'web_user'
    ) {
      // Mesmo sendo do usuário, verificar injection patterns
      if (this.containsInjectionPattern(content)) {
        return {
          level: 'untrusted_content',
          source,
          reason: 'Conteúdo do usuário contém padrão de prompt injection.',
          can_generate_execution: false,
        };
      }

      return {
        level: 'trusted_instruction',
        source,
        reason:
          source === 'discord_public_user'
            ? 'Instrucao direta de usuario em canal publico allowlisted do Discord.'
            : source === 'discord_owner_dm'
              ? 'Instrucao direta do owner em DM do Discord.'
              : source === 'discord_dm_user'
                ? 'Instrucao direta de usuario em DM do Discord.'
                : source === 'web_user'
                  ? 'Instrucao direta de usuario autenticado na web.'
                  : 'Instrucao direta do usuario autenticado.',
        can_generate_execution: true,
      };
    }

    // Conteúdo de arquivos
    if (source === 'file_content' || source === 'file_read') {
      return {
        level: 'untrusted_content',
        source,
        reason: 'Conteúdo de arquivo — sempre não-confiável.',
        can_generate_execution: false,
      };
    }

    // Conteúdo da web
    if (source === 'web' || source === 'url' || source === 'scrape') {
      return {
        level: 'untrusted_content',
        source,
        reason: 'Conteúdo da web — sempre não-confiável.',
        can_generate_execution: false,
      };
    }

    // Conteúdo de logs
    if (source === 'log' || source === 'stdout' || source === 'stderr') {
      return {
        level: 'untrusted_content',
        source,
        reason: 'Conteúdo de log/output — sempre não-confiável.',
        can_generate_execution: false,
      };
    }

    // Conteúdo de documentos (PDF, etc.)
    if (source === 'document' || source === 'pdf') {
      return {
        level: 'untrusted_content',
        source,
        reason: 'Conteúdo de documento — sempre não-confiável.',
        can_generate_execution: false,
      };
    }

    // Default: conservadorismo
    return {
      level: 'untrusted_content',
      source,
      reason: `Origem desconhecida '${source}' — tratada como não-confiável por padrão.`,
      can_generate_execution: false,
    };
  }

  /**
   * Verifica se conteúdo contém padrões de prompt injection.
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
   * Verifica se conteúdo de um arquivo pode ser tratado como instrução.
   * A resposta é sempre NÃO — conteúdo de arquivo nunca é instrução.
   */
  public static canFileContentBeInstruction(filePath: string): boolean {
    return false; // Regra absolutamente rígida
  }

  /**
   * Determina a trust level baseado na extensão do arquivo.
   */
  public static classifyFileContent(filePath: string): TrustClassification {
    return {
      level: 'untrusted_content',
      source: `file:${filePath}`,
      reason: 'Todo conteúdo de arquivo é não-confiável por definição.',
      can_generate_execution: false,
    };
  }

  /**
   * Valida se um input pode gerar ações de execução.
   * Retorna true se permitido, false se bloqueado.
   */
  public static validateExecutionOrigin(content: string, source: string): boolean {
    const classification = this.classify(content, source);
    return classification.can_generate_execution;
  }
}
