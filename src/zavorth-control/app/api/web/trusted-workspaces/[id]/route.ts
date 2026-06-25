import { NextResponse } from "next/server";
import {
  getRuntimeEngineApiState,
  isUnsafeCrossSiteMutation,
} from "../../runtime-engine-state";

export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> } | { params: { id: string } },
) {
  if (isUnsafeCrossSiteMutation(request)) {
    return NextResponse.json({
      ok: false,
      error: "cross-site mutation requests are blocked",
    }, { status: 403 });
  }
  const params = "then" in context.params ? await context.params : context.params;
  const { trustedWorkspaces } = getRuntimeEngineApiState();
  const removed = trustedWorkspaces.remove(decodeURIComponent(params.id));
  return NextResponse.json({
    ok: removed,
    removed,
    policies: trustedWorkspaces.list(),
  }, { status: removed ? 200 : 404 });
}
