import { NextResponse } from "next/server";
import { requireStrictManagementAuth } from "@/lib/api/requireManagementAuth";
import { getRegisteredKey, revokeRegisteredKey } from "@/lib/db/registeredKeys";

// ─── GET /api/v1/registered-keys/[id] ────────────────────────────────────────

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireStrictManagementAuth(request);
  if (authError) return authError;

  const resolvedParams = await params;
  const key = getRegisteredKey(resolvedParams.id);
  if (!key) {
    return NextResponse.json({ error: "Key not found" }, { status: 404 });
  }

  return NextResponse.json({ key });
}

// ─── DELETE /api/v1/registered-keys/[id] ─────────────────────────────────────

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireStrictManagementAuth(request);
  if (authError) return authError;

  const resolvedParams = await params;
  const revoked = revokeRegisteredKey(resolvedParams.id);
  if (!revoked) {
    return NextResponse.json({ error: "Key not found or already revoked" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    id: resolvedParams.id,
    revokedAt: new Date().toISOString(),
  });
}
