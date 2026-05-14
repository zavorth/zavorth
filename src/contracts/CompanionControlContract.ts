import type {
  DesktopResourceActionId,
  DesktopResourceActionSafety,
  DesktopResourcePressureLevel,
} from './DesktopResourceContract.js';
import type { TaskResourceImpact } from './TaskResourcePlannerContract.js';

export type CompanionId =
  | 'wsl'
  | 'docker-desktop'
  | 'zavorthBridge'
  | 'codex-companion';

export type CompanionStatus =
  | 'running'
  | 'idle'
  | 'stopped'
  | 'unavailable'
  | 'unknown';

export type CompanionActionId = Extract<
  DesktopResourceActionId,
  'inspect' | 'trim' | 'hibernate' | 'resume' | 'stop-idle' | 'restart-safe'
>;

export type CompanionActionDescriptor = {
  actionId: CompanionActionId;
  label: string;
  description: string;
  safety: DesktopResourceActionSafety;
  requiresApproval: boolean;
  available: boolean;
  reason: string;
  command: string | null;
};

export type CompanionDescriptor = {
  id: CompanionId;
  label: string;
  status: CompanionStatus;
  pressure: DesktopResourcePressureLevel;
  workingSetMb: number;
  processCount: number;
  summary: string;
  details: string[];
  activeWindowTitles: string[];
  runningContainerCount: number | null;
  runningDistros: string[];
  actions: CompanionActionDescriptor[];
};

export type CompanionControlSnapshot = {
  generatedAt: string;
  companions: CompanionDescriptor[];
  warnings: string[];
  recommendations: string[];
};

export type CompanionActionPlan = {
  generatedAt: string;
  companionId: CompanionId;
  actionId: CompanionActionId;
  ok: boolean;
  allowed: boolean;
  requiresApproval: boolean;
  safety: DesktopResourceActionSafety;
  executed: boolean;
  dryRun: boolean;
  summary: string;
  reason: string;
  command: string | null;
  companion: CompanionDescriptor;
  resourceImpact: TaskResourceImpact | null;
};

export type CompanionActionResult = CompanionActionPlan & {
  result: Record<string, any> | null;
  snapshot: CompanionControlSnapshot | null;
};

export type CompanionStateRecord = {
  companionId: CompanionId;
  actionId: CompanionActionId;
  ok: boolean;
  summary: string;
  updatedAt: string;
};

export type CompanionControlState = {
  updatedAt: string;
  lastActions: Partial<Record<CompanionId, CompanionStateRecord>>;
};
