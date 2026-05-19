import {
  ZAVORTH_AGENT_CAPABILITY_ASSIMILATION_CONTRACT_VERSION,
  type ZavorthAgentCapabilityAssimilationCategory,
  type ZavorthAgentCapabilityAssimilationMatrixItem,
  type ZavorthAgentCapabilityAssimilationPolicyRequirement,
  type ZavorthAgentCapabilityAssimilationReferenceProfile,
  type ZavorthAgentCapabilityAssimilationReferenceProfileId,
  type ZavorthAgentCapabilityAssimilationRiskLevel,
  type ZavorthAgentCapabilityAssimilationSnapshot,
  type ZavorthAgentCapabilityAssimilationStatus,
} from '../contracts/ZavorthAgentCapabilityAssimilationContract.js';

type Runtime = {
  now?: () => Date;
};

type ItemInput = {
  id: string;
  category: ZavorthAgentCapabilityAssimilationCategory;
  referenceProfiles: ZavorthAgentCapabilityAssimilationReferenceProfileId[];
  observedPattern: string;
  userBenefit: string;
  riskLevel: ZavorthAgentCapabilityAssimilationRiskLevel;
  riskSummary: string;
  equivalent: string;
  status: ZavorthAgentCapabilityAssimilationStatus;
  policy: ZavorthAgentCapabilityAssimilationPolicyRequirement[];
  tests: string[];
  acceptance: string[];
  nativeName: string;
  visualApproval?: boolean;
};

const REQUIRED_CATEGORIES: ZavorthAgentCapabilityAssimilationCategory[] = [
  'planning',
  'tool_orchestration',
  'subagents',
  'skills',
  'browser_device_computer',
  'memory_context',
  'error_recovery',
  'cross_surface_ux',
  'security_governance',
];

export class ZavorthAgentCapabilityAssimilationService {
  private readonly now: () => Date;

  public constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildSnapshot(): ZavorthAgentCapabilityAssimilationSnapshot {
    const referenceProfiles = buildReferenceProfiles();
    const matrix = buildMatrix();
    const summary = summarize(matrix);
    const blocked = matrix.some((item) => item.status === 'rejected' && item.risk.level !== 'forbidden');
    const attention = summary.planned > 0 || summary.partial > 0;

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_AGENT_CAPABILITY_ASSIMILATION_CONTRACT_VERSION,
      source: 'ZavorthAgentCapabilityAssimilationService',
      phase: 'checkpoint-1-capability-assimilation-matrix',
      status: blocked ? 'blocked' : attention ? 'attention' : 'passed',
      referenceProfiles,
      matrix,
      summary,
      guarantees: {
        zavorthNativeIdentity: true,
        noExternalProductNamesInPublicCore: true,
        noExternalSourceCodeCopied: true,
        noExternalPromptsCopied: true,
        noRawChainOfThoughtPolicy: true,
        policyBrokerRequiredForRisk: true,
        dashboardVisualChangesRequireOwnerApproval: true,
        importedCapabilitiesRemainGoverned: true,
      },
      commands: {
        report: 'npx tsx scripts/zavorth-agent-capability-assimilation.ts',
        json: 'npx tsx scripts/zavorth-agent-capability-assimilation.ts --json',
        check: 'node scripts/zavorth-agent-capability-assimilation-check.mjs',
        nextStage: 'Preview engine - Reasoning And Action Patterns',
      },
      narrative: {
        headline: 'Agent capability assimilation matrix ready',
        operatorSummary: 'Zavorth now has a governed map for studying external agent patterns without copying identity, source code, prompts or unsafe behavior.',
        nextStep: 'Implement Preview engine by turning approved reasoning/action patterns into compact plans, evidence, blocked actions, receipts and recovery policy.',
      },
    };
  }

  public formatSnapshotText(snapshot: ZavorthAgentCapabilityAssimilationSnapshot = this.buildSnapshot()): string {
    const lines = [
      'Zavorth Agent Capability Assimilation - Intent model',
      '',
      `Status: ${snapshot.status}`,
      `Items: ${snapshot.summary.items} | assimilated=${snapshot.summary.assimilated} | partial=${snapshot.summary.partial} | planned=${snapshot.summary.planned} | rejected=${snapshot.summary.rejected}`,
      `Categories: ${snapshot.summary.categoriesCovered}/${REQUIRED_CATEGORIES.length}`,
      '',
      'Reference profiles:',
      ...snapshot.referenceProfiles.map((profile) => `- ${profile.label}: ${profile.publicDescription}`),
      '',
      'Matrix:',
      ...snapshot.matrix.map((item) => `- ${item.publicNaming.zavorthNativeName}: ${item.status} | ${item.zavorthNativeEquivalent}`),
      '',
      'Guarantees:',
      '- Zavorth-native naming only in public core.',
      '- Pattern assimilation only; no source code or prompt copy.',
      '- Risky actions require Policy Broker, approval, receipts and redaction as applicable.',
      '',
      `Next: ${snapshot.commands.nextStage}`,
    ];
    return lines.join('\n');
  }
}

