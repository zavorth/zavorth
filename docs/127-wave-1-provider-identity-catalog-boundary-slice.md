# 127 - Wave 1 Provider Identity Catalog Boundary Slice

Status: wave-1-provider-identity-catalog-boundary-ready

Selected slice: provider-identity-catalog.

Inputs:
- docs/125-wave-0-provider-capability-contracts-matrix.md
- docs/126-wave-1-provider-capability-test-design.md

Boundary files:
- ExternalAgentProviderIdentityCatalogBoundary.ts
- ExternalAgentWave1ProviderCapabilityFixtures.ts
- src/runtime/external-agents/index.ts

This slice does not authorize a real sidecar.

Blocked surfaces:
- provider SDK loader
- source provider catalog import
- source state/config/credential migration
- liveProbePerformed: false
- liveProbeAllowed: false
- sourceProviderCatalogIntroduced: false
- sourceProviderCatalogAuthoritative: false
- sourceProviderCatalogLiveProbeAuthority: false

Next provider slice:
- docs/128-wave-1-provider-secret-ref-boundary-slice.md
- SecretRef is the second provider slice

Live provider calls, provider SDK loading and source catalog authority remain blocked.
