import type {
  ApprovalItem,
  ChannelItem,
  LearningItem,
  MemoryEncryptionMigrationReceipt,
  MemoryEncryptionStatus,
  MemoryItem,
  RuntimeCapabilitiesSnapshot,
  ToolItem,
} from '../apiClient';
import type { BootEvent, RuntimeStatus } from '../global';
import type { DesktopPanel } from '../slashCommands';

export type WorkspaceViewProps = {
  activePanel: Exclude<DesktopPanel, 'chat'>;
  accent: 'green' | 'orange' | 'purple' | 'navy';
  density?: 'comfortable' | 'compact';
  approvals: ApprovalItem[];
  busy: boolean;
  channels: ChannelItem[];
  encryptionReceipt: MemoryEncryptionMigrationReceipt | null;
  encryptionStatus: MemoryEncryptionStatus | null;
  events: BootEvent[];
  effort: string;
  learning: LearningItem[];
  memoryItems: MemoryItem[];
  nexusStatus: unknown;
  profile: string;
  runtimeCapabilities: RuntimeCapabilitiesSnapshot | null;
  status: RuntimeStatus;
  theme: 'light' | 'dark' | 'system';
  tools: ToolItem[];
  onAccessRepair(): void | Promise<void>;
  onAccent(value: 'green' | 'orange' | 'purple' | 'navy'): void;
  onDensity?(value: 'comfortable' | 'compact'): void;
  onEffort(value: string): void;
  onEncryptionAction(action: 'preview' | 'apply' | 'rollback'): void | Promise<void>;
  onLearningDecision(id: string, decision: 'approve' | 'reject' | 'forget'): void | Promise<void>;
  onProfile(value: string): void;
  onReviewDecision(
    id: string,
    decision: 'once' | 'session' | 'always' | 'deny' | 'approve' | 'reject',
  ): void | Promise<void>;
  onRuntimeStart(): void | Promise<void>;
  onRuntimeStateAction(input: { domain: string; operation: string; metadata?: Record<string, unknown> }): void | Promise<void>;
  onTheme(value: 'light' | 'dark' | 'system'): void;
};
