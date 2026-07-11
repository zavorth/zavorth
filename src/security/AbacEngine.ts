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

/**
 * Time-window constraints for ABAC policies.
 *
 * Contract:
 * - `notBefore` / `notAfter` are absolute instants (ISO-8601). Prefer a `Z`
 *   (UTC) suffix so evaluation is independent of the host locale.
 * - `daysOfWeek` / `hoursOfDay` are calendar fields evaluated in an explicit
 *   timezone — never the host's local wall clock unless that zone is chosen.
 * - Timezone resolution order: `timeConstraints.timezone` → engine
 *   `defaultTimezone` → `ZAVORTH_ABAC_TIMEZONE` env → `"UTC"`.
 * - `daysOfWeek` uses JS convention: 0 = Sunday … 6 = Saturday.
 * - `hoursOfDay` uses 0–23 in the resolved timezone.
 */
export interface TimeConstraint {
  notBefore?: string;
  notAfter?: string;
  daysOfWeek?: number[];
  hoursOfDay?: number[];
  /** IANA timezone (e.g. `UTC`, `America/Sao_Paulo`). Default: engine/UTC. */
  timezone?: string;
}

export interface AbacEngineOptions {
  /**
   * Default timezone for day/hour constraints when a policy does not set
   * `timeConstraints.timezone`. Defaults to `ZAVORTH_ABAC_TIMEZONE` or `UTC`.
   */
  defaultTimezone?: string;
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

const WEEKDAY_SHORT_TO_JS: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/**
 * Resolve calendar day-of-week (0–6, Sun–Sat) and hour (0–23) for `date`
 * in an explicit IANA timezone. Uses UTC getters for UTC aliases so fixtures
 * with `Z` timestamps stay deterministic without depending on host locale.
 */
export function getZonedDayAndHour(
  date: Date,
  timeZone: string
): { dayOfWeek: number; hourOfDay: number } {
  const zone = String(timeZone || 'UTC').trim() || 'UTC';
  if (zone === 'UTC' || zone === 'Etc/UTC' || zone === 'Z' || zone === 'GMT' || zone === 'Etc/GMT') {
    return {
      dayOfWeek: date.getUTCDay(),
      hourOfDay: date.getUTCHours(),
    };
  }

  const weekdayParts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    weekday: 'short',
  }).formatToParts(date);
  const weekday = weekdayParts.find((p) => p.type === 'weekday')?.value ?? '';
  const dayOfWeek = WEEKDAY_SHORT_TO_JS[weekday];
  if (dayOfWeek === undefined) {
    throw new Error(`Unable to resolve weekday for timezone '${zone}' (got '${weekday}')`);
  }

  // hourCycle h23 yields 0–23; avoid locale 12h am/pm ambiguity.
  const hourParts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(date);
  const hourRaw = hourParts.find((p) => p.type === 'hour')?.value ?? '0';
  const hourOfDay = Number.parseInt(hourRaw, 10);
  if (!Number.isFinite(hourOfDay) || hourOfDay < 0 || hourOfDay > 23) {
    throw new Error(`Unable to resolve hour for timezone '${zone}' (got '${hourRaw}')`);
  }

  return { dayOfWeek, hourOfDay };
}

function resolveAbacTimezone(policyZone: string | undefined, engineDefault: string): string {
  const fromPolicy = policyZone?.trim();
  if (fromPolicy) return fromPolicy;
  const fromEngine = engineDefault?.trim();
  if (fromEngine) return fromEngine;
  const fromEnv = process.env.ZAVORTH_ABAC_TIMEZONE?.trim();
  if (fromEnv) return fromEnv;
  return 'UTC';
}

export class AbacEngine {
  private policies: Map<string, AbacPolicy>;
  private attributeDefinitions: Map<string, AttributeDefinition>;
  private readonly defaultTimezone: string;

  constructor(options: AbacEngineOptions = {}) {
    this.policies = new Map();
    this.attributeDefinitions = new Map();
    this.defaultTimezone =
      options.defaultTimezone?.trim() ||
      process.env.ZAVORTH_ABAC_TIMEZONE?.trim() ||
      'UTC';
  }

  /** Effective default timezone used when a policy omits `timeConstraints.timezone`. */
  public getDefaultTimezone(): string {
    return this.defaultTimezone;
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

    // Absolute instant bounds — independent of evaluation timezone.
    if (tc.notBefore && ts < new Date(tc.notBefore).getTime()) return false;
    if (tc.notAfter && ts > new Date(tc.notAfter).getTime()) return false;

    const needsCalendar =
      (tc.daysOfWeek && tc.daysOfWeek.length > 0) || (tc.hoursOfDay && tc.hoursOfDay.length > 0);
    if (!needsCalendar) return true;

    const zone = resolveAbacTimezone(tc.timezone, this.defaultTimezone);
    const { dayOfWeek, hourOfDay } = getZonedDayAndHour(timestamp, zone);

    if (tc.daysOfWeek && tc.daysOfWeek.length > 0) {
      if (!tc.daysOfWeek.includes(dayOfWeek)) return false;
    }
    if (tc.hoursOfDay && tc.hoursOfDay.length > 0) {
      if (!tc.hoursOfDay.includes(hourOfDay)) return false;
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
