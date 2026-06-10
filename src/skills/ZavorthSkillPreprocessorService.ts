import fs from 'fs';
import path from 'path';
import { execSync, spawnSync } from 'child_process';
import yaml from 'js-yaml';
import { config as defaultConfig } from '../config/index.js';
import { decideSecurityPolicy } from '../security/SecurityPolicyBroker.js';
import { Database } from '../storage/Database.js';
import type { SkillMetadata } from './SkillCatalogContract.js';
import { ZavorthPathCompactor } from './ZavorthPathCompactor.js';

/**
 * Options for initializing the preprocessor service.
 */
export interface PreprocessorOptions {
  /**
   * Optional custom project root path. Defaults to central config projectRoot.
   */
  projectRoot?: string;

  /**
   * Optional Database instance to resolve dynamic configurations from SQLite.
   */
  database?: Database;

  /**
   * If true, throws a SecurityPolicyViolationError when any command is blocked.
   * If false, replaces the inline command with a descriptive blocked message.
   * Defaults to true.
   */
  strictSecurity?: boolean;
}

/**
 * Input structure for preprocessing a skill file.
 */
export interface PreprocessInput {
  /**
   * Raw content of the SKILL.md file.
   */
  content: string;

  /**
   * Active session ID for variable substitution.
   */
  sessionId: string;

  /**
   * Active actor/user ID for variable substitution and database lookups.
   */
  actorId: string;

  /**
   * Optional name of the skill being preprocessed (passed in security policy metadata).
   */
  skillName?: string;

  /**
   * Optional source path of the skill file (passed in security policy metadata).
   */
  sourcePath?: string;

  /**
   * Optional skill provenance. Missing provenance is treated as untrusted.
   */
  provenance?: SkillMetadata['provenance'];
}

/**
 * Audit result of an executed inline command.
 */
export interface ExecutedCommandResult {
  /**
   * The command template or expression that was evaluated.
   */
  command: string;

  /**
   * Whether the command execution was allowed by the security broker.
   */
  allowed: boolean;

  /**
   * The trimmed standard output of the command (if allowed and successful).
   */
  output?: string;

  /**
   * The error description if execution failed or was blocked.
   */
  error?: string;
}

/**
 * Output of the preprocessing operation.
 */
export interface PreprocessResult {
  /**
   * Fully processed markdown content with variables substituted, configs injected, and commands evaluated.
   */
  content: string;

  /**
   * Registry of all inline commands identified and executed.
   */
  executedCommands: ExecutedCommandResult[];
}

/**
 * Error thrown when an inline command violates the active security policy in strict mode.
 */
export class SecurityPolicyViolationError extends Error {
  public readonly command: string;

  constructor(command: string, message: string) {
    super(message);
    this.name = 'SecurityPolicyViolationError';
    this.command = command;
    Object.setPrototypeOf(this, SecurityPolicyViolationError.prototype);
  }
}

export type ZavorthPreprocessorInput = {
  content: string;
  skill: SkillMetadata;
  projectRoot: string;
  sessionId?: string | null;
  actorId?: string | null;
  securityProfile?: string | null;
};

/**
 * Service for preprocessing Zavorth skill files.
 * Handles:
 * 1. Variable substitution for `${ZAVORTH_PROJECT_ROOT}`, `${ZAVORTH_SESSION_ID}`, and `${ZAVORTH_ACTOR_ID}`.
 * 2. YAML frontmatter parsing and config key resolution with `[Zavorth Capability Config: ...]` injection.
 * 3. Safe inline command execution (`#[z_eval: <comando>]`) governed by the SecurityPolicyBroker.
 */
export class ZavorthSkillPreprocessorService {
  private readonly projectRoot: string;
  private database: Database | null;
  private readonly strictSecurity: boolean;

  constructor(options: PreprocessorOptions = {}) {
    this.projectRoot = ZavorthPathCompactor.expand(options.projectRoot || defaultConfig.projectRoot);
    this.database = options.database || null;
    this.strictSecurity = options.strictSecurity !== false;
  }

