import type {
  SourceAgentRuntimeToolDecision,
  SourceAgentRuntimeToolPolicyDecisionReceipt,
  SourceAgentRuntimeToolPolicyDoctorSnapshot,
  SourceAgentRuntimeToolPolicyMode,
  SourceAgentRuntimeToolRisk,
} from '../contracts/SourceAgentRuntimeBridgeContract.js';
import { ZAVORTH_SOURCE_AGENT_RUNTIME_BRIDGE_CONTRACT_VERSION } from '../contracts/SourceAgentRuntimeBridgeContract.js';

import { ToolExposurePolicy } from '../runtime/agent/ToolExposurePolicy.js';
import { ToolPolicyService } from './ToolPolicyService.js';
import type { ZavorthToolPolicyAction, ZavorthToolPolicyLevel } from '../contracts/ToolPolicyContract.js';

export type SourceAgentRuntimeToolPolicyInput = {
  mode?: SourceAgentRuntimeToolPolicyMode;
  requestedTools?: string[];
  allowedTools?: string[];
  approvedToolIds?: string[];
  approvalGranted?: boolean;
};

type Runtime = {
  now?: () => Date;
  toolExposurePolicy?: ToolExposurePolicy;
};

const DEFAULT_READ_ONLY_TOOLS = ['Read', 'Glob', 'Grep', 'LS'];
const DEFAULT_CONFIGURED_TOOLS = ['Read', 'Glob', 'Grep', 'LS', 'Write', 'Edit', 'Bash'];

const CLAUDE_TOOL_ALIASES: Record<string, string[]> = {
  read: ['Read', 'read', 'read_file', 'workspace.read'],
  glob: ['Glob', 'glob', 'workspace.read'],
  grep: ['Grep', 'grep', 'workspace.read'],
  ls: ['LS', 'ls', 'workspace.read'],
  write: ['Write', 'write', 'write_file', 'filesystem.write'],
  edit: ['Edit', 'edit', 'write_file', 'filesystem.write'],
  multiedit: ['MultiEdit', 'multiedit', 'write_file', 'filesystem.write'],
  notebookedit: ['NotebookEdit', 'notebookedit', 'write_file', 'filesystem.write'],
  bash: ['Bash', 'bash', 'bash_unsafe', 'shell.exec'],
  todowrite: ['TodoWrite', 'todowrite', 'task.write'],
};

function mapToolToPolicyAction(toolName: string): ZavorthToolPolicyAction | null {
  const norm = toolName.toLowerCase();
  if (['read', 'glob', 'grep', 'ls', 'view_file', 'list_dir', 'grep_search'].includes(norm)) return 'file.read';
  if (['write', 'edit', 'multiedit', 'notebookedit', 'write_to_file', 'replace_file_content', 'multi_replace_file_content'].includes(norm)) return 'file.write';
  if (['bash', 'shell', 'exec', 'run_command', 'shell.execute'].includes(norm)) return 'shell.execute';
  if (['fetch', 'curl', 'wget', 'network.fetch', 'read_url', 'read_browser_page', 'search_web'].includes(norm)) return 'network.fetch';
  if (['delegate', 'subagent', 'subagent.delegate', 'invoke_subagent', 'send_message'].includes(norm)) return 'subagent.delegate';
  if (norm.includes('mcp')) return 'mcp.execute';
  return null;
}

