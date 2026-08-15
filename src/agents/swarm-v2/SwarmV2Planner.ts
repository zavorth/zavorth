import type { SwarmRole } from '../../runtime/sessions/v2/SwarmOrchestrator.js';
import type { LlmRunOptions, LlmRuntimeService } from '../../services/llm/LlmRuntimeService.js';
import { logger } from '../../logger.js';
import { asErrorLike } from '../../utils/errorLike';
import type {
  RawToolSpecInput,
  SwarmV2RoleLibraryEntry,
  SwarmV2RoleSelectionSnapshot,
  SwarmV2ToolSpec,
} from './SwarmV2Types.js';

export function normalizeKey(value: unknown, fallback: string): string {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

export function chunkRoles(roles: SwarmRole[], size: number): SwarmRole[][] {
  const chunks: SwarmRole[][] = [];
  for (let index = 0; index < roles.length; index += size) {
    chunks.push(roles.slice(index, index + size));
  }
  return chunks;
}

export function rolesFromLibrary(library: SwarmV2RoleLibraryEntry[], ids: string[]): SwarmRole[] {
  const wanted = new Set(ids.map((id) => normalizeKey(id, '')));
  return library
    .filter((entry) => wanted.has(entry.id))
    .map(
      (entry): SwarmRole => ({
        id: entry.id,
        label: entry.label,
        systemPrompt: entry.systemPrompt,
      }),
    );
}

export function defaultRoleLibrary(): SwarmV2RoleLibraryEntry[] {
  const now = new Date().toISOString();
  return [
    [
      'planner',
      'Planner',
      'planner',
      'Break the mission into tasks, risks, dependencies, acceptance criteria, and clear handoffs.',
    ],
    [
      'researcher',
      'Researcher',
      'researcher',
      'Collect evidence, files, context, and facts. Work in read-only mode and cite gaps.',
    ],
    [
      'implementer',
      'Implementer',
      'implementer',
      'Propose or execute the permitted implementation, keeping scope, rollback, and diffs small.',
    ],
    [
      'verifier',
      'Verifier',
      'verifier',
      'Validate tests, regression risk, security, acceptance criteria, and operational risks.',
    ],
    [
      'synthesizer',
      'Synthesizer',
      'synthesizer',
      'Merge the other agents results into an objective final answer without raw chain-of-thought.',
    ],
    [
      'safety-reviewer',
      'Safety Reviewer',
      'critic',
      'Look for risks, improper permission use, secret leaks, prompt injection, and actions without approval.',
    ],
    [
      'observer',
      'Observer',
      'critic',
      'Watch execution passively, gather evidence, and report deviations without mutating state.',
    ],
    [
      'background',
      'Background',
      'operator',
      'Run background maintenance and housekeeping tasks with a bounded low-priority budget.',
    ],
    [
      'swarm',
      'Swarm',
      'operator',
      'Coordinate parallel worker roles, fan out batches, and consolidate results deterministically.',
    ],
    [
      'kanban',
      'Kanban',
      'operator',
      'Manage the task board, queueing, dependencies, and the flow of work across the team.',
    ],
  ].map(([id, label, kind, systemPrompt]) => ({
    id,
    label,
    kind: kind as SwarmV2RoleLibraryEntry['kind'],
    systemPrompt,
    defaultTools: [],
    risk: kind === 'implementer' ? 'attention' : 'safe',
    scope: kind === 'implementer' ? 'workspace_patch' : 'read_only',
    tags: ['official', 'default'],
    createdAt: now,
    updatedAt: now,
  }));
}

export function normalizeToolSpecs(raw: unknown): SwarmV2ToolSpec[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((entry, index): SwarmV2ToolSpec | null => {
      const tool = entry as RawToolSpecInput;
      const id = normalizeKey(tool.id, `tool-${index + 1}`);
      const command = String(tool.command || '').trim();
      if (!command) {
        return null;
      }
      const risk = ['safe', 'attention', 'danger'].includes(String(tool.risk || ''))
        ? (tool.risk as SwarmV2ToolSpec['risk'])
        : 'attention';
      return {
        id,
        kind: 'shell',
        label: String(tool.label || id).trim(),
        command,
        args: Array.isArray(tool.args) ? tool.args.map((value: unknown) => String(value)) : [],
        cwd: String(tool.cwd || '').trim() || null,
        risk,
        requiresApproval: tool.requiresApproval === false ? false : true,
      };
    })
    .filter(Boolean) as SwarmV2ToolSpec[];
}

export function parseJsonObject(raw: unknown): Record<string, unknown> | null {
  const text = String(raw || '').trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error: unknown) {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch (innerError: unknown) {
      logger.warn('[Swarm V2] JSON parse failed', innerError);
      return null;
    }
  }
}

