/**
 * One-shot helper: split DesktopWorkspaceView.tsx into focused modules.
 * Safe to re-run only when the source still contains the inline views.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = resolve(root, 'src/views/DesktopWorkspaceView.tsx');
const source = readFileSync(sourcePath, 'utf8');

if (!source.includes('export function PageFrame') || !source.includes('function SettingsView')) {
  console.log('DesktopWorkspaceView already split (or unexpected structure). Skipping.');
  process.exit(0);
}

const lines = source.split(/\r...\n/);

function sliceLines(start1, end1Inclusive) {
  return lines.slice(start1 - 1, end1Inclusive).join('\n') + '\n';
}

const panelChrome = `import type { ReactNode } from 'react';

${sliceLines(237, 338)}`;

const reviewView = `import { useMemo, useState } from 'react';
import type { ApprovalItem } from '../../apiClient';
import { itemId, panelLabels } from '../../primitives/desktopPrimitives';
import { DetailRows, PageFrame, SearchBox } from '../panelChrome';

${sliceLines(340, 381)}`;

// MemoryView ends before SkillsView at 500
const memoryView = `import { useMemo, useState } from 'react';
import type {
  LearningItem,
  MemoryEncryptionMigrationReceipt,
  MemoryEncryptionStatus,
  MemoryItem,
} from '../../apiClient';
import { itemId, panelLabels } from '../../primitives/desktopPrimitives';
import { DetailRows, PageFrame, SearchBox, TextTabs } from '../panelChrome';

${sliceLines(383, 499)}`;

const skillsView = `import { useMemo, useState } from 'react';
import type { ToolItem } from '../../apiClient';
import { itemId, panelLabels } from '../../primitives/desktopPrimitives';
import { DetailRows, PageFrame, SearchBox } from '../panelChrome';

${sliceLines(500, 566)}`;

const channelsView = `import { useMemo, useState } from 'react';
import type { ChannelItem, ChannelSetupSnapshot } from '../../apiClient';
import { asRecord, itemId, panelLabels } from '../../primitives/desktopPrimitives';
import { DetailRows, PageFrame, SearchBox } from '../panelChrome';

${sliceLines(567, 747)}`;

const settingsView = `import { useState } from 'react';
import type {
  GatewayResilienceSnapshot,
  RuntimeCapabilitiesSnapshot,
} from '../../apiClient';
import { connectGooglePersonalOps } from '../../apiClient';
import type { BootEvent, RuntimeStatus } from '../../global';
import { asRecord, effortLabels, profileLabels } from '../../primitives/desktopPrimitives';
import { ProviderSettingsPanel } from '../../panels/ProviderSettingsPanel.js';
import { InternalBetaDiagnosticsPanel } from '../../panels/InternalBetaDiagnosticsPanel.js';
import { CockpitDashboard } from '../../components/CockpitDashboard.js';
import { isCompletionSoundEnabled, setCompletionSoundEnabled } from '../../lib/there isptics';
import { DetailRows, PageFrame, TextTabs } from '../panelChrome';

${sliceLines(749, 1507)}`;

const filesView = `import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FileExplorerNode } from '../../global';
import type { DesktopWorkspaceScope } from '../../workspaceScopes';
import { LemniscateLoader } from '../../components/LemniscateLoader';
import { Folder, ChevronDown, ChevronRight, Refresh } from '../../icons';
import { PageFrame, SearchBox } from '../panelChrome';

${sliceLines(1509, lines.length)}`;

const router = `import type {
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
import { AutomationsPanel } from './panels/AutomationsPanel';
import { AgentsPanel } from './panels/AgentsPanel';
import { ProfilesPanel } from './panels/ProfilesPanel';
import UsageAnalyticsPanel from './panels/UsageAnalyticsPanel';
import PluginMarketplacePanel from './panels/PluginMarketplacePanel';
import WorkboardPanel from './panels/WorkboardPanel';
import type { ActiveSubagent } from '../desktop-state/subagents';
import type { AgentProfile } from '../desktop-state/agentProfiles';
import type { ScheduledTask } from '../desktop-state/useDesktopAutomations';
import { ReviewView } from './panels/ReviewView';
import { MemoryView } from './panels/MemoryView';
import { SkillsView } from './panels/SkillsView';
import { ChannelsView } from './panels/ChannelsView';
import { SettingsView } from './panels/SettingsView';
import { FilesView } from './panels/FilesView';

// Re-exports for callers that imported views from this module historically.
export { PageFrame } from './panelChrome';
export { ReviewView } from './panels/ReviewView';
export { MemoryView } from './panels/MemoryView';
export { ChannelsView } from './panels/ChannelsView';
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
  sessions?: unknown[];
  toolCalls?: unknown[];
  tokenUsage?: unknown[];
  currentModel?: string;
  marketplacePlugins?: unknown[];
  onInstallPlugin?: (...args: unknown[]) => void;
  onUninstallPlugin?: (...args: unknown[]) => void;
  onUpdatePlugin?: (...args: unknown[]) => void;
  boards?: unknown[];
  onBoardSelect?: (...args: unknown[]) => void;
  onCardMove?: (...args: unknown[]) => void;
  onCardCreate?: (...args: unknown[]) => void;
  onCardUpdate?: (...args: unknown[]) => void;
  onCardDelete?: (...args: unknown[]) => void;
};

export function DesktopWorkspaceView(props: WorkspaceViewProps) {
  if (props.activePanel === 'preview') {
    return <WebPreviewView workspaceScope={props.workspaceScope} />;
  }
  if (props.activePanel === 'files') {
    return <FilesView workspaceScope={props.workspaceScope} />;
  }

  if (props.activePanel === 'approvals') {
    return <ReviewView approvals={props.approvals} busy={props.busy} onDecision={props.onReviewDecision} />;
  }

  if (props.activePanel === 'memory') {
    return (
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
    );
  }

  if (props.activePanel === 'skills') {
    return <SkillsView tools={props.tools} />;
  }

  if (props.activePanel === 'channels') {
    return (
      <ChannelsView
        busy={props.busy}
        channels={props.channels}
        setup={props.channelSetup}
        onSetupAction={props.onChannelSetupAction}
      />
    );
  }

  if (props.activePanel === 'automations') {
    return (
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
    );
  }

  if (props.activePanel === 'agents') {
    return (
      <AgentsPanel
        busy={props.busy}
        subagents={props.subagents}
        onAddSubagent={props.onAddSubagent}
        onDeleteSubagent={props.onDeleteSubagent}
        onTriggerSubagentTask={props.onTriggerSubagentTask}
      />
    );
  }

  if (props.activePanel === 'profiles') {
    return (
      <ProfilesPanel
        customProfiles={props.customProfiles || []}
        allProfiles={props.allProfiles || []}
        onAddCustomProfile={props.onAddCustomProfile}
        onDeleteCustomProfile={props.onDeleteCustomProfile}
      />
    );
  }

  if (props.activePanel === 'analytics') {
    return (
      <UsageAnalyticsPanel
        sessions={props.sessions || []}
        toolCalls={props.toolCalls || []}
        tokenUsages={props.tokenUsage || []}
        currentModel={props.currentModel || 'unknown'}
      />
    );
  }

  if (props.activePanel === 'marketplace') {
    return (
      <PluginMarketplacePanel
        plugins={props.marketplacePlugins || []}
        onInstall={props.onInstallPlugin}
        onUninstall={props.onUninstallPlugin}
        onUpdate={props.onUpdatePlugin}
      />
    );
  }

  if (props.activePanel === 'workboard') {
    return (
      <WorkboardPanel
        boards={props.boards || []}
        onBoardSelect={props.onBoardSelect}
        onCardMove={props.onCardMove}
        onCardCreate={props.onCardCreate}
        onCardUpdate={props.onCardUpdate}
        onCardDelete={props.onCardDelete}
      />
    );
  }

  return (
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
    />
  );
}
`;

const panelsDir = resolve(root, 'src/views/panels');
if (!existsSync(panelsDir)) mkdirSync(panelsDir, { recursive: true });

writeFileSync(resolve(root, 'src/views/panelChrome.tsx'), panelChrome);
writeFileSync(resolve(panelsDir, 'ReviewView.tsx'), reviewView);
writeFileSync(resolve(panelsDir, 'MemoryView.tsx'), memoryView);
writeFileSync(resolve(panelsDir, 'SkillsView.tsx'), skillsView);
writeFileSync(resolve(panelsDir, 'ChannelsView.tsx'), channelsView);
writeFileSync(resolve(panelsDir, 'SettingsView.tsx'), settingsView);
writeFileSync(resolve(panelsDir, 'FilesView.tsx'), filesView);
writeFileSync(sourcePath, router);

console.log('Split DesktopWorkspaceView into panel modules.');
console.log('Router lines:', router.split('\\n').length);
