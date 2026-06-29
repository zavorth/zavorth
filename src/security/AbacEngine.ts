import fs from 'fs';
import path from 'path';

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'less_than'
  | 'greater_or_equal'
  | 'less_or_equal'
  | 'in'
  | 'not_in'
  | 'matches';

export type LogicOperator = 'AND' | 'OR' | 'NOT';

export interface Condition {
  attribute: string;
  operator: ConditionOperator;
  value: unknown;
}

export interface LogicGroup {
  logic: LogicOperator;
  conditions: (Condition | LogicGroup)[];
}

export interface AbacPolicy {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  condition: Condition | LogicGroup;
  effect: 'ALLOW' | 'DENY';
  priority: number;
  enabled: boolean;
  timeConstraints?: TimeConstraint;
  metadata?: Record<string, unknown>;
}

export interface TimeConstraint {
  notBefore?: string;
  notAfter?: string;
  daysOfWeek?: number[];
  hoursOfDay?: number[];
}

export interface AttributeDefinition {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array';
  description: string;
  defaultValue?: unknown;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    allowedValues?: unknown[];
  };
}

export interface AccessRequest {
  userId: string;
  resource: string;
  action: string;
  attributes: Record<string, unknown>;
  timestamp?: Date;
}

export interface AccessDecision {
  allowed: boolean;
  reason: string;
  evaluatedPolicies: string[];
  matchedPolicy?: string;
  deniedBy?: string;
}

export class AbacEngine {
  private policies: Map<string, AbacPolicy>;
  private attributeDefinitions: Map<string, AttributeDefinition>;

  constructor() {
    this.policies = new Map();
    this.attributeDefinitions = new Map();
  }

  public createPolicy(policy: AbacPolicy): void {
    if (this.policies.has(policy.id)) {
      throw new Error(`Policy with id '${policy.id}' already exists`);
    }
    this.policies.set(policy.id, { ...policy });
  }

  public getPolicy(id: string): AbacPolicy | undefined {
    const policy = this.policies.get(id);
    return policy ? { ...policy } : undefined;
  }

  public updatePolicy(id: string, updates: Partial<Omit<AbacPolicy, 'id'>>): void {
    const existing = this.policies.get(id);
    if (!existing) {
      throw new Error(`Policy with id '${id}' not found`);
    }
    this.policies.set(id, { ...existing, ...updates });
  }

  public deletePolicy(id: string): void {
    if (!this.policies.has(id)) {
      throw new Error(`Policy with id '${id}' not found`);
    }
    this.policies.delete(id);
  }

  public listPolicies(): AbacPolicy[] {
    return Array.from(this.policies.values()).map((p) => ({ ...p }));
  }

  public addAttributeDefinition(attr: AttributeDefinition): void {
    if (this.attributeDefinitions.has(attr.id)) {
      throw new Error(`Attribute definition with id '${attr.id}' already exists`);
    }
    this.attributeDefinitions.set(attr.id, { ...attr });
  }

  public getAttributeDefinition(id: string): AttributeDefinition | undefined {
    const attr = this.attributeDefinitions.get(id);
    return attr ? { ...attr } : undefined;
  }

  public updateAttributeDefinition(id: string, updates: Partial<Omit<AttributeDefinition, 'id'>>): void {
    const existing = this.attributeDefinitions.get(id);
    if (!existing) {
      throw new Error(`Attribute definition with id '${id}' not found`);
    }
    this.attributeDefinitions.set(id, { ...existing, ...updates });
  }

  public deleteAttributeDefinition(id: string): void {
    if (!this.attributeDefinitions.has(id)) {
      throw new Error(`Attribute definition with id '${id}' not found`);
    }
    this.attributeDefinitions.delete(id);
  }

  public listAttributeDefinitions(): AttributeDefinition[] {
    return Array.from(this.attributeDefinitions.values()).map((a) => ({ ...a }));
  }

  public evaluateCondition(condition: Condition | LogicGroup, attributes: Record<string, unknown>): boolean {
    if ('logic' in condition) {
      return this.evaluateLogicGroup(condition as LogicGroup, attributes);
    }
    return this.evaluateSimpleCondition(condition as Condition, attributes);
  }

