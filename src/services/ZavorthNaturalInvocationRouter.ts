import {
  ZAVORTH_INVOCATION_RECEIPT_CONTRACT_VERSION,
  type ZavorthInvocationReceipt,
} from '../contracts/runtime/ZavorthInvocationReceiptContract.js';
import {
  ZavorthSubagentRuntimeService,
  type ZavorthSubagentRuntimeCommandInput,
} from '../agents/ZavorthSubagentRuntimeService.js';
import { ZavorthSubagentAutoInvocationPolicyService } from './ZavorthSubagentAutoInvocationPolicyService.js';
import crypto from 'crypto';
import {
  ZAVORTH_NATURAL_INVOCATION_CONTRACT_VERSION,
  type ZavorthNaturalInvocationAction,
  type ZavorthNaturalInvocationCandidate,
  type ZavorthNaturalInvocationPlan,
  type ZavorthNaturalInvocationStatus,
  type ZavorthNaturalInvocationSurfaceCommand,
} from '../contracts/ZavorthNaturalInvocationContract.js';

import type {
  ZavorthSubagentAutoInvocationDecision,
  ZavorthSubagentAutoInvocationTelemetry,
} from '../contracts/runtime/ZavorthSubagentAutoInvocationContract.js';
import type { ZavorthSubagentRuntimeMode } from '../contracts/runtime/ZavorthSubagentRuntimeContract.js';
import {
  decideSecurityPolicy,
  type SecurityPolicyBrokerDecision,
  type SecurityPolicyBrokerRequest,
} from '../security/SecurityPolicyBroker.js';
import type { SecurityProfileId } from '../security/SecurityProfile.js';
import { SkillLoader, type SkillMetadata } from '../skills/SkillLoader.js';
import { ZavorthPathCompactor } from '../skills/ZavorthPathCompactor.js';
import {
  UniversalSkillBridgeRuntimeService,
  type UniversalSkillBridgeRuntimeInput,
} from '../skills/UniversalSkillBridgeRuntimeService.js';


import { ZavorthSandboxLifecycleManager } from './ZavorthSandboxLifecycleManager.js';
import { ProviderFactory } from '../providers/ProviderFactory.js';
import type { ILlmProvider, ChatMessage } from '../providers/ILlmProvider.js';
import { logger } from '../logger.js';

type DecideSecurityPolicy = (
  request: SecurityPolicyBrokerRequest,
  runtime?: { now?: () => Date },
) => SecurityPolicyBrokerDecision;

type Runtime = {
  now?: () => Date;
  skillLoader?: Pick<SkillLoader, 'loadAll'>;
  subagentRuntime?: Pick<ZavorthSubagentRuntimeService, 'execute'>;
  skillBridge?: Pick<UniversalSkillBridgeRuntimeService, 'invoke'>;
  autoSubagentPolicy?: Pick<ZavorthSubagentAutoInvocationPolicyService, 'decide'>;
  sandboxLifecycleManager?: Pick<ZavorthSandboxLifecycleManager, 'plan'>;
  decidePolicy?: DecideSecurityPolicy;
};

export type ZavorthNaturalInvocationInput = {
  text: string;
  channel?: string | null;
  actorId?: string | null;
  sourcePath?: string | null;
  approvalId?: string | null;
  securityProfile?: SecurityProfileId | string | null;
  autoExecute?: boolean | null;
  autoLiveSubagents?: boolean | null;
  liveSubagents?: boolean | null;
  mockLiveSubagents?: boolean | null;
  skillCatalog?: SkillMetadata[] | null;
  agentCatalog?: string[] | null;
};

type IntentAnalysis = {
  action: ZavorthNaturalInvocationAction;
  actions: ZavorthNaturalInvocationAction[];
  confidence: number;
  skillQuery: string | null;
  sourcePath: string | null;
  mode: ZavorthSubagentRuntimeMode | null;
  roleIds: string[];
  approvalRequired: boolean;
  approvalReason: string | null;
  risky: boolean;
  autoLive: boolean;
  maxLiveWorkers: number | null;
  autoReason: string | null;
  autoTelemetry: ZavorthSubagentAutoInvocationTelemetry | null;
};

