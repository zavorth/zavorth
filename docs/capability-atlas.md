# Capability Atlas

The Capability Atlas is Zavorth's canonical map of what the local agent can do.

It exists so users, the CLI, the dashboard, the TUI and the LLM runtime do not need to guess from scattered files. The Atlas lists the major Zavorth abilities, their natural aliases, their safe entry points, their Action Harness routes, their visible surfaces and their current discovery status.

## Use It

```bash
zavorth atlas
zavorth atlas --query mnemos
npm run zavorth:capability-atlas:json --silent
zavorth actions lookup "what can Zavorth do with memory?"
```

## What It Covers

The Atlas includes the main Zavorth-native planes:

- Action Harness
- Agent Kernel Snapshot
- Echo Voice
- Mnemos Memory
- Nexus
- Provider Mesh
- Channel Mesh
- Skill Curator Plane
- Task and Goal Plane
- Swarm Scale Plane
- Sandbox Control Plane
- Runtime TUI
- Integration Connector Mesh
- Satellite Companion
- Operational StateDB
- Transaction and Approval Plane

## Safety

The Atlas is read-only. It explains what exists and where to use it.

Any real mutation, external send, provider switch, host execution, memory deletion or capability activation still goes through Zavorth's Action Harness, preview, approval and receipts according to profile policy.
