import type {
  ApprovalItem,
  ChannelItem,
  ChannelSetupSnapshot,
  GatewayResilienceSnapshot,
  LearningItem,
  MemoryEncryptionMigrationReceipt,
  MemoryEncryptionStatus,
  MemoryItem,
  RuntimeCapabilitiesSnapshot,
  ToolItem,
} from '../apiClient';
import type { BootEvent, RuntimeStatus } from '../global';
import { WebPreviewView } from './WebPreviewView';
import type { DesktopPanel } from '../slashCommands';
import type { DesktopWorkspaceScope } from '../workspaceScopes';
import type { ActiveSubagent } from '../desktop-state/subagents';
import type { AgentProfile } from '../desktop-state/agentProfiles';
import type { ScheduledTask } from '../desktop-state/useDesktopAutomations';
import type { WorkboardBoard, WorkboardCard } from './panels/WorkboardPanel';
import type { PluginItem } from './panels/PluginMarketplacePanel';
import type { RuntimeWorkboardProjection } from '../workboard/runtimeWorkboardProjection';
import { ReviewView } from './panels/ReviewView';
import { FilesView } from './panels/FilesView';
import { ReceiptsPanel } from './panels/ReceiptsPanel';
import type { DesktopReceipt } from '../desktop-state/receiptsLedger';
import { lazyNamed, PanelSuspense } from '../lib/lazyPanel';
import type { SessionData, TokenUsage, ToolCall } from './panels/UsageAnalyticsPanel';

const MemoryView = lazyNamed(() => import('./panels/MemoryView'), 'MemoryView');
const SkillsView = lazyNamed(() => import('./panels/SkillsView'), 'SkillsView');
const ChannelsView = lazyNamed(() => import('./panels/ChannelsView'), 'ChannelsView');
const SettingsView = lazyNamed(() => import('./panels/SettingsView'), 'SettingsView');
const AutomationsPanel = lazyNamed(() => import('./panels/AutomationsPanel'), 'AutomationsPanel');
const AgentsPanel = lazyNamed(() => import('./panels/AgentsPanel'), 'AgentsPanel');
const ProfilesPanel = lazyNamed(() => import('./panels/ProfilesPanel'), 'ProfilesPanel');
const UsageAnalyticsPanel = lazyNamed(() => import('./panels/UsageAnalyticsPanel'), 'default');
const PluginMarketplacePanel = lazyNamed(() => import('./panels/PluginMarketplaceSimple'), 'PluginMarketplacePanel');
const WorkboardPanel = lazyNamed(() => import('./panels/WorkboardPanel'), 'default');

export { PageFrame } from './panelChrome';
export { ReviewView } from './panels/ReviewView';
export { FilesView } from './panels/FilesView';

