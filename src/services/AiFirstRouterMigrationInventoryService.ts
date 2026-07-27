export type AiFirstRouterMigrationDecision =
  | 'promote-ai-first'
  | 'keep-policy-guardrail'
  | 'keep-tool-or-action'
  | 'keep-fallback'
  | 'compatibility-only'
  | 'needs-owner-decision';

export type AiFirstRouterInventoryEntry = {
  id: string;
  label: string;
  filePath: string;
  currentRole: string;
  currentDecisionStyle:
    | 'command-switch'
    | 'regex-heuristic'
    | 'llm-assisted'
    | 'policy-guardrail'
    | 'tool-action'
    | 'transport-router'
    | 'control-plane'
    | 'deleted';
  migrationDecision: AiFirstRouterMigrationDecision;
  phaseTarget:
    | 'gate-1'
    | 'gate-2'
    | 'gate-3'
    | 'gate-4'
    | 'gate-5'
    | 'gate-7'
    | 'keep'
    | 'done';
  reason: string;
  aiFirstRole: string;
  evidence: string[];
};

export type AiFirstRouterMessagePathStep = {
  order: number;
  id: string;
  label: string;
  role: string;
};

export type AiFirstRouterMigrationInventorySnapshot = {
  generatedAt: string;
  source: 'AiFirstRouterMigrationInventoryService';
  summary: {
    totalEntries: number;
    promoteAiFirst: number;
    policyGuardrails: number;
    fallbacks: number;
    compatibilityOnly: number;
    toolOrAction: number;
    needsOwnerDecision: number;
  };
  entries: AiFirstRouterInventoryEntry[];
  currentDefaultMessagePath: AiFirstRouterMessagePathStep[];
  targetDefaultMessagePath: AiFirstRouterMessagePathStep[];
  gates: Array<{
    id: string;
    label: string;
    status: 'passed';
    detail: string;
  }>;
};

type AiFirstRouterMigrationInventoryRuntime = {
  now?: () => Date;
};

