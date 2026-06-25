import {
  buildGatewayControlDelegatedOperationPayload,
  buildGatewayControlOperationRouteOptions,
  readGatewayControlJsonBody,
} from "../../gatewayControlRouteSupport.js";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";

export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const parsed = await readGatewayControlJsonBody(request);
  const payload = await buildGatewayControlDelegatedOperationPayload(
    "combos.validate",
    parsed.ok ? parsed.body : {},
    buildGatewayControlOperationRouteOptions(request),
  );
  return Response.json(payload, { status: payload.httpStatus });
}