  /**
   * Preprocesses a skill's content applying all filters, substitutions, and validations.
   */
  public async preprocess(input: PreprocessInput): Promise<PreprocessResult> {
    if (!input.content) {
      return { content: '', executedCommands: [] };
    }

    // Initialize database lazily if not provided
    if (!this.database) {
      try {
        this.database = await Database.getInstance();
      } catch (err) {
        console.warn('[ZavorthSkillPreprocessorService] Database.getInstance() failed, proceeding with fallback config lookup only.', err);
      }
    }

    // 1. Variable Substitution on the entire content
    let preprocessed = input.content;
    preprocessed = preprocessed.replace(/\$\{ZAVORTH_PROJECT_ROOT\}/g, this.projectRoot);
    preprocessed = preprocessed.replace(/\$\{ZAVORTH_SESSION_ID\}/g, input.sessionId);
    preprocessed = preprocessed.replace(/\$\{ZAVORTH_ACTOR_ID\}/g, input.actorId);

    // 2. Extract YAML Frontmatter
    const frontmatterMatch = preprocessed.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/);
    let frontmatterText = '';
    let bodyContent = preprocessed;
    let hasFrontmatter = false;

    if (frontmatterMatch) {
      frontmatterText = frontmatterMatch[1];
      bodyContent = frontmatterMatch[2];
      hasFrontmatter = true;
    }

    // Parse configuration keys declared in YAML frontmatter
    let configKeys: string[] = [];
    if (hasFrontmatter) {
      try {
        const parsed = yaml.load(frontmatterText) as Record<string, unknown>;
        if (parsed && typeof parsed === 'object') {
          if (Array.isArray(parsed.config_keys)) {
            configKeys = parsed.config_keys.map(String);
          } else if (parsed.config_keys && typeof parsed.config_keys === 'string') {
            configKeys = [parsed.config_keys];
          }
        }
      } catch (err) {
        console.warn('[ZavorthSkillPreprocessorService] Frontmatter parsing failed:', err);
      }
    }

    // Resolve each declared config key
    const resolvedConfigs: Record<string, unknown> = {};
    for (const key of configKeys) {
      resolvedConfigs[key] = this.resolveConfigKey(key, input.actorId);
    }

    // Format the capability config block if keys were declared
    let injectedBlock = '';
    if (configKeys.length > 0) {
      const formattedLines = Object.entries(resolvedConfigs)
        .map(([k, v]) => `  ${k}: ${v !== null && typeof v === 'object' ? JSON.stringify(v) : v}`)
        .join('\n');
      injectedBlock = `[Zavorth Capability Config:\n${formattedLines}\n]\n\n`;
    }

    // 3. Process Inline Commands: #[z_eval: <comando>]
    const executedCommands: ExecutedCommandResult[] = [];
    const evalRegex = /#\[z_eval:\s*([\s\S]*?)\]/g;
    let match;
    let finalBody = '';
    let lastIndex = 0;

    evalRegex.lastIndex = 0;
    while ((match = evalRegex.exec(bodyContent)) !== null) {
      const command = match[1].trim();
      const matchIndex = match.index;

      // Append raw text up to this command match
      finalBody += bodyContent.substring(lastIndex, matchIndex);

      if (!this.isExplicitlyTrustedProvenance(input.provenance)) {
        const errorReason = 'Blocked by security policy: untrusted source';
        executedCommands.push({
          command,
          allowed: false,
          error: errorReason,
        });
        if (this.strictSecurity) {
          throw new SecurityPolicyViolationError(command, errorReason);
        }
        finalBody += `[Blocked: command execution denied by security policy]`;
        lastIndex = evalRegex.lastIndex;
        continue;
      }

      // Validate against the SecurityPolicyBroker
      const decision = decideSecurityPolicy({
        surface: 'skill',
        operation: 'governed-capability-eval',
        target: command,
        metadata: {
          sessionId: input.sessionId,
          actorId: input.actorId,
          skillName: input.skillName,
          sourcePath: input.sourcePath,
          provenance: input.provenance,
        },
      });

      if (decision.allowed) {
        try {
          // Execute command inside the project root workspace
          const output = execSync(command, {
            cwd: this.projectRoot,
            encoding: 'utf8',
            timeout: 30000,
          });
          const trimmedOutput = output.trim();
          finalBody += trimmedOutput;

          executedCommands.push({
            command,
            allowed: true,
            output: trimmedOutput,
          });
        } catch (err: any) {
          const errMsg = err?.message || String(err);
          finalBody += `[Error: ${errMsg}]`;

          executedCommands.push({
            command,
            allowed: true,
            error: errMsg,
          });
        }
      } else {
        const errorReason = `Blocked by security policy: ${decision.reasons.join(' ')}`;
        executedCommands.push({
          command,
          allowed: false,
          error: errorReason,
        });

        if (this.strictSecurity) {
          throw new SecurityPolicyViolationError(command, `Execution of command "${command}" blocked by security policy: ${decision.reasons.join(' ')}`);
        } else {
          finalBody += `[Blocked: command execution denied by security policy]`;
        }
      }

      lastIndex = evalRegex.lastIndex;
    }

