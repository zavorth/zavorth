import type {
  SystemOverlordActionRecord,
  SystemOverlordActionMutationRequest,
  SystemOverlordActionMutationResult,
  SystemOverlordActionRequest,
  SystemOverlordApprovalDecisionRequest,
  SystemOverlordApprovalDecisionResult,
  SystemOverlordApprovalQueueItem,
  SystemOverlordAutonomyLevel,
  SystemOverlordAutonomyLevelDescriptor,
  SystemOverlordCapability,
  SystemOverlordCapabilityDescriptor,
  SystemOverlordControlActionResult,
  SystemOverlordControlSnapshot,
  SystemOverlordExecutionProfile,
  SystemOverlordKillSwitchToggleRequest,
  SystemOverlordKillSwitchToggleResult,
  SystemOverlordProfileDescriptor,
  SystemOverlordRiskLevel,
} from '../contracts/SystemOverlordContract.js';
import { CapabilityPolicyService } from './CapabilityPolicyService.js';

import { SupervisedExecutionGatewayService } from './SupervisedExecutionGatewayService.js';

type GatewayFacade = Pick<
  SupervisedExecutionGatewayService,
  'execute' | 'listActions' | 'listAdapters' | 'recordApprovalDecision' | 'getKillSwitchState' | 'setKillSwitch' | 'cancelAction' | 'rollbackAction'
>;

const PROFILES: SystemOverlordProfileDescriptor[] = [
  {
    profile: 'safe',
    label: 'Safe',
    summary: 'Read, diagnostics, and dry-run. It is the default for regular users.',
    defaultAutonomyLevel: 1,
  },
  {
    profile: 'trusted',
    label: 'Trusted',
    summary: 'Allows patches, build/test/install in a guarded environment with approval.',
    defaultAutonomyLevel: 3,
  },
  {
    profile: 'dangerous',
    label: 'Dangerous',
    summary: 'Allows desktop, browser, tunnels, and external surfaces with strong approval.',
    defaultAutonomyLevel: 5,
  },
  {
    profile: 'owner',
    label: 'Owner',
    summary: 'Supervised maintenance mode for long and sensitive tasks.',
    defaultAutonomyLevel: 6,
  },
];

const AUTONOMY_LEVELS: SystemOverlordAutonomyLevelDescriptor[] = [
  {
    level: 1,
    label: 'diagnostic',
    summary: 'Only reads, diagnoses, and recommends next steps.',
    defaultProfile: 'safe',
    examples: ['git status', 'show context', 'explain error'],
    requiresApproval: false,
  },
  {
    level: 2,
    label: 'Repo patch',
    summary: 'Can propose and apply patches with rollback in the workspace.',
    defaultProfile: 'trusted',
    examples: ['fix TypeScript', 'edit repo file'],
    requiresApproval: true,
  },
  {
    level: 3,
    label: 'Guarded build and install',
    summary: 'Can run build/test/install in a sandbox/container when applicable.',
    defaultProfile: 'trusted',
    examples: ['npm install', 'npm run build', 'npm test'],
    requiresApproval: true,
  },
  {
    level: 4,
    label: 'Supervised host',
    summary: 'Can operate local host, WSL, Docker, and tunnels with explicit policy.',
    defaultProfile: 'trusted',
    examples: ['docker exec', 'wsl exec', 'spin up tunnel'],
    requiresApproval: true,
  },
  {
    level: 5,
    label: 'External apps and channels',
    summary: 'Can operate browser, desktop, channels, and computer vision with strong approval.',
    defaultProfile: 'dangerous',
    examples: ['control browser', 'operate desktop', 'computer use'],
    requiresApproval: true,
  },
  {
    level: 6,
    label: 'Owner supervised',
    summary: 'Mode for long supervised maintenance and auto-recovery, always audited.',
    defaultProfile: 'owner',
    examples: ['autonomous maintenance', 'Zavorth repair', 'long tasks'],
    requiresApproval: true,
  },
];

