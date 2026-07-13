export {
  getSurfacePresetDefinition,
  listSurfacePresetIds,
  resolveAffordances,
  isAffordanceStateEnabled,
  type SurfacePresetDefinition,
} from './SurfaceAffordancePresets.js';

export {
  registerSurfaceProfile,
  getSurfaceProfile,
  listSurfaceProfiles,
  resolveSurfaceProfileForChannel,
  resetSurfaceProfileRegistryForTests,
  isAffordanceEnabled,
  getAffordanceLimits,
  normalizeChannelId,
  snapshotBuiltinProfile,
  isSurfaceAffordanceEnabled,
} from './SurfaceProfileRegistry.js';

export {
  TELEGRAM_SURFACE_PROFILE,
  DISCORD_SURFACE_PROFILE,
  WEB_SURFACE_PROFILE,
  CLI_SURFACE_PROFILE,
  PLAIN_SURFACE_PROFILE,
  SIGNAL_SURFACE_PROFILE,
  SLACK_SURFACE_PROFILE,
  RICH_SELECT_SURFACE_PROFILE,
  listBuiltinSurfaceProfiles,
} from './SurfaceProfiles.js';

export { surfaceProfileToLegacySupport } from './channelCapabilityBridge.js';

export type {
  SurfaceAffordanceId,
  SurfaceAffordanceLimit,
  SurfaceAffordanceState,
  SurfaceAffordanceMap,
  SurfaceProfilePresetId,
  SurfaceChannelId,
  SurfaceProfile,
  RegisterSurfaceProfileInput,
} from '../../../../contracts/surface/SurfaceAffordanceContract.js';

export {
  SURFACE_AFFORDANCE_CONTRACT_VERSION,
  SURFACE_AFFORDANCE_IDS,
} from '../../../../contracts/surface/SurfaceAffordanceContract.js';
