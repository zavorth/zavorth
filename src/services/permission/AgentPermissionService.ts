/**
 * Agent-wide permission evaluator + memory (standard style).
 * - once: allow this time only
 * - session: remember for session/workspace until TTL
 * - always: persist allow rule
 * - deny: block (optional short session deny to avoid re-prompt spam)
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  ZAVORTH_AGENT_PERMISSION_CONTRACT_VERSION,
  normalizeAgentPermissionChoice,
  type AgentPermissionChoice,
  type AgentPermissionEvaluateInput,
  type AgentPermissionEvaluateResult,
  type AgentPermissionRespondInput,
  type AgentPermissionRespondResult,
} from '../../contracts/permission/AgentPermissionContract.js';
import { WorkspaceSessionGrantCache } from '../WorkspaceSessionGrantCache.js';
import { HighRiskConfirmationService } from '../HighRiskConfirmationService.js';

type AlwaysRule = {
  toolName: string;
  pattern: string;
  createdAt: string;
  actorId: string | null;
};

type SessionEntry = {
  key: string;
  choice: 'session' | 'deny';
  expiresAt: number;
  toolName: string;
  pattern: string;
};

const DEFAULT_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function normalizeTool(name: unknown): string {
  return String(name || '')
    .trim()
    .toLowerCase()
    .slice(0, 120);
}

function normalizePattern(pattern: unknown): string {
  return String(pattern || '')
    .trim()
    .toLowerCase()
    .slice(0, 500);
}

function ruleKey(toolName: string, pattern: string): string {
  return `${toolName}::${pattern || '*'}`;
}

function sessionBucket(workspaceId: string | null, sessionId: string | null): string {
  return `${workspaceId || 'ws'}::${sessionId || 'session'}`;
}

export type AgentPermissionServiceRuntime = {
  projectRoot?: string;
  now?: () => Date;
  alwaysPath?: string;
  grantCache?: WorkspaceSessionGrantCache;
  highRisk?: HighRiskConfirmationService;
};

export class AgentPermissionService {
  private readonly projectRoot: string;
  private readonly alwaysPath: string;
  private readonly now: () => Date;
  private readonly grantCache: WorkspaceSessionGrantCache;
  private readonly highRisk: HighRiskConfirmationService;
  private readonly session = new Map<string, SessionEntry>();
  private alwaysRules: AlwaysRule[] | null = null;

  constructor(runtime: AgentPermissionServiceRuntime = {}) {
    this.projectRoot = runtime.projectRoot || process.cwd();
    this.alwaysPath =
      runtime.alwaysPath ||
      path.join(this.projectRoot, 'data', 'runtime', 'agent-permissions', 'always.json');
    this.now = runtime.now || (() => new Date());
    this.grantCache = runtime.grantCache || WorkspaceSessionGrantCache.getInstance();
    this.highRisk = runtime.highRisk || new HighRiskConfirmationService();
  }

  public evaluate(input: AgentPermissionEvaluateInput): AgentPermissionEvaluateResult {
    const toolName = normalizeTool(input.toolName);
    const pattern = normalizePattern(input.pattern);
    const key = ruleKey(toolName, pattern);
    const bucket = sessionBucket(input.workspaceId || null, input.sessionId || null);

    this.pruneSession();

    const sessionDeny = this.session.get(`${bucket}::deny::${key}`);
    if (sessionDeny && sessionDeny.expiresAt > Date.now()) {
      return {
        contractVersion: ZAVORTH_AGENT_PERMISSION_CONTRACT_VERSION,
        action: 'deny',
        reason: 'Denied for this session',
        matchedRule: key,
        satisfiedBy: null,
      };
    }

    if (this.findAlways(toolName, pattern)) {
      return {
        contractVersion: ZAVORTH_AGENT_PERMISSION_CONTRACT_VERSION,
        action: 'allow',
        reason: 'Matched always-allow rule',
        matchedRule: key,
        satisfiedBy: 'always',
      };
    }

    const sessionAllow = this.session.get(`${bucket}::session::${key}`);
    if (sessionAllow && sessionAllow.expiresAt > Date.now()) {
      return {
        contractVersion: ZAVORTH_AGENT_PERMISSION_CONTRACT_VERSION,
        action: 'allow',
        reason: 'Allowed for this session',
        matchedRule: key,
        satisfiedBy: 'session',
      };
    }

    // Workspace temporary grant (user's friction-reduction system)
    const workspaceId = String(input.workspaceId || '').trim();
    if (workspaceId) {
      const grant = this.grantCache.getGrant(workspaceId);
      if (grant) {
        const risk = String(input.risk || '').toLowerCase();
        const grantCap = grant.allowRiskUpTo;
        const riskRank = this.riskRank(risk);
        const capRank = grantCap === 'MEDIUM' ? 2 : 1;
        if (riskRank > 0 && riskRank <= capRank && !this.isDangerRisk(risk)) {
          return {
            contractVersion: ZAVORTH_AGENT_PERMISSION_CONTRACT_VERSION,
            action: 'allow',
            reason: `Workspace session grant covers risk up to ${grantCap}`,
            matchedRule: null,
            satisfiedBy: 'workspace-grant',
          };
        }
      }
      if (this.grantCache.isDeveloperModeActive(workspaceId) && !this.isDangerRisk(input.risk)) {
        return {
          contractVersion: ZAVORTH_AGENT_PERMISSION_CONTRACT_VERSION,
          action: 'allow',
          reason: 'Developer mode active for workspace',
          matchedRule: null,
          satisfiedBy: 'workspace-grant',
        };
      }
    }

    const needsAsk =
      input.requiresApproval === true ||
      this.isDangerRisk(input.risk) ||
      this.highRisk.isHighRiskRiskLevel(input.risk);

    if (!needsAsk && String(input.risk || '').toLowerCase() === 'safe') {
      return {
        contractVersion: ZAVORTH_AGENT_PERMISSION_CONTRACT_VERSION,
        action: 'allow',
        reason: 'Safe tool — no approval required',
        matchedRule: null,
        satisfiedBy: 'safe',
      };
    }

    if (!needsAsk && !input.requiresApproval) {
      return {
        contractVersion: ZAVORTH_AGENT_PERMISSION_CONTRACT_VERSION,
        action: 'allow',
        reason: 'No approval required by policy',
        matchedRule: null,
        satisfiedBy: 'safe',
      };
    }

    return {
      contractVersion: ZAVORTH_AGENT_PERMISSION_CONTRACT_VERSION,
      action: 'ask',
      reason: 'Sensitive action — operator approval required',
      matchedRule: null,
      satisfiedBy: null,
    };
  }

  public respond(input: AgentPermissionRespondInput): AgentPermissionRespondResult {
    const choice =
      normalizeAgentPermissionChoice(input.choice) ||
      (String(input.choice || '').toLowerCase() as AgentPermissionChoice);
    if (!['once', 'session', 'always', 'deny'].includes(choice)) {
      return {
        contractVersion: ZAVORTH_AGENT_PERMISSION_CONTRACT_VERSION,
        choice: 'deny',
        allowed: false,
        remembered: false,
        scope: 'none',
        expiresAt: null,
        message: `Unknown choice "${String(input.choice)}". Use once|session|always|deny.`,
      };
    }

    const toolName = normalizeTool(input.toolName);
    const pattern = normalizePattern(input.pattern);
    const key = ruleKey(toolName, pattern);
    const bucket = sessionBucket(input.workspaceId || null, input.sessionId || null);
    const ttl = Math.max(60_000, Number(input.sessionTtlMs || DEFAULT_SESSION_TTL_MS));
    const expiresAtMs = Date.now() + ttl;
    const expiresAt = new Date(expiresAtMs).toISOString();

    if (choice === 'deny') {
      this.session.set(`${bucket}::deny::${key}`, {
        key,
        choice: 'deny',
        expiresAt: expiresAtMs,
        toolName,
        pattern,
      });
      return {
        contractVersion: ZAVORTH_AGENT_PERMISSION_CONTRACT_VERSION,
        choice: 'deny',
        allowed: false,
        remembered: true,
        scope: 'session',
        expiresAt,
        message: 'Denied for this session.',
      };
    }

    if (choice === 'once') {
      return {
        contractVersion: ZAVORTH_AGENT_PERMISSION_CONTRACT_VERSION,
        choice: 'once',
        allowed: true,
        remembered: false,
        scope: 'once',
        expiresAt: null,
        message: 'Allowed once.',
      };
    }

    if (choice === 'session') {
      this.session.set(`${bucket}::session::${key}`, {
        key,
        choice: 'session',
        expiresAt: expiresAtMs,
        toolName,
        pattern,
      });
      // Also lift workspace grant friction for low/medium when workspace known
      const workspaceId = String(input.workspaceId || '').trim();
      if (workspaceId && !this.isDangerRisk(input.risk)) {
        this.grantCache.setGrant(workspaceId, {
          workspaceId,
          expiresAt,
          allowRiskUpTo: 'MEDIUM',
          allowPackageInstall: false,
          allowNetwork: false,
        });
      }
      return {
        contractVersion: ZAVORTH_AGENT_PERMISSION_CONTRACT_VERSION,
        choice: 'session',
        allowed: true,
        remembered: true,
        scope: 'session',
        expiresAt,
        message: 'Allowed for this session.',
      };
    }

    // always
    this.addAlways({
      toolName,
      pattern: pattern || '*',
      createdAt: this.now().toISOString(),
      actorId: input.actorId || null,
    });
    return {
      contractVersion: ZAVORTH_AGENT_PERMISSION_CONTRACT_VERSION,
      choice: 'always',
      allowed: true,
      remembered: true,
      scope: 'always',
      expiresAt: null,
      message: 'Always allowed for this tool/pattern.',
    };
  }

  public listAlwaysRules(): AlwaysRule[] {
    return [...this.loadAlways()];
  }

  public clearSession(workspaceId?: string | null, sessionId?: string | null): void {
    if (!workspaceId && !sessionId) {
      this.session.clear();
      return;
    }
    const prefix = sessionBucket(workspaceId || null, sessionId || null);
    for (const key of this.session.keys()) {
      if (key.startsWith(prefix)) this.session.delete(key);
    }
  }

  private isDangerRisk(risk: unknown): boolean {
    const s = String(risk || '').toLowerCase();
    return (
      s === 'danger' ||
      s === 'high' ||
      s === 'critical' ||
      s === 'severe' ||
      this.highRisk.isHighRiskRiskLevel(risk)
    );
  }

  private riskRank(risk: string): number {
    if (risk === 'safe' || risk === 'low' || risk === '') return 0;
    if (risk === 'attention' || risk === 'medium') return 2;
    if (risk === 'danger' || risk === 'high' || risk === 'critical') return 3;
    return 1;
  }

  private pruneSession(): void {
    const now = Date.now();
    for (const [k, v] of this.session) {
      if (v.expiresAt <= now) this.session.delete(k);
    }
  }

  private loadAlways(): AlwaysRule[] {
    if (this.alwaysRules) return this.alwaysRules;
    try {
      if (!fs.existsSync(this.alwaysPath)) {
        this.alwaysRules = [];
        return this.alwaysRules;
      }
      const raw = JSON.parse(fs.readFileSync(this.alwaysPath, 'utf8')) as {
        rules?: AlwaysRule[];
      };
      this.alwaysRules = Array.isArray(raw.rules) ? raw.rules : [];
    } catch {
      this.alwaysRules = [];
    }
    return this.alwaysRules;
  }

  private addAlways(rule: AlwaysRule): void {
    const rules = this.loadAlways().filter(
      (r) => !(r.toolName === rule.toolName && r.pattern === rule.pattern),
    );
    rules.push(rule);
    this.alwaysRules = rules;
    fs.mkdirSync(path.dirname(this.alwaysPath), { recursive: true });
    fs.writeFileSync(
      this.alwaysPath,
      JSON.stringify(
        {
          contractVersion: ZAVORTH_AGENT_PERMISSION_CONTRACT_VERSION,
          updatedAt: this.now().toISOString(),
          rules,
        },
        null,
        2,
      ) + '\n',
      'utf8',
    );
  }

  private findAlways(toolName: string, pattern: string): AlwaysRule | null {
    const rules = this.loadAlways();
    for (const rule of rules) {
      if (rule.toolName !== toolName && rule.toolName !== '*') continue;
      if (rule.pattern === '*' || rule.pattern === pattern) return rule;
      if (pattern && rule.pattern && pattern.includes(rule.pattern)) return rule;
    }
    return null;
  }
}

/** Process singleton for agent runtime. */
let defaultAgentPermissionService: AgentPermissionService | null = null;

export function getAgentPermissionService(
  runtime?: AgentPermissionServiceRuntime,
): AgentPermissionService {
  if (runtime) return new AgentPermissionService(runtime);
  if (!defaultAgentPermissionService) {
    defaultAgentPermissionService = new AgentPermissionService();
  }
  return defaultAgentPermissionService;
}
