import {
  ZAVORTH_SURFACE_AGENT_CONTRACT_VERSION,
  ZAVORTH_SURFACE_AGENT_GATES,
  ZAVORTH_SURFACE_AGENT_CANONICAL_PLATFORMS,
  normalizeSurfaceAgentPlatform,
  type SurfaceAgentContractEvaluation,
  type SurfaceAgentPlatformId,
  type SurfaceAgentRoutingDecision,
  type SurfaceHighRiskGateDecision,
  type SurfaceSkillInstallGateDecision,
} from '../../contracts/surface/SurfaceAgentContract.js';
import {
  isSurfaceAgentFirstEnabled,
  shouldPassNaturalTextToAgent,
} from '../../domain/surface/presentation/shared-surface/SurfaceAgentFirstMode.js';
import { HighRiskConfirmationService } from '../HighRiskConfirmationService.js';
import type { HighRiskTask } from '../HighRiskConfirmationService.js';

export type SurfaceAgentRouteInput = {
  platform?: string | null;
  rawText?: string | null;
  hasParsedSlashCommand?: boolean;
  isCallback?: boolean;
  isHighRiskChallengeReply?: boolean;
  env?: NodeJS.ProcessEnv;
};

export type SurfaceHighRiskInput = {
  task?: HighRiskTask | null;
  providedCode?: string | null;
  /** When true, caller already has a durable approval grant (surface-agnostic). */
  approvalGranted?: boolean;
  env?: NodeJS.ProcessEnv;
};

export type SurfaceSkillInstallInput = {
  mode: 'preview' | 'apply';
  consent?: boolean;
  force?: boolean;
  env?: NodeJS.ProcessEnv;
};

export type SurfaceAgentContractServiceRuntime = {
  highRisk?: HighRiskConfirmationService;
  now?: () => Date;
};

