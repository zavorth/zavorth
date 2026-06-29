import fs from 'fs';
import path from 'path';
import { RbacEngine, Role, Permission, AccessCheckRequest, AccessCheckResult } from './RbacEngine.js';
import { AbacEngine, AbacPolicy, AccessRequest, AccessDecision, AttributeDefinition } from './AbacEngine.js';

export type EnforceMode = 'rbac_only' | 'abac_only' | 'both';

export interface AccessControlConfig {
  enforceMode: EnforceMode;
  denyOverrides: boolean;
  auditLogging: boolean;
}

export interface OverrideRule {
  id: string;
  resource: string;
  action: string;
  effect: 'ALLOW' | 'DENY';
  priority: number;
  description: string;
}

export interface UnifiedAccessRequest {
  userId: string;
  resource: string;
  action: string;
  attributes?: Record<string, unknown>;
  timestamp?: Date;
}

export interface UnifiedAccessDecision {
  allowed: boolean;
  reason: string;
  enforceMode: EnforceMode;
  rbacResult?: AccessCheckResult;
  abacResult?: AccessDecision;
  overrideApplied?: string;
  evaluatedPolicies: string[];
  deniedBy?: string;
}

export interface AccessControlStore {
  config: AccessControlConfig;
  overrideRules: OverrideRule[];
  rbacStorePath?: string;
  abacStorePath?: string;
}

export class AccessControlService {
  private config: AccessControlConfig;
  private overrideRules: OverrideRule[];
  private rbacEngine: RbacEngine;
  private abacEngine: AbacEngine;
  private baseDir: string;

  constructor(baseDir: string, config?: Partial<AccessControlConfig>) {
    this.baseDir = baseDir;
    this.config = {
      enforceMode: 'both',
      denyOverrides: true,
      auditLogging: false,
      ...config,
    };
    this.overrideRules = [];
    this.rbacEngine = new RbacEngine();
    this.abacEngine = new AbacEngine();
  }

  public getConfig(): AccessControlConfig {
    return { ...this.config };
  }