const INVENTORY_ENTRIES: AiFirstRouterInventoryEntry[] = [
  {
    id: 'telegram-command-parser',
    label: 'Telegram command parser',
    filePath: 'src/telegram/CommandParser.ts',
    currentRole: 'Transforms free text into /task and slash commands into an explicit command_type.',
    currentDecisionStyle: 'command-switch',
    migrationDecision: 'compatibility-only',
    phaseTarget: 'gate-7',
    reason:
      'Slash commands remain useful as shortcuts, but free text should not depend on them as the main brain.',
    aiFirstRole: 'Compatibility and legacy entry for users who prefer explicit commands.',
    evidence: ['text.startsWith("/")', 'command_type="/task"', 'references_last_task por includes'],
  },
  {
    id: 'legacy-intent-router',
    label: 'Legacy intent router',
    filePath: 'src/orchestrator/IntentRouter.ts',
    currentRole: 'Maps ParsedCommand to intent/target/executor via switch and registry.',
    currentDecisionStyle: 'command-switch',
    migrationDecision: 'keep-fallback',
    phaseTarget: 'gate-7',
    reason: 'Can resolve explicit commands and known routes when the AI-first router fails.',
    aiFirstRole: 'Deterministic fallback for legacy commands and explicitly declared capabilities.',
    evidence: ['switch(parsed.command_type)', 'findByCommand', 'matchImplicit always null'],
  },
  {
    id: 'capability-os-router',
    label: 'Capability OS router',
    filePath: 'src/orchestrator/IntentRouterV2.ts',
    currentRole: 'Routes text to Capability OS explainRoute.',
    currentDecisionStyle: 'control-plane',
    migrationDecision: 'keep-fallback',
    phaseTarget: 'gate-2',
    reason: 'Already centralizes routes by capability; should become a comparator in shadow mode and fallback.',
    aiFirstRole: 'Explains legacy route in parallel to the AI plan to measure divergences.',
    evidence: ['capabilityOsService.explainRoute', 'sourceSurface="intent-router-v2"'],
  },
  {
    id: 'intent-classifier',
    label: 'local intent classifier',
    filePath: 'src/cognitive-firewall/IntentClassifier.ts',
    currentRole: 'Classifies conversation, file, execution, configuration, memory, desktop and research via regex.',
    currentDecisionStyle: 'regex-heuristic',
    migrationDecision: 'promote-ai-first',
    phaseTarget: 'gate-2',
    reason: 'Should not be the default brain; keyword classification loses real natural language.',
    aiFirstRole: 'Cheap hint, regression test, and fallback when AI is unavailable.',
    evidence: ['classify()', 'full_toolset', 'model-owned-free-text'],
  },
  {
    id: 'natural-language-router',
    label: 'Natural language router',
    filePath: 'src/cognitive-firewall/NaturalLanguageRouter.ts',
    currentRole: 'Enriches free text with local category and suggested internal command.',
    currentDecisionStyle: 'regex-heuristic',
    migrationDecision: 'promote-ai-first',
    phaseTarget: 'gate-5',
    reason: 'The name is natural, but the decision still comes from the local classifier; should call the AI-first planner.',
    aiFirstRole: 'Fine adapter: receives text, calls AI-first planner and attaches legacy hints as context.',
    evidence: ['CognitiveFirewall.evaluate', 'useFastModel: false', 'legacyFallbackCommand'],
  },
  {
    id: 'tool-gatekeeper',
    label: 'Tool gatekeeper',
    filePath: 'src/cognitive-firewall/ToolGatekeeper.ts',
    currentRole: 'Reduces tools exposed to LLM by intent category.',
    currentDecisionStyle: 'policy-guardrail',
    migrationDecision: 'keep-policy-guardrail',
    phaseTarget: 'gate-3',
    reason: 'Should not choose user objectives, but is useful as a suggestion and exposure limit.',
    aiFirstRole: 'Policy/hint: validates the AI plan and reduces tools without becoming the final semantic authority.',
    evidence: ['DEFAULT_INTENT_TOOL_MAP', 'toolExposureGatedByCognitiveFirewall=false', 'isHardGate=false'],
  },
  {
    id: 'surface-operational-intent',
    label: 'Surface operational intent',
    filePath: 'src/services/SurfaceOperationalIntentService.ts',
    currentRole: 'Decides conversation vs operation via structural signals and optional semantic classifier.',
    currentDecisionStyle: 'llm-assisted',
    migrationDecision: 'promote-ai-first',
    phaseTarget: 'gate-2',
    reason: 'Has a semantic port; should become the first shadow mode point before the default.',
    aiFirstRole: 'Comparator and then official bridge between natural message, AI plan and response decision.',
    evidence: ['classifyWithSemantic', 'LlmRuntimeService.chat', 'toResponseDecision'],
  },
  {
    id: 'universal-intent-service',
    label: 'Universal intent service',
    filePath: 'src/runtime/uni/UniversalIntentService.ts',
    currentRole: 'Combines safety, clarification, permission, trust slider and narrative.',
    currentDecisionStyle: 'policy-guardrail',
    migrationDecision: 'keep-policy-guardrail',
    phaseTarget: 'gate-3',
    reason:
      'This layer must remain deterministic: AI proposes, UniversalIntent decides whether to ask, approve or block.',
    aiFirstRole: 'Policy owner for risk, permission, user abstraction and safe next action.',
    evidence: ['IntentSafetyClassifier', 'ConversationalPermissionService', 'TrustSliderPolicyService'],
  },
  {
    id: 'intent-safety-classifier',
    label: 'Intent safety classifier',
    filePath: 'src/runtime/uni/IntentSafetyClassifier.ts',
    currentRole: 'Infers risk and side effects from tools, signals and regex.',
    currentDecisionStyle: 'policy-guardrail',
    migrationDecision: 'keep-policy-guardrail',
    phaseTarget: 'gate-3',
    reason: 'Risk, destruction, shell and side effects need hard rules even in the AI-first world.',
    aiFirstRole: 'Deterministic validator of the AI plan; must never be replaced by model persuasion.',
    evidence: ['mutation', 'shell', 'externalSideEffect', 'destructive', 'operatorRequired'],
  },
  {
    id: 'universal-agent-request-heuristics',
    label: 'Universal agent request heuristics',
    filePath: 'src/runtime/agent/UniversalAgentRequestHeuristics.ts',
    currentRole: 'Infers requested tools from text patterns.',
    currentDecisionStyle: 'regex-heuristic',
    migrationDecision: 'promote-ai-first',
    phaseTarget: 'gate-2',
    reason: 'Tools must come from the validated AI plan, not isolated words.',
    aiFirstRole: 'Auxiliary signal and fallback for divergence audit.',
    evidence: ['inferUniversalAgentRequestedTools', 'addIfMatches', 'fallbackTool'],
  },
  {
    id: 'natural-capability-discovery',
    label: 'Natural capability discovery',
    filePath: 'src/runtime/agent/NaturalCapabilityDiscoveryService.ts',
    currentRole: 'Discovers capabilities and tools through semantic language understanding.',
    currentDecisionStyle: 'regex-heuristic',
    migrationDecision: 'promote-ai-first',
    phaseTarget: 'gate-2',
    reason: 'Must become a catalog consulted by AI, not the main regex router.',
    aiFirstRole: 'Provides catalog, risks, and alternatives so the AI-first planner can build a plan.',
    evidence: ['CATEGORY_PATTERNS', 'NaturalCapabilityDiscoveryRecommendation', 'toolHintProfile'],
  },
  {
    id: 'universal-preview-mode',
    label: 'Universal preview mode',
    filePath: 'src/runtime/agent/UniversalPreviewModeService.ts',
    currentRole: 'Transforms exposed tools into a preview-first plan without executing.',
    currentDecisionStyle: 'policy-guardrail',
    migrationDecision: 'keep-policy-guardrail',
    phaseTarget: 'gate-3',
    reason: 'Preview and receipt are central guardrails for governed execution.',
    aiFirstRole: 'Converts the approved AI plan into a human preview before any mutation.',
    evidence: ['noExecutionPerformed=true', 'naturalLanguageDoesNotBypassPolicy=true', 'executorBlockedInPreviewMode'],
  },
  {
    id: 'agent-run-service',
    label: 'Agent run service',
    filePath: 'src/runtime/agent/AgentRunService.ts',
    currentRole: 'Composes universal execution, approvals, preview, tools, LLM runtime and fallbacks.',
    currentDecisionStyle: 'control-plane',
    migrationDecision: 'keep-tool-or-action',
    phaseTarget: 'gate-4',
    reason: 'Must execute approved plans, not decide the main meaning of the request by itself.',
    aiFirstRole: 'Governed executor for normalized AI-first plans.',
    evidence: ['ToolExposurePolicy', 'UniversalPreviewModeService', 'AgentRunLlmRuntimeExecutor'],
  },
  {
    id: 'skill-router',
    label: 'Skill router',
    filePath: 'src/skills/SkillRouter.ts',
    currentRole: 'Selects skills via strong heuristics and LLM when necessary.',
    currentDecisionStyle: 'llm-assisted',
    migrationDecision: 'promote-ai-first',
    phaseTarget: 'gate-5',
    reason: 'Already uses LLM, but still allows strong heuristics to win before the model.',
    aiFirstRole: 'Skill selection becomes a sub-decision inside the AI plan; heuristics remain fallback only.',
    evidence: ['routeWithHeuristics', 'routeWithLlm', 'mergeSelections'],
  },
  {
    id: 'evidence-search-router',
    label: 'Evidence search router',
    filePath: 'src/agents/EvidenceSearchRouter.ts',
    currentRole: 'Decides when to search external evidence by domain, currency and risk.',
    currentDecisionStyle: 'regex-heuristic',
    migrationDecision: 'keep-policy-guardrail',
    phaseTarget: 'gate-3',
    reason: 'Evidence rules and sensitive domains must remain mandatory; AI may propose additional searches.',
    aiFirstRole: 'Minimum evidence policy for current, high-stakes or source-requiring questions.',
    evidence: ['isHighStakesDomain', 'currentMarker', 'explicitSearchIntent', 'buildContextGuidance'],
  },
  {
    id: 'natural-channel-setup-turn',
    label: 'Natural channel setup turn',
    filePath: 'src/services/NaturalChannelSetupTurnService.ts',
    currentRole: 'Setup executor with structured flags and limited env key=value extraction.',
    currentDecisionStyle: 'control-plane',
    migrationDecision: 'promote-ai-first',
    phaseTarget: 'gate-5',
    reason: 'Apply/doctor/test/mode no longer activate by free text; structured flags and safe secret extraction.',
    aiFirstRole: 'Extraction fallback and setup executor for the validated AI plan.',
    evidence: ['autoApply', 'autoDoctor', 'autoTest', 'input.mode', 'extractEntries'],
  },
  {
    id: 'channel-setup-assistant',
    label: 'Channel setup assistant',
    filePath: 'src/services/ChannelSetupAssistantService.ts',
    currentRole: 'Assembles setup state, applies scaffold and runs channel doctor.',
    currentDecisionStyle: 'tool-action',
    migrationDecision: 'keep-tool-or-action',
    phaseTarget: 'gate-4',
    reason: 'Is an execution/state capability, not the semantic brain.',
    aiFirstRole: 'Tool invoked by the executor after the AI plan passed policy.',
    evidence: ['buildSession', 'apply', 'runDoctor', 'resolveStatus'],
  },
  {
    id: 'natural-setup-control-plane',
    label: 'Natural setup control plane',
    filePath: 'src/services/ZavorthNaturalSetupControlPlaneService.ts',
    currentRole: 'Generates a preview-first snapshot and mutation plan for natural setup.',
    currentDecisionStyle: 'control-plane',
    migrationDecision: 'keep-policy-guardrail',
    phaseTarget: 'gate-3',
    reason: 'Must keep preview-first behavior, approval, and secret redaction.',
    aiFirstRole: 'Validation and receipt control plane for configurations proposed by AI.',
    evidence: ['previewOnly=true', 'approvalRequiredForMutation=true', 'rawIntentStored=false'],
  },
  {
    id: 'telegram-natural-capability-routing',
    label: 'Telegram natural capability routing',
    filePath: 'src/gateways/channels/telegram/TelegramNaturalCapabilityRoutingService.ts',
    currentRole: 'Removed — free text uses the agent gateway; slash owns explicit commands.',
    currentDecisionStyle: 'deleted',
    migrationDecision: 'promote-ai-first',
    phaseTarget: 'done',
    reason: 'Free-text natural capability routing was removed; agent + slash remain.',
    aiFirstRole: 'Transport adapter that sends text to the default router and respects policy decisions.',
    evidence: ['deleted-file', 'agent free text', 'slash packs'],
  },
  {
    id: 'automation-intent-service',
    label: 'Automation intent service',
    filePath: 'src/services/ZavorthAutomationIntentService.ts',
    currentRole: 'Extracts schedule, delivery, and prompt through legacy simple parsing.',
    currentDecisionStyle: 'regex-heuristic',
    migrationDecision: 'promote-ai-first',
    phaseTarget: 'gate-5',
    reason: 'Automation requests need semantic time reasoning and confirmation; keyword fallback is disabled.',
    aiFirstRole: 'Schedule validator/fallback after the AI plan identifies the automation.',
    evidence: ['extractSchedule', 'extractDelivery', 'cleanupPrompt'],
  },
  {
    id: 'shared-surface-agent-first',
    label: 'Shared surface agent-first free text',
    filePath: 'src/domain/surface/presentation/shared-surface/SurfaceAgentFirstMode.ts',
    currentRole: 'Telegram free text goes to agent; slash and callback_data stay deterministic.',
    currentDecisionStyle: 'policy-guardrail',
    migrationDecision: 'keep-policy-guardrail',
    phaseTarget: 'gate-7',
    reason: 'Free-text intent-regex packs removed; agent + slash/callback is the product path.',
    aiFirstRole: 'Gate free text to agent gateway; no phrase dictionary.',
    evidence: ['isSurfaceAgentFirstEnabled', 'shouldPassNaturalTextToAgent', 'preDispatchSharedSurfaceCommand'],
  },
  {
    id: 'provider-compatibility-classifier',
    label: 'Provider compatibility classifier',
    filePath: 'src/services/providers/catalog/ProviderCompatibilityClassifier.ts',
    currentRole: 'Classifies model routes and adapter compatibility from facts and catalogs.',
    currentDecisionStyle: 'policy-guardrail',
    migrationDecision: 'keep-policy-guardrail',
    phaseTarget: 'gate-3',
    reason: 'Runtime and credential compatibility must remain deterministic.',
    aiFirstRole: 'Validates whether an AI model/route plan can use a supported adapter.',
    evidence: ['FIRST_CLASS_PROVIDERS', 'isGateway', 'isLocal', 'isAnthropic', 'isOpenAiCompatible'],
  },
  {
    id: 'risk-classifier',
    label: 'Command risk classifier',
    filePath: 'src/orchestrator/RiskClassifier.ts',
    currentRole: 'Classifies risk for legacy commands and executors.',
    currentDecisionStyle: 'policy-guardrail',
    migrationDecision: 'keep-policy-guardrail',
    phaseTarget: 'gate-3',
    reason: 'Destructive term blocking and risk approval remain outside AI control.',
    aiFirstRole: 'Legacy guardrail for slash commands and older routes.',
    evidence: ['DANGEROUS_TERMS', 'requires_approval', 'risk_level'],
  },
  {
    id: 'shell-safety-classifier',
    label: 'Shell safety classifier',
    filePath: 'src/services/ShellSafetyClassifier.ts',
    currentRole: 'Classifies shell commands by dangerous patterns, cwd and approval.',
    currentDecisionStyle: 'policy-guardrail',
    migrationDecision: 'keep-policy-guardrail',
    phaseTarget: 'gate-3',
    reason: 'Shell should remain governed by hard rules before any execution.',
    aiFirstRole: 'Mandatory validator for any AI plan that requests the terminal.',
    evidence: ['DANGEROUS_PATTERNS', 'ATTENTION_PATTERNS', 'cwdAllowed', 'approvalRequired'],
  },
  {
    id: 'tool-exposure-policy',
    label: 'Tool exposure policy',
    filePath: 'src/runtime/agent/ToolExposurePolicy.ts',
    currentRole: 'Classifies tools by risk, approvals, and blockers.',
    currentDecisionStyle: 'policy-guardrail',
    migrationDecision: 'keep-policy-guardrail',
    phaseTarget: 'gate-3',
    reason: 'Exposed tools must be filtered by policy, not by model preference.',
    aiFirstRole: 'Central contract between the AI plan and tool execution.',
    evidence: ['DEFAULT_SAFE_TOOLS', 'DEFAULT_DANGER_TOOLS', 'requiresApproval', 'blockedTools'],
  },
  {
    id: 'fallback-router',
    label: 'Planner fallback router',
    filePath: 'src/agents/FallbackRouter.ts',
    currentRole: 'Attempts to generate a plan with redundancy and retry.',
    currentDecisionStyle: 'tool-action',
    migrationDecision: 'keep-fallback',
    phaseTarget: 'gate-4',
    reason: 'Planner retry and fallback remain useful when the AI runtime fails.',
    aiFirstRole: 'Operational fallback for transient planner failure.',
    evidence: ['planWithRedundancy', 'retries=2', 'fallback_used=true'],
  },
];

