import { useEffect, useState } from 'react';
import type {
  ApprovalItem,
  ChatMessage,
  LearningItem,
  MemoryEncryptionMigrationReceipt,
  MemoryEncryptionStatus,
  MemoryItem,
  RuntimeCapabilitiesSnapshot,
  ToolItem,
} from '../apiClient';
import { DesktopCommandBar } from '../composer/DesktopCommandBar';
import type { BootEvent, RuntimeStatus } from '../global';
import { DesktopSidebar } from '../navigation/DesktopSidebar';
import { DesktopStatusbar } from '../navigation/DesktopStatusbar';
import { DesktopTopbar } from '../navigation/DesktopTopbar';
import { X } from '../icons';
import type { ModelOption } from '../modelCatalog';
import { CommandPalette } from '../overlays/CommandPalette';
import { DesktopInspector } from '../panels/DesktopInspector';
import type { DesktopPanel } from '../slashCommands';
import { ThreadView } from '../thread/ThreadView';
import { DesktopWorkspaceView } from '../views/DesktopWorkspaceView';
import type { DesktopWorkspaceScope } from '../workspaceScopes';

export function DesktopShell(props: {
  accent: 'orange' | 'purple' | 'navy';
  activePanel: DesktopPanel;
  approvals: ApprovalItem[];
  busy: boolean;
  channels: any[];
  commandPaletteOpen: boolean;
  effort: string;
  encryptionReceipt: MemoryEncryptionMigrationReceipt | null;
  encryptionStatus: MemoryEncryptionStatus | null;
  events: BootEvent[];
  input: string;
  inspectorOpen: boolean;
  learning: LearningItem[];
  memoryItems: MemoryItem[];
  modelOptions: ModelOption[];
  messages: ChatMessage[];
  nexusStatus: unknown;
  notice: string;
  profile: string;
  runtimeMessage: string;
  runtimeCapabilities: RuntimeCapabilitiesSnapshot | null;
  showNotice: boolean;
  showRuntimeSetup: boolean;
  sidebarCollapsed: boolean;
  status: RuntimeStatus;
  selectedModel: string;
  theme: 'light' | 'dark' | 'system';
  tools: ToolItem[];
  workspaceScope: DesktopWorkspaceScope;
  workspaceScopes: DesktopWorkspaceScope[];
  onAccessRepair(): void | Promise<void>;
  onAccent(value: 'orange' | 'purple' | 'navy'): void;
  onCommandPalette(open: boolean): void;
  onEffort(value: string): void;
  onEncryptionAction(action: 'preview' | 'apply' | 'rollback'): void | Promise<void>;
  onInput(value: string): void;
  onLearningDecision(id: string, decision: 'approve' | 'reject' | 'forget'): void | Promise<void>;
  onModel(value: string): void;
  onNewSession(): void;
  onPanel(panel: DesktopPanel): void;
  onProfile(value: string): void;
  onRefresh(): void | Promise<void>;
  onReviewDecision(id: string, decision: 'approve' | 'reject'): void | Promise<void>;
  onRuntimeStart(): void | Promise<void>;
  onRuntimeStateAction(input: { domain: string; operation: string; metadata?: Record<string, unknown> }): void | Promise<void>;
  onSidebarCollapsed(updater: (value: boolean) => boolean): void;
  onSubmit(value?: string): void | Promise<void>;
  onTheme(value: 'light' | 'dark' | 'system'): void;
  onWorkspaceFolder(): void | Promise<void>;
  onWorkspaceScope(value: string): void;
}) {
  const isMac = navigator.userAgent.includes('Macintosh');
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true);
  const resolvedTheme = props.theme === 'system' ? (systemDark ? 'dark' : 'light') : props.theme;
  const appClassName = `zvd-app ${props.sidebarCollapsed ? 'has-collapsed-sidebar' : ''} theme-${resolvedTheme} mode-${props.theme} accent-${props.accent} ${isMac ? 'is-mac' : ''}`;
  const [bottomPanelOpen, setBottomPanelOpen] = useState(false);
  const activeModel = props.modelOptions.find(model => model.id === props.selectedModel) || props.modelOptions[0];

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'j') {
        event.preventDefault();
        setBottomPanelOpen(prev => !prev);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        props.onCommandPalette(true);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [props.onCommandPalette]);

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media) {
      return;
    }
    const update = () => setSystemDark(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  return (
    <main className={appClassName}>
      <DesktopSidebar
        activePanel={props.activePanel}
        collapsed={props.sidebarCollapsed}
        pendingApprovals={props.approvals.length}
        onNewSession={props.onNewSession}
        onPanel={props.onPanel}
        workspaceScope={props.workspaceScope}
        workspaceScopes={props.workspaceScopes}
        onToggle={() => props.onSidebarCollapsed(value => !value)}
        onWorkspaceFolder={props.onWorkspaceFolder}
        onWorkspaceScope={props.onWorkspaceScope}
      />

      <section className="zvd-workspace" aria-label="Zavorth Desktop">
        <DesktopTopbar
          busy={props.busy}
          modelLabel={activeModel?.label || 'Zavorth Core'}
          status={props.status}
          onCommandPalette={() => props.onCommandPalette(true)}
          onModel={() => props.onPanel('settings')}
          onRefresh={props.onRefresh}
          onStop={() => void props.onSubmit('/stop')}
        />

        <section className="zvd-content-stage" aria-label="Workspace content">
          <div className="zvd-ambient-field" aria-hidden="true" />
          {props.activePanel === 'chat' ? (
            <>
              <ThreadView
                approvals={props.approvals}
                busy={props.busy}
                messages={props.messages}
                onDecision={props.onReviewDecision}
                onOpenReview={() => props.onPanel('approvals')}
                onSuggestion={value => void props.onSubmit(value)}
              />

              <DesktopCommandBar
                busy={props.busy}
                effort={props.effort}
                modelOptions={props.modelOptions}
                selectedModel={props.selectedModel}
                value={props.input}
                workspaceScope={props.workspaceScope}
                workspaceScopes={props.workspaceScopes}
                onChange={props.onInput}
                onEffort={props.onEffort}
                onModel={props.onModel}
                onProviderSetup={() => props.onPanel('settings')}
                onStop={() => void props.onSubmit('/stop')}
                onSubmit={props.onSubmit}
                onWorkspaceFolder={props.onWorkspaceFolder}
                onWorkspaceScope={props.onWorkspaceScope}
              />

              {bottomPanelOpen && (
                <div className="zvd-terminal-panel" aria-label="Terminal">
                  <header>
                    <span>Terminal</span>
                    <button type="button" onClick={() => setBottomPanelOpen(false)} aria-label="Close terminal">
                      <X aria-hidden="true" size={16} stroke={2} />
                    </button>
                  </header>
                  <div className="zvd-terminal-logs">
                    {props.events.length === 0 ? (
                      <span className="zvd-terminal-empty">No runtime events yet.</span>
                    ) : (
                      props.events.map((event, index) => (
                        <div className="zvd-terminal-line" key={index}>
                          <span className="zvd-terminal-timestamp">[{new Date(event.at).toLocaleTimeString()}]</span>
                          <span className={`zvd-terminal-type type-${event.type}`}>{event.type.toUpperCase()}:</span>
                          <span className="zvd-terminal-msg">{event.message}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <DesktopWorkspaceView
              activePanel={props.activePanel}
              approvals={props.approvals}
              busy={props.busy}
              channels={props.channels}
              effort={props.effort}
              encryptionReceipt={props.encryptionReceipt}
              encryptionStatus={props.encryptionStatus}
              events={props.events}
              learning={props.learning}
              memoryItems={props.memoryItems}
              nexusStatus={props.nexusStatus}
              profile={props.profile}
              runtimeCapabilities={props.runtimeCapabilities}
              status={props.status}
              theme={props.theme}
              accent={props.accent}
              tools={props.tools}
              onAccessRepair={props.onAccessRepair}
              onAccent={props.onAccent}
              onEffort={props.onEffort}
              onEncryptionAction={props.onEncryptionAction}
              onLearningDecision={props.onLearningDecision}
              onProfile={props.onProfile}
              onReviewDecision={props.onReviewDecision}
              onRuntimeStart={props.onRuntimeStart}
              onRuntimeStateAction={props.onRuntimeStateAction}
              onTheme={props.onTheme}
            />
          )}
        </section>

        <DesktopStatusbar
          bottomPanelOpen={bottomPanelOpen}
          effort={props.effort}
          modelLabel={activeModel?.label || 'Zavorth Core'}
          status={props.status}
          workspaceScope={props.workspaceScope}
          onOpenWorkspace={() => void props.onWorkspaceFolder()}
          onOpenSettings={() => props.onPanel('settings')}
          onRuntimeStateAction={props.onRuntimeStateAction}
          onPanel={props.onPanel}
          onToggleBottomPanel={() => setBottomPanelOpen(prev => !prev)}
        />
      </section>

      <DesktopInspector
        activePanel={props.activePanel}
        approvals={props.approvals}
        busy={props.busy}
        channels={props.channels}
        encryptionReceipt={props.encryptionReceipt}
        encryptionStatus={props.encryptionStatus}
        events={props.events}
        learning={props.learning}
        memoryItems={props.memoryItems}
        nexusStatus={props.nexusStatus}
        open={props.inspectorOpen}
        status={props.status}
        tools={props.tools}
        onClose={() => props.onPanel('chat')}
        onEncryptionAction={props.onEncryptionAction}
        onLearningDecision={props.onLearningDecision}
        onRepair={props.onAccessRepair}
        onReviewDecision={props.onReviewDecision}
        onStart={props.onRuntimeStart}
      />

      <CommandPalette
        activePanel={props.activePanel}
        open={props.commandPaletteOpen}
        onClose={() => props.onCommandPalette(false)}
        onInsert={props.onInput}
        onPanel={props.onPanel}
        onRun={props.onSubmit}
      />
    </main>
  );
}
