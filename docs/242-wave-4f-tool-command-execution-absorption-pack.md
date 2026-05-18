# 242 - Wave 4F Tool Command Execution Absorption Pack

Status: `tool-command-execution-absorption-pack-ready`

Boundary: `src/runtime/external-agents/ZavorthWave4FToolCommandExecutionAbsorptionPack.ts`

- ZavorthWave4FToolCommandExecutionAbsorptionPack/v1
- ZavorthWave4FToolCommandReadinessRecord/v1
- ZavorthWave4FToolCommandDryRunEnvelope/v1
- ZavorthWave4FToolCommandSandboxExecutionReceipt/v1
- ZAVORTH_WAVE4F_TOOL_COMMAND_EXECUTION_EXECUTE
- toolCommandExecutionAbsorptionPackCreated=true
- toolCommandDryRunSupported=true
- toolCommandRealExecutionOnlySandboxNoopOrReadOnlyWhenFlagEnabled=true
- dangerousToolCommandExecutionAllowed=false
- filesystemMutationAllowed=false
- networkMutationAllowed=false
- processSpawnAllowedOnlyIfSandboxApproved=true
- final-adapter-domain-decommission-pack

Tool/command classes:

- sandbox/no-op
- read-only
- dry-run-only
- approval-required
- blocked
- unknown

## Final Adapter Domain Decommission Follow-Up

- docs/243-wave-5-final-adapter-domain-decommission-pack.md
- Do not advance beyond `243` without the final adapter domain decommission pack.
