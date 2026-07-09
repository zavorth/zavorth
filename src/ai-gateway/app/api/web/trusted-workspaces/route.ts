import { NextResponse } from "next/server";
import { logger } from '@/shared/utils/logger';
import {
getRuntimeEngineApiState,
  isTrustedWorkspaceState,
  isUnsafeCrossSiteMutation,
  readJsonBody,
} from "../runtime-engine-state";
import { asErrorLike } from '../../../../../utils/errorLike.js';

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { trustedWorkspaces } = getRuntimeEngineApiState();
  const url = new URL(request.url);
  const targetPath = url.searchParams.get("targetPath");
  return NextResponse.json({
    ok: true,
    policies: trustedWorkspaces.list(),
    evaluation: targetPath ? trustedWorkspaces.evaluate(targetPath) : null,
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
  const workspacePath = typeof body.path === "string" ? body.path.trim() : "";
  if (!workspacePath) {
    return NextResponse.json({
      ok: false,
      error: "path is required",
    }, { status: 400 });
  }

  const { trustedWorkspaces } = getRuntimeEngineApiState();
  const validation = trustedWorkspaces.validatePolicyInput(workspacePath);
  if (!validation.ok) {
    return NextResponse.json({
      ok: false,
      error: validation.reason,
      path: validation.path,
    }, { status: 400 });
  }

  let policy;
  try {
    policy = trustedWorkspaces.add({
      path: workspacePath,
      label: typeof body.label === "string" ? body.label : undefined,
      state: isTrustedWorkspaceState(body.state) ? body.state : "trusted",
    });
  } catch (error: unknown) {
    const err = asErrorLike(error);
    logger.warn('[route] validation failed', error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? err.message : "trusted workspace rejected",
    }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    policy,
    policies: trustedWorkspaces.list(),
  });
}
