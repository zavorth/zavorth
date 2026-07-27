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

export class ZavorthSkillForgeRuntimeService {
  private readonly now: () => Date;

  public constructor(deps: SkillForgeDeps = {}) {
    this.now = deps.now || (() => new Date());
  }

  public reviewSkillOpportunity(input: ZavorthSkillForgeInput): ZavorthSkillForgeRuntimeSnapshot {
    const generatedAt = this.now().toISOString();
    const shouldDraft = input.outcome === 'success'
      && this.hasStructuredDraftSignal(input);
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
    return this.firstWords(redacted, 5) || 'Native Workflow';
  }

  private hasStructuredDraftSignal(input: ZavorthSkillForgeInput): boolean {
    return input.toolCallCount >= 5
      || (input.observedFiles || []).length >= 2
      || (input.requestedCapabilities || []).some((capability) => capability.includes('workflow')
        || capability.includes('procedure')
        || capability.includes('playbook')
        || capability.includes('checklist')
        || capability.includes('skill'));
  }

  private firstWords(text: string, count: number): string {
    const words: string[] = [];
    let current = '';
    for (const char of text) {
      if (char.trim()) {
        current += char;
        continue;
      }
      if (current) {
        words.push(current);
        current = '';
        if (words.length >= count) break;
      }
    }
    if (current && words.length < count) {
      words.push(current);
    }
    return words.join(' ');
  }
}
