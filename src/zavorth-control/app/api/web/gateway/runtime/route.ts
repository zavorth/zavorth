import { NextResponse } from "next/server";
import { buildGatewayRuntime } from "../../zavorthControl/zavorthControlApiSnapshot";

export async function GET() {
  return NextResponse.json(buildGatewayRuntime());
}

