import { NextResponse } from "next/server";
import { requireControlAuth } from "@/lib/api/requireManagementAuth";
import { buildGatewayRuntime } from "../../zavorthControl/zavorthControlApiSnapshot";

export async function GET(request: Request) {
  const authError = await requireControlAuth(request);
  if (authError) return authError;
  return NextResponse.json(buildGatewayRuntime());
}