const CAPABILITY_METADATA: Record<SystemOverlordCapability, {
  label: string;
  summary: string;
  riskLevel: SystemOverlordRiskLevel;
  operatorNextStep: string;
}> = {
  'host.shell': {
    label: 'Host shell',
    summary: 'Runs diagnostic or mutable commands on the host, with policy.',
    riskLevel: 'medium',
    operatorNextStep: 'Use safe for diagnostics; mutable commands require trusted mode and approval.',
  },
  'host.files.write': {
    label: 'Filesystem write',
    summary: 'Allows creating or modifying files via supervised pipeline.',
    riskLevel: 'medium',
    operatorNextStep: 'Use patch preview, validate, and apply with rollback when possible.',
  },
  'host.install': {
    label: 'Dependency installation',
    summary: 'Installs packages or toolchains, preferring container/sandbox.',
    riskLevel: 'high',
    operatorNextStep: 'Approve explicitly and review the package/toolchain before running.',
  },
  'desktop.automation': {
    label: 'Desktop automation',
    summary: 'Operates windows, clicks, keyboard, and screenshots of local apps.',
    riskLevel: 'critical',
    operatorNextStep: 'Use only with a clear target window, strong approval, and kill switch.',
  },
  'browser.control': {
    label: 'Browser control',
    summary: 'Navigates and inspects pages; arbitrary JavaScript is restricted.',
    riskLevel: 'high',
    operatorNextStep: 'Allow navigate/inspect first; evaluate_js requires owner and opt-in.',
  },
  'docker.exec': {
    label: 'Docker exec',
    summary: 'Runs commands in a Docker runtime/container.',
    riskLevel: 'medium',
    operatorNextStep: 'Confirm the container/target before running mutable commands.',
  },
  'wsl.exec': {
    label: 'WSL exec',
    summary: 'Runs commands inside WSL distributions.',
    riskLevel: 'high',
    operatorNextStep: 'Provide the distro/target and approve execution outside the default sandbox.',
  },
  'network.tunnel': {
    label: 'Network tunnel',
    summary: 'Opens or manages tunnels and remote exposure.',
    riskLevel: 'critical',
    operatorNextStep: 'Approve only when the URL and exposure scope are clear.',
  },
  'secrets.read': {
    label: 'Secrets reading',
    summary: 'Accesses variables, credentials, or vaults.',
    riskLevel: 'critical',
    operatorNextStep: 'Prefer checking presence/health without revealing secret values.',
  },
  'node.invoke': {
    label: 'Node Mesh invoke',
    summary: 'Invokes capabilities on paired nodes.',
    riskLevel: 'high',
    operatorNextStep: 'Review node allowlist/capabilities before invoking.',
  },
  'computer_use.visual_action': {
    label: 'Computer Use visual',
    summary: 'Uses screenshot, multimodal LLM, and automation to operate UI.',
    riskLevel: 'critical',
    operatorNextStep: 'Set objective, target window, iteration limit, and strong approval.',
  },
};

