import {
  DeveloperWorkspaceSurfacePresenter,
  DeveloperWorkspaceSurfaceService,
  type DeveloperWorkspaceSurfaceActionInput,
} from "../../../../domain/surface/index.js";

const developerWorkspaceService = new DeveloperWorkspaceSurfaceService();
const developerWorkspacePresenter = new DeveloperWorkspaceSurfacePresenter();

export type DeveloperWorkspaceRouteOptions = {
  cwd?: string | null;
  manifestPath?: string | null;
  service?: DeveloperWorkspaceSurfaceService;
  presenter?: DeveloperWorkspaceSurfacePresenter;
};

export function parseDeveloperWorkspaceRouteOptions(request: Request): DeveloperWorkspaceRouteOptions {
  const searchParams = new URL(request.url).searchParams;
  return {
    cwd: searchParams.get("cwd"),
    manifestPath: searchParams.get("manifestPath"),
  };
}

export function buildDeveloperWorkspaceReadPayload(
  options: DeveloperWorkspaceRouteOptions = {},
): Record<string, unknown> {
  const service = options.service || developerWorkspaceService;
  const presenter = options.presenter || developerWorkspacePresenter;
  return presenter.toReadPayload(service.buildSnapshot({
    cwd: options.cwd,
    manifestPath: options.manifestPath,
  }));
}

export async function buildDeveloperWorkspaceActionPayload(
  request: Request,
  options: DeveloperWorkspaceRouteOptions = {},
): Promise<{ payload: Record<string, unknown>; httpStatus: number }> {
  const service = options.service || developerWorkspaceService;
  const presenter = options.presenter || developerWorkspacePresenter;
  const body = await readDeveloperWorkspaceJsonBody(request);
  const input = {
    ...(body || {}),
    cwd: options.cwd,
    manifestPath: options.manifestPath,
  } as DeveloperWorkspaceSurfaceActionInput;
  const result = service.executeAction(input);
  return {
    payload: presenter.toActionPayload(result),
    httpStatus: result.httpStatus,
  };
}

async function readDeveloperWorkspaceJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body)
      ? body as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}
