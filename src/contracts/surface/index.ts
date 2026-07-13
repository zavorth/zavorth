export {
  ZAVORTH_SURFACE_AGENT_CONTRACT_VERSION,
  ZAVORTH_SURFACE_AGENT_GATES,
  ZAVORTH_SURFACE_AGENT_CANONICAL_PLATFORMS,
  normalizeSurfaceAgentPlatform,
  formatSurfaceAgentContractPitch,
  type SurfaceAgentGateId,
  type SurfaceAgentPlatformId,
  type SurfaceAgentRoutingKind,
  type SurfaceAgentRoutingDecision,
  type SurfaceHighRiskGateDecision,
  type SurfaceSkillInstallGateDecision,
  type SurfaceAgentContractEvaluation,
} from './SurfaceAgentContract.js';

export {
  SURFACE_AFFORDANCE_CONTRACT_VERSION,
  SURFACE_AFFORDANCE_IDS,
  isSurfaceAffordanceEnabled,
  type SurfaceAffordanceId,
  type SurfaceAffordanceLimit,
  type SurfaceAffordanceState,
  type SurfaceAffordanceMap,
  type SurfaceProfilePresetId,
  type SurfaceChannelId,
  type SurfaceProfile,
  type RegisterSurfaceProfileInput,
} from './SurfaceAffordanceContract.js';
