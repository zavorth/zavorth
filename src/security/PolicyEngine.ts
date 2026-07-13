import fs from 'fs';
import path from 'path';
import { Plan, PlanStep } from '../contracts/PlanContract.js';
import { DangerousCommandBlocker } from './DangerousCommandBlocker.js';
import { WorkspaceResolver } from './WorkspaceResolver.js';
import { asErrorLike } from '../utils/errorLike';

export interface PolicyViolation {
  rule: string;
  severity: 'BLOCK' | 'WARN';
  detail: string;
  step_id?: string;
}

export interface PolicyEvaluation {
  allowed: boolean;
  violations: PolicyViolation[];
  warnings: PolicyViolation[];
}

export interface SecurityPolicy {
  version: string;
  description: string;
  blocked_paths: string[];
  blocked_path_patterns: string[];
  blocked_commands: string[];
  blocked_command_patterns: string[];
  allowed_workspaces: string[];
  sensitive_directories: string[];
  max_file_operations_per_plan: number;
  max_command_timeout_seconds: number;
  require_structured_plan: boolean;
  block_raw_text_execution: boolean;
  block_untrusted_content_execution: boolean;
}

export class PolicyEngine {
  private policy: SecurityPolicy;
  private compiledCommandPatterns: RegExp[];
  private compiledPathPatterns: RegExp[];

  constructor(policyPath?: string) {
    const resolvedPath = policyPath || this.findPolicyFile();
    this.policy = this.loadPolicy(resolvedPath);
    this.compiledCommandPatterns = this.policy.blocked_command_patterns.map(
      (p) => new RegExp(p, 'i')
    );
    this.compiledPathPatterns = this.policy.blocked_path_patterns.map((pattern) =>
      this.compilePathGlob(pattern),
    );
  }

  /**
   * Evaluate a structured plan against all security policies.
   */
  public evaluate(plan: Plan): PolicyEvaluation {
    const violations: PolicyViolation[] = [];
    const warnings: PolicyViolation[] = [];

    // Regra 1: Plano estruturado obrigatório
    if (this.policy.require_structured_plan && (!plan.steps || plan.steps.length === 0)) {
      violations.push({
        rule: 'REQUIRE_STRUCTURED_PLAN',
        severity: 'BLOCK',
        detail: 'Execução sem plano estruturado é proibida pela política de segurança.',
      });
    }

    // Rule 2: Operation limit per plan
    if (plan.steps && plan.steps.length > this.policy.max_file_operations_per_plan) {
      violations.push({
        rule: 'MAX_OPERATIONS_EXCEEDED',
        severity: 'BLOCK',
        detail: `Plano contém ${plan.steps.length} operações. Máximo permitido: ${this.policy.max_file_operations_per_plan}.`,
      });
    }

    // Regra 3: Validar cada step individualmente
    if (plan.steps) {
      for (const step of plan.steps) {
        this.evaluateStep(step, violations, warnings);
      }
    }

    return {
      allowed: violations.length === 0,
      violations,
      warnings,
    };
  }