type WorkspaceViewProps = {
  activePanel: Exclude<DesktopPanel, 'chat'>;
  accent: 'green' | 'orange' | 'purple' | 'navy';
  density?: 'comfortable' | 'compact';
  approvals: ApprovalItem[];
  approvalsCount?: number;
  busy: boolean;
  channels: ChannelItem[];
  channelSetup: ChannelSetupSnapshot | null;
  encryptionReceipt: MemoryEncryptionMigrationReceipt | null;
  encryptionStatus: MemoryEncryptionStatus | null;
  events: BootEvent[];
  effort: string;
  learning: LearningItem[];
  memoryItems: MemoryItem[];
  gatewayResilience: GatewayResilienceSnapshot | null;
  nexusStatus: unknown;
  profile: string;
  runtimeCapabilities: RuntimeCapabilitiesSnapshot | null;
  status: RuntimeStatus;
  theme: 'light' | 'dark' | 'system';
  tools: ToolItem[];
  workspaceScope: DesktopWorkspaceScope;
  onAccessRepair(): void | Promise<void>;
  onAccent(value: 'green' | 'orange' | 'purple' | 'navy'): void;
  onDensity?(value: 'comfortable' | 'compact'): void;
  onEffort(value: string): void;
  onEncryptionAction(action: 'preview' | 'apply' | 'rollback'): void | Promise<void>;
  onLearningDecision(id: string, decision: 'approve' | 'reject' | 'forget'): void | Promise<void>;
  onMemoryControlAction(input: { action: 'forget' | 'updatePreference'; id: string; content?: string }): void | Promise<void>;
  onChannelSetupAction(input: {
    action: 'applyScaffold' | 'doctor' | 'testConnection';
    channelId?: string | null;
    mode?: string | null;
    extraEntries?: Array<{ key: string; value: string }>;
  }): void | Promise<void>;
  onGatewayResilienceAction(input: Record<string, unknown>): void | Promise<void>;
  onProfile(value: string): void;
  onReviewDecision(id: string, decision: 'approve' | 'reject'): void | Promise<void>;
  onRuntimeStart(): void | Promise<void>;
  onRuntimeStateAction(input: { domain: string; operation: string; metadata?: Record<string, unknown> }): void | Promise<void>;
  onTheme(value: 'light' | 'dark' | 'system'): void;
  scheduledTasks?: ScheduledTask[];
  onAddScheduledTask?: (name: string, project: string, prompt: string, intervalMinutes: number) => void;
  onDeleteScheduledTask?: (id: string) => void;
  onToggleScheduledTask?: (id: string) => void;
  onRunScheduledTask?: (id: string) => void;
  loadScheduledTaskLogs?: (sessionId: string) => Promise<unknown[]>;
  subagents?: ActiveSubagent[];
  onAddSubagent?: (role: string, typeName: string) => void;
  onDeleteSubagent?: (id: string) => void;
  onTriggerSubagentTask?: (id: string, task: string) => void;
  customProfiles?: AgentProfile[];
  allProfiles?: AgentProfile[];
  onAddCustomProfile?: (name: string, prompt: string, effort: AgentProfile['effort'], costLimit: number) => void;
  onDeleteCustomProfile?: (id: string) => void;
  activeProfileId?: string;
  onActivateProfile?: (profile: AgentProfile) => void;
  sessions?: SessionData[];
  toolCalls?: ToolCall[];
  tokenUsage?: TokenUsage[];
  marketplacePlugins?: PluginItem[];
  marketplaceSource?: 'api' | 'tools' | 'empty';
  onInstallPlugin?: (pluginId: string) => void;
  onUninstallPlugin?: (pluginId: string) => void;
  onUpdatePlugin?: (pluginId: string) => void;
  onRefreshMarketplace?: () => void | Promise<void>;
  boards?: WorkboardBoard[];
  runtimeWorkboard?: RuntimeWorkboardProjection | null;
  onBoardSelect?: (boardId: string) => void;
  onCardCreate?: (boardId: string, card: Omit<WorkboardCard, 'id' | 'createdAt'>) => void;
  onCardUpdate?: (boardId: string, card: WorkboardCard) => void;
  onCardDelete?: (boardId: string, cardId: string) => void;
  onColumnCreate?: (boardId: string, name: string) => void;
  onColumnUpdate?: (boardId: string, columnId: string, name: string) => void;
  onColumnDelete?: (boardId: string, columnId: string) => void;
  onOpenCardInChat?: (boardId: string, cardId: string) => void;
  onAttachFile?: (relativePath: string) => void;
  workboardSyncLabel?: string | null;
  workboardSyncDetail?: string | null;
  workboardSyncBusy?: boolean;
  onSyncWorkboard?: (boardId?: string) => void | Promise<boolean | void>;
  receipts?: DesktopReceipt[];
  onClearReceipts?: () => void;
  updateStatusMessage?: string | null;
  updateStatus?: import('../desktop-state/desktopUpdate').DesktopUpdateStatus | null;
  voiceAgentStatus?: {
    running: boolean;
    message: string;
    hotkey: string;
    wakeWord: string | null;
    mode: string;
  } | null;
  onCheckUpdates?: () => void | Promise<void>;
  onDownloadUpdate?: () => void | Promise<void>;
  onInstallUpdate?: () => void | Promise<void>;
  onDeferUpdate?: () => void | Promise<void>;
  onRollbackUpdate?: () => void | Promise<void>;
  onOpenGithub?: () => void | Promise<void>;
  onOpenSetup?: () => void | Promise<void>;
  onOpenLogs?: () => void | Promise<void>;
  onStartVoiceAgent?: () => void | Promise<void>;
  onRefreshVoiceAgent?: () => void | Promise<void>;
};

