import type { ToolHookPipelineService } from './ToolHookPipelineService.js';

type HookPipelineHandle = Pick<ToolHookPipelineService, 'run' | 'registerListener'>;

let sharedHookPipeline: HookPipelineHandle | null = null;

export function setPluginOsHookPipeline(pipeline: HookPipelineHandle | null): void {
  sharedHookPipeline = pipeline;
}

export function getPluginOsHookPipeline(): HookPipelineHandle | null {
  return sharedHookPipeline;
}

export async function runPluginOsHook(input: {
  event: string;
  workspace?: string | null;
  context?: Record<string, unknown>;
  dryRun?: boolean;
}): Promise<void> {
  const pipeline = sharedHookPipeline;
  if (!pipeline) {
    return;
  }
  try {
    await pipeline.run({
      event: input.event,
      workspace: input.workspace ?? null,
      context: input.context || {},
      dryRun: input.dryRun === true,
    });
  } catch {
    /* plugin hooks must never break core runtime paths */
  }
}
