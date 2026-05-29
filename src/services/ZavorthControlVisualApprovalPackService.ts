import {
  ZAVORTH_ZAVORTH_CONTROL_VISUAL_APPROVAL_PACK_CONTRACT_VERSION,
  type ZavorthControlVisualApprovalBlock,
  type ZavorthControlVisualApprovalPack,
} from '../contracts/ZavorthControlVisualApprovalPackContract.js';
import type { ZavorthControlProviderCockpitProjection } from '../contracts/ZavorthControlProviderCockpitContract.js';
import {
  ZavorthControlProviderCockpitService,
  type ZavorthControlProviderCockpitInput,
} from './ZavorthControlProviderCockpitService.js';

export type ZavorthControlVisualApprovalPackInput = ZavorthControlProviderCockpitInput & {
  includeDetailsDrawer?: boolean;
};

export type ZavorthControlVisualApprovalPackRuntime = {
  now?: () => Date;
  cockpit?: Pick<ZavorthControlProviderCockpitService, 'buildProjection'>;
};

export class ZavorthControlVisualApprovalPackService {
  private readonly now: () => Date;
  private readonly cockpit: Pick<ZavorthControlProviderCockpitService, 'buildProjection'>;

  constructor(runtime: ZavorthControlVisualApprovalPackRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.cockpit = runtime.cockpit || new ZavorthControlProviderCockpitService({
      now: this.now,
    });
  }

  public async buildPack(input: ZavorthControlVisualApprovalPackInput = {}): Promise<ZavorthControlVisualApprovalPack> {
    const cockpit = await this.cockpit.buildProjection(input);
    const blocks = buildBlocks(cockpit, input.includeDetailsDrawer === true);
    const generatedAt = this.now().toISOString();

    return {
      contractVersion: ZAVORTH_ZAVORTH_CONTROL_VISUAL_APPROVAL_PACK_CONTRACT_VERSION,
      schemaVersion: 1,
      surface: 'zavorthControl-visual-approval-pack',
      generatedAt,
      status: blocks.length > 0 ? 'ready_for_review' : 'blocked',
      approvalRequired: true,
      approved: false,
      visualMutationApplied: false,
      executionAuthority: false,
      sourceCockpitContractVersion: cockpit.contractVersion,
      target: {
        route: '/control',
        ownerDecisionRequired: true,
        defaultDecision: 'do_not_render',
      },
      blocks,
      reviewChecklist: [
        'Confirm provider cockpit cards should be visible in /control.',
        'Confirm placement does not alter global layout or navigation.',
        'Confirm live probe buttons are rendered as commands or approval actions, not direct zavorthControl execution.',
        'Confirm empty, blocked, missing-auth and live-passed states are acceptable.',
        'Confirm mobile/desktop QA is required before enabling the block.',
      ],
      safety: {
        noZavorthControlExecutionAuthority: true,
        noProviderSecretSerialization: true,
        noLiveProbeOnRender: true,
        noLayoutMutationBeforeApproval: true,
      },
      receipts: [
        {
          id: `visual-proposal:${generatedAt}`,
          kind: 'visual-proposal',
          status: 'recorded',
          detail: `${blocks.length} ZavorthControl provider visual block(s) proposed; none rendered yet.`,
        },
        {
          id: `visual-safety:${generatedAt}`,
          kind: 'safety-gate',
          status: 'recorded',
          detail: 'Visual proposal is approval-gated and keeps zavorthControl execution authority disabled.',
        },
        {
          id: `visual-rollback:${generatedAt}`,
          kind: 'rollback',
          status: 'recorded',
          detail: 'Rollback is removal of proposed visual block registration before render enablement.',
        },
      ],
      nextAction: 'Owner approval is required before implementing or rendering these ZavorthControl blocks.',
    };
  }

