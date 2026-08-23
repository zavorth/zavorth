import type { UniversalAgentRun } from '../runtime/agent/UniversalAgentRuntimeTypes.js';

export type ZavorthUserResponseAudience = 'normal-user' | 'developer' | 'operator' | 'owner';

export type ZavorthUserResponseChannel = 'web' | 'cli' | 'telegram' | 'discord' | 'slack' | 'whatsapp' | string;

export type ZavorthUserResponseRenderInput = {
  text: string;
  channel: ZavorthUserResponseChannel;
  audience?: ZavorthUserResponseAudience | null;
  run?: UniversalAgentRun | null;
  approvalId?: string | null;
  approvalStatus?: string | null;
  replayCommand?: string | null;
  includeTechnicalFooter?: boolean | null;
};

/**
 * Plain-language execution receipt: a human summary up front plus the
 * technical lines (approval ids, run ids, replay commands) kept separate so
 * surfaces can collapse them by default.
 */
export type ZavorthUserResponseReceipt = {
  summary: string;
  technicalLines: string[];
};

export type ZavorthUserResponseRenderResult = {
  text: string;
  audience: ZavorthUserResponseAudience;
  simplified: boolean;
  footerIncluded: boolean;
  /** Present when the rendered response carries an execution receipt. */
  receipt?: ZavorthUserResponseReceipt;
};

function normalizeReply(value: unknown): string {
  return String(value ?? '').trim() || 'Zavorth processed the request.';
}

function pendingApproval(run: UniversalAgentRun | null | undefined): UniversalAgentRun['approvals'][number] | null {
  return run?.approvals.find((entry) => entry.status === 'pending') || run?.approvals.at(-1) || null;
}

export class ZavorthUserResponseRendererService {
  public render(input: ZavorthUserResponseRenderInput): ZavorthUserResponseRenderResult {
    const audience = input.audience || this.defaultAudience(input.channel);
    const run = input.run || null;
    const approval = pendingApproval(run);
    const approvalId = input.approvalId || approval?.id || null;
    const approvalStatus = input.approvalStatus || approval?.status || null;
    let simplifiedBody = this.simplifyBody(normalizeReply(input.text), {
      hasApproval: Boolean(approvalId),
      run,
    });
    // Light channel-aware markdown (tables/links/blocks) without a new service.
    simplifiedBody = this.adaptForChannel(simplifiedBody, input.channel);
    const includeFooter = this.shouldIncludeFooter({
      audience,
      run,
      approvalId,
      explicit: input.includeTechnicalFooter,
    });
    const footer = includeFooter
      ? this.renderFooter({
          audience,
          run,
          approvalId,
          approvalStatus,
          replayCommand: input.replayCommand || null,
        })
      : [];
    const receipt: ZavorthUserResponseReceipt | undefined = footer.length
      ? {
          summary: simplifiedBody,
          technicalLines: footer.filter((line) => line.startsWith('- ')),
        }
      : undefined;
    return {
      text: [simplifiedBody, ...footer].filter(Boolean).join('\n'),
      audience,
      simplified: simplifiedBody !== normalizeReply(input.text),
      footerIncluded: footer.length > 0,
      receipt,
    };
  }

  private adaptForChannel(text: string, channel: ZavorthUserResponseChannel): string {
    try {
      // Lazy require keeps renderer usable in minimal test contexts without presentation deps.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { ZavorthPresentationAdapterService } =
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('./ZavorthPresentationAdapterService.js') as typeof import('./ZavorthPresentationAdapterService.js');
      return new ZavorthPresentationAdapterService().adaptMarkdownForChannel(text, String(channel || 'web'));
    } catch {
      return text;
    }
  }

  private defaultAudience(channel: ZavorthUserResponseChannel): ZavorthUserResponseAudience {
    const normalized = String(channel || '').toLowerCase();
    if (normalized === 'cli') {
      return 'developer';
    }
    if (normalized === 'web') {
      return 'normal-user';
    }
    return 'normal-user';
  }

  private simplifyBody(
    text: string,
    input: {
      hasApproval: boolean;
      run: UniversalAgentRun | null;
    },
  ): string {
    if (input.hasApproval || input.run?.status === 'waiting_approval') {
      return [
        'I need your confirmation to continue safely.',
        'Nothing has been executed yet. Review the request and approve if you want to proceed.',
      ].join('\n');
    }

    return text;
  }

  private shouldIncludeFooter(input: {
    audience: ZavorthUserResponseAudience;
    run: UniversalAgentRun | null;
    approvalId: string | null;
    explicit?: boolean | null;
  }): boolean {
    if (input.explicit === true) {
      return true;
    }
    if (input.explicit === false) {
      return false;
    }
    if (input.approvalId || input.run?.status === 'waiting_approval' || input.run?.status === 'failed') {
      return true;
    }
    return input.audience === 'operator' || input.audience === 'owner';
  }

  private renderFooter(input: {
    audience: ZavorthUserResponseAudience;
    run: UniversalAgentRun | null;
    approvalId: string | null;
    approvalStatus: string | null;
    replayCommand: string | null;
  }): string[] {
    const lines: string[] = ['', 'Zavorth'];
    if (input.approvalId) {
      const pending = (input.approvalStatus || 'pending') === 'pending';
      // Full UUID only for operator/owner; normal-user and developer get a short pending line.
      const showFullId = input.audience === 'operator' || input.audience === 'owner';
      if (showFullId) {
        lines.push(`- approval: ${input.approvalId} (${input.approvalStatus || 'pending'})`);
      } else {
        lines.push(pending ? '- approval: waiting for your decision' : `- approval: ${input.approvalStatus}`);
      }
      if (pending) {
        // Honest contract: free-text "Approve" does NOT resolve approvals (agent-first).
        lines.push('- Tap Approve/Reject on the card, or use /approve or /reject (or /approve 1 if several).');
      }
    } else {
      lines.push('- approval: not required');
    }
    if (input.audience !== 'normal-user' && input.run?.id) {
      lines.push(`- run: ${input.run.id}`);
    }
    if (input.audience !== 'normal-user' && input.replayCommand) {
      lines.push(`- replay: ${input.replayCommand}`);
    }
    return lines;
  }
}