  private evaluateSimpleCondition(condition: Condition, attributes: Record<string, unknown>): boolean {
    const attrValue = attributes[condition.attribute];
    const condValue = condition.value;

    switch (condition.operator) {
      case 'equals':
        return attrValue === condValue;
      case 'not_equals':
        return attrValue !== condValue;
      case 'contains':
        return String(attrValue).includes(String(condValue));
      case 'not_contains':
        return !String(attrValue).includes(String(condValue));
      case 'starts_with':
        return String(attrValue).startsWith(String(condValue));
      case 'ends_with':
        return String(attrValue).endsWith(String(condValue));
      case 'greater_than':
        return Number(attrValue) > Number(condValue);
      case 'less_than':
        return Number(attrValue) < Number(condValue);
      case 'greater_or_equal':
        return Number(attrValue) >= Number(condValue);
      case 'less_or_equal':
        return Number(attrValue) <= Number(condValue);
      case 'in':
        return Array.isArray(condValue) && condValue.includes(attrValue);
      case 'not_in':
        return Array.isArray(condValue) && !condValue.includes(attrValue);
      case 'matches':
        return new RegExp(String(condValue)).test(String(attrValue));
      default:
        return false;
    }
  }

  private evaluateLogicGroup(group: LogicGroup, attributes: Record<string, unknown>): boolean {
    switch (group.logic) {
      case 'AND':
        return group.conditions.every((c) => this.evaluateCondition(c, attributes));
      case 'OR':
        return group.conditions.some((c) => this.evaluateCondition(c, attributes));
      case 'NOT':
        return group.conditions.length > 0 && !this.evaluateCondition(group.conditions[0], attributes);
      default:
        return false;
    }
  }

  private checkTimeConstraints(policy: AbacPolicy, timestamp: Date): boolean {
    if (!policy.timeConstraints) return true;
    const tc = policy.timeConstraints;
    const ts = timestamp.getTime();

    if (tc.notBefore && ts < new Date(tc.notBefore).getTime()) return false;
    if (tc.notAfter && ts > new Date(tc.notAfter).getTime()) return false;
    if (tc.daysOfWeek && tc.daysOfWeek.length > 0) {
      if (!tc.daysOfWeek.includes(timestamp.getDay())) return false;
    }
    if (tc.hoursOfDay && tc.hoursOfDay.length > 0) {
      if (!tc.hoursOfDay.includes(timestamp.getHours())) return false;
    }
    return true;
  }

  public evaluate(request: AccessRequest): AccessDecision {
    const timestamp = request.timestamp || new Date();
    const matchingPolicies = Array.from(this.policies.values())
      .filter((p) => p.enabled)
      .filter((p) => p.resource === request.resource || p.resource === '*')
      .filter((p) => p.action === request.action || p.action === '*')
      .filter((p) => this.checkTimeConstraints(p, timestamp));

    const evaluatedPolicies: string[] = [];
    const allowPolicies: AbacPolicy[] = [];
    const denyPolicies: AbacPolicy[] = [];

    for (const policy of matchingPolicies) {
      evaluatedPolicies.push(policy.id);
      const conditionMet = this.evaluateCondition(policy.condition, request.attributes);
      if (conditionMet) {
        if (policy.effect === 'DENY') {
          denyPolicies.push(policy);
        } else {
          allowPolicies.push(policy);
        }
      }
    }

    if (denyPolicies.length > 0) {
      denyPolicies.sort((a, b) => b.priority - a.priority);
      const topDeny = denyPolicies[0];
      return {
        allowed: false,
        reason: `Denied by policy '${topDeny.name}' (id: ${topDeny.id})`,
        evaluatedPolicies,
        deniedBy: topDeny.id,
      };
    }

    if (allowPolicies.length > 0) {
      allowPolicies.sort((a, b) => b.priority - a.priority);
      const topAllow = allowPolicies[0];
      return {
        allowed: true,
        reason: `Allowed by policy '${topAllow.name}' (id: ${topAllow.id})`,
        evaluatedPolicies,
        matchedPolicy: topAllow.id,
      };
    }

    return {
      allowed: false,
      reason: 'No matching ABAC policies found',
      evaluatedPolicies,
      deniedBy: 'ABAC_NO_MATCH',
    };
  }

  public save(filePath: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const data = {
      policies: Array.from(this.policies.entries()),
      attributeDefinitions: Array.from(this.attributeDefinitions.entries()),
    };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  public load(filePath: string): void {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File '${filePath}' not found`);
    }
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    this.policies = new Map(raw.policies || []);
    this.attributeDefinitions = new Map(raw.attributeDefinitions || []);
  }
}