function isForceAllowed(env: NodeJS.ProcessEnv): boolean {
  const v = String(env.ZAVORTH_SKILL_ALLOW_FORCE || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

function isOperatorMode(env: NodeJS.ProcessEnv): boolean {
  const v = String(env.ZAVORTH_SKILL_OPERATOR_MODE || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

export class SurfaceAgentContractService {
  private readonly highRisk: HighRiskConfirmationService;

  constructor(runtime: SurfaceAgentContractServiceRuntime = {}) {
    this.highRisk = runtime.highRisk || new HighRiskConfirmationService();
  }

  public listCanonicalPlatforms(): SurfaceAgentPlatformId[] {
    return [...ZAVORTH_SURFACE_AGENT_CANONICAL_PLATFORMS];
  }

  public routeFreeText(input: SurfaceAgentRouteInput): SurfaceAgentRoutingDecision {
    const env = input.env || process.env;
    const platform = normalizeSurfaceAgentPlatform(input.platform);
    const agentFirstEnabled = isSurfaceAgentFirstEnabled(platform, env);
    const text = String(input.rawText || '').trim();

    if (input.isHighRiskChallengeReply) {
      return {
        kind: 'high_risk_challenge_reply',
        platform,
        agentFirstEnabled,
        reason: 'High-risk challenge reply is consumed before agent free-text routing',
      };
    }

    if (input.isCallback) {
      return {
        kind: 'callback',
        platform,
        agentFirstEnabled,
        reason: 'Inline/callback actions stay deterministic (approve/reject/etc.)',
      };
    }

    if (input.hasParsedSlashCommand || text.startsWith('/')) {
      return {
        kind: 'deterministic_slash',
        platform,
        agentFirstEnabled,
        reason: 'Slash commands are deterministic on every surface',
      };
    }

    if (!text) {
      return {
        kind: 'blocked',
        platform,
        agentFirstEnabled,
        reason: 'Empty text is not routed to the agent',
      };
    }

    if (
      shouldPassNaturalTextToAgent(
        {
          platform,
          rawText: text,
          hasParsedSlashCommand: Boolean(input.hasParsedSlashCommand),
        },
        env,
      )
    ) {
      return {
        kind: 'pass_to_agent',
        platform,
        agentFirstEnabled,
        reason: 'Agent-first free text (surface-agnostic default)',
      };
    }

    return {
      kind: 'parse_only',
      platform,
      agentFirstEnabled,
      reason: 'Agent-first disabled for this surface (kill switch)',
    };
  }

  public evaluateHighRisk(input: SurfaceHighRiskInput = {}): SurfaceHighRiskGateDecision {
    const env = input.env || process.env;
    const task = input.task ?? null;
    const required = this.highRisk.requiresPin(task);
    const totpConfigured = false;
    const approvalGranted = input.approvalGranted === true;

    if (!required) {
      return {
        required: false,
        totpConfigured,
        canAutoApprove: false,
        approvalRequired: false,
        receiptRequired: true,
        reason: 'Task is not high-risk',
      };
    }

    if (approvalGranted) {
      const gate = this.highRisk.assertApprovalGate({
        task,
        approvalGranted: true,
        env,
      });
      return {
        required: true,
        totpConfigured: false,
        canAutoApprove: false,
        approvalRequired: !gate.ok,
        receiptRequired: true,
        reason: gate.reason,
      };
    }

    return {
      required: true,
      totpConfigured: false,
      canAutoApprove: false,
      approvalRequired: true,
      receiptRequired: true,
      reason: 'High-risk requires a simple explicit Approve (one click), never auto-run',
    };
  }

  public evaluateSkillInstall(input: SurfaceSkillInstallInput): SurfaceSkillInstallGateDecision {
    const env = input.env || process.env;
    const forceRequested = input.force === true;
    const forceAllowed = forceRequested && (isForceAllowed(env) || isOperatorMode(env));
    const consentPresent = input.consent === true;

    if (input.mode === 'preview') {
      return {
        previewAllowed: true,
        applyAllowed: false,
        consentRequired: true,
        consentPresent,
        forceRequested,
        forceAllowed,
        blockedReason: null,
      };
    }

    if (!consentPresent) {
      return {
        previewAllowed: true,
        applyAllowed: false,
        consentRequired: true,
        consentPresent: false,
        forceRequested,
        forceAllowed,
        blockedReason: 'Apply blocked without consent on every surface',
      };
    }

    if (forceRequested && !forceAllowed) {
      return {
        previewAllowed: true,
        applyAllowed: false,
        consentRequired: true,
        consentPresent: true,
        forceRequested: true,
        forceAllowed: false,
        blockedReason:
          'force requires ZAVORTH_SKILL_ALLOW_FORCE=1 or ZAVORTH_SKILL_OPERATOR_MODE=1',
      };
    }

    return {
      previewAllowed: true,
      applyAllowed: true,
      consentRequired: true,
      consentPresent: true,
      forceRequested,
      forceAllowed,
      blockedReason: null,
    };
  }

  /**
   * Evaluate C1/C2/C3 for one surface interaction snapshot.
   * Missing optional slices still report gate health for that surface defaults.
   */
  public evaluate(input: {
    platform?: string | null;
    routing?: SurfaceAgentRouteInput;
    highRisk?: SurfaceHighRiskInput;
    skillInstall?: SurfaceSkillInstallInput;
    env?: NodeJS.ProcessEnv;
  }): SurfaceAgentContractEvaluation {
    const env = input.env || process.env;
    const platform = normalizeSurfaceAgentPlatform(input.platform || input.routing?.platform);
    const routing = this.routeFreeText({
      platform,
      rawText: input.routing?.rawText ?? 'hello agent',
      hasParsedSlashCommand: input.routing?.hasParsedSlashCommand,
      isCallback: input.routing?.isCallback,
      isHighRiskChallengeReply: input.routing?.isHighRiskChallengeReply,
      env,
    });
    const highRisk = this.evaluateHighRisk({ ...(input.highRisk || {}), env });
    const skillInstall = this.evaluateSkillInstall(
      input.skillInstall || { mode: 'preview', env },
    );

    const violations: string[] = [];

    const freeText = Boolean(
      String(input.routing?.rawText || '').trim() &&
        !String(input.routing?.rawText || '').startsWith('/') &&
        !input.routing?.hasParsedSlashCommand &&
        !input.routing?.isCallback &&
        !input.routing?.isHighRiskChallengeReply,
    );

    let powerOk = true;
    if (freeText && routing.agentFirstEnabled && routing.kind !== 'pass_to_agent') {
      powerOk = false;
      violations.push(`C1 free text must pass_to_agent on ${platform} when agent-first is on`);
    }
    if (input.routing?.hasParsedSlashCommand || String(input.routing?.rawText || '').startsWith('/')) {
      if (routing.kind === 'pass_to_agent') {
        powerOk = false;
        violations.push('C1 slash must not pass_to_agent');
      }
    }

    let trustOk = highRisk.canAutoApprove === false && highRisk.receiptRequired === true;
    if (highRisk.canAutoApprove) {
      violations.push('C2 high-risk must never auto-approve');
      trustOk = false;
    }
    if (highRisk.required && input.highRisk?.approvalGranted !== true && !highRisk.approvalRequired) {
      violations.push('C2 high-risk without grant must require approval');
      trustOk = false;
    }

    let extendOk = true;
    if (input.skillInstall?.mode === 'preview' && !skillInstall.previewAllowed) {
      extendOk = false;
      violations.push('C3 preview must be allowed');
    }
    if (input.skillInstall?.mode === 'apply') {
      if (input.skillInstall.consent !== true && skillInstall.applyAllowed) {
        extendOk = false;
        violations.push('C3 apply must not be allowed without consent');
      }
      if (
        input.skillInstall.force === true &&
        !skillInstall.forceAllowed &&
        skillInstall.applyAllowed
      ) {
        extendOk = false;
        violations.push('C3 force apply must not be allowed without operator gate');
      }
      if (input.skillInstall.consent === true && !input.skillInstall.force && !skillInstall.applyAllowed) {
        extendOk = false;
        violations.push('C3 apply with consent must be allowed');
      }
    }

    return {
      contractVersion: ZAVORTH_SURFACE_AGENT_CONTRACT_VERSION,
      platform,
      gates: {
        power: {
          id: ZAVORTH_SURFACE_AGENT_GATES.power,
          ok: powerOk,
          routing,
        },
        trust: {
          id: ZAVORTH_SURFACE_AGENT_GATES.trust,
          ok: trustOk,
          highRisk,
        },
        extend: {
          id: ZAVORTH_SURFACE_AGENT_GATES.extend,
          ok: extendOk,
          skillInstall,
        },
      },
      ok: violations.length === 0,
      violations,
    };
  }

  /** Parity matrix: same free-text decision shape across canonical surfaces. */
  public evaluateParityMatrix(
    rawText = 'review my workspace and list risks',
    env: NodeJS.ProcessEnv = process.env,
  ): {
    contractVersion: typeof ZAVORTH_SURFACE_AGENT_CONTRACT_VERSION;
    rawText: string;
    platforms: Array<{
      platform: SurfaceAgentPlatformId;
      routing: SurfaceAgentRoutingDecision;
      evaluation: SurfaceAgentContractEvaluation;
    }>;
    allAgentFirstAligned: boolean;
    violations: string[];
  } {
    const platforms = this.listCanonicalPlatforms().map((platform) => {
      const routing = this.routeFreeText({ platform, rawText, env });
      const evaluation = this.evaluate({
        platform,
        routing: { platform, rawText, env },
        highRisk: {
          task: {
            risk_level: 3,
            metadata: { requiresHighRiskPin: true },
          },
          env,
        },
        skillInstall: { mode: 'apply', consent: false, env },
        env,
      });
      return { platform, routing, evaluation };
    });

    const violations: string[] = [];
    const kinds = new Set(platforms.map((p) => p.routing.kind));
    if (kinds.size !== 1) {
      violations.push(
        `Free-text routing kind not uniform across surfaces: ${[...kinds].join(', ')}`,
      );
    }
    for (const row of platforms) {
      if (row.routing.kind !== 'pass_to_agent' && row.routing.agentFirstEnabled) {
        violations.push(`${row.platform}: expected pass_to_agent`);
      }
      if (row.evaluation.gates.trust.highRisk.canAutoApprove) {
        violations.push(`${row.platform}: high-risk auto-approve forbidden`);
      }
      if (row.evaluation.gates.extend.skillInstall.applyAllowed) {
        violations.push(`${row.platform}: apply without consent must be blocked`);
      }
    }

    return {
      contractVersion: ZAVORTH_SURFACE_AGENT_CONTRACT_VERSION,
      rawText,
      platforms,
      allAgentFirstAligned: violations.length === 0,
      violations,
    };
  }
}
