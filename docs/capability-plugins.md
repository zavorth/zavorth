# Capability Plugins

Capability plugins are one way to describe extra commands, matchers or actions
for Zavorth. They are not a bypass around the runtime policy.

## What A Plugin May Provide

- command metadata;
- aliases;
- matchers;
- setup hints;
- safe actions;
- links to skills or MCP tools.

## Safety Expectations

- default to preview for new or unknown sources;
- require trust before live use;
- keep secrets as SecretRefs;
- do not execute setup scripts without policy and approval;
- record receipts for install, trust, review and removal.

## Relationship To Skills And MCP

Skills are governed instructions. MCP servers expose tools. Capability plugins
can help users discover and route those capabilities, but the action still goes
through Zavorth policy.

## Related

- [Capabilities](/docs/08-capabilities-plugins.md)
- [Security](/docs/05-security.md)
- [Roadmap](/docs/11-roadmap.md)
