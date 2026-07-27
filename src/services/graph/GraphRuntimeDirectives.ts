import type { ToolDefinition } from '../../providers/ILlmProvider.js';
import type { WorkspaceTaskKind, WorkspaceTaskSubtype } from '../WorkspaceTaskKind.js';
import type { GraphExecutionProfile, GraphRuntimeDecisionTrace } from './GraphRuntimeTypes.js';

export function toGraphRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

export function buildTaskQualityGuidance(
  taskKind: WorkspaceTaskKind,
  taskSubtype: WorkspaceTaskSubtype,
): string[] {
  if (taskKind === 'research') {
    if (taskSubtype === 'comparison') {
      return [
        '- Structure the deliverable as a clear comparison, with explicit criteria, tradeoffs, risks and final recommendation.',
        '- When there are competing options, highlight the best fit for the objective rather than just listing features.',
      ];
    }

    if (taskSubtype === 'summarization') {
      return [
        '- Deliver a short, hierarchical synthesis, opening with an executive summary and then actionable key points.',
        '- Preserve enough context for decision-making, but cut redundancy and leave uncertainties explicit when they exist.',
      ];
    }

    return [
      '- Prioritize reliable and recent sources, using absolute dates when temporal information is available.',
      '- If conflicting signals are found, make the conflict explicit and point to the most likely reading.',
    ];
  }

  if (taskKind === 'code') {
    if (taskSubtype === 'review') {
      return [
        '- Conduct review focused on concrete findings: bugs, regressions, risk and missing tests before any summary.',
      ];
    }

    if (taskSubtype === 'testing') {
      return [
        '- Prioritize objective validation: test commands, expected result and residual risk if something cannot be verified.',
      ];
    }

    if (taskSubtype === 'debugging') {
      return [
        '- Structure the response with the main hypothesis, observable evidence and the next most informative experiment.',
      ];
    }
  }

  if (taskKind === 'automation') {
    return [
      '- Organize the execution into short steps with clear checkpoints before confirming success.',
    ];
  }

  return [];
}

export function buildExecutionProfileGuidance(profile: GraphExecutionProfile): string[] {
  const lines: string[] = [];

  switch (profile.deliveryProfile) {
    case 'summary_first':
      lines.push('- Open with a short executive summary before detailing key points and next steps.');
      break;
    case 'findings_first':
      lines.push('- Start with the most important findings and leave secondary context or general summary afterwards.');
      break;
    case 'decision_brief':
      lines.push('- Deliver in decision-oriented format: final recommendation, criteria, tradeoffs and residual risk.');
      break;
    case 'checkpointed':
      lines.push('- Organize the output by checkpoints and current state before declaring final completion.');
      break;
    case 'diagnostic':
      lines.push('- Format the deliverable as a diagnosis: main hypothesis, observable evidence and next experiment.');
      break;
    case 'implementation_ready':
      lines.push('- Deliver something ready for implementation, with objective steps, expected impact and suggested validation.');
      break;
    default:
      lines.push('- Keep the deliverable direct, proportional and easy to act on.');
      break;
  }

  if (profile.toolingProfile === 'evidence_heavy') {
    lines.push('- Before concluding, use sufficient tools to gather verifiable evidence when it is available.');
    lines.push('- Do not close the response without at least one concrete check of the most relevant material for the decision.');
    return lines;
  }

  if (profile.toolingProfile === 'minimal') {
    lines.push('- Avoid extra tool rounds when the context is already sufficient for a good synthesis.');
    return lines;
  }

  if (profile.toolingProfile === 'checkpointed') {
    lines.push('- Use tools in short stages, confirming checkpoint and progress before proceeding to the next action.');
    return lines;
  }

  lines.push('- Use tools in a targeted manner, only when they improve confidence, verification or completeness.');
  return lines;
}

export function resolveToolSelectionStrategy(
  profile: GraphExecutionProfile['toolSelectionProfile'],
): { preferredToolNames: string[]; blockedToolNames: string[] } {
  switch (profile) {
    case 'research':
      return {
        preferredToolNames: [
          'web_search',
          'query_external_ai',
          'read_file',
          'list_directory',
          'get_datetime',
          'semantic_memory',
        ],
        blockedToolNames: ['create_file', 'remote_shell'],
      };
    case 'research_summary':
      return {
        preferredToolNames: [
          'read_file',
          'web_search',
          'list_directory',
          'get_datetime',
          'semantic_memory',
        ],
        blockedToolNames: ['create_file', 'remote_shell', 'run_sandbox_code'],
      };
    case 'code_readonly':
      return {
        preferredToolNames: [
          'read_file',
          'list_directory',
          'run_sandbox_code',
          'semantic_memory',
        ],
        blockedToolNames: ['create_file', 'remote_shell'],
      };
    case 'code_write':
      return {
        preferredToolNames: [
          'read_file',
          'list_directory',
          'create_file',
          'run_sandbox_code',
          'semantic_memory',
        ],
        blockedToolNames: ['remote_shell'],
      };
    case 'automation':
      return {
        preferredToolNames: [
          'remote_shell',
          'run_sandbox_code',
          'read_file',
          'list_directory',
          'create_file',
          'get_datetime',
        ],
        blockedToolNames: [],
      };
    default:
      return {
        preferredToolNames: [
          'read_file',
          'list_directory',
          'web_search',
          'run_sandbox_code',
          'semantic_memory',
        ],
        blockedToolNames: [],
      };
  }
}

