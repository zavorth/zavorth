import type {
  ZavorthSubagentRuntimeMode,
  ZavorthSubagentRuntimeSnapshot,
} from '../contracts/runtime/ZavorthSubagentRuntimeContract.js';
import type { ZavorthSubagentAutoInvocationTelemetry } from '../contracts/runtime/ZavorthSubagentAutoInvocationContract.js';
import type { ToolDefinition } from '../providers/ILlmProvider.js';
import { ZavorthSubagentRuntimeService, type ZavorthSubagentRuntimeCommandInput } from './ZavorthSubagentRuntimeService.js';

export type ZavorthSubagentInvocationSource = 'task' | 'channel' | 'cron' | 'skill' | 'plugin' | 'internal';

export type ZavorthSubagentInvocationGatewayInput = {
  source: ZavorthSubagentInvocationSource;
  text: string;
  channel?: string | null;
  actorId?: string | null;
  threadId?: string | null;
  mode?: ZavorthSubagentRuntimeMode | string | null;
  roleIds?: string[] | null;
  approvalId?: string | null;
  live?: boolean | null;
  mockLive?: boolean | null;
  providerName?: string | null;
  modelName?: string | null;
  maxLiveWorkers?: number | null;
  maxToolCalls?: number | null;
  autoInvocation?: ZavorthSubagentAutoInvocationTelemetry | null;
  securityProfile?: string | null;
  persistState?: boolean | null;
};

type Runtime = {
  subagentRuntime?: Pick<ZavorthSubagentRuntimeService, 'execute' | 'formatSnapshotText'>;
  toolRuntime?: {
    getToolDefinitions(): ToolDefinition[];
    executeTool(toolName: string, args: unknown): Promise<string>;
  } | null;
};

export class ZavorthSubagentInvocationGatewayService {
  private readonly subagentRuntime: Pick<ZavorthSubagentRuntimeService, 'execute' | 'formatSnapshotText'>;

  public constructor(runtime: Runtime = {}) {
    this.subagentRuntime = runtime.subagentRuntime || new ZavorthSubagentRuntimeService({
      toolRuntime: runtime.toolRuntime || null,
    });
  }

  public async invoke(input: ZavorthSubagentInvocationGatewayInput): Promise<ZavorthSubagentRuntimeSnapshot> {
    return this.subagentRuntime.execute(this.buildRuntimeInput(input));
  }

  public async executeCommand(input: ZavorthSubagentRuntimeCommandInput): Promise<ZavorthSubagentRuntimeSnapshot> {
    return this.subagentRuntime.execute(input);
  }

  public async invokeFromTask(input: Omit<ZavorthSubagentInvocationGatewayInput, 'source'>): Promise<ZavorthSubagentRuntimeSnapshot> {
    return this.invoke({ ...input, source: 'task' });
  }

  public async invokeFromChannel(input: Omit<ZavorthSubagentInvocationGatewayInput, 'source'>): Promise<ZavorthSubagentRuntimeSnapshot> {
    return this.invoke({ ...input, source: 'channel' });
  }

  public async invokeFromCron(input: Omit<ZavorthSubagentInvocationGatewayInput, 'source'>): Promise<ZavorthSubagentRuntimeSnapshot> {
    return this.invoke({ ...input, source: 'cron' });
  }

  public async invokeFromSkill(input: Omit<ZavorthSubagentInvocationGatewayInput, 'source'>): Promise<ZavorthSubagentRuntimeSnapshot> {
    return this.invoke({ ...input, source: 'skill' });
  }

  public async invokeFromPlugin(input: Omit<ZavorthSubagentInvocationGatewayInput, 'source'>): Promise<ZavorthSubagentRuntimeSnapshot> {
    return this.invoke({ ...input, source: 'plugin' });
  }

  public renderReport(snapshot: ZavorthSubagentRuntimeSnapshot): string {
    return this.subagentRuntime.formatSnapshotText(snapshot);
  }

  private buildRuntimeInput(input: ZavorthSubagentInvocationGatewayInput): ZavorthSubagentRuntimeCommandInput {
    const source = normalizeSource(input.source);
    return {
      action: 'subagents.spawn',
      task: input.text,
      mode: input.mode || (source === 'channel' ? 'session' : 'oneshot'),
      roleIds: input.roleIds || [],
      channel: input.channel || source,
      actorId: input.actorId || null,
      threadId: input.threadId || null,
      approvalId: input.approvalId || null,
      explicitSubagents: true,
      sourceSurface: source,
      live: input.live === true || input.mockLive === true,
      mockLive: input.mockLive === true,
      executionMode: input.mockLive ? 'mock-live' : input.live ? 'live-llm' : 'governed-in-process',
      providerName: input.providerName || null,
      modelName: input.modelName || null,
      maxLiveWorkers: input.maxLiveWorkers || null,
      maxToolCalls: input.maxToolCalls || null,
      autoInvocation: input.autoInvocation || null,
      securityProfile: input.securityProfile || null,
      persistState: input.persistState !== false,
    };
  }
}

function normalizeSource(value: unknown): ZavorthSubagentInvocationSource {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'channel') return 'channel';
  if (normalized === 'cron' || normalized === 'automation' || normalized === 'schedule') return 'cron';
  if (normalized === 'skill') return 'skill';
  if (normalized === 'plugin') return 'plugin';
  if (normalized === 'internal') return 'internal';
  return 'task';
}
