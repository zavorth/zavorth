import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";

export const dynamic = "force-dynamic";

function buildProtectedRuntimeProjection() {
  return {
    firstRun: {
      status: "ready",
      activeTemplateId: "zavorthControl-home",
      steps: [],
    },
    templates: [],
    mission: {
      active: null,
      summary: "No active protected mission.",
    },
    receipt: {
      summary: {
        approvals: 0,
        receipts: 0,
        latest: null,
      },
    },
    sandbox: {
      doctor: {
        simpleStatus: "ready",
        safeDefault: "Sandbox policy is available for governed work.",
      },
    },
  };
}

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  return NextResponse.json(buildProtectedRuntimeProjection());
}
