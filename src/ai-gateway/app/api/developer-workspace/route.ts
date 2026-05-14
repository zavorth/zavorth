import {
  buildDeveloperWorkspaceActionPayload,
  buildDeveloperWorkspaceReadPayload,
  parseDeveloperWorkspaceRouteOptions,
} from "./developerWorkspaceRouteSupport.js";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  return Response.json(buildDeveloperWorkspaceReadPayload(parseDeveloperWorkspaceRouteOptions(request)));
}

export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const result = await buildDeveloperWorkspaceActionPayload(
    request,
    parseDeveloperWorkspaceRouteOptions(request),
  );
  return Response.json(result.payload, { status: result.httpStatus });
}
