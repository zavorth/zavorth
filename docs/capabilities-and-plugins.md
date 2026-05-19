# Capabilities, Plugins, Skills And MCPs

Capabilities describe what Zavorth can do. Plugins, skills and MCP servers are
ways to add or expose capabilities while keeping policy in the middle.

## Capability Types

- built-in runtime capabilities;
- channel capabilities;
- provider capabilities;
- imported skills;
- MCP tools;
- plugins and extension manifests;
- perception and device capabilities.

## Governance Rules

- imported skills are instructions by default, not executable code;
- live tools require policy and approval when risk is elevated;
- unknown capability sources should start in preview or quarantine;
- channel and provider capabilities need live readiness, not just a manifest.

## Daily Use

Users should be able to ask naturally:

- use the best skill for this;
- check which channels are ready;
- use subagents for this audit;
- inspect the connected device;
- schedule this recurring task.

The runtime should select capabilities when confidence is high and ask for
confirmation when there is ambiguity or risk.

## Related

- [Channel Mesh](/docs/channel-mesh.md)
- [Provider Mesh](/docs/provider-mesh.md)
- [Roadmap](/docs/product-direction.md)
