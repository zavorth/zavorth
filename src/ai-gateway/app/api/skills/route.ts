import { NextResponse } from "next/server";
import { skillRegistry } from "@/lib/skills/registry";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    await skillRegistry.loadFromDatabase();
    const skills = skillRegistry.list();
    return NextResponse.json({ skills });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error }, { status: 500 });
  }
}
