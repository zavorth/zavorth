import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";import type {
  RemoteMeshNotebookMcpProxyApplyRequest,
} from "../../../../../../contracts/RemoteMeshNotebookMcpProxyContract.js";
import { RemoteMeshNotebookMcpProxyService } from "../../../../../../services/RemoteMeshNotebookMcpProxyService.js";

import { logger } from '@/shared/utils/logger';

export const runtime = "nodejs";

export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  let payload: RemoteMeshNotebookMcpProxyApplyRequest;
  try {
    payload = await request.json() as RemoteMeshNotebookMcpProxyApplyRequest;
  } catch (error: unknown) {logger.warn('[route] load operation failed', error);
    return NextResponse.json(
      { ok: false, error: "Invalid Remote Mesh MCP proxy JSON body." },
      { status: 400 },
    );
  }

  const result = await RemoteMeshNotebookMcpProxyService.fromEnv().apply(payload);
  const status = result.ok ? 200 : result.status === "blocked" ? 400 : 502;
  return NextResponse.json(result, { status });
}
