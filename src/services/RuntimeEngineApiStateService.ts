import { CanvasEgressGuardService } from './CanvasEgressGuardService';
import { CanvasPreviewServer } from './CanvasPreviewServer';
import { CanvasSessionService } from './CanvasSessionService';
import { ExecutionEngineRegistryService } from './ExecutionEngineRegistryService';
import { ExecutionEngineRouterService } from './ExecutionEngineRouterService';
import { GlassBoxTraceService } from './GlassBoxTraceService';
import { InteractiveDiffReviewService } from './InteractiveDiffReviewService';
import { TrustedWorkspacePolicyService } from './TrustedWorkspacePolicyService';

export type RuntimeEngineApiState = {
  registry: ExecutionEngineRegistryService;
  trustedWorkspaces: TrustedWorkspacePolicyService;
  trace: GlassBoxTraceService;
  router: ExecutionEngineRouterService;
  diffReview: InteractiveDiffReviewService;
  canvasEgressGuard: CanvasEgressGuardService;
  canvasPreviewServer: CanvasPreviewServer;
  canvasSessions: CanvasSessionService;
};

let state: RuntimeEngineApiState | null = null;

declare global {
  // eslint-disable-next-line no-var
  var __zavorthRuntimeEngineApiState: RuntimeEngineApiState | undefined;
}

export function getRuntimeEngineApiState(): RuntimeEngineApiState {
  if (state) return state;
  if (globalThis.__zavorthRuntimeEngineApiState) {
    state = globalThis.__zavorthRuntimeEngineApiState || null;
    if (state) return state;
  }

  const registry = new ExecutionEngineRegistryService();
  const trustedWorkspaces = new TrustedWorkspacePolicyService();
  const trace = new GlassBoxTraceService();
  const canvasEgressGuard = new CanvasEgressGuardService();
  const canvasPreviewServer = new CanvasPreviewServer(canvasEgressGuard);
  state = {
    registry,
    trustedWorkspaces,
    trace,
    router: new ExecutionEngineRouterService(registry, trustedWorkspaces, trace),
    diffReview: new InteractiveDiffReviewService(trustedWorkspaces, trace),
    canvasEgressGuard,
    canvasPreviewServer,
    canvasSessions: new CanvasSessionService(canvasPreviewServer, trace),
  };
  globalThis.__zavorthRuntimeEngineApiState = state;
  return state;
}