const CAPABILITIES = Object.keys(CAPABILITY_METADATA) as SystemOverlordCapability[];
const RISK_RANK: Record<SystemOverlordRiskLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export class SystemOverlordControlService {
  private readonly gateway: GatewayFacade;
  private readonly policy: CapabilityPolicyService;

  constructor(options: {
    executionGatewayService?: GatewayFacade | null;
    policyService?: CapabilityPolicyService | null;
  } = {}) {
    this.gateway = options.executionGatewayService || new SupervisedExecutionGatewayService();
    this.policy = options.policyService || new CapabilityPolicyService();
  }

  public buildSnapshot(limit: number = 25): SystemOverlordControlSnapshot {
    const recentActions = this.collapseLatestActions(this.gateway.listActions(Math.max(limit * 4, 100))).slice(0, limit);
    const capabilities = this.buildCapabilities();
    const adapters = this.gateway.listAdapters();
    const approvalQueue = this.buildApprovalQueue(recentActions);
    const killSwitch = this.gateway.getKillSwitchState();
    const highestRiskLevel = this.findHighestRecentRisk(recentActions.map((action) => action.request.capability));
    const runningActions = recentActions.filter((action) => action.status === 'running').length;
    const pendingApprovals = approvalQueue.length;
    const blockedActions = recentActions.filter((action) => action.status === 'blocked').length;
    const completedActions = recentActions.filter((action) => action.status === 'completed').length;
    const failedActions = recentActions.filter((action) => action.status === 'failed').length;
    const timedOutActions = recentActions.filter((action) => action.status === 'timed_out').length;

    return {
      generatedAt: new Date().toISOString(),
      summary: {
        capabilities: capabilities.length,
        adapters: adapters.length,
        recentActions: recentActions.length,
        runningActions,
        pendingApprovals,
        blockedActions,
        completedActions,
        failedActions,
        timedOutActions,
        killSwitchActive: killSwitch.active,
        highestRiskLevel,
      },
      narrative: {
        headline: 'System Overlord supervised',
        operatorSummary: this.buildOperatorSummary({
          adapters: adapters.length,
          runningActions,
          pendingApprovals,
          blockedActions,
          failedActions,
          timedOutActions,
          killSwitchActive: killSwitch.active,
          highestRiskLevel,
        }),
      },
      profiles: PROFILES,
      autonomyLevels: AUTONOMY_LEVELS,
      capabilities,
      adapters,
      killSwitch,
      approvalQueue,
      recentActions,
    };
  }

  public async executeAction(input: SystemOverlordActionRequest): Promise<SystemOverlordControlActionResult> {
    const action = await this.gateway.execute({
      ...input,
      requestedBy: String(input.requestedBy || '').trim() || 'operator',
      surface: String(input.surface || '').trim() || 'web-overlord',
      profile: input.profile || 'safe',
      autonomyLevel: input.autonomyLevel || 1,
      approved: input.approved === true,
      dryRun: input.dryRun === true,
    });
    return {
      action,
      snapshot: this.buildSnapshot(),
    };
  }

  public listApprovals(limit: number = 25): SystemOverlordApprovalQueueItem[] {
    const recentActions = this.collapseLatestActions(this.gateway.listActions(Math.max(limit * 4, 100)));
    return this.buildApprovalQueue(recentActions).slice(0, limit);
  }

  public async decideApproval(input: SystemOverlordApprovalDecisionRequest): Promise<SystemOverlordApprovalDecisionResult> {
    const actionId = String(input.actionId || '').trim();
    if (!actionId) {
      throw new Error('actionId required to decide approval.');
    }
    const latest = this.findLatestAction(actionId);
    if (!latest) {
      throw new Error('System Overlord approval not found.');
    }
    if (latest.status !== 'pending_approval') {
      throw new Error(`Approval ${actionId} is not pending; current status: ${latest.status}.`);
    }

    const requestedBy = String(input.requestedBy || '').trim() || 'operator';
    const reason = String(input.reason || '').trim() || (
      input.decision === 'approve'
        ? 'Approved in the System Overlord control plane.'
        : 'Rejected in the System Overlord control plane.'
    );

    if (input.decision === 'reject') {
      const approval = this.gateway.recordApprovalDecision({
        action: latest,
        decision: 'reject',
        requestedBy,
        reason,
      });
      return {
        approval,
        snapshot: this.buildSnapshot(),
      };
    }

    const approvedRequest: SystemOverlordActionRequest = {
      ...latest.request,
      actionId: latest.actionId,
      requestedBy,
      profile: latest.decision.requiredProfile,
      autonomyLevel: latest.decision.requiredAutonomyLevel,
      approved: true,
      dryRun: input.dryRun === true ? true : latest.request.dryRun === true,
      metadata: {
        ...(latest.request.metadata || {}),
        approvalDecision: {
          decision: 'approve',
          decidedAt: new Date().toISOString(),
          decidedBy: requestedBy,
          reason,
          previousStatus: latest.status,
          upgradedProfileFrom: latest.decision.profile,
          upgradedProfileTo: latest.decision.requiredProfile,
          upgradedAutonomyFrom: latest.decision.autonomyLevel,
          upgradedAutonomyTo: latest.decision.requiredAutonomyLevel,
        },
      },
    };
    const approval = await this.gateway.execute(approvedRequest);
    return {
      approval,
      snapshot: this.buildSnapshot(),
    };
  }

  public async setKillSwitch(input: SystemOverlordKillSwitchToggleRequest): Promise<SystemOverlordKillSwitchToggleResult> {
    const result = await this.gateway.setKillSwitch({
      active: input.active === true,
      requestedBy: String(input.requestedBy || '').trim() || 'operator',
      reason: String(input.reason || '').trim() || null,
      cancelActive: input.cancelActive === true,
    });
    return {
      killSwitch: result.killSwitch,
      affectedActions: result.affectedActions,
      snapshot: this.buildSnapshot(),
    };
  }

  public async cancelAction(input: SystemOverlordActionMutationRequest): Promise<SystemOverlordActionMutationResult> {
    const action = await this.gateway.cancelAction({
      actionId: String(input.actionId || '').trim(),
      requestedBy: String(input.requestedBy || '').trim() || 'operator',
      reason: String(input.reason || '').trim() || null,
    });
    return {
      action,
      snapshot: this.buildSnapshot(),
    };
  }

  public async rollbackAction(input: SystemOverlordActionMutationRequest): Promise<SystemOverlordActionMutationResult> {
    const action = await this.gateway.rollbackAction({
      actionId: String(input.actionId || '').trim(),
      requestedBy: String(input.requestedBy || '').trim() || 'operator',
      reason: String(input.reason || '').trim() || null,
    });
    return {
      action,
      snapshot: this.buildSnapshot(),
    };
  }

  private buildCapabilities(): SystemOverlordCapabilityDescriptor[] {
    return CAPABILITIES.map((capability) => {
      const decision = this.policy.evaluate({
        capability,
        profile: 'owner',
        autonomyLevel: 6,
        approved: true,
        dryRun: true,
      });
      const approvalDecision = this.policy.evaluate({
        capability,
        profile: decision.requiredProfile,
        autonomyLevel: decision.requiredAutonomyLevel,
        approved: false,
        dryRun: true,
      });
      const metadata = CAPABILITY_METADATA[capability];
      return {
        capability,
        label: metadata.label,
        summary: metadata.summary,
        riskLevel: metadata.riskLevel,
        requiredProfile: decision.requiredProfile,
        requiredAutonomyLevel: decision.requiredAutonomyLevel,
        runtimeTarget: decision.runtimeTarget,
        approvalRequired: approvalDecision.requiresApproval,
        operatorNextStep: metadata.operatorNextStep,
      };
    });
  }

  private buildApprovalQueue(actions: SystemOverlordActionRecord[]): SystemOverlordApprovalQueueItem[] {
    return actions
      .filter((action) => action.status === 'pending_approval')
      .map((action) => {
        const riskLevel = CAPABILITY_METADATA[action.request.capability]?.riskLevel || 'medium';
        const summary = [
          action.decision.reason,
          action.command ? `Command: ${action.command}` : '',
          action.decision.runtimeTarget ? `Runtime: ${action.decision.runtimeTarget}` : '',
        ].filter(Boolean).join(' | ');
        return {
          actionId: action.actionId,
          createdAt: action.createdAt,
          requestedBy: action.requestedBy,
          surface: action.surface,
          capability: action.request.capability,
          command: action.command,
          reason: action.decision.reason,
          blockedReason: action.decision.blockedReason || null,
          riskLevel,
          requiredProfile: action.decision.requiredProfile,
          requiredAutonomyLevel: action.decision.requiredAutonomyLevel,
          runtimeTarget: action.decision.runtimeTarget,
          preview: {
            summary,
            objective: action.request.objective || null,
            workspace: action.workspace,
            dryRun: action.request.dryRun === true,
            approvalWillUpgradeProfile: action.decision.profile !== action.decision.requiredProfile,
            approvalWillUpgradeAutonomy: action.decision.autonomyLevel !== action.decision.requiredAutonomyLevel,
          },
          action,
        };
      });
  }

  private findLatestAction(actionId: string): SystemOverlordActionRecord | null {
    const normalized = String(actionId || '').trim();
    if (!normalized) {
      return null;
    }
    return this.collapseLatestActions(this.gateway.listActions(500))
      .find((action) => action.actionId === normalized) || null;
  }

  private collapseLatestActions(actions: SystemOverlordActionRecord[]): SystemOverlordActionRecord[] {
    const seen = new Set<string>();
    const latest: SystemOverlordActionRecord[] = [];
    for (const action of actions) {
      if (!action?.actionId || seen.has(action.actionId)) {
        continue;
      }
      seen.add(action.actionId);
      latest.push(action);
    }
    return latest;
  }

  private findHighestRecentRisk(capabilities: SystemOverlordCapability[]): SystemOverlordRiskLevel | null {
    return capabilities.reduce<SystemOverlordRiskLevel | null>((highest, capability) => {
      const risk = CAPABILITY_METADATA[capability]?.riskLevel || null;
      if (!risk) {
        return highest;
      }
      if (!highest || RISK_RANK[risk] > RISK_RANK[highest]) {
        return risk;
      }
      return highest;
    }, null);
  }

  private buildOperatorSummary(input: {
    adapters: number;
    runningActions: number;
    pendingApprovals: number;
    blockedActions: number;
    failedActions: number;
    timedOutActions: number;
    killSwitchActive: boolean;
    highestRiskLevel: SystemOverlordRiskLevel | null;
  }): string {
    if (input.killSwitchActive) {
      return 'Kill switch active; new actions stay blocked until manual release.';
    }
    if (input.pendingApprovals > 0) {
      return `${input.pendingApprovals} action(s) wait for human approval before execution.`;
    }
    if (input.runningActions > 0) {
      return `There are ${input.runningActions} supervised action(s) running right now.`;
    }
    if (input.failedActions > 0 || input.blockedActions > 0) {
      return `There are ${input.failedActions} failure(s), ${input.timedOutActions} timeout(s) and ${input.blockedActions} block(s) recent for review.`;
    }
    if (input.timedOutActions > 0) {
      return `There are ${input.timedOutActions} action(s) exceeded the supervised time window and need an operator decision.`;
    }
    const risk = input.highestRiskLevel ? `; highest recent risk: ${input.highestRiskLevel}` : '';
    return `${input.adapters} supervised adapter(s) available${risk}.`;
  }
}
