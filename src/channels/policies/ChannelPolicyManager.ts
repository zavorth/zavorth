import fs from 'fs';
import path from 'path';
import { resolveZavorthLocalStateFile } from '../../config/localStatePaths.js';
import type {
  ChannelPolicyReloadReceipt,
  ChannelPolicySnapshot,
  ChannelPolicyState,
  ChannelPolicySummary,
} from '../../contracts/ChannelMeshContract.js';
import { getExplicitExecutorForCommand } from '../commands/ChannelCommandCatalog.js';
import {
  EXTERNAL_EXECUTOR_COMMAND,
  EXTERNAL_REVIEW_COMMAND,
  EXTERNAL_REVIEW_DASH_COMMAND,
  LEGACY_EXTERNAL_COMMAND,
  LEGACY_EXTERNAL_REVIEW_COMMAND,
  LEGACY_EXTERNAL_REVIEW_DASH_COMMAND,
} from '../commands/ExternalExecutorIdentity.js';

const FUN_COMMANDS = ['/roll', '/coinflip', '/8ball', '/joke', '/roulette'];

const READ_ONLY_ALLOWED_COMMANDS = new Set([
  '/start',
  '/help',
  '/menu',
  '/zavorth',
  '/settings',
  '/status',
  '/zavorthControl',
  '/tasks',
  '/logs',
  '/files',
  '/diff',
  '/research',
  '/deepresearch',
  '/memory',
  '/recall',
  '/snippets',
  '/snippet',
  '/remember',
  '/forget',
  '/hostauth',
  '/changes',
  '/access',
  '/bootstrap',
  '/doctor',
]);

const GROUP_ADMIN_COMMANDS = new Set([
  '/ban',
  '/kick',
  '/mute',
  '/unmute',
  '/warn',
  '/warns',
  '/clearwarns',
  '/rules',
  '/stats',
  '/setwelcome',
  '/setbye',
  '/antispam',
  '/filter',
]);

const NON_ADMIN_BLOCKED_COMMANDS = new Set([
  '/codex',
  EXTERNAL_EXECUTOR_COMMAND,
  EXTERNAL_REVIEW_DASH_COMMAND,
  EXTERNAL_REVIEW_COMMAND,
  LEGACY_EXTERNAL_COMMAND,
  LEGACY_EXTERNAL_REVIEW_DASH_COMMAND,
  LEGACY_EXTERNAL_REVIEW_COMMAND,
  '/selfmod',
  '/selfupdate',
  '/reload',
  '/autorepair',
  '/repair',
  '/ag',
  '/bridge',
  '/run',
  '/plan',
  '/wsl',
  '/companion',
  '/cleanup',
  '/mode',
  '/model',
  '/strong',
  '/profile',
  '/enable',
  '/disable',
  '/workspace',
  '/remote',
  '/schedule',
  '/schedules',
  '/unschedule',
  '/automations',
  '/perm',
  '/permallow',
  '/permrevoke',
  '/lock',
  '/unlock',
  '/hostauth',
  '/agfocus',
  '/agaccept',
  '/agnudge',
  '/agbridge',
  '/agclean',
  '/agreset',
  '/agmodel',
  '/ag_open',
  '/ag_status',
  '/ag_restart',
  '/ag_model',
  '/ag_prompt',
  '/approve',
  '/reject',
  '/deny',
  '/undo',
  '/tasks',
  '/logs',
  '/files',
  '/diff',
]);
export interface GroupToolPolicy {
  untrustedUserMode: 'none' | 'safe-only' | 'allowlist-only' | 'safe-plus-allowlist';
  allowedToolsForUntrustedUsers: string[];
}

export interface ChannelAccessPolicy {
  channelId: string;
  isOpenAccess: boolean;
  allowedList: string[];
  allowedUsers?: string[];
  allowedGroups?: string[];
  blockedList: string[];
  updatedAt: string;
  groupToolPolicy?: GroupToolPolicy;
}

type ChannelPolicyStoreState = {
  version: number;
  updatedAt: string;
  policies: Record<string, ChannelAccessPolicy>;
};

type ChannelPolicyManagerOptions = {
  policyFile?: string;
  env?: NodeJS.ProcessEnv;
  now?: () => Date;
  cacheWindowMs?: number;
  resolveUserRoles?: () => Record<string, string[]>;
};

