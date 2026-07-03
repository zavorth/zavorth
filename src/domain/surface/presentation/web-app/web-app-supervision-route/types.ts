import * as http from 'http';
import type { WebAppRuntimeRouteDeps } from '../WebAppRuntimeRouteService.js';

export type WebAppSupervisionRouteContext = {
  req: http.IncomingMessage;
  res: http.ServerResponse;
  url: URL;
  pathname: string;
  deps: WebAppRuntimeRouteDeps;
  experimentalAlias: boolean;
  sessionV2Service: WebAppRuntimeRouteDeps['sessionV2'];
  swarmV2Service: WebAppRuntimeRouteDeps['swarmV2'];
  swarmScalePlaneService: WebAppRuntimeRouteDeps['swarmScalePlane'];
  sessionV2Label: string;
  swarmV2Label: string;
  isSessionV2Route: (suffix?: string) => boolean;
  isSessionV2RecordingRoute: boolean;
  isSwarmV2Route: (suffix?: string) => boolean;
  isSwarmScaleRoute: (suffix?: string) => boolean;
};

export type WebAppSupervisionRouteHandler = (
  ctx: WebAppSupervisionRouteContext,
) => Promise<boolean>;
