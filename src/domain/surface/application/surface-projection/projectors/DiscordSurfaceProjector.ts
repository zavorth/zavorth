import type {
  DiscordActionRowComponent,
  DiscordSurfaceNativePayload,
} from '../../surface-response/SurfaceResponseRenderers.js';
import { truncateSurfaceText } from '../../surface-response/SurfaceResponseUtils.js';
import { isSurfaceAffordanceEnabled } from '../../surface-affordance/index.js';
import { buildSuggestedPermissionReactions } from '../interaction/SurfaceReactions.js';
import { BaseSurfaceProjector } from './BaseSurfaceProjector.js';
import type { SurfaceProjectorInput, SurfaceProjectorOutput } from './SurfaceProjectorContract.js';
import { SURFACE_PROJECTOR_CONTRACT_VERSION } from './SurfaceProjectorContract.js';

type DiscordSelectOption = {
  label: string;
  value: string;
  description?: string;
  default?: boolean;
};


/**
 * F5b — Discord projector with select menus for long choice_groups.
 * When metadata.projection includes select_menu (or actions > 5), emit a string select.
 */
export class DiscordSurfaceProjector extends BaseSurfaceProjector {
  public readonly channel = 'discord';
  protected readonly renderTarget = 'discord' as const;

  protected override defaultMaxActionsPerRow(): number {
    return 5;
  }

  public override project(input: SurfaceProjectorInput): SurfaceProjectorOutput {
    const base = super.project(input);
    const projection = (input.response.metadata?.projection ||
      input.projected?.projection ||
      []) as Array<{ controlId: string; mode: string }>;
    const wantsSelect =
      projection.some((p) => p.mode === 'select_menu') ||
      (input.response.actions || []).length > 5;

    const reactionsOn = input.profile
      ? isSurfaceAffordanceEnabled(input.profile, 'reactions')
      : true;
    const suggestedReactions = reactionsOn ? buildSuggestedPermissionReactions() : [];

    if (!wantsSelect) {
      if (suggestedReactions.length === 0) return base;
      return {
        ...base,
        contractVersion: SURFACE_PROJECTOR_CONTRACT_VERSION,
        replyOptions: {
          ...(base.replyOptions || {}),
          suggestedReactions,
          reactionsHint: 'React: ✅ once · 🔁 session · 📌 always · ❌ deny',
        },
      };
    }

    const actions = input.response.actions || [];
    if (actions.length === 0) {
      return base;
    }

    // Discord select menus support max 25 options
    const options: DiscordSelectOption[] = actions.slice(0, 25).map((action) => ({
      label: truncateSurfaceText(action.label, 100) || action.id,
      value: truncateSurfaceText(
        action.callbackData || action.command || action.id,
        100,
      ),
      description: action.description
        ? truncateSurfaceText(action.description, 100)
        : undefined,
    }));

    const controlId =
      projection.find((p) => p.mode === 'select_menu')?.controlId ||
      'surface-select';

    const selectRow: DiscordActionRowComponent = {
      type: 1,
      components: [
        {
          type: 3,
          custom_id: truncateSurfaceText(controlId, 100),
          placeholder: 'Choose an option…',
          min_values: 1,
          max_values: 1,
          options,
        } as unknown as DiscordActionRowComponent['components'][number],
      ],
    };

    const native: DiscordSurfaceNativePayload = {
      allowedMentions: { parse: [] },
      components: [selectRow],
    };

    return {
      ...base,
      contractVersion: SURFACE_PROJECTOR_CONTRACT_VERSION,
      usedNativeButtons: true,
      replyOptions: {
        allowedMentions: native.allowedMentions,
        components: native.components,
        selectMenu: true,
        ...(suggestedReactions.length > 0
          ? {
              suggestedReactions,
              reactionsHint: 'React: ✅ once · 🔁 session · 📌 always · ❌ deny',
            }
          : {}),
      },
      rendered: {
        ...base.rendered,
        native: native as never,
      },
    };
  }

  protected override buildReplyOptions(native: unknown): Record<string, unknown> | null {
    const discord = native as DiscordSurfaceNativePayload | null;
    if (!discord) return null;
    return {
      allowedMentions: discord.allowedMentions,
      ...(discord.components.length > 0 ? { components: discord.components } : {}),
    };
  }
}
