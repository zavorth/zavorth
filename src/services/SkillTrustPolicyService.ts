import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { logger } from '../logger.js';
import {
decideSecurityPolicy,
  type SecurityPolicyBrokerAction,
  type SecurityPolicyBrokerReceipt,
} from '../security/SecurityPolicyBroker.js';

export type SkillAllowMode = 'all' | 'explicit' | 'review' | 'none';
export type SkillTrustPolicyDefault = 'allow' | 'deny';

export type SkillTrustRule = {
  sourceId: string;
  mode: SkillAllowMode;
  skillNames: string[];
  reason: string | null;
};

export type SkillTrustPolicyDocument = {
  version: number;
  updatedAt: string | null;
  defaultPolicy: SkillTrustPolicyDefault;
  allowedSourceIds: string[];
  rules: SkillTrustRule[];
};

export type SkillTrustDecision = {
  allowed: boolean;
  sourceId: string;
  skillName: string | null;
  mode: SkillAllowMode | 'implicit' | 'default';
  reason: string;
  policyAction?: SecurityPolicyBrokerAction;
  policyReceipt?: SecurityPolicyBrokerReceipt;
};

type SkillTrustRuleRaw = Partial<SkillTrustRule>;

type SkillTrustPolicyRawDocument = {
  version?: number;
  updatedAt?: string | null;
  defaultPolicy?: SkillTrustPolicyDefault;
  allowedSourceIds?: string[];
  rules?: SkillTrustRuleRaw[];
};

type SkillTrustPolicyRuntime = {
  projectRoot?: string;
  policyFile?: string;
  now?: () => Date;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  mkdirSync?: typeof fs.mkdirSync;
};

const DEFAULT_POLICY: SkillTrustPolicyRawDocument = {
  version: 1,
  updatedAt: null,
  defaultPolicy: 'deny',
  allowedSourceIds: ['zavorth-native', 'workspace-agents', 'workspace-library'],
  rules: [
    {
      sourceId: 'zavorth-native',
      mode: 'all',
      reason: 'Official Zavorth-owned native intelligence pack.',
    },
    {
      sourceId: 'workspace-agents',
      mode: 'all',
      reason: 'Primary locally authored source.',
    },
    {
      sourceId: 'workspace-library',
      mode: 'all',
      reason: 'Curated local library.',
    },
    {
      sourceId: 'workspace-imported-library',
      mode: 'review',
      reason: 'Imported skills stay visible for review and require explicit promotion before execution.',
    },
  ],
};

export class SkillTrustPolicyViolation extends Error {
  public readonly sourceId: string;
  public readonly skillName: string | null;

  constructor(decision: SkillTrustDecision) {
    super(decision.reason);
    this.name = 'SkillTrustPolicyViolation';
    this.sourceId = decision.sourceId;
    this.skillName = decision.skillName;
  }
}

export class SkillTrustPolicyService {
  private readonly policyFile: string;
  private readonly now: () => Date;
  private readonly existsSyncImpl: typeof fs.existsSync;
  private readonly readFileSyncImpl: typeof fs.readFileSync;
  private readonly writeFileSyncImpl: typeof fs.writeFileSync;
  private readonly mkdirSyncImpl: typeof fs.mkdirSync;

  constructor(runtime: SkillTrustPolicyRuntime = {}) {
    const projectRoot = runtime.projectRoot || config.projectRoot;
    this.policyFile = runtime.policyFile || path.join(projectRoot, 'config', 'skill-allowlist.json');
    this.now = runtime.now || (() => new Date());
    this.existsSyncImpl = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSyncImpl = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSyncImpl = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.mkdirSyncImpl = runtime.mkdirSync || fs.mkdirSync.bind(fs);
  }

  public readPolicy(): SkillTrustPolicyDocument {
    return this.normalizeDocument(this.readRawPolicy());
  }

  public listAllowedSourceIds(): string[] {
    return this.readPolicy().allowedSourceIds.slice();
  }

  public savePolicy(document: SkillTrustPolicyDocument): SkillTrustPolicyDocument {
    const normalized = this.normalizeDocument({
      ...document,
      updatedAt: this.now().toISOString(),
    });
    this.mkdirSyncImpl(path.dirname(this.policyFile), { recursive: true });
    this.writeFileSyncImpl(this.policyFile, JSON.stringify(normalized, null, 2), 'utf8');
    return normalized;
  }

  public setDefaultPolicy(defaultPolicy: SkillTrustPolicyDefault): SkillTrustPolicyDocument {
    const current = this.readPolicy();
    return this.savePolicy({
      ...current,
      defaultPolicy: defaultPolicy === 'allow' ? 'allow' : 'deny',
    });
  }

