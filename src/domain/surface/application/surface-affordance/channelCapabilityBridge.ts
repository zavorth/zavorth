import type { ChannelCapabilitySupport } from '../../../../contracts/channel/ChannelCapabilityContract.js';
import type { SurfaceProfile } from '../../../../contracts/surface/SurfaceAffordanceContract.js';
import { isAffordanceEnabled } from './SurfaceProfileRegistry.js';

/**
 * Thin F1 bridge: project a SurfaceProfile into the legacy ChannelCapabilitySupport shape.
 * Does not replace ZavorthChannelCapabilityAwarenessService — opt-in compatibility only.
 */
export function surfaceProfileToLegacySupport(
  profile: SurfaceProfile,
): ChannelCapabilitySupport {
  const buttons =
    isAffordanceEnabled(profile, 'inline_buttons') ||
    isAffordanceEnabled(profile, 'button_rows') ||
    isAffordanceEnabled(profile, 'url_button');
  const menus =
    isAffordanceEnabled(profile, 'select_menu') ||
    isAffordanceEnabled(profile, 'multi_select') ||
    isAffordanceEnabled(profile, 'list_picker') ||
    isAffordanceEnabled(profile, 'modal_form');

  return {
    buttons,
    menus,
    pagination: true,
    tables: true,
    lists: true,
    safeMarkdown:
      profile.preset === 'chat-interactive' ||
      profile.preset === 'rich-app' ||
      profile.channel === 'telegram' ||
      profile.channel === 'discord' ||
      profile.channel === 'web' ||
      profile.channel === 'desktop' ||
      profile.channel === 'slack' ||
      profile.channel === 'teams',
    attachments: isAffordanceEnabled(profile, 'attachment'),
    qrLogin: profile.channel === 'whatsapp' || profile.channel === 'web',
    threadBinding:
      isAffordanceEnabled(profile, 'threaded_followup') ||
      profile.channel === 'discord' ||
      profile.channel === 'slack' ||
      profile.channel === 'teams' ||
      profile.channel === 'web',
    fallbackText: true,
  };
}