export class ZavorthNaturalInvocationRouter {
  private readonly now: () => Date;
  private readonly skillLoader: Pick<SkillLoader, 'loadAll'>;
  private readonly subagentRuntime: Pick<ZavorthSubagentRuntimeService, 'execute'>;
  private readonly skillBridge: Pick<UniversalSkillBridgeRuntimeService, 'invoke'>;
  private readonly autoSubagentPolicy: Pick<ZavorthSubagentAutoInvocationPolicyService, 'decide'>;
  private readonly sandboxLifecycleManager: Pick<ZavorthSandboxLifecycleManager, 'plan'>;
  private readonly decidePolicy: DecideSecurityPolicy;

  public constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.skillLoader = runtime.skillLoader || new SkillLoader();
    this.subagentRuntime = runtime.subagentRuntime || new ZavorthSubagentRuntimeService({
      now: this.now,
    });
    this.skillBridge = runtime.skillBridge || new UniversalSkillBridgeRuntimeService({
      now: this.now,
    });
    this.autoSubagentPolicy = runtime.autoSubagentPolicy || new ZavorthSubagentAutoInvocationPolicyService();
    this.sandboxLifecycleManager = runtime.sandboxLifecycleManager || new ZavorthSandboxLifecycleManager({
      now: this.now,
    });
    this.decidePolicy = runtime.decidePolicy || decideSecurityPolicy;
  }

  public async plan(input: ZavorthNaturalInvocationInput): Promise<ZavorthNaturalInvocationPlan> {
    const generatedAt = this.now().toISOString();
    const requestText = normalizeText(input.text);
    const channel = normalizeChannel(input.channel);
    const actorId = normalizeNullable(input.actorId);
    const baseAnalysis = await analyzeIntent({
      text: requestText,
      sourcePath: input.sourcePath,
      approvalId: input.approvalId,
    });
    const autoSubagent = this.autoSubagentPolicy.decide({
      text: requestText,
      channel,
      mode: 'default',
      allowImplicit: input.autoLiveSubagents === true,
    });
    const analysis = mergeAutoSubagentAnalysis(baseAnalysis, autoSubagent, input);
    const skills = input.skillCatalog || this.skillLoader.loadAll({ includeSupportFiles: false, quiet: true });
    const candidates = this.buildCandidates({
      analysis,
      requestText,
      skills,
      agentCatalog: input.agentCatalog || [],
    });
    const selectedSkill = this.selectSkill(candidates, skills);
    const status = resolveStatus({
      analysis,
      candidates,
      selectedSkill,
      approvalId: input.approvalId,
    });
    const policy = this.decidePolicy({
      surface: analysis.action.includes('skill') || analysis.action.includes('absorb') ? 'skill' : 'workspace',
      operation: 'natural-invocation-route',
      target: firstLine(requestText),
      profile: input.securityProfile || undefined,
      sourceTrust: 'trusted',
      risk: status === 'denied' ? 'forbidden' : status === 'approval-required' ? 'review' : 'safe',
      blocked: status === 'denied',
      userConfirmationRequired: status === 'approval-required',
      reasons: [
        `Natural invocation selected ${analysis.action}.`,
        analysis.approvalReason || 'No approval-only risk detected.',
      ],
      metadata: {
        selectedSkillName: selectedSkill?.name || null,
        channel,
        confidence: analysis.confidence,
      },
    }, { now: this.now });
    const receipt = this.buildReceipt({
      generatedAt,
      actorId,
      channel,
      action: analysis.action,
      policy,
      approvalId: normalizeNullable(input.approvalId),
      target: firstLine(requestText),
      risk: status === 'approval-required' ? 'review' : status === 'denied' ? 'forbidden' : 'safe',
    });
    const shouldExecute = input.autoExecute === true && policy.allowed;
    const subagentRuntime = shouldExecute && (analysis.action === 'spawn_subagent' || analysis.action === 'spawn_team')
      ? await this.subagentRuntime.execute(this.buildSubagentInput({
        input,
        analysis,
        requestText,
        channel,
        actorId,
      }))
      : null;
    const skillBridge = shouldExecute && analysis.action === 'use_skill' && selectedSkill
      ? await this.skillBridge.invoke(this.buildSkillBridgeInput({
        input,
        skillName: selectedSkill.name,
        requestText,
        channel,
      }))
      : null;
    const sandboxLifecycle = analysis.action === 'sandbox_lifecycle'
      ? this.sandboxLifecycleManager.plan({
        text: requestText,
        actorId,
        sourceSurface: channel,
        approvalId: input.approvalId,
        live: input.autoExecute === true,
      })
      : null;

    const availableCapabilitiesCatalogue = !selectedSkill && skills.length > 0
      ? buildAvailableCapabilitiesCatalogue(skills)
      : null;

    return {
      generatedAt,
      contractVersion: ZAVORTH_NATURAL_INVOCATION_CONTRACT_VERSION,
      source: 'ZavorthNaturalInvocationRouter',
      status,
      channel,
      actorId,
      requestText,
      primaryAction: status === 'approval-required' ? 'ask_approval' : analysis.action,
      actions: uniqueActions(status === 'approval-required' ? ['ask_approval', ...analysis.actions] : analysis.actions),
      confidence: analysis.confidence,
      candidates,
      selectedSkillName: selectedSkill?.name || null,
      selectedSubagentMode: analysis.mode,
      selectedRoleIds: analysis.roleIds,
      subagentAutoInvocation: analysis.autoTelemetry,
      sourcePath: analysis.sourcePath,
      approval: {
        required: status === 'approval-required',
        reason: status === 'approval-required' ? analysis.approvalReason || 'Approval required by policy.' : null,
        approvalId: normalizeNullable(input.approvalId),
      },
      safety: {
        policyBrokerRequired: true,
        skillContentIsUntrustedByDefault: true,
        importedSkillsAreInstructionsOnly: true,
        liveUseRequiresApproval: true,
        workspaceMutationRequiresApproval: true,
        sensitiveNetworkRequiresApproval: true,
      },
      execution: {
        subagentRuntime,
        skillBridge,
        sandboxLifecycle,
      },
      surfaceCommands: buildSurfaceCommands(),
      receipts: [receipt],
      narrative: buildNarrative({
        status,
        action: analysis.action,
        selectedSkillName: selectedSkill?.name || null,
        sourcePath: analysis.sourcePath,
      }),
      availableCapabilitiesCatalogue,
      commands: {
        invoke: 'npm run zavorth:natural-invocation -- --text "<request>"',
        invokeJson: 'npm run zavorth:natural-invocation:json -- --text "<request>"',
        check: 'npm run zavorth:natural-invocation:check --silent',
        nextStage: 'Runtime gateway - Absorption Materialization And Bridge Handoff',
      },
    };
  }

  public renderPlan(plan: ZavorthNaturalInvocationPlan): string {
    const lines = [
      'Zavorth Natural Invocation Router - Credential vault',
      '',
      `Status: ${plan.status}`,
      `Action: ${plan.primaryAction}`,
      `Confidence: ${plan.confidence}`,
      `Channel: ${plan.channel}`,
      `Skill: ${plan.selectedSkillName || 'n/d'}`,
      `Subagent mode: ${plan.selectedSubagentMode || 'n/d'} | roles=${plan.selectedRoleIds.join(', ') || 'auto'}`,
      `Auto subagents: ${plan.subagentAutoInvocation?.zavorthControl.status || 'n/d'} | ${plan.subagentAutoInvocation?.selectedBy || 'n/d'} | confidence=${plan.subagentAutoInvocation?.confidence ?? 'n/d'}`,
      `Sandbox: ${plan.execution.sandboxLifecycle?.intent || 'n/d'} | runtime=${plan.execution.sandboxLifecycle?.selectedRuntime || 'n/d'} | approval=${plan.execution.sandboxLifecycle?.approval.required ? 'required' : 'n/d'}`,
      '',
      plan.narrative.summary,
      '',
      'Commands:',
    ];
    for (const command of plan.surfaceCommands.slice(0, 12)) {
      lines.push(`- ${command.command}: ${command.description}`);
    }
    if (plan.approval.required) {
      lines.push('', `Approval required: ${plan.approval.reason || 'policy'}`);
    }
    lines.push('', `Next: ${plan.commands.nextStage}`);
    return lines.join('\n');
  }

  private buildCandidates(input: {
    analysis: IntentAnalysis;
    requestText: string;
    skills: SkillMetadata[];
    agentCatalog: string[];
  }): ZavorthNaturalInvocationCandidate[] {
    const candidates: ZavorthNaturalInvocationCandidate[] = [];
    if (input.analysis.action === 'use_skill') {
      const matches = rankSkills(input.requestText, input.skills, input.analysis.skillQuery).slice(0, 5);
      for (const match of matches) {
        candidates.push({
          id: `skill:${match.skill.name}`,
          label: match.skill.name,
          kind: 'skill',
          confidence: match.score,
          reason: match.reason,
          requiresApproval: match.skill.provenance?.imported === true,
        });
      }
    }
    if (input.analysis.action === 'spawn_subagent' || input.analysis.action === 'spawn_team') {
      candidates.push({
        id: `subagent:${input.analysis.mode || 'oneshot'}`,
        label: input.analysis.action === 'spawn_team' ? 'Governed subagent team' : 'Governed subagent',
        kind: input.analysis.action === 'spawn_team' ? 'team' : 'subagent',
        confidence: input.analysis.confidence,
        reason: input.analysis.autoReason || 'User explicitly requested subagents or parallel agents.',
        requiresApproval: input.analysis.approvalRequired,
      });
    }
    if (input.analysis.action === 'absorb_skill_preview' || input.analysis.action === 'absorb_skill_apply' || input.analysis.action === 'large_absorption') {
      candidates.push({
        id: `absorption:${input.analysis.sourcePath || 'pending-source'}`,
        label: input.analysis.sourcePath || 'Skill source',
        kind: 'absorption',
        confidence: input.analysis.confidence,
        reason: 'User requested skill absorption, import, or chunked library processing.',
        requiresApproval: input.analysis.action !== 'absorb_skill_preview',
      });
    }
    if (input.analysis.action === 'sandbox_lifecycle') {
      candidates.push({
        id: 'sandbox:lifecycle',
        label: 'Sandbox lifecycle',
        kind: 'sandbox_lifecycle',
        confidence: input.analysis.confidence,
        reason: 'User asked about Docker, gVisor, Firecracker, containers, microVMs or sandbox lifecycle.',
        requiresApproval: input.analysis.approvalRequired,
      });
    }
    if (candidates.length === 0) {
      candidates.push({
        id: 'direct:answer',
        label: 'Answer directly',
        kind: 'direct',
        confidence: input.analysis.confidence,
        reason: 'No skill or subagent invocation was required.',
        requiresApproval: false,
      });
    }
    return candidates;
  }

  private selectSkill(
    candidates: ZavorthNaturalInvocationCandidate[],
    skills: SkillMetadata[],
  ): SkillMetadata | null {
    const best = candidates
      .filter((candidate) => candidate.kind === 'skill')
      .sort((left, right) => right.confidence - left.confidence)[0];
    if (!best || best.confidence < 0.62) {
      return null;
    }
    return skills.find((skill) => `skill:${skill.name}` === best.id) || null;
  }

  private buildSubagentInput(input: {
    input: ZavorthNaturalInvocationInput;
    analysis: IntentAnalysis;
    requestText: string;
    channel: string;
    actorId: string | null;
  }): ZavorthSubagentRuntimeCommandInput {
    return {
      action: 'subagents.spawn',
      task: input.requestText,
      mode: input.analysis.mode || 'oneshot',
      roleIds: input.analysis.roleIds,
      channel: input.channel,
      actorId: input.actorId,
      approvalId: input.input.approvalId,
      explicitSubagents: true,
      live: input.analysis.autoLive === true || input.input.liveSubagents === true || input.input.mockLiveSubagents === true,
      mockLive: input.input.mockLiveSubagents === true,
      executionMode: input.input.mockLiveSubagents ? 'mock-live' : (input.analysis.autoLive || input.input.liveSubagents) ? 'live-llm' : 'governed-in-process',
      sourceSurface: 'task',
      securityProfile: input.input.securityProfile,
      maxLiveWorkers: input.analysis.maxLiveWorkers,
      autoInvocation: input.analysis.autoTelemetry,
      persistState: false,
    };
  }

  private buildSkillBridgeInput(input: {
    input: ZavorthNaturalInvocationInput;
    skillName: string;
    requestText: string;
    channel: string;
  }): UniversalSkillBridgeRuntimeInput {
    return {
      skillName: input.skillName,
      intent: input.requestText,
      mode: input.input.approvalId ? 'live' : 'dry-run',
      channel: input.channel,
      ownerApprovalId: input.input.approvalId || null,
      persistReceipt: false,
    };
  }

  private buildReceipt(input: {
    generatedAt: string;
    actorId: string | null;
    channel: string;
    action: ZavorthNaturalInvocationAction;
    policy: SecurityPolicyBrokerDecision;
    approvalId: string | null;
    target: string;
    risk: 'safe' | 'review' | 'dangerous' | 'forbidden';
  }): ZavorthInvocationReceipt {
    return {
      id: `zavorth.invocation.skill-selection.${stableId(input.generatedAt, input.target, input.action)}`,
      contractVersion: ZAVORTH_INVOCATION_RECEIPT_CONTRACT_VERSION,
      kind: 'skill-selection',
      status: input.policy.requiresUserConfirmation ? 'approval-required' : input.policy.allowed ? 'pass' : 'deny',
      generatedAt: input.generatedAt,
      actorId: input.actorId,
      channel: input.channel,
      target: input.target,
      action: input.action,
      policyBrokerReceipt: input.policy.receipt,
      approvalId: input.approvalId,
      risk: input.risk,
      reasons: input.policy.reasons,
      guarantees: {
        policyBrokerEvaluated: true,
        noSecretValuesSerialized: true,
        untrustedContentDelimited: false,
        workspaceMutationPerformed: false,
        externalIoPerformed: false,
        upstreamCodeExecuted: false,
      },
      evidence: {
        confidence: input.policy.receipt.allowed ? 1 : 0,
      },
    };
  }
}