function buildReferenceProfiles(): ZavorthAgentCapabilityAssimilationReferenceProfile[] {
  return [
    profile(
      'cautious-code-review-agent',
      'Cautious code-review agent',
      'Studies careful planning, side-effect scanning and verification-first behavior.',
      ['short plans before action', 'side-effect awareness', 'test-oriented closure'],
    ),
    profile(
      'multi-surface-tool-agent',
      'Multi-surface tool agent',
      'Studies fluid movement across browser, terminal, desktop, device and artifacts.',
      ['tool selection timing', 'visual confirmation', 'multi-surface recovery'],
    ),
    profile(
      'pragmatic-coding-harness',
      'Pragmatic coding harness',
      'Studies fast tool execution, patch discipline, context compaction and task persistence.',
      ['efficient function calls', 'subagent delegation', 'large-context summarization'],
    ),
    profile(
      'channel-agent-runtime',
      'Channel agent runtime',
      'Studies practical chat/channel UX, commands, subagents and large skill libraries.',
      ['slash command ergonomics', 'rich channel responses', 'skill-scale routing'],
    ),
  ];
}

function profile(
  id: ZavorthAgentCapabilityAssimilationReferenceProfileId,
  label: string,
  publicDescription: string,
  strengthsToStudy: string[],
): ZavorthAgentCapabilityAssimilationReferenceProfile {
  return {
    id,
    label,
    publicDescription,
    strengthsToStudy,
    neverCopy: [
      'brand identity',
      'source code',
      'private prompts',
      'unsafe default permissions',
    ],
  };
}

