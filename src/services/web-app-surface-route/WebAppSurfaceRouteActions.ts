import { NaturalSetupMutationPlannerService } from '../NaturalSetupMutationPlannerService.js';
import type { WebAppSurfaceRouteDeps } from './WebAppSurfaceRouteTypes.js';

export function buildNaturalSetupMutationPlanner(deps: WebAppSurfaceRouteDeps) {
  return deps.naturalSetupMutationPlanner || new NaturalSetupMutationPlannerService({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    controlPlaneService: deps.naturalSetupControlPlane as any || undefined,
    channelSetupAssistant: deps.channelSetupAssistant || null,
    channelActions: deps.channelActions || null,
  });
}

export function getCodexRemoteRequireApproval(actionId: string): boolean {
  return (
    actionId === 'select-profile'
    || actionId === 'create-profile'
    || actionId === 'update-profile'
    || actionId === 'delete-profile'
    || actionId === 'start-session'
    || actionId === 'resume-session'
    || actionId === 'spawn-web-session'
    || actionId === 'open-web-session'
  );
}

export function buildCodexRemoteActionInput(deps: WebAppSurfaceRouteDeps, body: Record<string, unknown>, actionId: string) {
  return {
    actionId,
    profileId: String(body.profileId || '').trim() || null,
    profileLabel: String(body.profileLabel || '').trim() || null,
    profileDescription: String(body.profileDescription || '').trim() || null,
    codexCliPath: String(body.codexCliPath || '').trim() || null,
    codexHome: String(body.codexHome || '').trim() || null,
    prompt: String(body.prompt || '').trim() || null,
    title: String(body.title || '').trim() || null,
    sessionId: String(body.sessionId || '').trim() || null,
    permissionId: String(body.permissionId || '').trim() || null,
    decisionNote: String(body.decisionNote || '').trim() || null,
    workspaceRoot: String(body.workspaceRoot || '').trim() || null,
    runtimeUserId: deps.runtime?.webUserId || 'web',
    sourceSurface: 'web',
    requireApproval: body.requireApproval === undefined
      ? getCodexRemoteRequireApproval(actionId)
      : body.requireApproval !== false,
    sessionSpawner: deps.gatewayChannelRouter,
  };
}