type ChannelPolicyInput = {
  isOpenAccess?: boolean;
  allowedList?: Array<string | null | undefined>;
  blockedList?: Array<string | null | undefined>;
};

export class ChannelPolicyManager {
  private readonly policyFile: string;
  private readonly env: NodeJS.ProcessEnv;
  private readonly now: () => Date;
  private readonly cacheWindowMs: number;
  private policies: Map<string, ChannelAccessPolicy> = new Map();
  private lastLoadedAtMs: number | null = null;
  private lastStoreUpdatedAt: string | null = null;
  private lastReloadReceipt: ChannelPolicyReloadReceipt | null = null;
  private readonly resolveUserRoles: () => Record<string, string[]>;

  constructor(options: ChannelPolicyManagerOptions = {}) {
    this.policyFile = path.resolve(
      options.policyFile || resolveZavorthLocalStateFile('channel-policies.json'),
    );
    this.env = options.env || process.env;
    this.now = options.now || (() => new Date());
    this.cacheWindowMs = Math.max(0, Number(options.cacheWindowMs ?? 1_000) || 0);
    this.resolveUserRoles = options.resolveUserRoles || (() => ({}));
  }

  public async loadPolicies(): Promise<ChannelAccessPolicy[]> {
    this.ensurePoliciesLoaded(true);
    return this.listPolicies();
  }

  public async reloadPolicies(input: {
    actor?: string | null;
    reason?: string | null;
  } = {}): Promise<ChannelPolicyReloadReceipt> {
    return this.reloadPoliciesFromSource({
      actor: normalizeAuditText(input.actor) || 'operator',
      reason: normalizeAuditText(input.reason) || 'manual',
      persistIfMissing: false,
    });
  }

  public getLastReloadReceipt(): ChannelPolicyReloadReceipt | null {
    return this.lastReloadReceipt;
  }

  public listPolicies(): ChannelAccessPolicy[] {
    this.ensurePoliciesLoaded(false);
    return Array.from(this.policies.values()).sort((left, right) => left.channelId.localeCompare(right.channelId));
  }

  public getPolicy(channelId: string): ChannelAccessPolicy | null {
    const normalizedChannelId = normalizeIdentifier(channelId);
    if (!normalizedChannelId) {
      return null;
    }
    this.ensurePoliciesLoaded(false);
    return this.policies.get(normalizedChannelId) || null;
  }

  public describePolicy(channelId: string): ChannelPolicySummary {
    const normalizedChannelId = normalizeIdentifier(channelId);
    const policy = this.getPolicy(normalizedChannelId);
    if (!normalizedChannelId || !policy) {
      return {
        channelId: normalizedChannelId || 'unknown',
        state: 'closed',
        isOpenAccess: false,
        allowedCount: 0,
        blockedCount: 0,
        summary: 'Channel without policy loaded; access remains closed until allowlist or supervised open access is configured.',
      };
    }
    return summarizePolicy(policy);
  }

  public buildSnapshot(channelIds?: string[] | null): ChannelPolicySnapshot {
    const candidates = Array.isArray(channelIds) && channelIds.length > 0
      ? channelIds.map((entry) => normalizeIdentifier(entry)).filter(Boolean)
      : this.listPolicies().map((entry) => entry.channelId);
    const entries = Array.from(new Set(candidates)).map((channelId) => this.describePolicy(channelId));
    return {
      generatedAt: this.now().toISOString(),
      summary: {
        total: entries.length,
        open: entries.filter((entry) => entry.state === 'open').length,
        allowlist: entries.filter((entry) => entry.state === 'allowlist').length,
        mixed: entries.filter((entry) => entry.state === 'mixed').length,
        blockedOnly: entries.filter((entry) => entry.state === 'blocked-only').length,
        closed: entries.filter((entry) => entry.state === 'closed').length,
      },
      entries,
    };
  }

  public async setPolicy(channelId: string, input: ChannelPolicyInput): Promise<ChannelAccessPolicy> {
    const normalizedChannelId = normalizeIdentifier(channelId);
    if (!normalizedChannelId) {
      throw new Error('channelId is required to persist a channel policy.');
    }
    const existing = this.getPolicy(normalizedChannelId);
    const allowedList = input.allowedList !== undefined
      ? parseIdentifierList(input.allowedList)
      : (existing?.allowedList || []);
    const blockedList = input.blockedList !== undefined
      ? parseIdentifierList(input.blockedList)
      : (existing?.blockedList || []);
    const next = normalizePolicy({
      channelId: normalizedChannelId,
      isOpenAccess: input.isOpenAccess ?? existing?.isOpenAccess ?? false,
      allowedList,
      blockedList,
      groupToolPolicy: existing?.groupToolPolicy,
      updatedAt: this.now().toISOString(),
    }, this.now);

    this.policies.set(normalizedChannelId, next);
    this.persist();
    return next;
  }