  public renderText(pack: ZavorthControlVisualApprovalPack): string {
    return [
      '[zavorthControl-visual-approval]',
      `status=${pack.status}`,
      `approval_required=${pack.approvalRequired}`,
      `approved=${pack.approved}`,
      `visual_mutation=${pack.visualMutationApplied}`,
      `execution_authority=${pack.executionAuthority}`,
      '',
      '[blocks]',
      ...pack.blocks.map((block) =>
        `- ${block.id}: ${block.title} | placement=${block.placement} | type=${block.visualChangeType} | user_visible=${block.userVisible}`,
      ),
      '',
      '[checklist]',
      ...pack.reviewChecklist.map((item) => `- ${item}`),
      '',
      `next=${pack.nextAction}`,
      '',
    ].join('\n');
  }
}

function buildBlocks(
  cockpit: ZavorthControlProviderCockpitProjection,
  includeDetailsDrawer: boolean,
): ZavorthControlVisualApprovalBlock[] {
  const blocks: ZavorthControlVisualApprovalBlock[] = [
    {
      id: 'provider-cockpit-summary-card',
      title: 'Provider Cockpit Summary',
      targetSurface: '/control',
      sourceProjection: cockpit.surface,
      placement: 'right-rail',
      visualChangeType: 'new-card',
      requiresOwnerApproval: true,
      implementationStatus: 'proposal_only',
      userVisible: false,
      summary: 'Compact provider readiness card with ready/live/blocked counts and selected provider.',
      dataBindings: [
        'summary.totalProviders',
        'summary.readyProviders',
        'summary.livePassed',
        'summary.liveFailed',
        'selectedProviderId',
      ],
      interactionModel: cockpit.actions.map((action) => ({
        id: action.id,
        label: action.label,
        command: action.command,
        zavorthControlCanExecute: false,
      })),
      acceptanceCriteria: [
        'Fits existing right rail density without adding a new global section.',
        'Shows live evidence as proof state, not as a claim of default routing.',
        'Does not run live probes on render.',
        'Does not expose provider secrets, tokens or raw headers.',
      ],
      rollbackPlan: 'Remove the provider cockpit summary card registration; backend projection remains available.',
    },
    {
      id: 'provider-cockpit-action-row',
      title: 'Provider Cockpit Actions',
      targetSurface: '/control',
      sourceProjection: cockpit.surface,
      placement: 'main-panel',
      visualChangeType: 'new-action-row',
      requiresOwnerApproval: true,
      implementationStatus: 'proposal_only',
      userVisible: false,
      summary: 'Action row for provider matrix, probe packet and explicit live probe commands.',
      dataBindings: [
        'actions',
        'cards.actions',
        'safety.zavorthControlCannotExecuteProviderCalls',
      ],
      interactionModel: cockpit.actions.map((action) => ({
        id: action.id,
        label: action.label,
        command: action.command,
        zavorthControlCanExecute: false,
      })),
      acceptanceCriteria: [
        'Buttons or command chips must not directly call provider APIs.',
        'Sensitive live probe actions must be represented as explicit operator actions.',
        'Fallback text must be understandable if rendered in CLI or narrow surfaces.',
      ],
      rollbackPlan: 'Remove action row rendering while keeping CLI commands available.',
    },
  ];

  if (includeDetailsDrawer) {
    blocks.push({
      id: 'provider-cockpit-evidence-drawer',
      title: 'Provider Evidence Drawer',
      targetSurface: '/control',
      sourceProjection: cockpit.surface,
      placement: 'details-drawer',
      visualChangeType: 'new-section',
      requiresOwnerApproval: true,
      implementationStatus: 'proposal_only',
      userVisible: false,
      summary: 'Details drawer for sanitized live probe evidence, receipts and health checks.',
      dataBindings: [
        'cards.evidence',
        'healthChecks',
        'receipts',
      ],
      interactionModel: [],
      acceptanceCriteria: [
        'Evidence target excludes query strings and credentials.',
        'Receipts show evidence hashes, not response bodies.',
        'Drawer must be optional and closed by default.',
      ],
      rollbackPlan: 'Remove evidence drawer route/registration; no data migration required.',
    });
  }

  return blocks;
}
