/**
 * Named builtin surface profiles for callers/tests (F1 + F2 compatibility).
 * Backed by SurfaceProfileRegistry — do not fork capability truth here.
 */

import type { SurfaceProfile } from '../../../../contracts/surface/SurfaceAffordanceContract.js';
import {
  isSurfaceAffordanceEnabled,
  listSurfaceProfiles,
  resolveSurfaceProfileForChannel,
  snapshotBuiltinProfile,
} from './SurfaceProfileRegistry.js';

export const TELEGRAM_SURFACE_PROFILE: SurfaceProfile = snapshotBuiltinProfile('telegram');
export const DISCORD_SURFACE_PROFILE: SurfaceProfile = snapshotBuiltinProfile('discord');
export const WEB_SURFACE_PROFILE: SurfaceProfile = snapshotBuiltinProfile('web');
export const CLI_SURFACE_PROFILE: SurfaceProfile = snapshotBuiltinProfile('cli');
export const PLAIN_SURFACE_PROFILE: SurfaceProfile = snapshotBuiltinProfile('plain');
export const SIGNAL_SURFACE_PROFILE: SurfaceProfile = snapshotBuiltinProfile('signal');
export const SLACK_SURFACE_PROFILE: SurfaceProfile = snapshotBuiltinProfile('slack');
export const RICH_SELECT_SURFACE_PROFILE: SurfaceProfile = snapshotBuiltinProfile('rich-select');

export function listBuiltinSurfaceProfiles(): SurfaceProfile[] {
  return listSurfaceProfiles();
}

export { resolveSurfaceProfileForChannel, isSurfaceAffordanceEnabled };