  public updateConfig(updates: Partial<AccessControlConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  public getRbacEngine(): RbacEngine {
    return this.rbacEngine;
  }

  public getAbacEngine(): AbacEngine {
    return this.abacEngine;
  }

  public addOverrideRule(rule: OverrideRule): void {
    if (this.overrideRules.some((r) => r.id === rule.id)) {
      throw new Error(`Override rule with id '${rule.id}' already exists`);
    }
    this.overrideRules.push(rule);
  }

  public removeOverrideRule(id: string): void {
    const idx = this.overrideRules.findIndex((r) => r.id === id);
    if (idx === -1) {
      throw new Error(`Override rule with id '${id}' not found`);
    }
    this.overrideRules.splice(idx, 1);
  }

  public getOverrideRules(): OverrideRule[] {
    return [...this.overrideRules];
  }

  private evaluateOverrides(request: UnifiedAccessRequest): OverrideRule | undefined {
    const sorted = [...this.overrideRules].sort((a, b) => b.priority - a.priority);
    return sorted.find(
      (r) =>
        (r.resource === request.resource || r.resource === '*') &&
        (r.action === request.action || r.action === '*')
    );
  }

  public checkAccess(request: UnifiedAccessRequest): UnifiedAccessDecision {
    const timestamp = request.timestamp || new Date();
    const evaluatedPolicies: string[] = [];
    let rbacResult: AccessCheckResult | undefined;
    let abacResult: AccessDecision | undefined;

    const override = this.evaluateOverrides(request);
    if (override) {
      if (this.config.denyOverrides || override.effect === 'ALLOW') {
        return {
          allowed: override.effect === 'ALLOW',
          reason: `Override rule '${override.id}': ${override.effect}`,
          enforceMode: this.config.enforceMode,
          overrideApplied: override.id,
          evaluatedPolicies: [],
        };
      }
    }

    switch (this.config.enforceMode) {
      case 'rbac_only': {
        rbacResult = this.rbacEngine.checkAccess({
          userId: request.userId,
          resource: request.resource,
          action: request.action,
          context: request.attributes,
        });
        return {
          allowed: rbacResult.allowed,
          reason: rbacResult.reason,
          enforceMode: 'rbac_only',
          rbacResult,
          evaluatedPolicies,
        };
      }

      case 'abac_only': {
        abacResult = this.abacEngine.evaluate({
          userId: request.userId,
          resource: request.resource,
          action: request.action,
          attributes: request.attributes || {},
          timestamp,
        });
        if (abacResult.matchedPolicy) {
          evaluatedPolicies.push(abacResult.matchedPolicy);
        }
        return {
          allowed: abacResult.allowed,
          reason: abacResult.reason,
          enforceMode: 'abac_only',
          abacResult,
          evaluatedPolicies,
        };
      }

      case 'both':
      default: {
        rbacResult = this.rbacEngine.checkAccess({
          userId: request.userId,
          resource: request.resource,
          action: request.action,
          context: request.attributes,
        });

        abacResult = this.abacEngine.evaluate({
          userId: request.userId,
          resource: request.resource,
          action: request.action,
          attributes: request.attributes || {},
          timestamp,
        });

        if (abacResult.matchedPolicy) {
          evaluatedPolicies.push(abacResult.matchedPolicy);
        }

        if (this.config.denyOverrides) {
          if (!rbacResult.allowed || !abacResult.allowed) {
            const reasons: string[] = [];
            if (!rbacResult.allowed) reasons.push(`RBAC: ${rbacResult.reason}`);
            if (!abacResult.allowed) reasons.push(`ABAC: ${abacResult.reason}`);
            return {
              allowed: false,
              reason: reasons.join(' | '),
              enforceMode: 'both',
              rbacResult,
              abacResult,
              evaluatedPolicies,
              deniedBy: !rbacResult.allowed ? rbacResult.deniedBy : abacResult.deniedBy,
            };
          }
        }

        if (rbacResult.allowed && abacResult.allowed) {
          return {
            allowed: true,
            reason: `Allowed by both RBAC (${rbacResult.reason}) and ABAC (${abacResult.reason})`,
            enforceMode: 'both',
            rbacResult,
            abacResult,
            evaluatedPolicies,
          };
        }

        return {
          allowed: false,
          reason: `Not allowed by both engines. RBAC: ${rbacResult.reason} | ABAC: ${abacResult.reason}`,
          enforceMode: 'both',
          rbacResult,
          abacResult,
          evaluatedPolicies,
        };
      }
    }
  }

  public createRole(role: Role): void {
    this.rbacEngine.createRole(role);
  }

  public createPermission(permission: Permission): void {
    this.rbacEngine.createPermission(permission);
  }

  public createAbacPolicy(policy: AbacPolicy): void {
    this.abacEngine.createPolicy(policy);
  }

  public createAttributeDefinition(attr: AttributeDefinition): void {
    this.abacEngine.addAttributeDefinition(attr);
  }

  public save(): void {
    const configPath = path.join(this.baseDir, 'access-control-config.json');
    const overridePath = path.join(this.baseDir, 'access-control-overrides.json');
    const rbacPath = path.join(this.baseDir, 'rbac-store.json');
    const abacPath = path.join(this.baseDir, 'abac-store.json');

    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2), 'utf-8');
    fs.writeFileSync(overridePath, JSON.stringify(this.overrideRules, null, 2), 'utf-8');
    this.rbacEngine.save(rbacPath);
    this.abacEngine.save(abacPath);
  }

  public load(): void {
    const configPath = path.join(this.baseDir, 'access-control-config.json');
    const overridePath = path.join(this.baseDir, 'access-control-overrides.json');
    const rbacPath = path.join(this.baseDir, 'rbac-store.json');
    const abacPath = path.join(this.baseDir, 'abac-store.json');

    if (fs.existsSync(configPath)) {
      this.config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
    if (fs.existsSync(overridePath)) {
      this.overrideRules = JSON.parse(fs.readFileSync(overridePath, 'utf-8'));
    }
    if (fs.existsSync(rbacPath)) {
      this.rbacEngine.load(rbacPath);
    }
    if (fs.existsSync(abacPath)) {
      this.abacEngine.load(abacPath);
    }
  }
}
