import { NextResponse } from "next/server";
import {
  getRuntimeEngineApiState,
  isExecutionEngineId,
  isUnsafeCrossSiteMutation,
  readJsonBody,
} from "../runtime-engine-state";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { registry, trace } = getRuntimeEngineApiState();
  const url = new URL(request.url);
  const prompt = url.searchParams.get("prompt");
  const targetPath = url.searchParams.get("targetPath");
  const operation = url.searchParams.get("operation");
  const decision = prompt || targetPath || operation
    ? getRuntimeEngineApiState().router.decide({
      prompt,
      targetPath,
      operation: operation as never,
    })
    : null;

  return NextResponse.json({
    ok: true,
    ...registry.getSnapshot(),
    decision,
    traces: trace.list(20),
  });
}

export async function POST(request: Request) {
  if (isUnsafeCrossSiteMutation(request)) {
    return NextResponse.json({
      ok: false,
      error: "cross-site mutation requests are blocked",
    }, { status: 403 });
  }
  const body = await readJsonBody(request);
  const { registry, router, trace } = getRuntimeEngineApiState();
  const action = typeof body.action === "string" ? body.action : "select";

  if (action === "decide") {
    const decision = router.decide({
      prompt: typeof body.prompt === "string" ? body.prompt : null,
      operation: typeof body.operation === "string" ? body.operation as never : undefined,
      targetPath: typeof body.targetPath === "string" ? body.targetPath : null,
      command: typeof body.command === "string" ? body.command : null,
      content: typeof body.content === "string" ? body.content : null,
      requestedEngineId: isExecutionEngineId(body.engineId) ? body.engineId : null,
      networkTargets: Array.isArray(body.networkTargets) ? body.networkTargets.filter((value): value is string => typeof value === "string") : [],
    });
    return NextResponse.json({
      ok: true,
      decision,
      traces: trace.list(20),
    });
  }

  if (!isExecutionEngineId(body.engineId)) {
    return NextResponse.json({
      ok: false,
      error: "engineId must be lite, velocity or shield",
    }, { status: 400 });
  }

  const selection = registry.select(body.engineId);
  return NextResponse.json({
    ok: selection.ok,
    ...registry.getSnapshot(),
    selection,
    traces: trace.list(20),
  }, { status: selection.ok ? 200 : 423 });
}
