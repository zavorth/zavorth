import type {
  UniversalAgentRun,
} from '../runtime/agent/UniversalAgentRuntimeTypes.js';

export type ZavorthUserResponseAudience =
  | 'normal-user'
  | 'developer'
  | 'operator'
  | 'owner';

export type ZavorthUserResponseChannel =
  | 'web'
  | 'cli'
  | 'telegram'
  | 'discord'
  | 'slack'
  | 'whatsapp'
  | string;

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

export type ZavorthUserResponseRenderResult = {
  text: string;
  audience: ZavorthUserResponseAudience;
  simplified: boolean;
  footerIncluded: boolean;
};

function normalizeReply(value: unknown): string {
  return String(value ?? '').trim() || 'Pedido processado pelo Zavorth.';
}

function normalizeSearchText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function pendingApproval(run: UniversalAgentRun | null | undefined): UniversalAgentRun['approvals'][number] | null {
  return run?.approvals.find((entry) => entry.status === 'pending')
    || run?.approvals.at(-1)
    || null;
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
    return {
      text: [simplifiedBody, ...footer].filter(Boolean).join('\n'),
      audience,
      simplified: simplifiedBody !== normalizeReply(input.text),
      footerIncluded: footer.length > 0,
    };
  }

  private adaptForChannel(text: string, channel: ZavorthUserResponseChannel): string {
    try {
      // Lazy require keeps renderer usable in minimal test contexts without presentation deps.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { ZavorthPresentationAdapterService } = require('./ZavorthPresentationAdapterService.js') as typeof import('./ZavorthPresentationAdapterService.js');
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

  private simplifyBody(text: string, input: {
    hasApproval: boolean;
    run: UniversalAgentRun | null;
  }): string {
    const normalized = normalizeSearchText(text);
    if (input.hasApproval || input.run?.status === 'waiting_approval') {
      if (
        normalized.includes('capability negotiation')
        || normalized.includes('aprovar escopo de capabilities')
        || normalized.includes('preciso negociar o escopo')
        || normalized.includes('approval requerido')
      ) {
        return [
          'I need your confirmation to continue safely.',
          'Nothing has been executed yet. Review the request and approve if you want to proceed.',
        ].join('\n');
      }
    }

    if (normalized.includes('pedido processado pelo runtime universal')) {
      return 'Recebi. O Zavorth registrou a solicitacao e vai seguir pelo fluxo seguro.';
    }

    if (normalized.includes('runtime universal registrou a conversa')) {
      return 'Received. I will answer here and only ask for confirmation if a real action is necessary.';
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
      lines.push(`- approval: ${input.approvalId} (${input.approvalStatus || 'pending'})`);
      if ((input.approvalStatus || 'pending') === 'pending') {
        lines.push('- reply "Approve" to allow or "Cancel" to reject.');
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
