import { BaseSurfaceProjector } from './BaseSurfaceProjector.js';
import type { SurfaceProjectorInput, SurfaceProjectorOutput } from './SurfaceProjectorContract.js';
import { SURFACE_PROJECTOR_CONTRACT_VERSION } from './SurfaceProjectorContract.js';

/**
 * Web/API projector: text + structured actions payload for clients that render their own UI.
 * Does not emit Telegram/Discord native widgets.
 */
export class WebSurfaceProjector extends BaseSurfaceProjector {
  public readonly channel: string = 'web';
  protected readonly renderTarget = 'web' as const;

  protected override defaultMaxActionsPerRow(): number {
    return 3;
  }

  public override project(input: SurfaceProjectorInput): SurfaceProjectorOutput {
    const base = super.project(input);
    const actions = input.response.actions || [];
    // Expose actions as a structured reply option for web clients (not native chat buttons).
    const replyOptions =
      actions.length > 0
        ? {
            surfaceActions: actions,
            surfaceResponseId: input.response.id,
            intent: input.response.intent,
          }
        : null;

    return {
      ...base,
      contractVersion: SURFACE_PROJECTOR_CONTRACT_VERSION,
      replyOptions,
      // Web can render buttons in its own shell; mark true when actions exist.
      usedNativeButtons: actions.length > 0,
    };
  }
}
