import { NextResponse } from "next/server";
import { MCP_TOOLS, MCP_TOOL_MAP } from "@ZavorthGateway/open-sse/mcp-server/schemas/tools";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { logger } from '@/shared/utils/logger';
export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    return NextResponse.json({
      total: MCP_TOOLS.length,
      mappedTotal: Object.keys(MCP_TOOL_MAP).length,
      tools: MCP_TOOLS.map((tool) => ({
        name: tool.name,
        description: tool.description,
        scopes: [...tool.scopes],
        stage: tool.phase,
        auditLevel: tool.auditLevel,
        sourceEndpoints: [...tool.sourceEndpoints],
      })),
    });
  } catch (error: unknown) {
    logger.warn('[route] array operation failed', error);
    const message = error instanceof Error ? error.message : "Failed to load MCP tools";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