/**
 * Free-text intent is model-owned (LLM). No keyword packs that force actions.
 * Structured fields (sourcePath, approvalId) remain deterministic.
 */
async function analyzeIntent(input: {
  text: string;
  sourcePath?: string | null;
  approvalId?: string | null;
}): Promise<IntentAnalysis> {
  const sourcePath = normalizeNullable(input.sourcePath);

  const llmResult = await classifyWithLlm(input.text);
  if (llmResult) {
    if (sourcePath && !llmResult.sourcePath) {
      return { ...llmResult, sourcePath };
    }
    return llmResult;
  }

  return base({
    action: 'answer_directly',
    confidence: 0.5,
    approvalRequired: false,
    approvalReason: null,
    risky: false,
    sourcePath,
  });
}

/**
 * LLM-based intent classification fallback.
 * Used when regex patterns don't match with high confidence.
 * Supports ALL languages including RTL (Arabic, Hebrew, etc.).
 *
 * Performance:
 * - Uses the provider configured during zavorth setup (default: aigateway)
 * - Respects ZAVORTH_INTENT_CLASSIFIER_MODEL env var for override
 * - Falls back to a lightweight model when available
 * - Prompt is ~400 tokens, response ~50 tokens = ~450 tokens total
 * - Latency: 300-800ms depending on provider
 *
 * Configuration:
 *   ZAVORTH_INTENT_CLASSIFIER_MODEL=gpt-4o-mini  (cheapest)
 *   ZAVORTH_INTENT_CLASSIFIER_MODEL=gemini-2.0-flash  (fast)
 *   ZAVORTH_INTENT_CLASSIFIER_MODEL=claude-3-haiku  (cheap)
 */
