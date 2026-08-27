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
  zavorthEnsembleService: WebAppRuntimeRouteDeps['zavorthEnsemble'];
  swarmScalePlaneService: WebAppRuntimeRouteDeps['swarmScalePlane'];
  sessionV2Label: string;
  zavorthEnsembleLabel: string;
  isSessionV2Route: (suffix?: string) => boolean;
  isSessionV2RecordingRoute: boolean;
  isZavorthEnsembleRoute: (suffix?: string) => boolean;
  isSwarmScaleRoute: (suffix?: string) => boolean;
};

export type WebAppSupervisionRouteHandler = (
  ctx: WebAppSupervisionRouteContext,
) => Promise<boolean>;
