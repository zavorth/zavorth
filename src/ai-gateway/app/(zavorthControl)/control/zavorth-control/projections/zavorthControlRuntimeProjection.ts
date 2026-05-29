import type { ZavorthControlProviderCockpitSnapshot } from "../contracts/zavorthControlZavorthControlObservabilityContracts";

export interface ZavorthControlRuntimeProjection {
  providerCockpit?: ZavorthControlProviderCockpitSnapshot | null;
}
