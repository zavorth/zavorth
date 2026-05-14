import fs from 'fs';
import { decideSecurityPolicy, formatSecurityPolicyReceipt } from './SecurityPolicyBroker.js';
import { WorkspaceResolver } from './WorkspaceResolver.js';

/**
 * @deprecated Use WorkspaceResolver directly. This facade remains only for old imports.
 */
export class WorkspaceGuard {
  public static resolveAlias(workspaceHint: string): string {
    return WorkspaceResolver.resolve(workspaceHint);
  }

  public static isWorkspaceAllowed(workspace: string): boolean {
    return WorkspaceResolver.isWorkspaceAllowed(workspace);
  }

  public static validateOrThrow(workspace: string): string {
    let resolved: string;
    try {
      resolved = WorkspaceResolver.validate(workspace);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const decision = decideSecurityPolicy({
        surface: 'workspace',
        operation: 'validate_workspace',
        target: workspace,
        blocked: true,
        risk: 'forbidden',
        rule: 'WORKSPACE_DENIED',
        reasons: [message],
      });
      throw new Error(`${message} ${formatSecurityPolicyReceipt(decision.receipt)}`);
    }

    if (!fs.existsSync(resolved)) {
      const decision = decideSecurityPolicy({
        surface: 'workspace',
        operation: 'validate_workspace',
        target: resolved,
        blocked: true,
        risk: 'forbidden',
        rule: 'WORKSPACE_MISSING_ON_DISK',
        reasons: [`Workspace autorizado, mas o diretorio nao existe: '${resolved}'.`],
      });
      throw new Error(`[SECURITY] Workspace autorizado, mas o diretorio nao existe: '${resolved}'. ${formatSecurityPolicyReceipt(decision.receipt)}`);
    }

    decideSecurityPolicy({
      surface: 'workspace',
      operation: 'validate_workspace',
      target: resolved,
      rule: 'WORKSPACE_ALLOWED',
      reasons: ['Workspace permitido pela politica central de paths.'],
    });
    return resolved;
  }

  public static getSecuredPath(workspace: string, relativeOrAbsoluteTarget: string): string {
    const resolved = this.validateOrThrow(workspace);
    try {
      const securedPath = WorkspaceResolver.ensurePathInsideWorkspace(resolved, relativeOrAbsoluteTarget);
      decideSecurityPolicy({
        surface: 'local-write',
        operation: 'resolve_path',
        target: securedPath,
        workspace: resolved,
        rule: 'WORKSPACE_PATH_ALLOWED',
        reasons: ['Path resolvido dentro da workspace autorizada.'],
      });
      return securedPath;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const decision = decideSecurityPolicy({
        surface: 'local-write',
        operation: 'resolve_path',
        target: relativeOrAbsoluteTarget,
        workspace: resolved,
        blocked: true,
        risk: 'forbidden',
        rule: 'WORKSPACE_PATH_ESCAPE_BLOCKED',
        reasons: [message],
      });
      throw new Error(`${message} ${formatSecurityPolicyReceipt(decision.receipt)}`);
    }
  }
}
