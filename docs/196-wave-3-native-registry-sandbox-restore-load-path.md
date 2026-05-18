# 196 - Wave 3 Native Registry Sandbox Restore Load Path

Status: native-registry-sandbox-restore-load-ready

Evidence: docs/195-wave-3-native-registry-sandbox-persistence.md

Contracts:
- ZavorthNativeRegistrySandboxRestoreReceipt/v1
- ZavorthNativeRegistrySandboxRestoredView/v1
- ZavorthNativeRegistrySandboxRestoredCommandCenterProjection/v1

Guarantees:
- nativeRegistryRestoreMode=sandbox-live
- persistentReadActuallyPerformed=true
- runtimeExternalExecutorRequiredForRestore=false
- runtimeExternalExecutorRequiredForRestoredLookup=false
- runtimeExternalExecutorRequiredForRestoredRender=false

native registry production storage design follow-up: docs/197-wave-3-native-registry-production-storage-design.md

Do not advance to `198` until sandbox restore/load and production storage design are green.
