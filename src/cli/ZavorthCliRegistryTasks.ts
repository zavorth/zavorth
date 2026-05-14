import type { ZavorthCliFlags, ZavorthCliRuntime, CliExecutionResult, CliWriter } from './ZavorthCliContract.js';
import {
  formatTaskArtifactsSnapshot,
  formatTaskContinuationPlan,
  formatTaskOsSnapshot,
} from './ZavorthCliTaskOsRenderer.js';

type RegistryCommandParams = {
  runtime: ZavorthCliRuntime;
  effectiveFlags: ZavorthCliFlags;
  commandName: string | null;
  args: string;
  writer: CliWriter;
};

export async function handleZavorthCliRegistryTasksCommand(params: RegistryCommandParams): Promise<CliExecutionResult | null> {
  const { runtime, effectiveFlags, commandName, args, writer } = params;
  const service = runtime.taskOperatingSystemService;
  if (!service) {
    return null;
  }

  if (commandName === 'tasks') {
    const tokens = String(args || '').trim().split(/\s+/).filter(Boolean);
    const first = String(tokens[0] || '').trim().toLowerCase();
    if (first === 'resume' || first === 'retry') {
      const taskId = tokens.slice(1).join(' ').trim() || 'latest';
      const plan = await service.buildContinuationPlan(taskId, first);
      const body = effectiveFlags.json
        ? JSON.stringify(plan, null, 2)
        : formatTaskContinuationPlan(plan);
      writer.line(body);
      return { ok: true, handled: true, output: [body], error: null };
    }

    const taskId = first && first !== 'list' && first !== 'status'
      ? tokens.join(' ').trim()
      : null;
    const snapshot = await service.buildSnapshot({
      taskId,
      userId: effectiveFlags.userId,
      limit: 20,
    });
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot, null, 2)
      : formatTaskOsSnapshot(snapshot);
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (commandName === 'artifacts') {
    const tokens = String(args || '').trim().split(/\s+/).filter(Boolean);
    const first = String(tokens[0] || '').trim().toLowerCase();
    const taskId = first === 'task'
      ? tokens.slice(1).join(' ').trim() || 'latest'
      : tokens.join(' ').trim() || 'latest';
    const snapshot = await service.listArtifactsForTask(taskId);
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot, null, 2)
      : formatTaskArtifactsSnapshot(snapshot);
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  return null;
}