  public setSourceRule(input: {
    sourceId: string;
    mode: SkillAllowMode;
    skillNames?: string[];
    reason?: string | null;
  }): SkillTrustPolicyDocument {
    const current = this.readPolicy();
    const sourceId = this.normalizeSourceId(input.sourceId);
    const mode = input.mode === 'all' || input.mode === 'explicit' || input.mode === 'review' || input.mode === 'none'
      ? input.mode
      : 'none';
    const rules = current.rules.filter((entry) => entry.sourceId !== sourceId);
    rules.push({
      sourceId,
      mode,
      skillNames: this.normalizeSkillNameList(input.skillNames || []),
      reason: this.normalizeReason(input.reason),
    });
    const allowedSourceIds = new Set(current.allowedSourceIds);
    if (mode === 'all') {
      allowedSourceIds.add(sourceId);
    }
    if (mode === 'none' || mode === 'review') {
      allowedSourceIds.delete(sourceId);
    }
    return this.savePolicy({
      ...current,
      allowedSourceIds: Array.from(allowedSourceIds.values()),
      rules,
    });
  }

  public evaluateSource(sourceId: string | null | undefined): SkillTrustDecision {
    const normalizedSourceId = this.normalizeSourceId(sourceId);
    const policy = this.readPolicy();
    const rule = this.findRule(policy, normalizedSourceId);

    if (rule?.mode === 'none') {
      return this.deny(normalizedSourceId, null, 'none', rule.reason || `Source ${normalizedSourceId} blocked by allowlist.`);
    }

    if (rule?.mode === 'review') {
      return this.allow(
        normalizedSourceId,
        null,
        'review',
        rule.reason || `Source ${normalizedSourceId} visible for review only.`,
      );
    }

    if (rule?.mode === 'all') {
      return this.allow(normalizedSourceId, null, 'all', rule.reason || `Source ${normalizedSourceId} fully allowed.`);
    }

    if (rule?.mode === 'explicit') {
      return this.allow(
        normalizedSourceId,
        null,
        'explicit',
        rule.reason || `Source ${normalizedSourceId} allowed only by explicit allowlist.`,
      );
    }

    if (policy.allowedSourceIds.includes(normalizedSourceId)) {
      return this.allow(normalizedSourceId, null, 'implicit', `Source ${normalizedSourceId} allowed by base allowlist.`);
    }

    if (policy.defaultPolicy === 'allow') {
      return this.allow(normalizedSourceId, null, 'default', `Source ${normalizedSourceId} allowed by default policy.`);
    }

    return this.deny(
      normalizedSourceId,
      null,
      'default',
      `Source ${normalizedSourceId || 'unknown'} is not allowed by the allowlist.`,
    );
  }

  public assertSourceAllowed(sourceId: string | null | undefined): void {
    const decision = this.evaluateSource(sourceId);
    if (!decision.allowed) {
      throw new SkillTrustPolicyViolation(decision);
    }
  }

  public evaluateSkill(sourceId: string | null | undefined, skillName: string | null | undefined): SkillTrustDecision {
    const normalizedSourceId = this.normalizeSourceId(sourceId);
    const normalizedSkillName = this.normalizeSkillName(skillName);
    const sourceDecision = this.evaluateSource(normalizedSourceId);

    if (!sourceDecision.allowed) {
      return this.withBrokerDecision({
        ...sourceDecision,
        skillName: normalizedSkillName || null,
      });
    }

    const policy = this.readPolicy();
    const rule = this.findRule(policy, normalizedSourceId);

    if (rule?.mode === 'review') {
      return this.deny(
        normalizedSourceId,
        normalizedSkillName,
        'review',
        rule.reason || `Skill ${normalizedSkillName || 'unknown'} requires review before execution.`,
      );
    }

    if (rule?.mode === 'all') {
      return this.allow(
        normalizedSourceId,
        normalizedSkillName,
        'all',
        rule.reason || `Skill ${normalizedSkillName || 'unknown'} allowed by source ${normalizedSourceId}.`,
      );
    }

    if (rule?.mode === 'explicit') {
      if (rule.skillNames.includes(normalizedSkillName)) {
        return this.allow(
          normalizedSourceId,
          normalizedSkillName,
          'explicit',
          rule.reason || `Skill ${normalizedSkillName} allowed by explicit allowlist.`,
        );
      }

      return this.deny(
        normalizedSourceId,
        normalizedSkillName,
        'explicit',
        `Skill ${normalizedSkillName || 'unknown'} is not in the explicit allowlist for source ${normalizedSourceId}.`,
      );
    }

    if (policy.allowedSourceIds.includes(normalizedSourceId)) {
      return this.allow(
        normalizedSourceId,
        normalizedSkillName,
        'implicit',
        `Skill ${normalizedSkillName || 'unknown'} allowed by source ${normalizedSourceId}.`,
      );
    }

    if (policy.defaultPolicy === 'allow') {
      return this.allow(
        normalizedSourceId,
        normalizedSkillName,
        'default',
        `Skill ${normalizedSkillName || 'unknown'} allowed by default policy.`,
      );
    }

    return this.deny(
      normalizedSourceId,
      normalizedSkillName,
      'default',
      `Skill ${normalizedSkillName || 'unknown'} is not allowed by the allowlist.`,
    );
  }