  public async verifyAccess(channelId: string, userIdentifier: string): Promise<boolean> {
    const policy = this.getPolicy(channelId);
    const normalizedIdentifier = normalizeIdentifier(userIdentifier);
    if (!policy || !normalizedIdentifier) {
      return false;
    }
    if (policy.blockedList.includes(normalizedIdentifier)) {
      return false;
    }
    if (policy.isOpenAccess) {
      return true;
    }
    return policy.allowedList.includes(normalizedIdentifier);
  }

  public async verifyChatAccess(channelId: string, chatId: string, userId: string): Promise<boolean> {
    const policy = this.getPolicy(channelId);
    if (!policy) {
      return false;
    }
    const normalizedUser = normalizeIdentifier(userId);
    const normalizedChat = normalizeIdentifier(chatId);
    if (policy.blockedList.includes(normalizedUser) || policy.blockedList.includes(normalizedChat)) {
      return false;
    }
    if (policy.isOpenAccess) {
      return true;
    }
    if (isWhatsAppGroupId(normalizedChat)) {
      return (policy.allowedGroups || []).includes(normalizedChat);
    }
    return (policy.allowedUsers || []).includes(normalizedUser);
  }

  public async verifyUserAccess(channelId: string, userId: string): Promise<boolean> {
    const policy = this.getPolicy(channelId);
    const normalizedUser = normalizeIdentifier(userId);
    if (!policy || !normalizedUser) {
      return false;
    }
    if (policy.blockedList.includes(normalizedUser)) {
      return false;
    }
    if (policy.isOpenAccess) {
      return true;
    }
    return (policy.allowedUsers || []).includes(normalizedUser);
  }

  public async verifyGroupAccess(channelId: string, chatId: string): Promise<boolean> {
    const policy = this.getPolicy(channelId);
    const normalizedChat = normalizeIdentifier(chatId);
    if (!policy || !normalizedChat || !isWhatsAppGroupId(normalizedChat)) {
      return false;
    }
    if (policy.blockedList.includes(normalizedChat)) {
      return false;
    }
    if (policy.isOpenAccess) {
      return true;
    }
    return (policy.allowedGroups || []).includes(normalizedChat);
  }

  public getUserRoles(userId: string): string[] {
    return this.resolveUserRoles()[userId] || ['admin'];
  }

  public isAdminUser(userId: string): boolean {
    return this.getUserRoles(userId).includes('admin');
  }

  public isFunCommand(command: string): boolean {
    return FUN_COMMANDS.includes(command);
  }

  public isReadOnlyAllowedCommand(command: string): boolean {
    return READ_ONLY_ALLOWED_COMMANDS.has(command);
  }

  public isGroupAdminCommand(command: string): boolean {
    return GROUP_ADMIN_COMMANDS.has(command);
  }

  public isCommandBlockedForNonAdmin(command: string): boolean {
    return NON_ADMIN_BLOCKED_COMMANDS.has(command);
  }

  /**
   * Privileged slash tokens only (agent-first).
   * Free-text NLU phrases no longer activate ops features, so they are not
   * treated as hidden privileged shortcuts either — free text stays agent-owned.
   */
  public isHiddenPrivilegedInput(rawText: string): boolean {
    const normalized = rawText
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');

    if (!normalized || !normalized.startsWith('/')) {
      return false;
    }

    const command = normalized.split(' ')[0] || '';
    return [
      '/ag_prompt',
      '/ag_model',
      '/ag_open',
      '/ag_status',
      '/ag_restart',
      '/remote',
      '/selfupdate',
      '/reload',
      '/autorepair',
      '/repair',
    ].includes(command);
  }

  public isMutableCommandWhileHostReadonly(command: string, rawText: string): boolean {
    if (!rawText.startsWith('/')) {
      return this.isHiddenPrivilegedInput(rawText);
    }

    if (!command) {
      return false;
    }

    if (READ_ONLY_ALLOWED_COMMANDS.has(command) || FUN_COMMANDS.includes(command)) {
      return false;
    }

    return Boolean(getExplicitExecutorForCommand(command)) || NON_ADMIN_BLOCKED_COMMANDS.has(command);
  }

