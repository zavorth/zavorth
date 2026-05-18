# 125 - Wave 0 Provider Capability Contracts Matrix

Status: wave-0-provider-capability-contracts-matrix-ready

Selected capability area: provider-capability-contracts.

Evidence:
- docs/118-wave-0-gateway-capability-matrix.md
- docs/124-wave-1-plugin-runtime-registry-boundary-slice.md
- docs/126-wave-1-provider-capability-test-design.md

No real sidecar, real adapter, provider SDK load, live provider call, executable setup, command surfaces, source modules or credentials are authorized here.
no real sidecar, real adapter, provider SDK load, live provider call
No source provider SDK is loaded. Live provider calls remain blocked.

| Item | Decision | Zavorth contract | Test gate | Status |
| --- | --- | --- | --- | --- |
| `provider-identity-catalog` | `absorb` | ZavorthProviderCatalogRecord/v1 | Add provider-identity-catalog fixture test before implementation | Wave-0-provider-ready |
| `provider-secret-ref-boundary` | `absorb` | SecretRef boundary | Add provider-secret-ref-boundary fixture test before implementation | Wave-0-provider-ready |
| `provider-embedding-contracts` | `adapt` | Zavorth embedding contract | Add provider-embedding-contracts fixture test before implementation | Wave-0-provider-ready |
| `provider-speech-transcription-contracts` | `adapt` | Zavorth speech transcription contract | Add provider-speech-transcription-contracts fixture test before implementation | Wave-0-provider-ready |
| `provider-realtime-voice-contracts` | `adapt` | Zavorth realtime voice contract | Add provider-realtime-voice-contracts fixture test before implementation | Wave-0-provider-ready |
| `provider-media-understanding-contracts` | `adapt` | Zavorth media understanding contract | Add provider-media-understanding-contracts fixture test before implementation | Wave-0-provider-ready |
| `provider-generation-contracts` | `replace` | Zavorth generation contract | Add provider-generation-contracts fixture test before implementation | Wave-0-provider-ready |
| `provider-web-search-fetch-contracts` | `adapt` | ToolExposurePolicyInput web search/fetch contract | Add provider-web-search-fetch-contracts fixture test before implementation | Wave-0-provider-ready |
| `provider-activation-setup-qa-runners` | `deferred` | Zavorth activation QA gate | Deferred until explicit operator phase | Wave-0-provider-deferred |
| `provider-source-implementation-modules` | `rejected` | Evidence-only source posture | Rejected; do not copy source module | Wave-0-provider-rejected |

Plugin command and HTTP surfaces remain deferred.
