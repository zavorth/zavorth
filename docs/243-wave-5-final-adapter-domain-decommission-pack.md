# 243 - Wave 5 Final Adapter Domain Decommission Pack

Status: `final-adapter-domain-decommission-ready`

Boundary: `src/runtime/external-agents/ZavorthFinalAdapterDomainDecommissionPack.ts`

- ZavorthFinalAdapterDomainDecommissionPack/v1
- ZavorthFinalAdapterDomainInventoryRow/v1
- ZavorthFinalAdapterDomainImplementationRow/v1
- ZavorthFinalAdapterDomainReport/v1
- finalAdapterDomainDecommissionPackCreated=true
- absorbedDomainsAdapterDefaultRemoved=true
- adapterDefaultPathForAbsorbedDomains=false
- adapterGlobalStillAvailableIfRefreshNeeded=true
- adapterRemovalGlobalAllowed=false
- runtimeExternalExecutorRequiredForAbsorbedDomains=false
- publicExternalExecutorIdentityLeak=false

Do not advance to the final Zavorth-only hardening/report pack until this pack
keeps default runtime ownership inside Zavorth.

## Final Zavorth-Only Follow-Up

- docs/244-final-zavorth-only-absorption-hardening-and-report.md
- It does not reintroduce ExternalExecutor as a default runtime.