async function classifyWithLlm(text: string): Promise<IntentAnalysis | null> {
  try {
    const configuredModel = process.env.ZAVORTH_INTENT_CLASSIFIER_MODEL || '';
    const provider: ILlmProvider = ProviderFactory.create('default');
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are an intent classifier. Classify the user's message into ONE of these categories:
- "import_skill": User wants to import, absorb, or bring in skills from another source
- "use_skill": User wants to use or apply a specific skill
- "spawn_subagent": User wants to spawn or use a sub-agent
- "spawn_team": User wants multiple agents working in parallel
- "large_absorption": User wants to process a large skill library
- "sandbox_lifecycle": User wants to start/stop/manage a sandbox
- "answer_directly": Default - just answer the question

Respond with ONLY a JSON object:
{"action": "<category>", "confidence": <0.0-1.0>, "skillQuery": "<extracted skill name or null>", "sourcePath": "<extracted path or null>"}

Examples:
- "import the github skill from an external library" → {"action": "import_skill", "confidence": 0.95, "skillQuery": "github", "sourcePath": null}
- "استورد مهارة الطقس" → {"action": "import_skill", "confidence": 0.95, "skillQuery": "weather", "sourcePath": null}
- "bring in the discord skill" → {"action": "import_skill", "confidence": 0.95, "skillQuery": "discord", "sourcePath": null}
- "use the code review skill" → {"action": "use_skill", "confidence": 0.9, "skillQuery": "code review", "sourcePath": null}
- "spawn two agents to review this" → {"action": "spawn_team", "confidence": 0.9, "skillQuery": null, "sourcePath": null}
- "what is the weather today?" → {"action": "answer_directly", "confidence": 0.8, "skillQuery": null, "sourcePath": null}`,
      },
      {
        role: 'user',
        content: text,
      },
    ];
    const options = configuredModel ? { modelName: configuredModel } : undefined;
    const response = await provider.chat(messages, undefined, options);
    const content = response.content || '';
    const parsed = JSON.parse(content.match(/\{[^}]+\}/)?.[0] || '{}');
    if (!parsed.action) return null;
    const risky = /\b(write|edit|delete|remove|apply|patch|execute|shell|terminal|deploy|live)\b/i.test(text.toLowerCase());
    const sourcePath = extractPath(text) || parsed.sourcePath || null;
    return base({
      action: parsed.action as ZavorthNaturalInvocationAction,
      confidence: Math.min(parsed.confidence || 0.8, 0.85),
      skillQuery: parsed.skillQuery || null,
      sourcePath,
      approvalRequired: risky,
      approvalReason: risky ? 'LLM-classified intent involves potentially risky operations.' : null,
      risky,
    });
  } catch (error: unknown) {logger.warn('[Zavorth Natural Invocation r] parsing failed', error); return null; }
}

function base(input: {
  action: ZavorthNaturalInvocationAction;
  confidence: number;
  skillQuery?: string | null;
  sourcePath?: string | null;
  mode?: ZavorthSubagentRuntimeMode | null;
  roleIds?: string[];
  approvalRequired: boolean;
  approvalReason: string | null;
  risky: boolean;
  autoLive?: boolean;
  maxLiveWorkers?: number | null;
  autoReason?: string | null;
  autoTelemetry?: ZavorthSubagentAutoInvocationTelemetry | null;
}): IntentAnalysis {
  return {
    action: input.action,
    actions: [input.action],
    confidence: input.confidence,
    skillQuery: input.skillQuery || null,
    sourcePath: input.sourcePath || null,
    mode: input.mode || null,
    roleIds: input.roleIds || [],
    approvalRequired: input.approvalRequired,
    approvalReason: input.approvalReason,
    risky: input.risky,
    autoLive: input.autoLive === true,
    maxLiveWorkers: input.maxLiveWorkers ?? null,
    autoReason: input.autoReason || null,
    autoTelemetry: input.autoTelemetry || null,
  };
}

function mergeAutoSubagentAnalysis(
  analysis: IntentAnalysis,
  auto: ZavorthSubagentAutoInvocationDecision,
  input: ZavorthNaturalInvocationInput,
): IntentAnalysis {
  const subagentAction = analysis.action === 'spawn_subagent' || analysis.action === 'spawn_team';
  const autoLiveAllowed = input.mockLiveSubagents === true
    || input.liveSubagents === true
    || (input.autoExecute === true && input.autoLiveSubagents !== false && auto.shouldInvoke && !auto.requiresApproval);

  if (subagentAction) {
    return {
      ...analysis,
      mode: analysis.mode || auto.mode,
      roleIds: analysis.roleIds.length > 0 ? analysis.roleIds : auto.roleIds,
      autoLive: autoLiveAllowed,
      maxLiveWorkers: auto.maxLiveWorkers,
      autoReason: auto.reason,
      autoTelemetry: auto.telemetry,
    };
  }

  if (analysis.action === 'answer_directly' && auto.shouldInvoke && !auto.requiresApproval) {
    return base({
      action: auto.roleIds.length > 1 ? 'spawn_team' : 'spawn_subagent',
      confidence: Math.max(analysis.confidence, auto.confidence),
      mode: auto.mode,
      roleIds: auto.roleIds,
      approvalRequired: false,
      approvalReason: null,
      risky: false,
      autoLive: autoLiveAllowed,
      maxLiveWorkers: auto.maxLiveWorkers,
      autoReason: auto.reason,
      autoTelemetry: auto.telemetry,
    });
  }

  if (analysis.action === 'answer_directly' && auto.requiresApproval && auto.explicitSubagentRequest) {
    return base({
      action: auto.roleIds.length > 1 ? 'spawn_team' : 'spawn_subagent',
      confidence: Math.max(analysis.confidence, auto.confidence),
      mode: auto.mode,
      roleIds: auto.roleIds,
      approvalRequired: !input.approvalId,
      approvalReason: auto.reason,
      risky: true,
      autoLive: false,
      maxLiveWorkers: auto.maxLiveWorkers,
      autoReason: auto.reason,
      autoTelemetry: auto.telemetry,
    });
  }

  return analysis;
}

function resolveStatus(input: {
  analysis: IntentAnalysis;
  candidates: ZavorthNaturalInvocationCandidate[];
  selectedSkill: SkillMetadata | null;
  approvalId?: string | null;
}): ZavorthNaturalInvocationStatus {
  if (input.analysis.approvalRequired && !input.approvalId) {
    return 'approval-required';
  }
  if (input.analysis.action === 'use_skill' && !input.selectedSkill) {
    const best = input.candidates.filter((candidate) => candidate.kind === 'skill')[0];
    return best ? 'ambiguous' : 'denied';
  }
  if (input.analysis.confidence >= 0.8) {
    return 'ready';
  }
  return 'planned';
}

function rankSkills(
  text: string,
  skills: SkillMetadata[],
  query: string | null,
): Array<{ skill: SkillMetadata; score: number; reason: string }> {
  const needle = normalizeSearchText(query || text);
  return skills
    .map((skill) => {
      const haystack = normalizeSearchText([
        skill.name,
        skill.description,
        (skill.bundleTags || []).join(' '),
        skill.sourceLabel || '',
      ].join(' '));
      const nameHit = haystack.includes(normalizeSearchText(skill.name)) && needle.includes(normalizeSearchText(skill.name));
      const tokenHits = needle.split(/\s+/).filter((token) => token.length > 2 && haystack.includes(token)).length;
      const score = Math.min(0.99, (nameHit ? 0.55 : 0) + (tokenHits * 0.22) + (skill.provenance?.imported ? 0.18 : 0.04));
      return {
        skill,
        score,
        reason: nameHit ? 'Skill name matched the request.' : `${tokenHits} semantic token(s) matched.`,
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);
}

function buildSurfaceCommands(): ZavorthNaturalInvocationSurfaceCommand[] {
  return [
    command('/agents', 'Agents', 'List governed subagent sessions and runtime status.', false),
    command('/agents spawn <task>', 'Spawn agent', 'Spawn a governed read-only subagent or team when requested.', false),
    command('/agents status', 'Agent status', 'Show running, completed and approval-required subagents.', false),
    command('/subagent <task>', 'Subagent alias', 'Alias for /agents spawn with the same policy and receipts.', false),
    command('sessions_spawn', 'Tool alias', 'Tool/function alias accepted by subagents.spawn for channel and plugin runtimes.', false),
    command('/skills', 'Skills', 'List governed skills and bridge status.', false),
    command('/skills search <query>', 'Search skills', 'Find the best governed skill for a task.', false),
    command('/skills absorb <path>', 'Absorb skills', 'Preview and chunk a skill source before import.', false),
    command('/skills use <name>', 'Use skill', 'Prepare a dry-run skill bridge envelope.', false),
    command('/skills batches', 'Skill batches', 'Show large absorption batches and quarantine.', false),
    command('/sandbox', 'Sandbox', 'Route Docker, gVisor, Firecracker and sandbox lifecycle requests through policy.', false),
    command('/sandbox list', 'Sandbox inventory', 'List known sandbox resources without starting heavy runtimes.', false),
    command('/sandbox doctor', 'Sandbox doctor', 'Explain which sandbox runtimes are available on this host.', false),
    command('/invoke <request>', 'Natural invoke', 'Route a natural request to skill, subagent or direct answer.', false),
  ];
}

const MAX_AVAILABLE_CAPABILITIES = 40;
const MAX_CAPABILITY_DESCRIPTION_CHARS = 180;
const MAX_CAPABILITY_PATH_CHARS = 220;

function buildAvailableCapabilitiesCatalogue(skills: SkillMetadata[]): string {
  const visibleSkills = skills.slice(0, MAX_AVAILABLE_CAPABILITIES);
  const lines: string[] = [
    '<zavorth_available_capabilities>',
    'As habilidades governadas a seguir estao disponiveis no ecossistema do Zavorth.',
    'Use os caminhos apenas como referencia local. Leia o arquivo antes de aplicar detalhes de uma habilidade.',
    '',
  ];

  for (const skill of visibleSkills) {
    const displayPath = skill.displaySkillFilePath || ZavorthPathCompactor.compact(skill.skillFilePath);
    lines.push(`- Nome: ${escapeCatalogueText(skill.name, 80)}`);
    lines.push(`  Descricao: ${escapeCatalogueText(skill.description, MAX_CAPABILITY_DESCRIPTION_CHARS)}`);
    lines.push(`  Caminho: ${escapeCatalogueText(displayPath, MAX_CAPABILITY_PATH_CHARS)}`);
    lines.push('');
  }

  if (skills.length > visibleSkills.length) {
    lines.push(`... ${skills.length - visibleSkills.length} habilidade(s) omitidas. Use /skills search <query> to refinar.`);
  }

  lines.push('</zavorth_available_capabilities>');
  return lines.join('\n').trim();
}

function escapeCatalogueText(value: unknown, maxLength: number): string {
  const normalized = normalizeText(value, 'n/d').replace(/\s+/g, ' ');
  const truncated = normalized.length > maxLength
    ? `${normalized.slice(0, maxLength - 3)}...`
    : normalized;
  return truncated
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function command(
  commandText: string,
  label: string,
  description: string,
  requiresApproval: boolean,
): ZavorthNaturalInvocationSurfaceCommand {
  return {
    id: commandText.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase(),
    command: commandText,
    label,
    description,
    channels: ['cli', 'telegram', 'discord', 'whatsapp', 'signal', 'imessage', 'web'],
    interactiveWhenSupported: true,
    fallbackText: `${label}: ${commandText}`,
    requiresApproval,
  };
}

function inferRoles(text: string): string[] {
  const roles = ['planner'];
  if (/\b(pesquis|research|buscar|fontes)\b/i.test(text)) roles.push('researcher');
  if (/\b(revis|audit|seguran|security)\b/i.test(text)) roles.push('auditor');
  if (/\b(codigo|implementar|patch|edit|fix)\b/i.test(text)) roles.push('coder');
  if (/\b(test|qa|validar|verificar)\b/i.test(text)) roles.push('qa');
  return Array.from(new Set(roles));
}

function buildNarrative(input: {
  status: ZavorthNaturalInvocationStatus;
  action: ZavorthNaturalInvocationAction;
  selectedSkillName: string | null;
  sourcePath: string | null;
}): ZavorthNaturalInvocationPlan['narrative'] {
  const target = input.selectedSkillName || input.sourcePath || input.action;
  return {
    headline: 'Natural invocation routed',
    summary: `Router selected ${input.action} for ${target}. Status is ${input.status}.`,
    nextAction: input.status === 'approval-required'
      ? 'Collect owner approval id, then re-run the same request.'
      : input.action === 'sandbox_lifecycle'
        ? 'Follow the sandbox lifecycle plan; read-only inventory can run without starting heavy runtimes.'
      : input.action === 'large_absorption'
        ? 'Run skill absorption materialization preview before apply.'
        : 'Execute the selected route or answer directly.',
  };
}

function looksLikeSandboxLifecycleRequest(text: string): boolean {
  return /\b(docker|dockers|container|containers|gvisor|runsc|firecracker|microvm|micro-vm|sandbox|sandboxes)\b/i.test(text)
    && /\b(ligue|liga|suba|subir|start|inicie|iniciar|use|usar|rode|rodar|execute|executar|crie|criar|liste|listar|lista|mostre|mostrar|quais|todos|rodando|ligados?|ativos?|derrube|derrubar|desliga|desligue|mate|matar|limpe|cleanup|stop|pare|parar|encerre|encerrar|doctor|status|ready|readiness|inventario|inventory)\b/i.test(text);
}

function looksLikeSandboxLifecycleMutation(text: string): boolean {
  return /\b(ligue|liga|suba|subir|start|inicie|iniciar|use|usar|rode|rodar|execute|executar|crie|criar|derrube|derrubar|desliga|desligue|mate|matar|limpe|cleanup|stop|pare|parar|encerre|encerrar)\b/i.test(text);
}

function extractSkillQuery(text: string): string | null {
  const match = text.match(/skill(?:\s+para|\s+for)?\s+(.+)$/i);
  return normalizeNullable(match?.[1]) || null;
}

function extractPath(text: string): string | null {
  const match = text.match(/(?:path|pasta|fonte|source)\s*[:=]?\s*("[^"]+"|'[^']+'|\S+)/i);
  return normalizeNullable(match?.[1]?.replace(/^['"]|['"]$/g, '')) || null;
}

function normalizeSearchText(value: string): string {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value || '').trim();
  return text || fallback;
}

function normalizeNullable(value: unknown): string | null {
  const text = normalizeText(value);
  return text || null;
}

function normalizeChannel(value: unknown): string {
  return normalizeText(value, 'cli').toLowerCase().replace(/[^a-z0-9_.:-]+/g, '-') || 'cli';
}

function firstLine(value: string, maxLength = 240): string {
  const text = normalizeText(value).replace(/\s+/g, ' ');
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function uniqueActions(values: ZavorthNaturalInvocationAction[]): ZavorthNaturalInvocationAction[] {
  return Array.from(new Set(values));
}

function stableId(...parts: string[]): string {
  return crypto.createHash('sha256').update(parts.join(':')).digest('hex').slice(0, 16);
}