  /**
   * Check if a path is blocked by the policy.
   */
  public isPathBlocked(targetPath: string): boolean {
    const normalized = targetPath.replace(/\\/g, '/').toLowerCase();

    for (const blocked of this.policy.blocked_paths) {
      const normalizedBlocked = blocked.replace(/\\/g, '/').replace('~', '').toLowerCase();
      if (normalized.includes(normalizedBlocked)) {
        return true;
      }
    }

    for (const pattern of this.compiledPathPatterns) {
      if (pattern.test(normalized)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a path belongs to a sensitive directory.
   */
  public isSensitivePath(targetPath: string): boolean {
    const normalized = targetPath.replace(/\\/g, '/').toLowerCase();

    for (const sensitive of this.policy.sensitive_directories) {
      const normalizedSensitive = sensitive.replace(/\\/g, '/').replace('~', '').toLowerCase();
      if (normalized.includes(normalizedSensitive)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Verifica se um comando é bloqueado pela política.
   */
  public isCommandBlocked(command: string): boolean {
    const normalized = command.trim().toLowerCase();

    // Check exact matches
    for (const blocked of this.policy.blocked_commands) {
      if (normalized.includes(blocked.toLowerCase())) {
        return true;
      }
    }

    // Check regex patterns
    for (const pattern of this.compiledCommandPatterns) {
      if (pattern.test(command.trim())) {
        return true;
      }
    }

    // Also delegate to existing DangerousCommandBlocker
    return !DangerousCommandBlocker.isSafe(command);
  }

  /**
   * Verifica se um workspace é permitido.
   */
  public isWorkspaceAllowed(workspace: string): boolean {
    return WorkspaceResolver.isWorkspaceAllowed(workspace);
  }

  /**
   * Verifica se a execução de texto bruto é bloqueada.
   */
  public isRawTextExecutionBlocked(): boolean {
    return this.policy.block_raw_text_execution;
  }

  /**
   * Check if untrusted content can trigger execution.
   */
  public isUntrustedContentExecutionBlocked(): boolean {
    return this.policy.block_untrusted_content_execution;
  }

  /**
   * Retorna o timeout máximo permitido para comandos.
   */
  public getMaxCommandTimeout(): number {
    return this.policy.max_command_timeout_seconds;
  }

  /**
   * Retorna a política carregada (somente leitura).
   */
  public getPolicy(): Readonly<SecurityPolicy> {
    return this.policy;
  }

  private evaluateStep(step: PlanStep, violations: PolicyViolation[], warnings: PolicyViolation[]): void {
    // Validar comandos do step
    if (step.command) {
      if (this.isCommandBlocked(step.command)) {
        violations.push({
          rule: 'BLOCKED_COMMAND',
          severity: 'BLOCK',
          detail: `Comando bloqueado pela política: '${step.command}'`,
          step_id: step.step_id,
        });
      }
    }

    // Validar paths do step
    if (step.file_targets) {
      for (const filePath of step.file_targets) {
        if (this.isPathBlocked(filePath)) {
          violations.push({
            rule: 'BLOCKED_PATH',
            severity: 'BLOCK',
            detail: `Path bloqueado pela política: '${filePath}'`,
            step_id: step.step_id,
          });
        }

        if (this.isSensitivePath(filePath)) {
          warnings.push({
            rule: 'SENSITIVE_PATH',
            severity: 'WARN',
            detail: `Path sensível detectado: '${filePath}'`,
            step_id: step.step_id,
          });
        }
      }
    }

    // Steps sensíveis devem ter flag
    if (step.sensitive) {
      warnings.push({
        rule: 'SENSITIVE_STEP',
        severity: 'WARN',
        detail: `Step marcado como sensível: '${step.description}'`,
        step_id: step.step_id,
      });
    }
  }

  private findPolicyFile(): string {
    // Sobe do src até encontrar config/security-policy.json
    let dir = __dirname;
    for (let i = 0; i < 5; i++) {
      const candidate = path.join(dir, 'config', 'security-policy.json');
      if (fs.existsSync(candidate)) {
        return candidate;
      }
      dir = path.dirname(dir);
    }

    // Fallback: projeto raiz
    const fallback = path.resolve(process.cwd(), 'config', 'security-policy.json');
    if (fs.existsSync(fallback)) {
      return fallback;
    }

    throw new Error('[PolicyEngine] Arquivo security-policy.json não encontrado.');
  }

  private loadPolicy(filePath: string): SecurityPolicy {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw) as SecurityPolicy;
      this.validatePolicySchema(parsed);
      return parsed;
    } catch (error: unknown) { const err = asErrorLike(error); const message = err instanceof Error ? err.message : String(err);
      throw new Error(`[PolicyEngine] Erro ao carregar pol?tica de seguran?a: ${message}`);
    }
  }

  private validatePolicySchema(policy: unknown): void {
    if (!policy || typeof policy !== 'object' || Array.isArray(policy)) {
      throw new Error('[PolicyEngine] Politica de seguranca precisa ser um objeto JSON.');
    }
    const record = policy as Record<string, unknown>;
    const required = [
      'blocked_paths',
      'blocked_commands',
      'allowed_workspaces',
    ];

    for (const field of required) {
      if (!Array.isArray(record[field])) {
        throw new Error(`[PolicyEngine] Campo obrigatório ausente ou inválido: '${field}'`);
      }
    }
  }

  private compilePathGlob(pattern: string): RegExp {
    const normalizedPattern = String(pattern || '').trim().replace(/\\/g, '/').toLowerCase();
    const escaped = normalizedPattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    const regexSource = escaped
      .replace(/\*\*/g, '::DOUBLE_STAR::')
      .replace(/\*/g, '[^/]*')
      .replace(/::DOUBLE_STAR::/g, '.*');

    return new RegExp(regexSource, 'i');
  }
}
