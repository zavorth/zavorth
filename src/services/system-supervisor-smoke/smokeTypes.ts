import type { SystemOverlordActionRecord, SystemOverlordCapability } from '../../contracts/SystemOverlordContract.js';
import { AutomaticBrowserTool } from '../../mcp/tools/AutomaticBrowserTool.js';
import { ZavorthPublicTunnelService } from '../ZavorthPublicTunnelService.js';
import { SupervisedExecutionGatewayService } from '../SupervisedExecutionGatewayService.js';

export type SystemOverlordSmokeItemStatus = 'passed' | 'failed' | 'skipped';
export type SystemOverlordSmokeStatus = 'running' | 'passed' | 'failed' | 'skipped';

export type SystemOverlordSmokeCapability = Extract<
  SystemOverlordCapability,
  'browser.control' | 'network.tunnel' | 'wsl.exec' | 'docker.exec'
>;

export type SystemOverlordSmokeItem = {
  capability: SystemOverlordSmokeCapability;
  status: SystemOverlordSmokeItemStatus;
  actionId: string | null;
  runtimeTarget: string | null;
  summary: string;
  detail: string | null;
  error: string | null;
  operatorNextStep: string | null;
};

export type SystemOverlordSmokeReport = {
  startedAt: string;
  finishedAt: string | null;
  status: SystemOverlordSmokeStatus;
  ok: boolean;
  command: string;
  summary: string;
  probeUrl: string | null;
  items: SystemOverlordSmokeItem[];
  error: string | null;
  file: string;
};

export type BrowserToolLike = Pick<AutomaticBrowserTool, 'handleToolCall' | 'diagnose' | 'shutdown'>;
export type TunnelServiceLike = Pick<ZavorthPublicTunnelService, 'readStatus' | 'ensureStarted' | 'stop'>;
export type SmokeGatewayLike = Pick<SupervisedExecutionGatewayService, 'execute' | 'rollbackAction'>;

export type ProbeServer = {
  url: string;
  close: () => Promise<void>;
};

export type ExecuteSmokeActionInput = {
  capability: SystemOverlordCapability;
  profile: 'trusted' | 'dangerous';
  autonomyLevel: 3 | 4 | 5;
  approved: boolean;
  timeoutMs: number;
  objective: string;
  command: string;
};

export type ExecuteSmokeAction = (
  input: ExecuteSmokeActionInput,
) => Promise<SystemOverlordActionRecord>;
