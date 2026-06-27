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

## MCP Readiness States

MCP entries move through three explicit states:

- **Catalogued**: the platform registry knows about the MCP, but there is no local execution manifest yet.
- **Manifest-backed disabled**: `config/mcp-servers.json` declares the server with `enabled: false`; it can be reviewed, audited and shown in the platform plane, but it cannot execute.
- **Enabled**: the manifest enables the server and policy still decides which tools can run, which tools need approval, and which tools remain blocked.

The bundled filesystem, reasoning and Playwright MCP entries start as manifest-backed disabled candidates. This keeps the marketplace and platform registry concrete without silently granting executable MCP access.

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

- [Capabilities](/docs/capabilities.md)
- [Channel Mesh](/docs/channel-mesh.md)
- [Provider Mesh](/docs/provider-mesh.md)
- [Product Principles](/docs/product-direction.md)