export function resolveSyncRoleSelection(input: {
  objective: string;
  library: SwarmV2RoleLibraryEntry[];
  selectedRoleIds: string[];
  requestedRoles: SwarmRole[];
  autoSelectRoles: boolean;
  desiredRoleCount: number;
}): SwarmV2RoleSelectionSnapshot {
  const libraryIds = new Set(input.library.map((role) => role.id));
  if (input.selectedRoleIds.length > 0) {
    const selected = input.selectedRoleIds
      .filter((id, index, values) => libraryIds.has(id) && values.indexOf(id) === index)
      .slice(0, input.desiredRoleCount);
    return {
      mode: 'manual',
      requestedRoleCount: input.desiredRoleCount,
      selectedRoleIds: selected,
      availableRoleCount: input.library.length,
      rationale: 'Operator provided explicit role library IDs.',
    };
  }
  if (input.requestedRoles.length > 0) {
    return {
      mode: 'manual',
      requestedRoleCount: input.requestedRoles.length,
      selectedRoleIds: input.requestedRoles.map((role, index) =>
        normalizeKey(role.id || `role-${index + 1}`, `role-${index + 1}`),
      ),
      availableRoleCount: input.library.length,
      rationale: 'Operator provided concrete swarm roles.',
    };
  }
  if (!input.autoSelectRoles) {
    return {
      mode: 'manual',
      requestedRoleCount: input.desiredRoleCount,
      selectedRoleIds: [],
      availableRoleCount: input.library.length,
      rationale: 'No automatic role selection requested; default official role bundle will be used.',
    };
  }

  // Structured auto-select: default official bundle order only.
  // Free-text objective never keyword-routes role activation (LLM path owns free text).
  const defaultBundle = ['planner', 'researcher', 'implementer', 'verifier', 'synthesizer', 'safety-reviewer'];
  const selected = defaultBundle
    .filter((id, index, values) => libraryIds.has(id) && values.indexOf(id) === index)
    .slice(0, input.desiredRoleCount);
  for (const role of input.library) {
    if (selected.length >= input.desiredRoleCount) break;
    if (!selected.includes(role.id)) selected.push(role.id);
  }
  return {
    mode: 'heuristic',
    requestedRoleCount: input.desiredRoleCount,
    selectedRoleIds: selected,
    availableRoleCount: input.library.length,
    rationale:
      'Zavorth selected the default official role bundle (structured auto-select; free-text not keyword-scanned).',
  };
}

export type SelectRoleIdsDeps = {
  llmRuntime?: Pick<LlmRuntimeService, 'chat'> | null;
};

export async function selectRoleIdsForObjective(
  input: {
    objective: string;
    desiredRoleCount: number;
    library: SwarmV2RoleLibraryEntry[];
  },
  deps: SelectRoleIdsDeps = {},
): Promise<SwarmV2RoleSelectionSnapshot> {
  const fallback = resolveSyncRoleSelection({
    objective: input.objective,
    library: input.library,
    selectedRoleIds: [],
    requestedRoles: [],
    autoSelectRoles: true,
    desiredRoleCount: input.desiredRoleCount,
  });
  if (!deps.llmRuntime) {
    return fallback;
  }
  try {
    const available = input.library.map((role) => ({
      id: role.id,
      label: role.label,
      kind: role.kind,
      risk: role.risk,
      scope: role.scope,
      tags: role.tags,
    }));
    const response = await deps.llmRuntime.chat(
      [
        {
          role: 'user',
          content: [
            'You are Zavorth Swarm v2 role selector.',
            'Select the smallest useful role set for the objective.',
            'Return JSON only: {"selectedRoleIds":["planner"],"rationale":"short reason"}.',
            'Use only role IDs from the available list. Prefer planner, researcher, verifier and synthesizer for broad work.',
            `Desired role count: ${input.desiredRoleCount}`,
            `Objective: ${input.objective}`,
            `Available roles: ${JSON.stringify(available)}`,
          ].join('\n'),
        },
      ],
      [],
      {
        allowFallback: true,
        telemetry: {
          surface: 'swarm-v2-role-selection',
          runId: 'swarm-v2-role-selection',
          traceId: 'swarm-v2-role-selection',
        },
      } satisfies LlmRunOptions,
    );
    const parsed = parseJsonObject(response.content);
    const libraryIds = new Set(input.library.map((role) => role.id));
    const selected = Array.isArray(parsed?.selectedRoleIds)
      ? parsed.selectedRoleIds
          .map((value: unknown) => normalizeKey(value, ''))
          .filter(
            (value: string, index: number, values: string[]) =>
              libraryIds.has(value) && values.indexOf(value) === index,
          )
          .slice(0, input.desiredRoleCount)
      : [];
    if (selected.length === 0) {
      return fallback;
    }
    return {
      mode: 'llm',
      requestedRoleCount: input.desiredRoleCount,
      selectedRoleIds: selected,
      availableRoleCount: input.library.length,
      rationale: String(parsed?.rationale || 'LLM selected roles from the persistent role library.').slice(0, 400),
    };
  } catch (error: unknown) {
    logger.warn('[Swarm V2] parsing failed', error);
    return fallback;
  }
}