  private ensurePoliciesLoaded(persistIfMissing: boolean): void {
    if (!this.shouldReloadPolicies()) {
      return;
    }
    this.reloadPoliciesFromSource({
      actor: 'system',
      reason: this.policies.size > 0 ? 'cache-expired' : 'initial-load',
      persistIfMissing,
    });
  }

  private shouldReloadPolicies(): boolean {
    if (this.policies.size === 0 || this.lastLoadedAtMs === null) {
      return true;
    }
    if (this.cacheWindowMs === 0) {
      return true;
    }
    return this.now().getTime() - this.lastLoadedAtMs > this.cacheWindowMs;
  }

  private reloadPoliciesFromSource(input: {
    actor: string;
    reason: string;
    persistIfMissing: boolean;
  }): ChannelPolicyReloadReceipt {
    const previousPolicies = new Map(this.policies);
    const state = this.readState();
    const hasPolicyFile = fs.existsSync(this.policyFile);
    const sourcePolicies = Object.keys(state.policies).length > 0
      ? state.policies
      : buildDefaultPolicies(this.env, this.now);
    this.policies = new Map(
      Object.values(sourcePolicies).map((policy) => [policy.channelId, normalizePolicy(policy, this.now)]),
    );
    this.lastLoadedAtMs = this.now().getTime();
    this.lastStoreUpdatedAt = state.updatedAt;
    if (input.persistIfMissing && !hasPolicyFile) {
      this.persist();
      this.lastStoreUpdatedAt = this.now().toISOString();
    }
    const receipt: ChannelPolicyReloadReceipt = {
      actor: input.actor,
      reason: input.reason,
      reloadedAt: this.now().toISOString(),
      source: hasPolicyFile ? this.policyFile : 'env-defaults',
      cacheWindowMs: this.cacheWindowMs,
      previousUpdatedAt: this.lastReloadReceipt?.nextUpdatedAt || null,
      nextUpdatedAt: this.lastStoreUpdatedAt || this.now().toISOString(),
      previousPolicyCount: previousPolicies.size,
      nextPolicyCount: this.policies.size,
      changedChannels: diffChangedChannels(previousPolicies, this.policies),
    };
    this.lastReloadReceipt = receipt;
    return receipt;
  }

  private readState(): ChannelPolicyStoreState {
    try {
      if (!fs.existsSync(this.policyFile)) {
        return {
          version: 1,
          updatedAt: this.now().toISOString(),
          policies: {},
        };
      }
      const parsed = JSON.parse(fs.readFileSync(this.policyFile, 'utf8'));
      return {
        version: Number(parsed.version || 1) || 1,
        updatedAt: String(parsed.updatedAt || this.now().toISOString()),
        policies: parsed?.policies && typeof parsed.policies === 'object'
          ? parsed.policies as Record<string, ChannelAccessPolicy>
          : {},
      };
    } catch (error: unknown) {return {
        version: 1,
        updatedAt: this.now().toISOString(),
        policies: {},
      };
    }
  }

