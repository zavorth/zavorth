---
name: minecraft-modpack-server
description: Zavorth-native capability route for Minecraft Modpack Server.
---

# Minecraft Modpack Server

ZAVORTH_EXPANSION_GENERATED: true

This skill is a Zavorth-native capability stub. It gives the agent routing context and operating guardrails, but it does not copy or execute upstream skill scripts.

## When To Use

- the user asks for Minecraft Modpack Server.
- the task belongs to the gaming capability area.

## Operating Contract

- Route through Natural First Runtime before any tool use.
- Treat external services, account changes, writes, payments, messaging, code execution and system changes as approval-required.
- Use typed Zavorth connectors when available; otherwise produce a preview and ask for operator approval.
- Do not run upstream scripts directly from this skill.
- Record receipts for actions, denials and fallbacks.

## Capability Metadata

- Category: gaming
- Permission: approval-required
- Risk: medium
- Tags: gaming, minecraft, server, neoforge, forge, modpack, minecraft-modpack-server, host, modded, servers