const CURRENT_DEFAULT_MESSAGE_PATH: AiFirstRouterMessagePathStep[] = [
  {
    order: 1,
    id: 'surface-input',
    label: 'Message enters through a surface',
    role: 'Web, CLI, Telegram, or another adapter receives text.',
  },
  {
    order: 2,
    id: 'surface-router',
    label: 'Surface router interprets signals',
    role: 'Each surface may have local parsing, command parsing, or its own legacy heuristics.',
  },
  {
    order: 3,
    id: 'intent-hints',
    label: 'Heuristics infer category/tools',
    role: 'Semantic classifiers generate intent and tool hints.',
  },
  {
    order: 4,
    id: 'control-plane',
    label: 'Control plane decides path',
    role: 'Response decision, capability OS, or command routing chooses a path.',
  },
  {
    order: 5,
    id: 'policy',
    label: 'Policy applies gates',
    role: 'Risk, approval, sandbox, and tool exposure reduce impact.',
  },
  {
    order: 6,
    id: 'executor',
    label: 'Executor runs or responds',
    role: 'AgentRunService, controllers, or tools execute the chosen path.',
  },
];

const TARGET_DEFAULT_MESSAGE_PATH: AiFirstRouterMessagePathStep[] = [
  {
    order: 1,
    id: 'surface-input',
    label: 'Message enters through any surface',
    role: 'Free text and explicit commands arrive in the same envelope.',
  },
  {
    order: 2,
    id: 'ai-first-plan',
    label: 'AI-first router understands and plans',
    role: 'AI interprets objective, user level, missing information, plan, and risks.',
  },
  {
    order: 3,
    id: 'normalization',
    label: 'Contract normalizes the plan',
    role: 'The plan becomes a stable schema: objective, proposed actions, tools, risks, and questions.',
  },
  {
    order: 4,
    id: 'policy',
    label: 'Policy validates the plan',
    role: 'Hard rules approve, request clarification, require approval, or block.',
  },
  {
    order: 5,
    id: 'executor',
    label: 'Governed executor acts',
    role: 'Only approved tools execute under the correct sandbox, cwd, and secret policy.',
  },
  {
    order: 6,
    id: 'receipt',
    label: 'Response and receipt',
    role: 'User receives natural language; audit receives artifact/receipt without secrets.',
  },
];

