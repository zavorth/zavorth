import { NextResponse } from "next/server";
import {
  getRuntimeEngineApiState,
  isExecutionEngineId,
  isUnsafeCrossSiteMutation,
  readJsonBody,
} from "../../runtime-engine-state";

export const runtime = "nodejs";

const DIFF_ACTIONS = new Set(["accept-file", "reject-file", "accept-hunk", "reject-hunk"]);

export async function POST(request: Request) {
  if (isUnsafeCrossSiteMutation(request)) {
    return NextResponse.json({
      ok: false,
      error: "cross-site mutation requests are blocked",
    }, { status: 403 });
  }
  const body = await readJsonBody(request);
  if (!DIFF_ACTIONS.has(String(body.action))) {
    return NextResponse.json({
      ok: false,
      error: "action must be accept-file, reject-file, accept-hunk or reject-hunk",
    }, { status: 400 });
  }
  const targetId = typeof body.targetId === "string" ? body.targetId : "";
  if (!targetId) {
    return NextResponse.json({
      ok: false,
      error: "targetId is required",
    }, { status: 400 });
  }

  const { diffReview, registry } = getRuntimeEngineApiState();
  const input = {
    action: body.action as never,
    targetId,
    engineId: isExecutionEngineId(body.engineId) ? body.engineId : registry.getActiveEngineId(),
    targetPath: typeof body.targetPath === "string" ? body.targetPath : null,
    diffText: typeof body.diffText === "string" ? body.diffText : null,
  };
  const result = body.apply === true
    ? diffReview.apply({
      ...input,
      dryRun: body.dryRun === true,
    })
    : null;
  const review = result?.review ?? diffReview.review(input);

  return NextResponse.json({
    ok: true,
    review,
    result,
  });
}