export class SourceAgentRuntimeToolPolicyService {
  private readonly now: () => Date;
  private readonly toolExposurePolicy: ToolExposurePolicy;
  private readonly toolPolicyService: ToolPolicyService;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.toolExposurePolicy = runtime.toolExposurePolicy || new ToolExposurePolicy();
    this.toolPolicyService = new ToolPolicyService();
  }

  public buildDoctor(input: SourceAgentRuntimeToolPolicyInput = {}): SourceAgentRuntimeToolPolicyDoctorSnapshot {
    const mode = input.mode || 'configured';
    const requestedTools = normalizeList(input.requestedTools || defaultRequestedTools(mode));
    const allowedTools = normalizeList(input.allowedTools || defaultAllowedTools(mode));
    const approvedToolIds = normalizeList(input.approvedToolIds);
    const approvalGranted = input.approvalGranted === true;
    const profile = this.toolExposurePolicy.buildProfile({
      requestedTools,
      allowedTools,
      requireApprovalFor: [], // Handled dynamically per-tool using ToolPolicyService below
    });

    const decisions = requestedTools.map((toolName) => {
      const exposed = profile.tools.find((tool) => sameTool(tool.id, toolName));
      const aliases = resolveAliases(toolName);
      const approved = approvalGranted && aliases.some((alias) =>
        approvedToolIds.map((tool) => tool.toLowerCase()).includes(alias.toLowerCase()),
      );
      const risk = normalizeRisk(exposed?.risk);

      const action = mapToolToPolicyAction(toolName);
      let approvalRequired = Boolean(exposed?.requiresApproval) || risk === 'danger' || risk === 'attention';
      let policyLevel: ZavorthToolPolicyLevel | undefined;

      if (action) {
        const policyRes = this.toolPolicyService.checkPermission(action);
        policyLevel = policyRes.level;
        if (policyRes.level === 'allow') {
          approvalRequired = false;
        } else if (policyRes.level === 'ask') {
          approvalRequired = true;
        }
      }

      let decision = decideTool({
        mode,
        exposed: Boolean(exposed),
        approvalRequired,
        approved,
        risk,
      });

      if (policyLevel === 'deny') {
        decision = 'deny';
      }

      return {
        toolName,
        aliases,
        risk,
        decision,
        approvalRequired,
        approvalGranted: approved,
        reason: policyLevel === 'deny'
          ? `${toolName} is explicitly denied by your TOOL-POLICY.md config.`
          : reasonForDecision(mode, toolName, decision, risk, approvalRequired, approved),
      };
    });

    const status = decisions.some((decision) =>
      decision.risk === 'danger' && decision.decision === 'allow' && !decision.approvalGranted,
    ) ? 'failed' : 'passed';

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_SOURCE_AGENT_RUNTIME_BRIDGE_CONTRACT_VERSION,
      status,
      mode,
      requestedTools,
      approvedToolIds,
      decisions,
      summary: {
        allowed: decisions.filter((decision) => decision.decision === 'allow').length,
        denied: decisions.filter((decision) => decision.decision === 'deny').length,
        approvalRequired: decisions.filter((decision) => decision.decision === 'approval_required').length,
        dangerousToolsWithoutApproval: decisions.filter((decision) =>
          decision.risk === 'danger' && decision.approvalRequired && !decision.approvalGranted,
        ).length,
        readOnlyToolsAllowed: decisions.filter((decision) =>
          decision.decision === 'allow' && decision.risk === 'safe',
        ).length,
      },
      policy: {
        noFreeToolExecution: true,
        writesAndShellRequireApproval: this.toolPolicyService.checkPermission('file.write').level === 'ask' ||
                                       this.toolPolicyService.checkPermission('shell.execute').level === 'ask',
        deniedToolsRemainDeniedInCanUseTool: true,
        artifactFirstReceipts: true,
      },
    };
  }
}

function decideTool(input: {
  mode: SourceAgentRuntimeToolPolicyMode;
  exposed: boolean;
  approvalRequired: boolean;
  approved: boolean;
  risk: SourceAgentRuntimeToolRisk;
}): SourceAgentRuntimeToolDecision {
  if (input.mode === 'disabled') {
    return 'deny';
  }
  if (!input.exposed) {
    return 'deny';
  }
  if (input.approvalRequired) {
    return input.approved ? 'allow' : 'approval_required';
  }
  return input.risk === 'safe' ? 'allow' : 'approval_required';
}

function reasonForDecision(
  mode: SourceAgentRuntimeToolPolicyMode,
  toolName: string,
  decision: SourceAgentRuntimeToolDecision,
  risk: SourceAgentRuntimeToolRisk,
  approvalRequired: boolean,
  approved: boolean,
): string {
  if (mode === 'disabled') {
    return `${toolName} is denied because tool execution is disabled.`;
  }
  if (decision === 'allow' && approved) {
    return `${toolName} is allowed by explicit Zavorth approval.`;
  }
  if (decision === 'allow') {
    return `${toolName} is allowed as a safe read-only tool.`;
  }
  if (approvalRequired) {
    return `${toolName} is ${risk} and requires explicit Zavorth approval before execution.`;
  }
  return `${toolName} is denied because it is outside the active Zavorth tool policy.`;
}

function defaultRequestedTools(mode: SourceAgentRuntimeToolPolicyMode): string[] {
  if (mode === 'disabled') return ['Read', 'Bash', 'Write'];
  if (mode === 'read-only') return DEFAULT_READ_ONLY_TOOLS;
  return DEFAULT_CONFIGURED_TOOLS;
}

function defaultAllowedTools(mode: SourceAgentRuntimeToolPolicyMode): string[] {
  if (mode === 'disabled') return [];
  if (mode === 'read-only') return DEFAULT_READ_ONLY_TOOLS;
  return DEFAULT_CONFIGURED_TOOLS;
}

function normalizeList(values?: string[]): string[] {
  return Array.from(new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean)));
}

function normalizeRisk(value: unknown): SourceAgentRuntimeToolRisk {
  if (value === 'safe' || value === 'attention' || value === 'danger') {
    return value;
  }
  return 'unknown';
}

function resolveAliases(toolName: string): string[] {
  const normalized = String(toolName || '').trim().toLowerCase();
  return Array.from(new Set([
    toolName,
    normalized,
    ...(CLAUDE_TOOL_ALIASES[normalized] || []),
  ].map((tool) => String(tool || '').trim()).filter(Boolean)));
}

function sameTool(left: string, right: string): boolean {
  const rightAliases = resolveAliases(right).map((tool) => tool.toLowerCase());
  return resolveAliases(left).some((tool) => rightAliases.includes(tool.toLowerCase()));
}