function buildMatrix(): ZavorthAgentCapabilityAssimilationMatrixItem[] {
  return [
    item({
      id: 'compact-plan-before-action',
      category: 'planning',
      referenceProfiles: ['cautious-code-review-agent', 'pragmatic-coding-harness'],
      observedPattern: 'Plan briefly, identify blast radius, then act with scoped changes.',
      userBenefit: 'The user sees what will happen without being buried in hidden reasoning.',
      riskLevel: 'medium',
      riskSummary: 'Over-sharing raw reasoning can leak sensitive context or create brittle behavior.',
      equivalent: 'Compact plan, evidence, action, blocked action and receipt blocks.',
      status: 'partial',
      policy: ['no-raw-chain-of-thought', 'receipt', 'policy-broker'],
      tests: ['reasoning pattern renderer', 'no raw chain-of-thought scan', 'approval transition test'],
      acceptance: ['plan is short', 'raw hidden reasoning is never serialized', 'receipts explain decisions'],
      nativeName: 'Compact Governed Plan',
    }),
    item({
      id: 'side-effect-scan',
      category: 'planning',
      referenceProfiles: ['cautious-code-review-agent'],
      observedPattern: 'Read adjacent context and anticipate impacted modules before editing.',
      userBenefit: 'Fewer regressions and fewer surprise breakages.',
      riskLevel: 'low',
      riskSummary: 'May spend more time reading than needed on trivial tasks.',
      equivalent: 'Blast-radius scanner tied to runtime checks and targeted tests.',
      status: 'planned',
      policy: ['workspace-boundary', 'receipt'],
      tests: ['adjacent-file detection fixture', 'targeted test suggestion fixture'],
      acceptance: ['shared modules are detected', 'unrelated refactors are not proposed'],
      nativeName: 'Blast Radius Reader',
    }),
    item({
      id: 'natural-tool-selection',
      category: 'tool_orchestration',
      referenceProfiles: ['multi-surface-tool-agent', 'pragmatic-coding-harness'],
      observedPattern: 'Choose browser, files, terminal, device or subagents from natural language.',
      userBenefit: 'The user asks for outcomes instead of memorizing tools.',
      riskLevel: 'high',
      riskSummary: 'Wrong tool choice can mutate host state or leak data.',
      equivalent: 'Natural invocation routers with Policy Broker, approval and setup fallbacks.',
      status: 'partial',
      policy: ['policy-broker', 'approval', 'receipt', 'workspace-boundary'],
      tests: ['natural browser routing', 'natural device routing', 'mutation requires approval'],
      acceptance: ['read-only tools run when ready', 'mutating tools stop at approval', 'missing tools return setup hints'],
      nativeName: 'Natural Tool Router',
    }),
    item({
      id: 'subagents-on-demand',
      category: 'subagents',
      referenceProfiles: ['pragmatic-coding-harness', 'channel-agent-runtime'],
      observedPattern: 'Spawn, wait, read, summarize and cancel workers when the task benefits from delegation.',
      userBenefit: 'Complex tasks can be split while the main agent stays coherent.',
      riskLevel: 'high',
      riskSummary: 'Unbounded worker trees can waste cost, loop forever or bypass policy.',
      equivalent: 'ZavorthSubagentRuntimeService with budgets, parent-child tree and receipts.',
      status: 'assimilated',
      policy: ['policy-broker', 'approval', 'receipt'],
      tests: ['spawn/wait/read/summarize/cancel', 'spawn depth limit', 'worker budget limit'],
      acceptance: ['explicit subagent requests create governed workers', 'workers cannot mutate without approval'],
      nativeName: 'Governed Subagent Runtime',
    }),
    item({
      id: 'large-skill-library-intake',
      category: 'skills',
      referenceProfiles: ['channel-agent-runtime'],
      observedPattern: 'Discover, batch and route large libraries of reusable skills.',
      userBenefit: 'Zavorth gains breadth without losing governance.',
      riskLevel: 'high',
      riskSummary: 'Skills can contain hostile instructions, unsafe scripts or license risk.',
      equivalent: 'Universal skill intake, chunked absorption, quarantine and bridge dry-run.',
      status: 'assimilated',
      policy: ['untrusted-content', 'no-upstream-code-copy', 'approval', 'receipt'],
      tests: ['hostile skill quarantine', 'large library chunking', 'approved materialization only'],
      acceptance: ['imported skills are instructions by default', 'scripts never become tools automatically'],
      nativeName: 'Universal Skill Intake',
    }),
    item({
      id: 'browser-computer-device-perception',
      category: 'browser_device_computer',
      referenceProfiles: ['multi-surface-tool-agent', 'pragmatic-coding-harness'],
      observedPattern: 'Use browser, desktop observation and connected device evidence when the task needs seeing.',
      userBenefit: 'The agent can verify real state instead of guessing.',
      riskLevel: 'high',
      riskSummary: 'Visual or device control can expose secrets or mutate sensitive UI.',
      equivalent: 'Vision, Browser Vision, Computer Control and Android ADB planes with read-only defaults.',
      status: 'partial',
      policy: ['policy-broker', 'approval', 'redaction', 'egress-guard', 'receipt'],
      tests: ['SSRF blocked', 'ADB read-only live observe', 'terminal automation blocked', 'secret redaction'],
      acceptance: ['read-only observation is allowed when configured', 'click/type/tap require approval'],
      nativeName: 'Perception Control Plane',
    }),
    item({
      id: 'context-compaction-continuity',
      category: 'memory_context',
      referenceProfiles: ['cautious-code-review-agent', 'pragmatic-coding-harness'],
      observedPattern: 'Compact large context and preserve task continuity across long sessions.',
      userBenefit: 'Long work stays coherent without forcing the user to repeat everything.',
      riskLevel: 'medium',
      riskSummary: 'Bad summaries can turn guesses into false facts.',
      equivalent: 'Hot/warm/cold memory with fact-vs-inference separation and resumable checkpoints.',
      status: 'partial',
      policy: ['receipt', 'redaction', 'untrusted-content'],
      tests: ['summary preserves facts', 'inference labels retained', 'secret-bearing memory redacted'],
      acceptance: ['summaries cite source state', 'unknowns remain unknown'],
      nativeName: 'Continuity Memory Engine',
    }),
    item({
      id: 'recover-from-tool-errors',
      category: 'error_recovery',
      referenceProfiles: ['multi-surface-tool-agent', 'pragmatic-coding-harness'],
      observedPattern: 'When a tool fails, retry safely, switch approach or ask for missing setup.',
      userBenefit: 'Failures become useful next steps instead of dead ends.',
      riskLevel: 'medium',
      riskSummary: 'Blind retries can repeat unsafe actions or hide the real problem.',
      equivalent: 'Tool failure classifier with bounded retry, fallback and setup guidance.',
      status: 'planned',
      policy: ['policy-broker', 'receipt'],
      tests: ['retry budget fixture', 'fallback fixture', 'ask-user fixture'],
      acceptance: ['no infinite retries', 'mutation failure does not auto-escalate'],
      nativeName: 'Bounded Recovery Policy',
    }),
    item({
      id: 'rich-cross-surface-commands',
      category: 'cross_surface_ux',
      referenceProfiles: ['channel-agent-runtime', 'multi-surface-tool-agent'],
      observedPattern: 'Expose equivalent actions across CLI, web and messaging channels with rich fallbacks.',
      userBenefit: 'No channel feels second-class.',
      riskLevel: 'medium',
      riskSummary: 'A channel-specific feature can accidentally bypass central policy.',
      equivalent: 'Shared Surface Response contract and Channel Mesh actions.',
      status: 'partial',
      policy: ['policy-broker', 'approval', 'receipt'],
      tests: ['telegram buttons', 'discord components', 'text fallback', 'CLI dense table'],
      acceptance: ['same action has equivalent semantics on every channel', 'dashboard visuals require owner approval'],
      nativeName: 'Shared Surface UX',
      visualApproval: true,
    }),
    item({
      id: 'approval-and-receipt-governance',
      category: 'security_governance',
      referenceProfiles: ['cautious-code-review-agent', 'channel-agent-runtime', 'pragmatic-coding-harness'],
      observedPattern: 'Separate allowed work, approval-required work and denied work.',
      userBenefit: 'The user keeps control without losing agent autonomy for safe work.',
      riskLevel: 'high',
      riskSummary: 'Missing policy checks can turn convenience into unsafe autonomy.',
      equivalent: 'SecurityPolicyBroker decisions, approvals, signed receipts and data lifecycle rules.',
      status: 'assimilated',
      policy: ['policy-broker', 'approval', 'receipt', 'redaction'],
      tests: ['approval required for mutation', 'denial receipt', 'raw secret blocked'],
      acceptance: ['no sensitive action runs without policy decision', 'receipts are legible'],
      nativeName: 'Trust Plane Governance',
    }),
    item({
      id: 'raw-reasoning-copy',
      category: 'security_governance',
      referenceProfiles: ['cautious-code-review-agent'],
      observedPattern: 'Expose complete hidden reasoning as product output.',
      userBenefit: 'None in Zavorth; concise explanations and evidence are safer.',
      riskLevel: 'forbidden',
      riskSummary: 'Raw reasoning can leak sensitive context and encourage prompt dependence.',
      equivalent: 'Rejected; Zavorth uses concise plan/evidence/inference/receipt summaries instead.',
      status: 'rejected',
      policy: ['no-raw-chain-of-thought'],
      tests: ['raw reasoning serialization guard'],
      acceptance: ['raw chain-of-thought is not emitted'],
      nativeName: 'Raw Reasoning Rejection',
    }),
  ];
}

