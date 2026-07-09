import { atom } from 'nanostores';
import { defaultWorkspaceScopes, type DesktopWorkspaceScope } from '../workspaceScopes';
import type { ChannelSetupSnapshot, GatewayResilienceSnapshot, RuntimeCapabilitiesSnapshot } from '../apiClient';

export const $workspaceScopes = atom<DesktopWorkspaceScope[]>(defaultWorkspaceScopes);
export const $workspaceScopeId = atom('local');
export const $nexusStatus = atom<unknown>(null);
export const $channelSetup = atom<ChannelSetupSnapshot | null>(null);
export const $gatewayResilience = atom<GatewayResilienceSnapshot | null>(null);
export const $runtimeCapabilities = atom<RuntimeCapabilitiesSnapshot | null>(null);

export function setWorkspaceScopes(s: DesktopWorkspaceScope[] | ((current: DesktopWorkspaceScope[]) => DesktopWorkspaceScope[])) {
  if (typeof s === 'function') {
    $workspaceScopes.set(s($workspaceScopes.get()));
  } else {
    $workspaceScopes.set(s);
  }
}
export function setWorkspaceScopeId(id: string) { $workspaceScopeId.set(id); }
export function addWorkspaceScope(scope: DesktopWorkspaceScope) {
  const current = $workspaceScopes.get();
  if (!current.some(s => s.id === scope.id)) {
    $workspaceScopes.set([...current, scope]);
  }
}
export function setNexusStatus(s: unknown) { $nexusStatus.set(s); }
export function setChannelSetup(c: ChannelSetupSnapshot | null) { $channelSetup.set(c); }
export function setGatewayResilience(g: GatewayResilienceSnapshot | null) { $gatewayResilience.set(g); }
export function setRuntimeCapabilities(r: RuntimeCapabilitiesSnapshot | null) { $runtimeCapabilities.set(r); }
