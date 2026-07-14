/**
 * Runtime budget gate for conversational / tool hot paths (not only autonomous partner).
 * Uses AgentRuntimeBudgetEnforcementService with per-session usage tracking.
 */

import type { ZavorthAutonomyBudget } from '../contracts/runtime/AutonomousEngineeringPartnerContract.js';
import { AgentRuntimeBudgetEnforcementService } from './AgentRuntimeBudgetEnforcementService.js';

const MUTATION_HINT = /write|delete|remove|apply|patch|shell|exec|send|post|put|upload|install|mutate|filesystem|file_write|run_command|bash|powershell/i;

export type HotPathBudgetAuthorizeInput = {
  workspaceId?: string | null;
  sessionId?: string | null;
  userId?: string | null;
  surface?: string | null;
  toolName: string;
  isMutation?: boolean;
};

export type HotPathBudgetAuthorizeResult = {
  allowed: boolean;
  blockers: string[];
  remainingActions: number;
  missionId: string;
};

const enforcement = new AgentRuntimeBudgetEnforcementService();
const usageByMission = new Map<string, {
  actions: number;
  mutableActions: number;
  cost: number;
  durationMs: number;
  networkCalls: number;
  filesystemWrites: number;
  externalDeliveries: number;
  failures: number;
}>();

function defaultBudget(): ZavorthAutonomyBudget {
  const maxActions = Number(process.env.ZAVORTH_HOTPATH_MAX_ACTIONS || 200);
  const maxMutable = Number(process.env.ZAVORTH_HOTPATH_MAX_MUTABLE_ACTIONS || 80);
  const hours = Number(process.env.ZAVORTH_HOTPATH_BUDGET_HOURS || 12);
  return {
    scope: 'session',
    maxActions: Number.isFinite(maxActions) ? maxActions : 200,
    maxMutableActions: Number.isFinite(maxMutable) ? maxMutable : 80,
    maxCost: Number(process.env.ZAVORTH_HOTPATH_MAX_COST || 50),
    maxDurationMs: Math.max(1, hours) * 60 * 60 * 1000,
    maxNetworkCalls: Number(process.env.ZAVORTH_HOTPATH_MAX_NETWORK || 120),
    maxFilesystemWrites: Number(process.env.ZAVORTH_HOTPATH_MAX_FS_WRITES || 80),
    maxExternalDeliveries: Number(process.env.ZAVORTH_HOTPATH_MAX_DELIVERIES || 40),
    pauseOnFailureCount: Number(process.env.ZAVORTH_HOTPATH_MAX_FAILURES || 25),
    requiresHumanReviewAboveRisk: 'high',
    expiresAt: new Date(Date.now() + Math.max(1, hours) * 60 * 60 * 1000).toISOString(),
  };
}

function missionKey(input: HotPathBudgetAuthorizeInput): { workspaceId: string; missionId: string } {
  const workspaceId = String(input.workspaceId || process.env.ZAVORTH_WORKSPACE_ID || 'local-workspace')
    .replace(/[^a-zA-Z0-9._:-]+/g, '_')
    .slice(0, 64) || 'local-workspace';
  const session = String(input.sessionId || input.userId || 'anon').replace(/[^a-zA-Z0-9._:-]+/g, '_').slice(0, 48);
  const surface = String(input.surface || 'chat').replace(/[^a-zA-Z0-9._:-]+/g, '_').slice(0, 24);
  return {
    workspaceId: workspaceId.startsWith('w') || /[a-zA-Z0-9]/.test(workspaceId[0] || '')
      ? workspaceId
      : `ws-${workspaceId}`,
    missionId: `hotpath-${surface}-${session || 'anon'}`.slice(0, 128),
  };
}

export async function authorizeHotPathToolCall(
  input: HotPathBudgetAuthorizeInput,
): Promise<HotPathBudgetAuthorizeResult> {
  const { workspaceId, missionId } = missionKey(input);
  // Identity must match AgentRuntimeBudgetEnforcementService regex.
  const safeWorkspace = /^[a-zA-Z0-9]/.test(workspaceId) ? workspaceId : `w${workspaceId}`;
  const safeMission = /^[a-zA-Z0-9]/.test(missionId) ? missionId : `m${missionId}`;
  const isMutation = input.isMutation === true || MUTATION_HINT.test(input.toolName);
  const usage = usageByMission.get(safeMission) || {
    actions: 0,
    mutableActions: 0,
    cost: 0,
    durationMs: 0,
    networkCalls: 0,
    filesystemWrites: 0,
    externalDeliveries: 0,
    failures: 0,
  };

  const decision = await enforcement.authorize({
    workspaceId: safeWorkspace.slice(0, 128),
    missionId: safeMission.slice(0, 128),
    budget: defaultBudget(),
    usage,
    requested: {
      actions: 1,
      mutableActions: isMutation ? 1 : 0,
      cost: 0.01,
      durationMs: 1_000,
      networkCalls: /web_search|http|fetch|api|browser|email|send/i.test(input.toolName) ? 1 : 0,
      filesystemWrites: isMutation && /file|write|fs|patch|edit/i.test(input.toolName) ? 1 : 0,
      externalDeliveries: /send|email|telegram|discord|slack|post/i.test(input.toolName) ? 1 : 0,
      failures: 0,
    },
    riskLevel: isMutation ? 'medium' : 'low',
  });

  if (decision.allowed) {
    usageByMission.set(safeMission, decision.usage);
  }

  return {
    allowed: decision.allowed,
    blockers: decision.blockers,
    remainingActions: decision.remaining.actions,
    missionId: safeMission,
  };
}

export function noteHotPathToolFailure(sessionId?: string | null, userId?: string | null, surface?: string | null): void {
  const { missionId } = missionKey({ toolName: 'failed', sessionId, userId, surface });
  const safeMission = /^[a-zA-Z0-9]/.test(missionId) ? missionId : `m${missionId}`;
  const usage = usageByMission.get(safeMission);
  if (!usage) return;
  usage.failures += 1;
  usageByMission.set(safeMission, usage);
}

/** Test helper */
export function __resetHotPathBudgetForTests(): void {
  usageByMission.clear();
}
