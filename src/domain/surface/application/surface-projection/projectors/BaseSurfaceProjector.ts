import type { SurfaceProfile } from '../../surface-affordance/index.js';
import {
  renderSurfaceResponseForTarget,
  type SurfaceRenderTarget,
} from '../../surface-response/index.js';
import {
  SURFACE_PROJECTOR_CONTRACT_VERSION,
  type SurfaceProjector,
  type SurfaceProjectorInput,
  type SurfaceProjectorOutput,
} from './SurfaceProjectorContract.js';

function hasNativeButtons(native: unknown): boolean {
  if (!native || typeof native !== 'object') return false;
  const n = native as {
    replyMarkup?: { inline_keyboard?: unknown[] };
    components?: unknown[];
  };
  if (Array.isArray(n.replyMarkup?.inline_keyboard) && n.replyMarkup.inline_keyboard.length > 0) {
    return true;
  }
  if (Array.isArray(n.components) && n.components.length > 0) {
    return true;
  }
  return false;
}

/**
 * Shared projector path: profile → render target → SurfaceResponse renderer → reply options.
 */
export abstract class BaseSurfaceProjector implements SurfaceProjector {
  public abstract readonly channel: string;
  protected abstract readonly renderTarget: SurfaceRenderTarget;

  public project(input: SurfaceProjectorInput): SurfaceProjectorOutput {
    const profile = input.profile ?? null;
    const maxActionsPerRow =
      input.options?.maxActionsPerRow ??
      profile?.limits.maxActionsPerRow ??
      this.defaultMaxActionsPerRow();
    const maxTextLength =
      input.options?.maxTextLength ?? profile?.limits.maxTextLength ?? undefined;

    const rendered = renderSurfaceResponseForTarget(this.renderTarget, input.response, {
      ...input.options,
      maxActionsPerRow,
      ...(maxTextLength != null ? { maxTextLength } : {}),
    });

    const replyOptions = this.buildReplyOptions(rendered.native);
    const usedNativeButtons =
      input.projected?.usedNativeButtons === true || hasNativeButtons(rendered.native);

    return {
      contractVersion: SURFACE_PROJECTOR_CONTRACT_VERSION,
      channel: this.channel,
      text: rendered.text,
      replyOptions,
      rendered,
      usedNativeButtons,
      profileId: profile?.id ?? input.projected?.profileId ?? null,
    };
  }

  protected defaultMaxActionsPerRow(): number {
    return 2;
  }

  /** Channel-specific native reply payload. Default: text only. */
  protected buildReplyOptions(_native: unknown): Record<string, unknown> | null {
    return null;
  }
}

export function resolveRenderTargetFromProfile(
  profile: SurfaceProfile | null | undefined,
  fallback: SurfaceRenderTarget,
): SurfaceRenderTarget {
  return profile?.renderTarget || fallback;
}
