import type { TelegramSurfaceNativePayload } from '../../surface-response/SurfaceResponseRenderers.js';
import { isSurfaceAffordanceEnabled } from '../../surface-affordance/index.js';
import { buildSuggestedPermissionReactions } from '../interaction/SurfaceReactions.js';
import { BaseSurfaceProjector } from './BaseSurfaceProjector.js';
import type { SurfaceProjectorInput, SurfaceProjectorOutput } from './SurfaceProjectorContract.js';
import { SURFACE_PROJECTOR_CONTRACT_VERSION } from './SurfaceProjectorContract.js';

export class TelegramSurfaceProjector extends BaseSurfaceProjector {
  public readonly channel = 'telegram';
  protected readonly renderTarget = 'telegram' as const;

  protected override defaultMaxActionsPerRow(): number {
    return 2;
  }

  public override project(input: SurfaceProjectorInput): SurfaceProjectorOutput {
    const base = super.project(input);
    const profile = input.profile;
    const reactionsOn = profile ? isSurfaceAffordanceEnabled(profile, 'reactions') : true;
    const voiceOn = profile ? isSurfaceAffordanceEnabled(profile, 'voice_reply') : false;
    const suggestedReactions = reactionsOn ? buildSuggestedPermissionReactions() : [];

    const replyOptions = {
      ...(base.replyOptions || {}),
      ...(suggestedReactions.length > 0
        ? {
            suggestedReactions,
            reactionsHint: 'You can also react: ✅ once · 🔁 session · 📌 always · ❌ deny',
          }
        : {}),
      voiceReplyEnabled: voiceOn,
    };

    const hasReplyMarkup = Boolean((base.replyOptions as unknown as Record<string, unknown>)?.reply_markup);
    const hasExtras = suggestedReactions.length > 0 || voiceOn;

    return {
      ...base,
      contractVersion: SURFACE_PROJECTOR_CONTRACT_VERSION,
      replyOptions: hasReplyMarkup || hasExtras ? replyOptions : base.replyOptions,
    };
  }

  protected override buildReplyOptions(native: unknown): Record<string, unknown> | null {
    const telegram = native as TelegramSurfaceNativePayload | null;
    return telegram?.replyMarkup ? { reply_markup: telegram.replyMarkup } : null;
  }
}
