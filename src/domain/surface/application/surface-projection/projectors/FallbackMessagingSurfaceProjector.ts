import type { SurfaceRenderTarget } from '../../surface-response/SurfaceResponseContract.js';
import { BaseSurfaceProjector } from './BaseSurfaceProjector.js';
import type { SurfaceProjectorInput, SurfaceProjectorOutput } from './SurfaceProjectorContract.js';
import { SURFACE_PROJECTOR_CONTRACT_VERSION } from './SurfaceProjectorContract.js';

/**
 * F5d — WhatsApp / Signal / Slack / etc.
 * Structured text + numbered options metadata for reply parsing.
 */
export class FallbackMessagingSurfaceProjector extends BaseSurfaceProjector {
  public readonly channel: string;
  protected readonly renderTarget: SurfaceRenderTarget;

  constructor(channel: string, renderTarget: SurfaceRenderTarget) {
    super();
    this.channel = channel;
    this.renderTarget = renderTarget;
  }

  protected override defaultMaxActionsPerRow(): number {
    return 1;
  }

  public override project(input: SurfaceProjectorInput): SurfaceProjectorOutput {
    const base = super.project(input);
    const actions = input.response.actions || [];
    const numberedOptions = actions.map((a) => a.id);
    const meta = (input.response.metadata || {}) as Record<string, unknown>;

    // Ensure numbered prompt is visible even if response text came from button-oriented builder.
    let text = base.text;
    if (actions.length > 0 && !/reply with a number/i.test(text)) {
      const lines = [
        text,
        '',
        `Reply with a number (1-${actions.length}):`,
        ...actions.map((a, i) => {
          const cmd = a.command ? ` — ${a.command}` : '';
          return `${i + 1}. ${a.label}${cmd}`;
        }),
      ];
      text = lines.join('\n').trim();
    }

    return {
      ...base,
      contractVersion: SURFACE_PROJECTOR_CONTRACT_VERSION,
      text,
      replyOptions: {
        numberedOptions,
        numberedPrompt: true,
        approvalId: meta.approvalId ?? null,
        surfaceActions: actions,
      },
      usedNativeButtons: false,
      rendered: {
        ...base.rendered,
        text,
      },
    };
  }
}
