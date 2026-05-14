import {
  renderCliSurfaceResponse,
  type SurfaceRenderedResponse,
  type SurfaceRenderOptions,
  type SurfaceResponse,
} from '../domain/surface/application/surface-response/index.js';

export function formatCliSurfaceResponse(
  response: SurfaceResponse,
  options: SurfaceRenderOptions = {},
): string {
  return renderCliSurfaceResponse(response, options).text;
}

export function renderCliSurfaceResponsePacket(
  response: SurfaceResponse,
  options: SurfaceRenderOptions = {},
): SurfaceRenderedResponse<null> {
  return renderCliSurfaceResponse(response, options);
}
