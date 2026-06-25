import {
  ZAVORTH_SKILL_FORGE_RUNTIME_VERSION,
  type ZavorthSkillForgeDraft,
  type ZavorthSkillForgeInput,
  type ZavorthSkillForgeRuntimeSnapshot,
} from '../contracts/native/ZavorthNativeAutonomySpineContract.js';
import { redactSensitiveText, stableId } from './ZavorthNativeAutonomyShared.js';

type SkillForgeDeps = {
  now?: () => Date;
};

const EXECUTABLE_CAPABILITIES = new Set([
  'shell',
  'terminal',
  'write_file',
  'network',
  'external_send',
  'mcp_tool',
  'provider_change',
  'policy_change',
]);

const WORKFLOW_SIGNAL = /\b(workflow|procedure|playbook|checklist|fluxo|procedimento|release notes|repeat|repeated|da proxima vez|next time)\b/i;

export class ZavorthSkillForgeRuntimeService {
  private readonly now: () => Date;

  public constructor(deps: SkillForgeDeps = {}) {
    this.now = deps.now || (() => new Date());
  }

  public reviewSkillOpportunity(input: ZavorthSkillForgeInput): ZavorthSkillForgeRuntimeSnapshot {
    const generatedAt = this.now().toISOString();
    const shouldDraft = input.outcome === 'success'
      && (input.toolCallCount >= 5 || WORKFLOW_SIGNAL.test(input.userMessage) || WORKFLOW_SIGNAL.test(input.assistantResponse));
    const drafts = shouldDraft ? [this.buildDraft(input)] : [];
    const needsApproval = drafts.some((draft) => draft.approvalRequired);

    return {
      version: ZAVORTH_SKILL_FORGE_RUNTIME_VERSION,
      generatedAt,
      status: needsApproval ? 'needs-approval' : 'ready',
      drafts,
      pipeline: ['observe', 'draft', 'scan', 'smoke', 'approve', 'install', 'measure', 'curate'],
      safety: {
        noDirectSkillFileWrites: true,
        executableSupportFilesHeldForApproval: true,
        importedToolsNeverExecutableByDefault: true,
        usageMetricsExcludePromptContent: true,
      },
    };
  }

  private buildDraft(input: ZavorthSkillForgeInput): ZavorthSkillForgeDraft {
    const requested = input.requestedCapabilities || [];
    const executableRequested = requested.some((capability) => EXECUTABLE_CAPABILITIES.has(capability));
    const fileTouch = (input.observedFiles || []).length > 0;
    const risk = executableRequested ? 'high' : fileTouch ? 'medium' : 'low';
    const approvalRequired = risk !== 'low';
    const title = this.titleFromInput(input);

    return {
      draftId: stableId('skill-draft', [input.turnId, title, requested.join(','), input.toolCallCount]),
      title,
      status: 'draft',
      materialized: false,
      approvalRequired,
      smokeRequired: true,
      rollbackAvailable: true,
      risk,
      evidenceRefs: [`turn:${input.turnId}`],
      preview: {
        manifest: JSON.stringify({
          name: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'native-skill-draft',
          source: 'zavorth-native-skill-forge',
          materialized: false,
          approvalRequired,
          smokeRequired: true,
        }, null, 2),
        skillBody: [
          '# Draft Skill',
          '',
          redactSensitiveText(input.userMessage).slice(0, 240),
          '',
          'This draft remains preview-only until scanner, smoke and approval gates pass.',
        ].join('\n'),
        tests: [
          'static-risk-scan',
          'non-destructive-smoke',
          'rollback-proof',
        ],
      },
    };
  }

  private titleFromInput(input: ZavorthSkillForgeInput): string {
    const redacted = redactSensitiveText(input.userMessage).trim();
    if (/release notes/i.test(redacted)) return 'Release Notes Workflow';
    if (/resumo|summary/i.test(redacted)) return 'Summary Workflow';
    return redacted.split(/\s+/).slice(0, 5).join(' ') || 'Native Workflow';
  }
}
