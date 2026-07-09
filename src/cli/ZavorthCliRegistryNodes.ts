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

import type { RuntimeAccessReadinessInput } from '../runtime/access/RuntimeAccessReadinessService.js';
import type { NodeMeshCapabilityId, NodeMeshNodeKind } from '../contracts/NodeMeshContract.js';

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
        ? await runtime.runtimeAccessReadinessService.inspectLive(probeInput as RuntimeAccessReadinessInput)
        : runtime.runtimeAccessReadinessService.inspect(probeInput as RuntimeAccessReadinessInput);
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
      });
    const snapshot = effectiveFlags.json
      ? withCliConsoleSuppressed(readNodeSnapshot)
      : withFilteredCliStartupLogs(readNodeSnapshot);
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot, null, 2)
      : nodeIntent.mode === 'queue'
        ? formatNodeMeshActivity(snapshot.selectedActivity || null, 'queue', snapshot.selected?.label || null)
        : nodeIntent.mode === 'history'
          ? formatNodeMeshActivity(snapshot.selectedActivity || null, 'history', snapshot.selected?.label || null)
          : formatNodeMeshSnapshot(snapshot, {
            focusExplicit: Boolean(nodeIntent.selectedNodeId),
          });
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (commandName === 'nodepair' && runtime.nodePairingService) {
    const parsed = parseCliNodePairArgs(args);
    const profile = runtime.nodeDeviceProfileService
      ? runtime.nodeDeviceProfileService.resolveProfile(parsed.profileId, (parsed.kind || null) as NodeMeshNodeKind | null)
      : null;
    const draft = runtime.nodePairingService.createPairingDraft({
      profileId: parsed.profileId,
      label: parsed.label || profile?.label || 'Node companion',
      requestedBy: effectiveFlags.userId,
    });
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
      capabilityId: parsed.capabilityId as NodeMeshCapabilityId,
      action: parsed.action,
      payload: parsed.payload,
      requestedBy: effectiveFlags.userId,
    });
    const body = effectiveFlags.json
      ? JSON.stringify(result, null, 2)
      : formatNodeInvokeResult(result);
    writer.line(body);
    return { ok: Boolean(result.ok ?? true), handled: true, output: [body], error: null };
  }

  return null;
}