export function selectToolDefinitionsForProfile(
  definitions: ToolDefinition[],
  profile: GraphExecutionProfile,
): ToolDefinition[] {
  const blocked = new Set(profile.blockedToolNames.map((name) => String(name || '').trim()));
  const preferredOrder = new Map(
    profile.preferredToolNames.map((name, index) => [String(name || '').trim(), index] as const),
  );
  const selected = definitions.filter((definition) => !blocked.has(String(definition.name || '').trim()));

  return [...selected].sort((left, right) => {
    const leftName = String(left.name || '').trim();
    const rightName = String(right.name || '').trim();
    const leftRank = preferredOrder.has(leftName) ? preferredOrder.get(leftName)! : Number.MAX_SAFE_INTEGER;
    const rightRank = preferredOrder.has(rightName) ? preferredOrder.get(rightName)! : Number.MAX_SAFE_INTEGER;

    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    return leftName.localeCompare(rightName);
  });
}

export function buildGeneratorDirectives(profile: GraphExecutionProfile): string[] {
  const directives: string[] = [];

  if (profile.skillDecision.primarySkill) {
    directives.push(
      `Use the skill @${profile.skillDecision.primarySkill.name} as the preferred workflow for this execution, adapting what is necessary to the current context.`,
    );
  }
  if (profile.preferredToolNames.length > 0) {
    directives.push(
      `Prefer these tools when you need to verify or act: ${profile.preferredToolNames.join(', ')}.`,
    );
  }
  if (profile.blockedToolNames.length > 0) {
    directives.push(
      `Do not attempt to use these tools in this task: ${profile.blockedToolNames.join(', ')}.`,
    );
  }

  switch (profile.deliveryProfile) {
    case 'summary_first':
      directives.push(
        'Open with a short executive summary before going into details.',
        'After the summary, organize the points by priority and next steps.',
      );
      break;
    case 'findings_first':
      directives.push(
        'Start with the most important concrete findings before any general summary.',
        'Do not hide risk, regression, failure or relevant gap behind introductory context.',
      );
      break;
    case 'decision_brief':
      directives.push(
        'Deliver in decision format: final recommendation, criteria used, tradeoffs and residual risk.',
        'If there are multiple options, make clear why the best option wins over the others.',
      );
      break;
    case 'checkpointed':
      directives.push(
        'Organize the output by clear checkpoints and current state before declaring the task complete.',
        'If execution spans multiple stages, make the next step explicit.',
      );
      break;
    case 'diagnostic':
      directives.push(
        'Structure as a diagnosis: main hypothesis, observable evidence and next experiment.',
      );
      break;
    case 'implementation_ready':
      directives.push(
        'Deliver something ready for execution or implementation, with objective steps, expected impact and suggested validation.',
      );
      break;
    default:
      directives.push(
        'Keep the deliverable direct, proportional and easy to act on.',
      );
      break;
  }

  return directives;
}

export function buildCriticDirectives(profile: GraphExecutionProfile): string[] {
  const directives: string[] = [];

  switch (profile.verificationProfile) {
    case 'strict':
      directives.push('Only approve when the response covers risks, impact and expected verifications without relevant ambiguities.');
      break;
    case 'evidence_required':
      directives.push('Only approve when there is sufficient concrete evidence, observable check or verifiable basis for the conclusion.');
      break;
    case 'stepwise':
      directives.push('Only approve when the checkpoints are coherent, the current state is clear and the next step is explicit.');
      break;
    default:
      directives.push('Approve when the response is clear, coherent and without relevant gaps for the objective.');
      break;
  }

  if (profile.deliveryProfile === 'findings_first') {
    directives.push('If the task is review or testing, reject responses that hide the main findings behind a generic summary.');
  } else if (profile.deliveryProfile === 'decision_brief') {
    directives.push('For comparisons, reject responses that do not end with a clear recommendation and explicit tradeoffs.');
  } else if (profile.deliveryProfile === 'checkpointed') {
    directives.push('For automation, reject responses that jump from execution to completion without a checkpoint or clear final state.');
  }

  return directives;
}

export function buildDecisionTrace(profile: GraphExecutionProfile): GraphRuntimeDecisionTrace {
  return {
    executionRoute: profile.intentDecision.executionRoute,
    taskKind: profile.intentDecision.taskKind,
    taskSubtype: profile.intentDecision.taskSubtype,
    responseStyle: profile.intentDecision.responseStyle,
    provider: {
      providerName: profile.providerDecision.providerName,
      modelName: profile.providerDecision.modelName,
      profileId: profile.providerDecision.profileId,
      profileLabel: profile.providerDecision.profileLabel,
      selectionSource: profile.providerDecision.selectionSource,
      fallbackOrder: profile.providerDecision.fallbackOrder.slice(),
    },
    skills: {
      primarySkillName: profile.skillDecision.primarySkill?.name || null,
      supportingSkillNames: profile.skillDecision.supportingSkills.map((entry) => entry.name),
      matchedBundleTags: profile.skillDecision.matchedBundleTags.slice(),
    },
    rationale: [
      ...profile.intentDecision.rationale,
      ...profile.providerDecision.rationale,
      ...profile.skillDecision.rationale,
    ],
  };
}