  public assertSkillAllowed(sourceId: string | null | undefined, skillName: string | null | undefined): void {
    const decision = this.evaluateSkill(sourceId, skillName);
    if (!decision.allowed) {
      throw new SkillTrustPolicyViolation(decision);
    }
  }

  private readRawPolicy(): SkillTrustPolicyRawDocument {
    try {
      if (!this.existsSyncImpl(this.policyFile)) {
        return DEFAULT_POLICY;
      }
      return JSON.parse(this.readFileSyncImpl(this.policyFile, 'utf8')) as SkillTrustPolicyRawDocument;
    } catch (error: unknown) {logger.warn('[Skill Trust] JSON parse failed', error); return DEFAULT_POLICY; }
  }

  private normalizeDocument(raw: SkillTrustPolicyRawDocument): SkillTrustPolicyDocument {
    const rules = Array.isArray(raw.rules) && raw.rules.length > 0
      ? raw.rules
      : DEFAULT_POLICY.rules || [];
    const ruleMap = new Map<string, SkillTrustRule>();

    rules.forEach((rule) => {
      const normalized = this.normalizeRule(rule);
      ruleMap.set(normalized.sourceId, normalized);
    });

    return {
      version: Number.isFinite(raw.version) ? Number(raw.version) : 1,
      updatedAt: typeof raw.updatedAt === 'string' && raw.updatedAt.trim()
        ? raw.updatedAt.trim()
        : null,
      defaultPolicy: raw.defaultPolicy === 'allow' ? 'allow' : 'deny',
      allowedSourceIds: this.normalizeSourceIdList(raw.allowedSourceIds),
      rules: Array.from(ruleMap.values()),
    };
  }

  private normalizeRule(rule: SkillTrustRuleRaw): SkillTrustRule {
    return {
      sourceId: this.normalizeSourceId(rule.sourceId),
      mode: rule.mode === 'all' || rule.mode === 'explicit' || rule.mode === 'review' || rule.mode === 'none'
        ? rule.mode
        : 'none',
      skillNames: this.normalizeSkillNameList(rule.skillNames),
      reason: this.normalizeReason(rule.reason),
    };
  }

  private findRule(policy: SkillTrustPolicyDocument, sourceId: string): SkillTrustRule | null {
    return policy.rules.find((rule) => rule.sourceId === sourceId) || null;
  }

  private normalizeSourceIdList(values: unknown): string[] {
    if (!Array.isArray(values)) {
      return [];
    }
    return values
      .map((entry) => this.normalizeSourceId(typeof entry === 'string' ? entry : ''))
      .filter(Boolean);
  }

  private normalizeSkillNameList(values: unknown): string[] {
    if (!Array.isArray(values)) {
      return [];
    }
    return values
      .map((entry) => this.normalizeSkillName(typeof entry === 'string' ? entry : ''))
      .filter(Boolean);
  }

  private normalizeSourceId(value: string | null | undefined): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_\-:/]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private normalizeSkillName(value: string | null | undefined): string {
    return String(value || '')
      .trim()
      .toLowerCase();
  }

  private normalizeReason(value: unknown): string | null {
    const normalized = String(value || '').trim();
    return normalized || null;
  }

  private allow(
    sourceId: string,
    skillName: string | null,
    mode: SkillTrustDecision['mode'],
    reason: string,
  ): SkillTrustDecision {
    return this.withBrokerDecision({
      allowed: true,
      sourceId,
      skillName,
      mode,
      reason,
    });
  }

  private deny(
    sourceId: string,
    skillName: string | null,
    mode: SkillTrustDecision['mode'],
    reason: string,
  ): SkillTrustDecision {
    return this.withBrokerDecision({
      allowed: false,
      sourceId,
      skillName,
      mode,
      reason,
    });
  }

  private withBrokerDecision(decision: SkillTrustDecision): SkillTrustDecision {
    const brokerDecision = decideSecurityPolicy({
      surface: 'skill',
      operation: decision.skillName ? 'skill_trust' : 'source_trust',
      target: decision.skillName ? `${decision.sourceId}/${decision.skillName}`
        : decision.sourceId,
      adminPolicyRequired: !decision.allowed,
      rule: decision.allowed ? 'SKILL_TRUST_POLICY_ALLOWED' : 'SKILL_TRUST_POLICY_ADMIN_REQUIRED',
      reasons: [decision.reason],
    });
    return {
      ...decision,
      policyAction: brokerDecision.action,
      policyReceipt: brokerDecision.receipt,
    };
  }
}