  private persist(): void {
    const updatedAt = this.now().toISOString();
    const state: ChannelPolicyStoreState = {
      version: 1,
      updatedAt,
      policies: Object.fromEntries(
        Array.from(this.policies.entries()).sort(([left], [right]) => left.localeCompare(right)),
      ),
    };
    fs.mkdirSync(path.dirname(this.policyFile), { recursive: true });
    fs.writeFileSync(this.policyFile, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    this.lastLoadedAtMs = this.now().getTime();
    this.lastStoreUpdatedAt = updatedAt;
  }
}

function buildDefaultPolicies(env: NodeJS.ProcessEnv, now: () => Date): Record<string, ChannelAccessPolicy> {
  const timestamp = now().toISOString();
  return {
    whatsapp: {
      channelId: 'whatsapp',
      isOpenAccess: false,
      allowedList: parseIdentifierList(env.ZAVORTH_CHANNEL_POLICY_WHATSAPP_ALLOWED || '+5511999999999'),
      blockedList: parseIdentifierList(env.ZAVORTH_CHANNEL_POLICY_WHATSAPP_BLOCKED),
      updatedAt: timestamp,
    },
    slack: {
      channelId: 'slack',
      isOpenAccess: parseBoolean(env.ZAVORTH_CHANNEL_POLICY_SLACK_OPEN, false),
      allowedList: parseIdentifierList(env.ZAVORTH_CHANNEL_POLICY_SLACK_ALLOWED),
      blockedList: parseIdentifierList(env.ZAVORTH_CHANNEL_POLICY_SLACK_BLOCKED || 'spammer@corp.com'),
      updatedAt: timestamp,
    },
    telegram: {
      channelId: 'telegram',
      isOpenAccess: parseBoolean(env.ZAVORTH_CHANNEL_POLICY_TELEGRAM_OPEN, false),
      allowedList: parseIdentifierList(env.ZAVORTH_CHANNEL_POLICY_TELEGRAM_ALLOWED),
      blockedList: parseIdentifierList(env.ZAVORTH_CHANNEL_POLICY_TELEGRAM_BLOCKED),
      updatedAt: timestamp,
    },
    discord: {
      channelId: 'discord',
      isOpenAccess: parseBoolean(env.ZAVORTH_CHANNEL_POLICY_DISCORD_OPEN, false),
      allowedList: parseIdentifierList(env.ZAVORTH_CHANNEL_POLICY_DISCORD_ALLOWED),
      blockedList: parseIdentifierList(env.ZAVORTH_CHANNEL_POLICY_DISCORD_BLOCKED),
      updatedAt: timestamp,
    },
    instagram: {
      channelId: 'instagram',
      isOpenAccess: parseBoolean(env.ZAVORTH_CHANNEL_POLICY_INSTAGRAM_OPEN, false),
      allowedList: parseIdentifierList(env.ZAVORTH_CHANNEL_POLICY_INSTAGRAM_ALLOWED),
      blockedList: parseIdentifierList(env.ZAVORTH_CHANNEL_POLICY_INSTAGRAM_BLOCKED),
      updatedAt: timestamp,
    },
    signal: {
      channelId: 'signal',
      isOpenAccess: parseBoolean(env.ZAVORTH_CHANNEL_POLICY_SIGNAL_OPEN, false),
      allowedList: parseIdentifierList(env.ZAVORTH_CHANNEL_POLICY_SIGNAL_ALLOWED),
      blockedList: parseIdentifierList(env.ZAVORTH_CHANNEL_POLICY_SIGNAL_BLOCKED),
      updatedAt: timestamp,
    },
    imessage: {
      channelId: 'imessage',
      isOpenAccess: parseBoolean(env.ZAVORTH_CHANNEL_POLICY_IMESSAGE_OPEN, false),
      allowedList: parseIdentifierList(env.ZAVORTH_CHANNEL_POLICY_IMESSAGE_ALLOWED),
      blockedList: parseIdentifierList(env.ZAVORTH_CHANNEL_POLICY_IMESSAGE_BLOCKED),
      updatedAt: timestamp,
    },
    teams: {
      channelId: 'teams',
      isOpenAccess: parseBoolean(env.ZAVORTH_CHANNEL_POLICY_TEAMS_OPEN, false),
      allowedList: parseIdentifierList(env.ZAVORTH_CHANNEL_POLICY_TEAMS_ALLOWED),
      blockedList: parseIdentifierList(env.ZAVORTH_CHANNEL_POLICY_TEAMS_BLOCKED),
      updatedAt: timestamp,
    },
    email: {
      channelId: 'email',
      isOpenAccess: parseBoolean(env.ZAVORTH_CHANNEL_POLICY_EMAIL_OPEN, false),
      allowedList: parseIdentifierList(env.ZAVORTH_CHANNEL_POLICY_EMAIL_ALLOWED),
      blockedList: parseIdentifierList(env.ZAVORTH_CHANNEL_POLICY_EMAIL_BLOCKED),
      updatedAt: timestamp,
    },
  };
}

function normalizePolicy(policy: Partial<ChannelAccessPolicy>, now: () => Date): ChannelAccessPolicy {
  const channelId = normalizeIdentifier(policy.channelId);
  if (!channelId) {
    throw new Error('Invalid channelId for ChannelAccessPolicy.');
  }
  const allowedList = parseIdentifierList(policy.allowedList || []);
  const allowedUsers = parseIdentifierList(policy.allowedUsers || allowedList.filter((entry) => !isWhatsAppGroupId(entry)));
  const allowedGroups = parseIdentifierList(policy.allowedGroups || allowedList.filter(isWhatsAppGroupId));
  return {
    channelId,
    isOpenAccess: policy.isOpenAccess === true,
    allowedList,
    allowedUsers,
    allowedGroups,
    blockedList: parseIdentifierList(policy.blockedList || []),
    updatedAt: String(policy.updatedAt || now().toISOString()),
    ...(policy.groupToolPolicy ? { groupToolPolicy: normalizeGroupToolPolicy(policy.groupToolPolicy) } : {}),
  };
}

function normalizeGroupToolPolicy(input: GroupToolPolicy): GroupToolPolicy {
  const mode = ['none', 'safe-only', 'allowlist-only', 'safe-plus-allowlist'].includes(input.untrustedUserMode)
    ? input.untrustedUserMode
    : 'none';
  return {
    untrustedUserMode: mode,
    allowedToolsForUntrustedUsers: parseIdentifierList(input.allowedToolsForUntrustedUsers || []),
  };
}

function parseIdentifierList(input: string | Array<string | null | undefined> | null | undefined): string[] {
  const rawEntries = Array.isArray(input)
    ? input
    : String(input || '')
      .split(/[,\n;]/g);
  return Array.from(
    new Set(
      rawEntries
        .map((entry) => normalizeIdentifier(entry))
        .filter(Boolean),
    ),
  ) as string[];
}

function normalizeIdentifier(input: unknown): string {
  return String(input || '').trim().toLowerCase();
}

function isWhatsAppGroupId(input: string): boolean {
  return normalizeIdentifier(input).endsWith('@g.us');
}

function normalizeAuditText(input: unknown): string {
  return String(input || '').trim();
}

function diffChangedChannels(
  previousPolicies: Map<string, ChannelAccessPolicy>,
  nextPolicies: Map<string, ChannelAccessPolicy>,
): string[] {
  const channelIds = new Set([...previousPolicies.keys(), ...nextPolicies.keys()]);
  return Array.from(channelIds)
    .filter(
      (channelId) =>
        JSON.stringify(previousPolicies.get(channelId) || null) !==
        JSON.stringify(nextPolicies.get(channelId) || null),
    )
    .sort((left, right) => left.localeCompare(right));
}

function parseBoolean(input: unknown, fallback: boolean): boolean {
  const normalized = String(input || '').trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

function summarizePolicy(policy: ChannelAccessPolicy): ChannelPolicySummary {
  const state = resolvePolicyState(policy);
  const allowedCount = policy.allowedList.length;
  const blockedCount = policy.blockedList.length;

  switch (state) {
    case 'open':
      return {
        channelId: policy.channelId,
        state,
        isOpenAccess: true,
        allowedCount,
        blockedCount,
        summary: blockedCount > 0
          ? `Channel aberto com ${blockedCount} block(s) explicit(s).`
          : 'Channel open for identities authorized by the provider.',
      };
    case 'allowlist':
      return {
        channelId: policy.channelId,
        state,
        isOpenAccess: false,
        allowedCount,
        blockedCount,
        summary: `Channel restrito por allowlist com ${allowedCount} identidade(s) permitida(s).`,
      };
    case 'mixed':
      return {
        channelId: policy.channelId,
        state,
        isOpenAccess: false,
        allowedCount,
        blockedCount,
        summary: `Channel com allowlist (${allowedCount}) e blocklist (${blockedCount}) explicits.`,
      };
    case 'blocked-only':
      return {
        channelId: policy.channelId,
        state,
        isOpenAccess: false,
        allowedCount,
        blockedCount,
        summary: `Channel closed com ${blockedCount} block(s) explicit(s) e without allowlist ready.`,
      };
    default:
      return {
        channelId: policy.channelId,
        state: 'closed',
        isOpenAccess: false,
        allowedCount,
        blockedCount,
        summary: 'Channel closed until allowlist or supervised open access is configured.',
      };
  }
}

function resolvePolicyState(policy: ChannelAccessPolicy): ChannelPolicyState {
  if (policy.isOpenAccess) {
    return 'open';
  }
  if (policy.allowedList.length > 0 && policy.blockedList.length > 0) {
    return 'mixed';
  }
  if (policy.allowedList.length > 0) {
    return 'allowlist';
  }
  if (policy.blockedList.length > 0) {
    return 'blocked-only';
  }
  return 'closed';
}