export function DesktopWorkspaceView(props: WorkspaceViewProps) {
  if (props.activePanel === 'preview') {
    return <WebPreviewView workspaceScope={props.workspaceScope} />;
  }
  if (props.activePanel === 'files') {
    return (
      <FilesView
        workspaceScope={props.workspaceScope}
        onAttachFile={props.onAttachFile}
      />
    );
  }

  if (props.activePanel === 'approvals') {
    return (
      <ReviewView
        approvals={props.approvals}
        busy={props.busy}
        onDecision={props.onReviewDecision}
        learning={props.learning}
        onLearningDecision={props.onLearningDecision}
      />
    );
  }

  if (props.activePanel === 'receipts') {
    return (
      <ReceiptsPanel
        receipts={props.receipts || []}
        onClear={props.onClearReceipts}
      />
    );
  }

  if (props.activePanel === 'memory') {
    return (
      <PanelSuspense>
        <MemoryView
          busy={props.busy}
          encryptionReceipt={props.encryptionReceipt}
          encryptionStatus={props.encryptionStatus}
          items={props.memoryItems}
          learning={props.learning}
          onEncryptionAction={props.onEncryptionAction}
          onLearningDecision={props.onLearningDecision}
          onMemoryControlAction={props.onMemoryControlAction}
        />
      </PanelSuspense>
    );
  }

  if (props.activePanel === 'skills') {
    return (
      <PanelSuspense>
        <SkillsView tools={props.tools} />
      </PanelSuspense>
    );
  }

  if (props.activePanel === 'channels') {
    return (
      <PanelSuspense>
        <ChannelsView
          busy={props.busy}
          channels={props.channels}
          setup={props.channelSetup}
          onSetupAction={props.onChannelSetupAction}
        />
      </PanelSuspense>
    );
  }

  if (props.activePanel === 'automations') {
    return (
      <PanelSuspense>
        <AutomationsPanel
          busy={props.busy}
          runtimeCapabilities={props.runtimeCapabilities}
          onRuntimeStateAction={props.onRuntimeStateAction}
          scheduledTasks={props.scheduledTasks}
          onAddScheduledTask={props.onAddScheduledTask}
          onDeleteScheduledTask={props.onDeleteScheduledTask}
          onToggleScheduledTask={props.onToggleScheduledTask}
          onRunScheduledTask={props.onRunScheduledTask}
          loadScheduledTaskLogs={props.loadScheduledTaskLogs}
        />
      </PanelSuspense>
    );
  }

  if (props.activePanel === 'agents') {
    return (
      <PanelSuspense>
        <AgentsPanel
          busy={props.busy}
          subagents={props.subagents}
          onAddSubagent={props.onAddSubagent}
          onDeleteSubagent={props.onDeleteSubagent}
          onTriggerSubagentTask={props.onTriggerSubagentTask}
        />
      </PanelSuspense>
    );
  }

  if (props.activePanel === 'profiles') {
    return (
      <PanelSuspense>
        <ProfilesPanel
          customProfiles={props.customProfiles || []}
          allProfiles={props.allProfiles || []}
          onAddCustomProfile={props.onAddCustomProfile}
          onDeleteCustomProfile={props.onDeleteCustomProfile}
          activeProfileId={props.activeProfileId}
          onActivateProfile={props.onActivateProfile}
        />
      </PanelSuspense>
    );
  }

  if (props.activePanel === 'analytics') {
    return (
      <PanelSuspense>
        <UsageAnalyticsPanel
          sessions={props.sessions || []}
          toolCalls={props.toolCalls || []}
          tokenUsages={props.tokenUsage || []}
        />
      </PanelSuspense>
    );
  }

  if (props.activePanel === 'marketplace') {
    return (
      <PanelSuspense>
        <PluginMarketplacePanel
          plugins={props.marketplacePlugins || []}
          source={props.marketplaceSource}
          onInstall={props.onInstallPlugin}
          onUninstall={props.onUninstallPlugin}
          onUpdate={props.onUpdatePlugin}
          onRefresh={props.onRefreshMarketplace}
        />
      </PanelSuspense>
    );
  }

  if (props.activePanel === 'workboard') {
    return (
      <PanelSuspense>
        <WorkboardPanel
          boards={props.boards || []}
          runtimeWorkboard={props.runtimeWorkboard}
          onBoardSelect={props.onBoardSelect}
          onCardCreate={props.onCardCreate}
          onCardUpdate={props.onCardUpdate}
          onCardDelete={props.onCardDelete}
          onColumnCreate={props.onColumnCreate}
          onColumnUpdate={props.onColumnUpdate}
          onColumnDelete={props.onColumnDelete}
          onOpenCardInChat={props.onOpenCardInChat}
          syncLabel={props.workboardSyncLabel}
          syncDetail={props.workboardSyncDetail}
          syncBusy={props.workboardSyncBusy}
          onSyncNow={props.onSyncWorkboard}
        />
      </PanelSuspense>
    );
  }

  return (
    <PanelSuspense>
      <SettingsView
        busy={props.busy}
        effort={props.effort}
        events={props.events}
        nexusStatus={props.nexusStatus}
        profile={props.profile}
        runtimeCapabilities={props.runtimeCapabilities}
        gatewayResilience={props.gatewayResilience}
        status={props.status}
        approvalsCount={props.approvalsCount ?? props.approvals?.length ?? 0}
        theme={props.theme}
        accent={props.accent}
        density={props.density}
        onEffort={props.onEffort}
        onAccent={props.onAccent}
        onDensity={props.onDensity}
        onProfile={props.onProfile}
        onRepair={props.onAccessRepair}
        onGatewayResilienceAction={props.onGatewayResilienceAction}
        onStart={props.onRuntimeStart}
        onRuntimeStateAction={props.onRuntimeStateAction}
        onTheme={props.onTheme}
        updateStatusMessage={props.updateStatusMessage}
        updateStatus={props.updateStatus}
        voiceAgentStatus={props.voiceAgentStatus}
        workboardSyncLabel={props.workboardSyncLabel}
        workboardSyncDetail={props.workboardSyncDetail}
        workboardSyncBusy={props.workboardSyncBusy}
        onSyncWorkboard={props.onSyncWorkboard}
        onCheckUpdates={props.onCheckUpdates}
        onDownloadUpdate={props.onDownloadUpdate}
        onInstallUpdate={props.onInstallUpdate}
        onDeferUpdate={props.onDeferUpdate}
        onRollbackUpdate={props.onRollbackUpdate}
        onOpenGithub={props.onOpenGithub}
        onOpenSetup={props.onOpenSetup}
        onOpenLogs={props.onOpenLogs}
        onStartVoiceAgent={props.onStartVoiceAgent}
        onRefreshVoiceAgent={props.onRefreshVoiceAgent}
      />
    </PanelSuspense>
  );
}
