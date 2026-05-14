import {
  buildGatewayControlReadPayload,
  parseGatewayControlRouteOptions,
} from "../gatewayControlRouteSupport.js";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  return Response.json(buildGatewayControlReadPayload("cache", parseGatewayControlRouteOptions(request)));
}