    finalBody += bodyContent.substring(lastIndex);

    // Reconstruct the full document content
    let finalContent = '';
    if (hasFrontmatter) {
      finalContent = `---\n${frontmatterText}\n---\n\n${injectedBlock}${finalBody}`;
    } else {
      finalContent = `${injectedBlock}${finalBody}`;
    }

    return {
      content: finalContent,
      executedCommands,
    };
  }

  /**
   * Look up configuration key from the central config or database.
   */
  private resolveConfigKey(key: string, actorId: string): unknown {
    // 1. Resolve from central application config
    const configVal = this.resolveFromObject(defaultConfig, key);
    if (configVal !== undefined) {
      return configVal;
    }

    // 2. Resolve from SQLite database if available
    if (this.database) {
      try {
        const stateMetaRow = this.database.get(
          'SELECT value_json FROM zavorth_state_meta WHERE key = ?',
          [key]
        );
        if (stateMetaRow && stateMetaRow.value_json) {
          return JSON.parse(stateMetaRow.value_json);
        }
      } catch (err) {
        console.warn(`[ZavorthSkillPreprocessorService] Error looking up key "${key}" in zavorth_state_meta:`, err);
      }

      try {
        const userMemoryRow = this.database.get(
          'SELECT value FROM user_memory WHERE user_id = ? AND key = ?',
          [actorId, key]
        );
        if (userMemoryRow && userMemoryRow.value !== undefined) {
          return userMemoryRow.value;
        }

        // Try user_memory fallback (no user filter)
        const fallbackMemoryRow = this.database.get(
          'SELECT value FROM user_memory WHERE key = ? LIMIT 1',
          [key]
        );
        if (fallbackMemoryRow && fallbackMemoryRow.value !== undefined) {
          return fallbackMemoryRow.value;
        }
      } catch (err) {
        console.warn(`[ZavorthSkillPreprocessorService] Error looking up key "${key}" in user_memory:`, err);
      }

      try {
        const snippetRow = this.database.get(
          'SELECT content FROM snippets WHERE user_id = ? AND name = ?',
          [actorId, key]
        );
        if (snippetRow && snippetRow.content !== undefined) {
          return snippetRow.content;
        }
      } catch (err) {
        console.warn(`[ZavorthSkillPreprocessorService] Error looking up key "${key}" in snippets:`, err);
      }
    }

    return null;
  }

  /**
   * Helper to resolve nested keys in objects (e.g. executionHost.timeout).
   */
  private resolveFromObject(obj: Record<string, any>, keyPath: string): unknown {
    const parts = keyPath.split('.');
    let current: any = obj;
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return undefined;
      }
    }
    return current;
  }

  // --- Static Backwards Compatibility Layer ---

  /**
   * Preprocesses the capability content by replacing variables, binding configurations,
   * and executing authorized inline commands.
   * 
   * @param input Preprocessor inputs.
   * @returns The preprocessed content.
   */
  public static preprocess(input: ZavorthPreprocessorInput): string {
    let content = input.content;

    // 1. Variable Substitution
    content = this.substituteVariables(content, input);

    // 2. Config Binding
    content = this.bindConfigurations(content, input.skill);

    // 3. Controlled Command Execution
    content = this.evaluateInlineCommands(content, input);

    return content;
  }

  private static substituteVariables(content: string, input: ZavorthPreprocessorInput): string {
    const root = ZavorthPathCompactor.expand(input.projectRoot || '').replace(/\\/g, '/');
    const sess = input.sessionId || '';
    const actor = input.actorId || '';

    return content
      .replace(/\$\{ZAVORTH_PROJECT_ROOT\}/g, root)
      .replace(/\$\{ZAVORTH_SESSION_ID\}/g, sess)
      .replace(/\$\{ZAVORTH_ACTOR_ID\}/g, actor);
  }

  private static bindConfigurations(content: string, skill: SkillMetadata): string {
    const skillFilePath = ZavorthPathCompactor.expand(skill.skillFilePath);
    if (!skillFilePath || !fs.existsSync(skillFilePath)) {
      return content;
    }

    try {
      const fileContent = fs.readFileSync(skillFilePath, 'utf8');
      const match = fileContent.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
      if (!match) {
        return content;
      }

      const parsed = yaml.load(match[1]) as any;
      const configVars = parsed?.metadata?.zavorth?.config;
      if (!Array.isArray(configVars) || configVars.length === 0) {
        return content;
      }

      const lines: string[] = ['', '[Zavorth Capability Config:'];
      for (const item of configVars) {
        if (!item || typeof item !== 'object') {
          continue;
        }
        const key = String(item.key || '').trim();
        const defaultValue = item.default !== undefined ? String(item.default) : '';
        if (!key) {
          continue;
        }

        // Resolve config value (Environment variables mapping)
        const envKey = 'ZAVORTH_CONFIG_' + key.toUpperCase().replace(/\./g, '_');
        const value = process.env[envKey] || defaultValue || '(not set)';
        lines.push(`  ${key} = ${value}`);
      }
      lines.push(']');

      return content + '\n' + lines.join('\n');
    } catch {
      return content;
    }
  }

  private static evaluateInlineCommands(content: string, input: ZavorthPreprocessorInput): string {
    if (!content.includes('#[z_eval:')) {
      return content;
    }

    const pattern = /#\[z_eval:\s*([^\]]+)\]/g;
    return content.replace(pattern, (match, command) => {
      const trimmedCommand = command.trim();
      if (!trimmedCommand) {
        return '';
      }

      // Governed Execution Security: only trusted local skills are allowed to execute shell commands
      const isTrusted = this.isExplicitlyTrustedProvenance(input.skill.provenance);
      if (!isTrusted) {
        return `[Zavorth capability evaluation blocked: untrusted source]`;
      }

      // Check with the Central Security Policy Broker
      const decision = decideSecurityPolicy({
        surface: 'skill',
        operation: 'governed-capability-eval',
        target: trimmedCommand,
        profile: input.securityProfile || undefined,
        workspace: input.projectRoot,
        risk: 'review',
        blocked: false
      });

      if (!decision.allowed) {
        return `[Zavorth capability evaluation blocked by policy broker: ${decision.reasons.join(', ')}]`;
      }

      try {
        const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/bash';
        const flag = process.platform === 'win32' ? '/c' : '-c';
        
        const result = spawnSync(shell, [flag, trimmedCommand], {
          cwd: ZavorthPathCompactor.expand(input.skill.dirPath),
          encoding: 'utf8',
          timeout: 5000,
          windowsHide: true,
          env: {
            ...process.env,
            ZAVORTH_PROJECT_ROOT: ZavorthPathCompactor.expand(input.projectRoot),
            ZAVORTH_SESSION_ID: input.sessionId || '',
            ZAVORTH_ACTOR_ID: input.actorId || ''
          }
        });

        const output = (result.stdout || '').trim() || (result.stderr || '').trim();
        if (result.status !== 0 && result.error) {
          return `[Zavorth capability evaluation error: ${result.error.message}]`;
        }

        return output || `[Zavorth capability execution finished with exit code ${result.status}]`;
      } catch (err: any) {
        return `[Zavorth capability evaluation error: ${err.message}]`;
      }
    });
  }

  private static isExplicitlyTrustedProvenance(provenance: SkillMetadata['provenance'] | undefined): boolean {
    return provenance !== undefined && provenance !== null && provenance.imported === false;
  }

  private isExplicitlyTrustedProvenance(provenance: SkillMetadata['provenance'] | undefined): boolean {
    return ZavorthSkillPreprocessorService.isExplicitlyTrustedProvenance(provenance);
  }
}