export class AiFirstRouterMigrationInventoryService {
  private readonly now: () => Date;

  constructor(runtime: AiFirstRouterMigrationInventoryRuntime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildSnapshot(): AiFirstRouterMigrationInventorySnapshot {
    const entries = INVENTORY_ENTRIES.map((entry) => ({
      ...entry,
      evidence: [...entry.evidence],
    }));
    const summary = {
      totalEntries: entries.length,
      promoteAiFirst: this.count(entries, 'promote-ai-first'),
      policyGuardrails: this.count(entries, 'keep-policy-guardrail'),
      fallbacks: this.count(entries, 'keep-fallback'),
      compatibilityOnly: this.count(entries, 'compatibility-only'),
      toolOrAction: this.count(entries, 'keep-tool-or-action'),
      needsOwnerDecision: this.count(entries, 'needs-owner-decision'),
    };

    return {
      generatedAt: this.now().toISOString(),
      source: 'AiFirstRouterMigrationInventoryService',
      summary,
      entries,
      currentDefaultMessagePath: CURRENT_DEFAULT_MESSAGE_PATH.map((step) => ({ ...step })),
      targetDefaultMessagePath: TARGET_DEFAULT_MESSAGE_PATH.map((step) => ({ ...step })),
      gates: [
        {
          id: 'gate-0-no-runtime-change',
          label: 'Without runtime change',
          status: 'passed',
          detail: 'Security contract only inventories and classifies; no existing route was changed.',
        },
        {
          id: 'gate-0-policy-preserved',
          label: 'Policy preserved',
          status: 'passed',
          detail: 'Risk, shell, tool exposure, preview, and approvals remain deterministic guardrails.',
        },
        {
          id: 'gate-0-ai-first-candidates',
          label: 'AI-first candidates identified',
          status: 'passed',
          detail: `${summary.promoteAiFirst} surfaces or routers should stop being regex/command-based decision makers.`,
        },
      ],
    };
  }

  public renderMarkdown(snapshot = this.buildSnapshot()): string {
    const lines = [
      '# Zavorth AI-First Router - Security contract Inventory',
      '',
      `Generated at: ${snapshot.generatedAt}`,
      '',
      '## Summary',
      '',
      `- Total inventoried: ${snapshot.summary.totalEntries}`,
      `- Promote to AI-first: ${snapshot.summary.promoteAiFirst}`,
      `- Keep as policy/guardrail: ${snapshot.summary.policyGuardrails}`,
      `- Keep as fallback: ${snapshot.summary.fallbacks}`,
      `- Keep as tool/action: ${snapshot.summary.toolOrAction}`,
      `- Compatibility only: ${snapshot.summary.compatibilityOnly}`,
      `- Needs owner decision: ${snapshot.summary.needsOwnerDecision}`,
      '',
      '## Current path',
      '',
      ...snapshot.currentDefaultMessagePath.map((step) => `${step.order}. ${step.label}: ${step.role}`),
      '',
      '## Target path',
      '',
      ...snapshot.targetDefaultMessagePath.map((step) => `${step.order}. ${step.label}: ${step.role}`),
      '',
      '## Inventory',
      '',
      ...snapshot.entries.map((entry) =>
        [
          `### ${entry.label}`,
          `- File: ${entry.filePath}`,
          `- Current role: ${entry.currentRole}`,
          `- Current style: ${entry.currentDecisionStyle}`,
          `- Decision: ${entry.migrationDecision}`,
          `- Target stage: ${entry.phaseTarget}`,
          `- AI-first role: ${entry.aiFirstRole}`,
          `- Reason: ${entry.reason}`,
          `- Evidence: ${entry.evidence.join('; ')}`,
          '',
        ].join('\n'),
      ),
      '## Gates',
      '',
      ...snapshot.gates.map((gate) => `- ${gate.label}: ${gate.status} ? ${gate.detail}`),
      '',
      '## Recommended Next Stage',
      '',
      'Intent model: create the AI plan contract, without executing anything yet.',
    ];

    return lines.join('\n');
  }

  private count(entries: AiFirstRouterInventoryEntry[], decision: AiFirstRouterMigrationDecision): number {
    return entries.filter((entry) => entry.migrationDecision === decision).length;
  }
}