function item(input: ItemInput): ZavorthAgentCapabilityAssimilationMatrixItem {
  return {
    id: input.id,
    category: input.category,
    referenceProfiles: input.referenceProfiles,
    observedPattern: input.observedPattern,
    userBenefit: input.userBenefit,
    risk: {
      level: input.riskLevel,
      summary: input.riskSummary,
    },
    zavorthNativeEquivalent: input.equivalent,
    status: input.status,
    policyRequirements: input.policy,
    testsRequired: input.tests,
    acceptanceCriteria: input.acceptance,
    publicNaming: {
      usesExternalProductName: false,
      zavorthNativeName: input.nativeName,
    },
    implementationBoundary: {
      copyExternalCode: false,
      copyExternalPrompts: false,
      absorbPatternOnly: true,
      requiresOwnerApprovalForVisualChange: input.visualApproval === true,
    },
  };
}

function summarize(matrix: ZavorthAgentCapabilityAssimilationMatrixItem[]): ZavorthAgentCapabilityAssimilationSnapshot['summary'] {
  const categories = new Set(matrix.map((item) => item.category));
  return {
    items: matrix.length,
    assimilated: countStatus(matrix, 'assimilated'),
    partial: countStatus(matrix, 'partial'),
    planned: countStatus(matrix, 'planned'),
    rejected: countStatus(matrix, 'rejected'),
    categoriesCovered: REQUIRED_CATEGORIES.filter((category) => categories.has(category)).length,
    highRiskItems: matrix.filter((item) => item.risk.level === 'high').length,
    forbiddenItems: matrix.filter((item) => item.risk.level === 'forbidden').length,
    visualApprovalItems: matrix.filter((item) => item.implementationBoundary.requiresOwnerApprovalForVisualChange).length,
    externalProductNamesInPublicCore: 0,
  };
}

function countStatus(
  matrix: ZavorthAgentCapabilityAssimilationMatrixItem[],
  status: ZavorthAgentCapabilityAssimilationStatus,
): number {
  return matrix.filter((item) => item.status === status).length;
}
