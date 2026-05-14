import type { ZavorthCliFlags, ZavorthCliRuntime, CliExecutionResult, CliWriter } from './ZavorthCliContract.js';
import {
  buildCliNodeMeshDoctorSnapshot,
  buildCliRuntimeAccessProbeInput,
  formatNodeCapabilities,
  formatNodeInvokeResult,
  formatNodeMeshActivity,
  formatNodeMeshDoctorSnapshot,
  formatNodeMeshSnapshot,
  formatNodePairingDraft,
  formatNodeProfiles,
  parseCliNodeInvokeArgs,
  parseCliNodePairArgs,
  resolveNodeIntent,
  withCliConsoleSuppressed,
} from './ZavorthCliNativeRenderers.js';
import { withFilteredCliStartupLogs } from './ZavorthCliFlowHelpers.js';

type RegistryCommandParams = {
  runtime: ZavorthCliRuntime;
  effectiveFlags: ZavorthCliFlags;
  commandName: string | null;
  args: string;
  writer: CliWriter;
};

export async function handleZavorthCliRegistryNodesCommand(params: RegistryCommandParams): Promise<CliExecutionResult | null> {
  const { runtime, effectiveFlags, commandName, args, writer } = params;

  if (commandName === 'nodes' && runtime.nodeMeshService) {
    const nodeIntent = resolveNodeIntent(args);
    if (nodeIntent.mode === 'profiles' && runtime.nodeDeviceProfileService) {
      const profiles = runtime.nodeDeviceProfileService.listProfiles();
      const body = effectiveFlags.json
        ? JSON.stringify(profiles, null, 2)
        : formatNodeProfiles(profiles);
      writer.line(body);
      return { ok: true, handled: true, output: [body], error: null };
    }
    if (nodeIntent.mode === 'capabilities' && runtime.nodeCapabilityService) {
      const capabilities = runtime.nodeCapabilityService.listCatalog();
      const body = effectiveFlags.json
        ? JSON.stringify(capabilities, null, 2)
        : formatNodeCapabilities(capabilities);
      writer.line(body);
      return { ok: true, handled: true, output: [body], error: null };
    }
    if (nodeIntent.mode === 'doctor' && runtime.runtimeAccessReadinessService) {
      const probeInput = await buildCliRuntimeAccessProbeInput(runtime);
      const report = effectiveFlags.live && typeof runtime.runtimeAccessReadinessService.inspectLive === 'function'
        ? await runtime.runtimeAccessReadinessService.inspectLive(probeInput as any)
        : runtime.runtimeAccessReadinessService.inspect(probeInput as any);
      const snapshot = buildCliNodeMeshDoctorSnapshot(report);
      const body = effectiveFlags.json
        ? JSON.stringify(snapshot, null, 2)
        : formatNodeMeshDoctorSnapshot(snapshot);
      writer.line(body);
      return { ok: true, handled: true, output: [body], error: null };
    }
    const readNodeSnapshot = () =>
      runtime.nodeMeshService!.buildSnapshot({
        selectedNodeId: nodeIntent.selectedNodeId,
      } as any);
    const snapshot = effectiveFlags.json
      ? withCliConsoleSuppressed(readNodeSnapshot)
      : withFilteredCliStartupLogs(readNodeSnapshot);
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot, null, 2)
      : nodeIntent.mode === 'queue'
        ? formatNodeMeshActivity((snapshot as any).selectedActivity || null, 'queue', (snapshot as any).selected?.label || null)
        : nodeIntent.mode === 'history'
          ? formatNodeMeshActivity((snapshot as any).selectedActivity || null, 'history', (snapshot as any).selected?.label || null)
          : formatNodeMeshSnapshot(snapshot as any, {
            focusExplicit: Boolean(nodeIntent.selectedNodeId),
          });
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (commandName === 'nodepair' && runtime.nodePairingService) {
    const parsed = parseCliNodePairArgs(args);
    const profile = runtime.nodeDeviceProfileService
      ? (runtime.nodeDeviceProfileService as any).resolveProfile(parsed.profileId, parsed.kind || undefined)
      : null;
    const draft = runtime.nodePairingService.createPairingDraft({
      profileId: parsed.profileId,
      label: parsed.label || profile?.label || 'Node companion',
      requestedBy: effectiveFlags.userId,
    } as any);
    const body = effectiveFlags.json
      ? JSON.stringify(draft, null, 2)
      : formatNodePairingDraft(draft);
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (commandName === 'nodeinvoke' && runtime.nodeInvokeService) {
    const parsed = parseCliNodeInvokeArgs(args);
    if (!parsed) {
      const error = 'Uso: nodeinvoke <nodeId> <capabilityId> [action] [payload-json|key=value]';
      writer.error(error);
      return { ok: false, handled: true, output: [], error };
    }
    const result = runtime.nodeInvokeService.invoke({
      nodeId: parsed.nodeId,
      capabilityId: parsed.capabilityId,
      action: parsed.action,
      payload: parsed.payload,
      requestedBy: effectiveFlags.userId,
    } as any);
    const body = effectiveFlags.json
      ? JSON.stringify(result, null, 2)
      : formatNodeInvokeResult(result);
    writer.line(body);
    return { ok: Boolean((result as any).ok ?? true), handled: true, output: [body], error: null };
  }

  return null;
}
