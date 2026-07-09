import { NextResponse } from "next/server";
import {
  detectInstalledAgents,
  refreshAgentCache,
  setCustomAgents,
  getCustomAgentDefs,
  type CustomAgentDef,
} from "@/lib/acp/registry";
import { getSettings, updateSettings } from "@/lib/localDb";

import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { jsonObjectSchema } from "@/shared/validation/schemas";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";
import { logger } from '@/shared/utils/logger';export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    // Load custom agents from settings on each GET to stay in sync
    const settings = await getSettings();
    if (settings.customAgents) {
      setCustomAgents(settings.customAgents as CustomAgentDef[]);
    }

    const agents = detectInstalledAgents();
    const installed = agents.filter((a) => a.installed).length;
    const total = agents.length;

    return NextResponse.json({
      agents,
      summary: {
        total,
        installed,
        notFound: total - installed,
        builtIn: agents.filter((a) => !a.isCustom).length,
        custom: agents.filter((a) => a.isCustom).length,
      },
    });
  } catch (error: unknown) {console.error("Error detecting agents:", error);
    return NextResponse.json({ error: "Failed to detect agents" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch (error: unknown) {logger.warn('[route] filesystem check failed', error);
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateBody(jsonObjectSchema, rawBody);
  if (isValidationFailure(validation)) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const body = validation.data;

    if (body.action === "refresh") {
      const agents = refreshAgentCache();
      return NextResponse.json({ agents, refreshed: true });
    }

    // Add custom agent
    const { id, name, binary, versionCommand, providerAlias, spawnArgs, protocol } = body;
    if (!id || !name || !binary || !versionCommand) {
      return NextResponse.json(
        { error: "Missing required fields: id, name, binary, versionCommand" },
        { status: 400 }
      );
    }

    const newAgent: CustomAgentDef = {
      id: (id as string).toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      name: name as string,
      binary: binary as string,
      versionCommand: versionCommand as string,
      providerAlias: (providerAlias as string) || (id as string),
      spawnArgs: Array.isArray(spawnArgs) ? (spawnArgs as string[]) : [],
      protocol: (protocol as "stdio" | "http") || "stdio",
    };

    // Load current, append, save
    const settings = await getSettings();
    const current: CustomAgentDef[] = (settings.customAgents as CustomAgentDef[]) || [];

    // Avoid duplicates
    if (current.some((a) => a.id === newAgent.id)) {
      return NextResponse.json(
        { error: `Agent with id '${newAgent.id}' already exists` },
        { status: 409 }
      );
    }

    const updated = [...current, newAgent];
    await updateSettings({ customAgents: updated });
    setCustomAgents(updated);

    // Refresh cache to detect the new agent
    const agents = refreshAgentCache();
    return NextResponse.json({ agents, added: newAgent });
  } catch (error: unknown) {console.error("Error adding custom agent:", error);
    return NextResponse.json({ error: "Failed to add agent" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("id");

    if (!agentId) {
      return NextResponse.json({ error: "Missing agent id" }, { status: 400 });
    }

    const settings = await getSettings();
    const current: CustomAgentDef[] = (settings.customAgents as CustomAgentDef[]) || [];
    const updated = current.filter((a) => a.id !== agentId);

    if (updated.length === current.length) {
      return NextResponse.json(
        { error: `Agent '${agentId}' not found in custom agents` },
        { status: 404 }
      );
    }

    await updateSettings({ customAgents: updated });
    setCustomAgents(updated);
    const agents = refreshAgentCache();

    return NextResponse.json({ agents, removed: agentId });
  } catch (error: unknown) {console.error("Error removing custom agent:", error);
    return NextResponse.json({ error: "Failed to remove agent" }, { status: 500 });
  }
}
