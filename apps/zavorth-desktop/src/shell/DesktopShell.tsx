import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import type {
  ApprovalItem,
  ChannelItem,
  ChannelSetupSnapshot,
  ChatMessage,
  GatewayResilienceSnapshot,
  LearningItem,
  MemoryEncryptionMigrationReceipt,
  MemoryEncryptionStatus,
  MemoryItem,
  RuntimeCapabilitiesSnapshot,
  TaskMandate,
  ToolItem,
} from '../apiClient';
import { DesktopCommandBar } from '../composer/DesktopCommandBar';
import { DesktopInspector } from '../panels/DesktopInspector';
import { ContinuityBanner, buildContinuityBannerModel } from '../components/ContinuityBanner';
import { NextActionBanner } from '../components/NextActionBanner';
import {
  buildDesktopPendingTasks,
  isDay1ReturnEligible,
  readRememberedDesktopSession,
  rememberDesktopSession,
  touchDesktopOpenClock,
} from '../desktop-state/continuityStorage';
import { getOnboardingAudience } from '../onboarding/desktopOnboarding';

import {
  clearQueue,
  enqueuePrompt,
  nextAutoSubmit,
  removeQueuedPrompt,
  type QueuedPrompt,
} from '../composer/composerQueue';
import type { BootEvent, RuntimeStatus } from '../global';
import { DesktopSidebar } from '../navigation/DesktopSidebar';
import { DesktopStatusbar } from '../navigation/DesktopStatusbar';
import { DesktopTopbar } from '../navigation/DesktopTopbar';
import type { ModelOption } from '../modelCatalog';
import { CommandPalette } from '../overlays/CommandPalette';
import { CommandCenterOverlay } from '../command-center/CommandCenterOverlay';
import type { CommandCenterAction, CommandCenterInput } from '../command-center/commandCenter';
import { CapabilityMapOverlay } from '../capability-map/CapabilityMapOverlay';
import type { CapabilityDomain } from '../capability-map/capabilityMapLayout';
import { buildSettingsModules } from '../settings/settingsModules';
import {
  clampRightRailWidth,
  readStoredRightRailState,
  writeStoredRightRailState,
  type RightRailState,
  type RightRailTab,
} from './rightRail';
import { $rightRailOpenRequest } from '../store/layout';

import type { DesktopPanel } from '../slashCommands';
import { ThreadView } from '../thread/ThreadView';
import { DesktopWorkspaceView } from '../views/DesktopWorkspaceView';
import { DesktopRightRail } from './DesktopRightRail';
import type { DesktopWorkspaceScope } from '../workspaceScopes';
import { zavorthThemePresets, type ZavorthAccent } from '../themePresets';
import type { ActiveSubagent } from '../desktop-state/subagents';
import type { AgentProfile } from '../desktop-state/agentProfiles';
import type { ScheduledTask } from '../desktop-state/useDesktopAutomations';
import type { DesktopDensity } from '../designSystem/desktopTokens';
import type { WorkboardBoard, WorkboardCard } from '../views/panels/WorkboardPanel';
import type { PluginItem } from '../views/panels/PluginMarketplacePanel';
import type { RuntimeWorkboardProjection } from '../workboard/runtimeWorkboardProjection';
import { t } from '../i18n';
import { useVoiceDictation } from '../voice/useVoiceDictation';
import { useDuplexCall } from '../voice/useDuplexCall';
import { VoiceCallStatusBanner } from '../voice/VoiceCallStatusBanner';
import { setMessages } from '../store/session';
import { ProofStrip } from '../components/ProofStrip';
import type { DesktopReceipt } from '../desktop-state/receiptsLedger';
import { appendReceipt } from '../desktop-state/receiptsLedger';
import { buildHomeTrustSummary } from '../desktop-state/homeTrustModel';
import type { DesktopRiskBudgetState } from '../desktop-state/riskBudgetBridge';
import { loadTrustedOperator, toggleTrustedOperator } from '../trust/trustedOperator';
import type { HunkReceipt } from '../trust/hunkApproval';
import { useCodeBridge } from '../desktop-state/useCodeBridge';
import { CodeBridgeChecksPanel } from '../components/CodeBridgeChecksPanel';

export function DesktopShell(props: {
  accent: ZavorthAccent;
  density?: DesktopDensity;
  activePanel: DesktopPanel;
  approvals: ApprovalItem[];
  busy: boolean;
  channels: ChannelItem[];
  channelSetup: ChannelSetupSnapshot | null;
  commandPaletteOpen: boolean;
  commandCenterOpen?: boolean;
  effort: string;
  encryptionReceipt: MemoryEncryptionMigrationReceipt | null;
  encryptionStatus: MemoryEncryptionStatus | null;
  events: BootEvent[];
  input: string;
  inspectorOpen: boolean;
  learning: LearningItem[];
  memoryItems: MemoryItem[];
  gatewayResilience: GatewayResilienceSnapshot | null;
  modelOptions: ModelOption[];
  messages: ChatMessage[];
  nexusStatus: unknown;
  notice: string;
  onNotice?(message: string): void;
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
  onAccent(value: ZavorthAccent): void;
  onDensity?(value: DesktopDensity): void;
  onCommandPalette(open: boolean): void;
  onCommandCenter?(open: boolean): void;
  onEffort(value: string): void;
  onEncryptionAction(action: 'preview' | 'apply' | 'rollback'): void | Promise<void>;
  onInput(value: string): void;
  onLearningDecision(id: string, decision: 'approve' | 'reject' | 'forget'): void | Promise<void>;
  onMemoryControlAction(input: {
    action: 'forget' | 'updatePreference';
    id: string;
    content?: string;
  }): void | Promise<void>;
  onChannelSetupAction(input: {
    action: 'applyScaffold' | 'doctor' | 'testConnection';
    channelId?: string | null;
    mode?: string | null;
    extraEntries?: Array<{ key: string; value: string }>;
  }): void | Promise<void>;
  onGatewayResilienceAction(input: Record<string, unknown>): void | Promise<void>;
  onModel(value: string): void;
  onNewSession(): void;
  onNewSessionWithWorkspace?(workspaceId: string): void;
  onOpenSettingsOverlay?(): void;
  onPanel(panel: DesktopPanel): void;
  onProfile(value: string): void;
  onRefresh(): void | Promise<void>;
  onReviewDecision(
    id: string,
    decision: 'once' | 'session' | 'always' | 'deny' | 'approve' | 'reject',
  ): void | Promise<void>;
  onRuntimeStart(): void | Promise<void>;
  onRuntimeStateAction(input: {
    domain: string;
    operation: string;
    metadata?: Record<string, unknown>;
  }): void | Promise<void>;
  onSidebarCollapsed(updater: (value: boolean) => boolean): void;
  onSubmit(value?: string): unknown | Promise<unknown>;
  onTheme(value: 'light' | 'dark' | 'system'): void;
  onWorkspaceFolder(): void | Promise<void>;
  onWorkspaceScope(value: string): void;
  activeMandate?: TaskMandate | null;
  onRevokeMandate?: () => Promise<void>;
  currentSessionId?: string;
  onSwitchSession?: (sessionId: string) => void;
  mascotActive: boolean;
  onToggleMascot: () => void;
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
  scheduledTasks?: ScheduledTask[];
  onAddScheduledTask?: (name: string, project: string, prompt: string, intervalMinutes: number) => void;
  onDeleteScheduledTask?: (id: string) => void;
  onToggleScheduledTask?: (id: string) => void;
  onRunScheduledTask?: (id: string) => void;
  loadScheduledTaskLogs?: (sessionId: string) => Promise<unknown[]>;
  boards?: WorkboardBoard[];
  runtimeWorkboard?: RuntimeWorkboardProjection | null;
  marketplacePlugins?: PluginItem[];
  marketplaceSource?: 'api' | 'tools' | 'empty';
  pluginOsData?: import('../desktop-state/pluginOsBridge').PluginOsPlanePanelData;
  pluginOsLabels?: Partial<Record<string, string>>;
  pluginOsError?: string | null;
  onEnablePluginOs?: (pluginId: string) => void;
  onDisablePluginOs?: (pluginId: string) => void;
  onInspectPluginOs?: (pluginId: string) => void;
  onRecommendPluginOs?: (intent: string) => void | Promise<void>;
  onCatalogApplyPluginOs?: () => void | Promise<void>;
  onOnboardingPluginOs?: (profile?: string) => void | Promise<void>;
  onUndoOnboardingPluginOs?: () => void | Promise<void>;
  onSuggestActionPluginOs?: (actionId: string, pluginId?: string) => void | Promise<void>;
  pluginOsSuggest?: {
    title?: string;
    body?: string;
    message?: string;
    primary?: { pluginId?: string; needsCredentials?: boolean; risks?: string[] } | null;
    ui?: { actions?: Array<{ id: string; label: string; pluginId?: string }> };
  } | null;
  pluginOsReceipts?: Array<{ id?: string; headline?: string; detail?: string; createdAt?: string }>;
  pluginOsInjectMode?: string;
  onRefreshPluginOs?: () => void | Promise<void>;
  onBoardSelect?: (boardId: string) => void;
  onCardCreate?: (boardId: string, card: Omit<WorkboardCard, 'id' | 'createdAt'>) => void;
  onCardUpdate?: (boardId: string, card: WorkboardCard) => void;
  onCardDelete?: (boardId: string, cardId: string) => void;
  onColumnCreate?: (boardId: string, name: string) => void;
  onColumnUpdate?: (boardId: string, columnId: string, name: string) => void;
  onColumnDelete?: (boardId: string, columnId: string) => void;
  onOpenCardInChat?: (boardId: string, cardId: string) => void;
  onInstallPlugin?: (pluginId: string) => void;
  onUninstallPlugin?: (pluginId: string) => void;
  onUpdatePlugin?: (pluginId: string) => void;
  onAttachFile?: (relativePath: string) => void;
  onRefreshMarketplace?: () => void | Promise<void>;
  receipts?: DesktopReceipt[];
  /** Optional risk budget snapshot for chat-home chip (pure props, no fs). */
  riskBudgetState?: DesktopRiskBudgetState | null;
  /** Persist a new receipt into React state (preferred over localStorage-only append). */
  onRecordReceipt?: (input: Omit<DesktopReceipt, 'id' | 'at'> & { id?: string; at?: string }) => void;
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
  workboardSyncLabel?: string | null;
  workboardSyncDetail?: string | null;
  workboardSyncBusy?: boolean;
  onSyncWorkboard?: (boardId?: string) => void | Promise<boolean | void>;
  onCheckUpdates?: () => unknown | Promise<unknown>;
  onDownloadUpdate?: () => void | Promise<void>;
  onInstallUpdate?: () => void | Promise<void>;
  onDeferUpdate?: () => void | Promise<void>;
  onRollbackUpdate?: () => void | Promise<void>;
  onOpenGithub?: () => void | Promise<void>;
  onOpenSetup?: () => void | Promise<void>;
  onOpenLogs?: () => void | Promise<void>;
  onStartVoiceAgent?: () => void | Promise<void>;
  onRefreshVoiceAgent?: () => void | Promise<void>;
}) {
  const isMac = navigator.userAgent.includes('Macintosh');
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true,
  );
  const resolvedTheme = props.theme === 'system' ? (systemDark ? 'dark' : 'light') : props.theme;
  const sidebarSide = localStorage.getItem('zvd:sidebar-side') || 'left';
  const density = props.density || 'comfortable';
  const [rightRail, setRightRail] = useState<RightRailState>(() =>
    readStoredRightRailState(typeof localStorage !== 'undefined' ? localStorage : null),
  );
  const [focusFilePath, setFocusFilePath] = useState<string | null>(null);
  const [codeBridgeOpen, setCodeBridgeOpen] = useState(false);
  const codeBridge = useCodeBridge();
  const rightRailResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const appClassName = [
    'zvd-app',
    props.sidebarCollapsed ? 'has-collapsed-sidebar' : '',
    props.activePanel === 'chat' ? 'is-chat-focus' : 'is-panel-focus',
    rightRail.open ? 'has-right-rail' : '',
    `theme-${resolvedTheme}`,
    `mode-${props.theme}`,
    `accent-${props.accent}`,
    `density-${density}`,
    isMac ? 'is-mac' : '',
    `zvd-sidebar-side-${sidebarSide}`,
  ]
    .filter(Boolean)
    .join(' ');
  const [localCommandCenterOpen, setLocalCommandCenterOpen] = useState(false);
  const [capabilityMapOpen, setCapabilityMapOpen] = useState(false);
  const [trustedOperator, setTrustedOperator] = useState(() =>
    loadTrustedOperator(typeof localStorage !== 'undefined' ? localStorage : null),
  );
  const [composerQueue, setComposerQueue] = useState<QueuedPrompt[]>([]);
  const [justCompleted, setJustCompleted] = useState(false);
  const wasBusyRef = useRef(props.busy);
  const composerQueueRef = useRef(composerQueue);
  composerQueueRef.current = composerQueue;
  const onSubmitRef = useRef(props.onSubmit);
  onSubmitRef.current = props.onSubmit;

  const updateRightRail = useCallback((patch: Partial<RightRailState>) => {
    setRightRail((current) => {
      const next = { ...current, ...patch, width: clampRightRailWidth(patch.width ?? current.width) };
      writeStoredRightRailState(next, typeof localStorage !== 'undefined' ? localStorage : null);
      return next;
    });
  }, []);

  useEffect(() => {
    return $rightRailOpenRequest.subscribe((request) => {
      if (!request) return;
      updateRightRail({ open: true, tab: request.tab });
    });
  }, [updateRightRail]);

  const commandCenterOpen = props.commandCenterOpen ?? localCommandCenterOpen;
  const setCommandCenterOpen = useCallback(
    (open: boolean) => {
      if (props.onCommandCenter) {
        props.onCommandCenter(open);
        return;
      }
      setLocalCommandCenterOpen(open);
    },
    [props.onCommandCenter],
  );
  const activeModel =
    (props.modelOptions || []).find((model) => model.id === props.selectedModel) || props.modelOptions?.[0];
  const homeTrust = useMemo(
    () =>
      buildHomeTrustSummary({
        approvals: props.approvals,
        receipts: props.receipts,
      }),
    [props.approvals, props.receipts],
  );
  const pendingApprovalCount = homeTrust.pendingApprovalCount;

  // Touch once on mount and keep clock in React state so day-1 eligibility
  // is computed from the same values written to localStorage (not a stale read).
  const [openClock] = useState(() => touchDesktopOpenClock());

  useEffect(() => {
    if (props.currentSessionId) {
      rememberDesktopSession({ id: props.currentSessionId, title: null });
    }
  }, [props.currentSessionId]);

  const continuityModel = useMemo(() => {
    if (props.busy) return null;
    const remembered = readRememberedDesktopSession();
    const providerReady = Boolean(props.runtimeCapabilities?.providers?.connected?.length);
    // Prefer return continuity only when returning to a prior session, not the active one.
    const lastSessionId =
      remembered.id && remembered.id !== props.currentSessionId
        ? remembered.id
        : props.currentSessionId
          ? null
          : remembered.id;
    const learningPending = (props.learning || []).filter((item: LearningItem) => {
      const status = String(item.status || '').toLowerCase();
      return status !== 'promoted' && status !== 'accepted' && status !== 'rejected';
    }).length;
    const pendingTasks = buildDesktopPendingTasks(pendingApprovalCount, learningPending);
    return buildContinuityBannerModel({
      pendingApprovals: pendingApprovalCount,
      providerReady,
      lastSessionId,
      lastSessionTitle: remembered.title,
      pendingTasks,
      day1ReturnEligible: isDay1ReturnEligible(openClock.previousOpenAt, openClock.currentOpenAt),
    });
  }, [
    pendingApprovalCount,
    openClock.currentOpenAt,
    openClock.previousOpenAt,
    props.busy,
    props.currentSessionId,
    props.learning,
    props.runtimeCapabilities,
  ]);

  const voice = useVoiceDictation({
    value: props.input,
    onChange: props.onInput,
    onNotice: props.onNotice,
  });

  const voiceCall = useDuplexCall({
    language: undefined,
    experienceSessionId: props.currentSessionId || null,
    workspace: props.workspaceScope?.path || props.workspaceScope?.id || null,
    injectChat: (turn) => {
      const now = new Date().toISOString();
      setMessages((current) => [
        ...current,
        {
          id: `voice-call-user-${Date.now()}`,
          role: 'user',
          content: turn.userText,
          at: now,
          title: 'Voice call',
        },
        {
          id: `voice-call-agent-${Date.now() + 1}`,
          role: 'assistant',
          content: turn.agentText,
          at: now,
          title: 'Voice call',
        },
      ]);
    },
    onNotice: props.onNotice,
  });

  const toggleVoiceCall = useCallback(() => {
    if (voiceCall.active) {
      void voiceCall.end();
      return;
    }
    // Stop pure dictation if a call starts
    if (voice.listening) {
      voice.stop?.();
    }
    void voiceCall.start();
  }, [voice, voiceCall]);

  const activeToolCount = useMemo(() => {
    if (!props.busy) return 0;
    return (props.messages || []).filter((message) => message.role === 'tool').length;
  }, [props.busy, props.messages]);

  const streamingAssistant = useMemo(() => {
    if (!props.busy) return false;
    const messages = props.messages || [];
    if (!messages.length) return false;
    return messages[messages.length - 1]?.role === 'assistant';
  }, [props.busy, props.messages]);

  // Brief "done" flash when a run finishes (if queue empty), else auto-submit next.
  useEffect(() => {
    const wasBusy = wasBusyRef.current;
    wasBusyRef.current = props.busy;

    if (wasBusy && !props.busy) {
      const result = nextAutoSubmit(false, composerQueueRef.current);
      if (result.prompt) {
        setComposerQueue(result.remaining);
        Promise.resolve().then(() => {
          void onSubmitRef.current(result.prompt!.text);
        });
        return;
      }

      setJustCompleted(true);
      const timer = window.setTimeout(() => setJustCompleted(false), 2200);
      return () => window.clearTimeout(timer);
    }

    if (props.busy) {
      setJustCompleted(false);
    }
  }, [props.busy]);

  const commandCenterInput = useMemo<CommandCenterInput>(() => {
    const settingsGroups = buildSettingsModules({
      runtimeRunning: props.status.running,
      automationCount: props.scheduledTasks?.length,
      customProfileCount: props.customProfiles?.length,
      approvalsCount: pendingApprovalCount,
      memoryCount: props.memoryItems?.length,
      channelCount: props.channels?.length,
      workspacePath: props.workspaceScope?.path || props.workspaceScope?.label || null,
      audience: getOnboardingAudience(),
    });
    return {
      settingsGroups,
      audience: getOnboardingAudience(),
      automationCount: props.scheduledTasks?.length,
      customProfileCount: props.customProfiles?.length,
      runtimeRunning: props.status.running,
      mascotActive: props.mascotActive,
      workspaceLabel: props.workspaceScope?.label,
      rightRailOpen: rightRail.open,
      rightRailTab: rightRail.tab,
      tools: props.tools,
      channels: props.channels,
      agents: props.subagents,
      approvalsPending: props.approvals?.length,
      receiptsCount: props.receipts?.length,
      providerCount: (() => {
        const p = props.runtimeCapabilities?.providers;
        if (!p) return 0;
        if (p.all?.length) return p.all.length;
        return (p.connected?.length || 0) + (p.configurable?.length || 0) + (p.blocked?.length || 0);
      })(),
      // Connection proof only — never catalog length alone.
      providerLiveCount: props.runtimeCapabilities?.providers?.connected?.length || 0,
    };
  }, [
    props.approvals?.length,
    props.channels,
    props.customProfiles?.length,
    props.mascotActive,
    props.memoryItems?.length,
    props.receipts?.length,
    props.runtimeCapabilities,
    props.scheduledTasks?.length,
    props.status.running,
    props.subagents,
    props.tools,
    props.workspaceScope?.label,
    props.workspaceScope?.path,
    rightRail.open,
    rightRail.tab,
  ]);

  const openRightRailTab = useCallback(
    (tab: RightRailTab) => {
      updateRightRail({ open: true, tab });
    },
    [updateRightRail],
  );

  const handleOpenPath = useCallback(
    (path: string, opts?: { line?: number; kind?: 'file' | 'diff' }) => {
      const kind = opts?.kind === 'diff' ? 'diff' : 'file';
      setFocusFilePath(path);
      updateRightRail({
        open: true,
        tab: kind === 'diff' ? 'git' : 'files',
      });
    },
    [updateRightRail],
  );

  const handleApprovePlan = useCallback(
    (planId: string) => {
      void props.onSubmit(`Approve the proposed plan (${planId}) and proceed with the steps.`);
    },
    [props.onSubmit],
  );

  const handleRejectPlan = useCallback(
    (planId: string) => {
      void props.onSubmit(`Reject plan ${planId}. Do not proceed with those steps.`);
    },
    [props.onSubmit],
  );

  const handleRightRailResizeMouseDown = useCallback(
    (event: ReactMouseEvent) => {
      event.preventDefault();
      rightRailResizeRef.current = {
        startX: event.clientX,
        startWidth: rightRail.width,
      };
      const onMove = (moveEvent: MouseEvent) => {
        const start = rightRailResizeRef.current;
        if (!start) return;
        const delta = start.startX - moveEvent.clientX;
        updateRightRail({ width: clampRightRailWidth(start.startWidth + delta) });
      };
      const onUp = () => {
        rightRailResizeRef.current = null;
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [rightRail.width, updateRightRail],
  );

  const openCapabilityDomain = useCallback(
    (domain: CapabilityDomain) => {
      setCapabilityMapOpen(false);
      const panelByDomain: Record<CapabilityDomain, DesktopPanel> = {
        skills: 'skills',
        channels: 'channels',
        agents: 'agents',
        power: 'analytics',
        trust: 'approvals',
        product: 'settings',
      };
      props.onPanel(panelByDomain[domain] || 'skills');
    },
    [props.onPanel],
  );

  const handleCommandCenterAction = useCallback(
    (action: CommandCenterAction) => {
      setCommandCenterOpen(false);
      if (action.type === 'close') {
        return;
      }
      if (action.type === 'capability-map') {
        setCapabilityMapOpen(true);
        return;
      }
      if (action.type === 'panel') {
        props.onPanel(action.panel);
        return;
      }
      if (action.type === 'settings') {
        try {
          const url = new URL(window.location.href);
          url.searchParams.set('settingsTab', action.tab);
          window.history.replaceState({}, '', url.toString());
        } catch {
          // ignore
        }
        if (props.onOpenSettingsOverlay) {
          props.onOpenSettingsOverlay();
        } else {
          props.onPanel('settings');
        }
        return;
      }
      if (action.type === 'rail') {
        openRightRailTab(action.tab);
        return;
      }
      if (action.type === 'insert') {
        props.onPanel('chat');
        props.onInput(action.value);
        return;
      }
      if (action.type === 'run') {
        void props.onSubmit(action.value);
      }
    },
    [openRightRailTab, props.onInput, props.onOpenSettingsOverlay, props.onPanel, props.onSubmit, setCommandCenterOpen],
  );

  const voiceToggleRef = useRef(voice.toggle);
  voiceToggleRef.current = voice.toggle;
  useEffect(() => {
    if (!window.zavorthDesktop?.onVoiceHotkey) return;
    return window.zavorthDesktop.onVoiceHotkey(() => {
      voiceToggleRef.current();
    });
  }, []);

  // Renderer-side hotkey fallback when Electron globalShortcut is unavailable (e.g. smoke hosts).
  useEffect(() => {
    function handleVoiceHotkey(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || !event.shiftKey) return;
      if (event.code !== 'Space' && event.key !== ' ') return;
      event.preventDefault();
      voiceToggleRef.current();
    }
    window.addEventListener('keydown', handleVoiceHotkey);
    return () => window.removeEventListener('keydown', handleVoiceHotkey);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.dataset.density = density;
    document.documentElement.dataset.accent = props.accent;
  }, [resolvedTheme, density, props.accent]);

  const analyticsSessions = useMemo(() => {
    if (!props.messages.length) return [];
    const firstTimestamp = Date.parse(props.messages.find((message) => message.at)?.at || '');
    const lastTimestamp = Date.parse([...props.messages].reverse().find((message) => message.at)?.at || '');
    const startedAt = Number.isFinite(firstTimestamp) ? firstTimestamp : Date.now();
    return [
      {
        id: props.currentSessionId || 'desktop-main',
        startedAt,
        endedAt: props.busy ? undefined : Number.isFinite(lastTimestamp) ? lastTimestamp : Date.now(),
        status: props.busy ? ('active' as const) : ('completed' as const),
        model: props.selectedModel,
      },
    ];
  }, [props.busy, props.currentSessionId, props.messages, props.selectedModel]);

  const analyticsToolCalls = useMemo(
    () =>
      props.messages
        .filter((message) => message.role === 'tool')
        .map((message) => ({
          name: message.title || 'Runtime tool',
          success: !/\b(error|failed|failure)\b/i.test(message.content),
          timestamp: Number.isFinite(Date.parse(message.at || '')) ? Date.parse(message.at || '') : undefined,
        })),
    [props.messages],
  );

  useEffect(() => {
    setTrustedOperator(loadTrustedOperator(typeof localStorage !== 'undefined' ? localStorage : null));
  }, []);

  const handleToggleTrustedOperator = useCallback(() => {
    const next = toggleTrustedOperator(typeof localStorage !== 'undefined' ? localStorage : null, trustedOperator);
    setTrustedOperator(next);
  }, [trustedOperator]);

  const handleHunkReceipt = useCallback(
    (receipt: HunkReceipt) => {
      const payload: Omit<DesktopReceipt, 'id' | 'at'> & { id?: string; at?: string } = {
        kind: 'approval',
        title: receipt.summary,
        summary: `${receipt.decision} · ${receipt.path}`,
        status: receipt.decision === 'approve' ? 'ok' : 'info',
        id: receipt.id,
        at: receipt.at,
        metadata: {
          hunkId: receipt.hunkId,
          path: receipt.path,
          decision: receipt.decision,
        },
      };
      if (props.onRecordReceipt) {
        props.onRecordReceipt(payload);
        return;
      }
      // Fallback when parent does not own receipts state (tests / isolated shells).
      appendReceipt(Array.isArray(props.receipts) ? props.receipts : [], payload);
    },
    [props.onRecordReceipt, props.receipts],
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'j') {
        event.preventDefault();
        updateRightRail({
          open: !(rightRail.open && rightRail.tab === 'terminal'),
          tab: 'terminal',
        });
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandCenterOpen(true);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        props.onCommandPalette(true);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [props.onCommandPalette, rightRail.open, rightRail.tab, setCommandCenterOpen, updateRightRail]);

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
    <main
      className={appClassName}
      data-theme={resolvedTheme}
      data-density={density}
      style={{
        ...zavorthThemePresets[props.accent]?.cssVars,
        ...(rightRail.open ? ({ '--zvd-right-rail-width': `${rightRail.width}px` } as CSSProperties) : null),
      }}
    >
      <a className="zvd-skip-link" href="#zvd-main-content">
        {t('a11y.skipToContent')}
      </a>
      <DesktopSidebar
        activePanel={props.activePanel}
        collapsed={props.sidebarCollapsed}
        pendingApprovals={pendingApprovalCount}
        onNewSession={props.onNewSession}
        onNewSessionWithWorkspace={props.onNewSessionWithWorkspace}
        onPanel={props.onPanel}
        onCommandPalette={() => props.onCommandPalette(true)}
        onOpenCommandCenter={() => setCommandCenterOpen(true)}
        workspaceScope={props.workspaceScope}
        workspaceScopes={props.workspaceScopes}
        onToggle={() => props.onSidebarCollapsed((value) => !value)}
        onWorkspaceFolder={props.onWorkspaceFolder}
        onWorkspaceScope={props.onWorkspaceScope}
        activeMandate={props.activeMandate}
        onRevokeMandate={props.onRevokeMandate}
        currentSessionId={props.currentSessionId}
        onSwitchSession={props.onSwitchSession}
      />

      <section className="zvd-workspace" aria-label="Zavorth Desktop">
        <DesktopTopbar
          busy={props.busy}
          modelLabel={activeModel?.label || 'Zavorth Core'}
          status={props.status}
          mascotActive={props.mascotActive}
          onToggleMascot={props.onToggleMascot}
          onCommandPalette={() => props.onCommandPalette(true)}
          onOpenCommandCenter={() => setCommandCenterOpen(true)}
          onModel={() => props.onOpenSettingsOverlay?.() ?? props.onPanel('settings')}
          onRuntime={() => {
            if (!props.status.running) {
              void props.onRuntimeStart();
              return;
            }
            if (!props.status.tokenReady) {
              void props.onAccessRepair();
              return;
            }
            props.onOpenSettingsOverlay?.() ?? props.onPanel('settings');
          }}
          onRefresh={props.onRefresh}
          onStop={() => void props.onSubmit('/stop')}
          trustedOperator={trustedOperator}
          onToggleTrustedOperator={handleToggleTrustedOperator}
        />

        <section id="zvd-main-content" className="zvd-content-stage" aria-label="Workspace content" tabIndex={-1}>
          <div className="zvd-ambient-field" aria-hidden="true" />
          {props.activePanel === 'chat' ? (
            <>
              <NextActionBanner
                approvalsCount={pendingApprovalCount}
                busy={props.busy}
                runtimeOnline={props.status.running}
                onOpenReview={() => props.onPanel('approvals')}
                onOpenChat={() => props.onPanel('chat')}
                onOpenProof={() => props.onPanel('receipts')}
                onDoctor={() => void props.onAccessRepair()}
              />
              {pendingApprovalCount === 0 && !props.busy ? (
                <ContinuityBanner
                  model={continuityModel}
                  onReview={() => props.onPanel('approvals')}
                  onContinueSession={(sessionId) => {
                    if (props.onSwitchSession) {
                      props.onSwitchSession(sessionId);
                      return;
                    }
                    props.onPanel('chat');
                  }}
                  onStartChat={() => props.onPanel('chat')}
                  onSetupProvider={() => props.onOpenSettingsOverlay?.() ?? props.onPanel('settings')}
                />
              ) : null}
              <ProofStrip
                receipts={Array.isArray(props.receipts) ? props.receipts : []}
                onOpenProof={() => props.onPanel('receipts')}
                onOpenReceipt={() => props.onPanel('receipts')}
                riskBudgetState={props.riskBudgetState}
              />
              <VoiceCallStatusBanner
                active={voiceCall.active}
                phase={voiceCall.phase}
                webrtcState={voiceCall.webrtcState}
                mediaMode={voiceCall.mediaMode}
                mediaPlane={voiceCall.mediaPlane}
                busy={voiceCall.busy}
                lastError={voiceCall.lastError}
                rms={voiceCall.rms}
                interim={voiceCall.interim}
                titleLabel={t('composer.voiceCallActive')}
                endLabel={t('composer.voiceCallStop')}
                onEnd={() => void voiceCall.end()}
              />
              <ThreadView
                approvals={props.approvals}
                busy={props.busy}
                messages={props.messages}
                onDecision={props.onReviewDecision}
                onOpenReview={() => props.onPanel('approvals')}
                onOpenProof={() => props.onPanel('receipts')}
                recentReceiptCount={props.receipts?.length ?? 0}
                onSuggestion={(value) => void props.onSubmit(value)}
                onOpenPath={handleOpenPath}
                onApprovePlan={handleApprovePlan}
                onRejectPlan={handleRejectPlan}
                agents={props.subagents}
                onHunkReceipt={handleHunkReceipt}
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
                onProviderSetup={() => props.onOpenSettingsOverlay?.() ?? props.onPanel('settings')}
                onStop={() => void props.onSubmit('/stop')}
                onSubmit={async (value) => {
                  await props.onSubmit(value);
                }}
                onVoice={voice.toggle}
                voiceListening={voice.listening}
                onVoiceCall={toggleVoiceCall}
                voiceCallActive={voiceCall.active}
                voiceCallPhase={voiceCall.phase}
                voiceCallRms={voiceCall.rms}
                voiceCallStatusLabel={voiceCall.statusLabel}
                onWorkspaceFolder={props.onWorkspaceFolder}
                onWorkspaceScope={props.onWorkspaceScope}
                messages={props.messages}
                pendingApprovals={pendingApprovalCount}
                activeToolCount={activeToolCount}
                streamingAssistant={streamingAssistant}
                justCompleted={justCompleted}
                queue={composerQueue}
                onQueuePrompt={(text) => {
                  setComposerQueue((current) => enqueuePrompt(current, text));
                }}
                onQueueRemove={(id) => {
                  setComposerQueue((current) => removeQueuedPrompt(current, id));
                }}
                onQueueClear={() => {
                  setComposerQueue((current) => clearQueue(current));
                }}
                sessionId={props.currentSessionId}
              />
            </>
          ) : (
            <DesktopWorkspaceView
              activePanel={props.activePanel}
              approvals={props.approvals}
              approvalsCount={pendingApprovalCount}
              busy={props.busy}
              channels={props.channels}
              channelSetup={props.channelSetup}
              effort={props.effort}
              encryptionReceipt={props.encryptionReceipt}
              encryptionStatus={props.encryptionStatus}
              events={props.events}
              learning={props.learning}
              memoryItems={props.memoryItems}
              gatewayResilience={props.gatewayResilience}
              nexusStatus={props.nexusStatus}
              profile={props.profile}
              runtimeCapabilities={props.runtimeCapabilities}
              status={props.status}
              theme={props.theme}
              accent={props.accent}
              density={density}
              tools={props.tools}
              workspaceScope={props.workspaceScope}
              onAccessRepair={props.onAccessRepair}
              onAccent={props.onAccent}
              onDensity={props.onDensity}
              onEffort={props.onEffort}
              onEncryptionAction={props.onEncryptionAction}
              onLearningDecision={props.onLearningDecision}
              onMemoryControlAction={props.onMemoryControlAction}
              onChannelSetupAction={props.onChannelSetupAction}
              onGatewayResilienceAction={props.onGatewayResilienceAction}
              onProfile={props.onProfile}
              onReviewDecision={props.onReviewDecision}
              onRuntimeStart={props.onRuntimeStart}
              onRuntimeStateAction={props.onRuntimeStateAction}
              onTheme={props.onTheme}
              scheduledTasks={props.scheduledTasks}
              onAddScheduledTask={props.onAddScheduledTask}
              onDeleteScheduledTask={props.onDeleteScheduledTask}
              onToggleScheduledTask={props.onToggleScheduledTask}
              onRunScheduledTask={props.onRunScheduledTask}
              loadScheduledTaskLogs={props.loadScheduledTaskLogs}
              subagents={props.subagents}
              onAddSubagent={props.onAddSubagent}
              onDeleteSubagent={props.onDeleteSubagent}
              onTriggerSubagentTask={props.onTriggerSubagentTask}
              customProfiles={props.customProfiles}
              allProfiles={props.allProfiles}
              onAddCustomProfile={props.onAddCustomProfile}
              onDeleteCustomProfile={props.onDeleteCustomProfile}
              activeProfileId={props.activeProfileId}
              onActivateProfile={props.onActivateProfile}
              sessions={analyticsSessions}
              toolCalls={analyticsToolCalls}
              tokenUsage={[]}
              boards={props.boards}
              runtimeWorkboard={props.runtimeWorkboard}
              marketplacePlugins={props.marketplacePlugins}
              marketplaceSource={props.marketplaceSource}
              pluginOsData={props.pluginOsData}
              pluginOsLabels={props.pluginOsLabels}
              pluginOsError={props.pluginOsError}
              onEnablePluginOs={props.onEnablePluginOs}
              onDisablePluginOs={props.onDisablePluginOs}
              onInspectPluginOs={props.onInspectPluginOs}
              onRecommendPluginOs={props.onRecommendPluginOs}
              onCatalogApplyPluginOs={props.onCatalogApplyPluginOs}
              onOnboardingPluginOs={props.onOnboardingPluginOs}
              onUndoOnboardingPluginOs={props.onUndoOnboardingPluginOs}
              onSuggestActionPluginOs={props.onSuggestActionPluginOs}
              pluginOsSuggest={props.pluginOsSuggest}
              pluginOsReceipts={props.pluginOsReceipts}
              pluginOsInjectMode={props.pluginOsInjectMode}
              onRefreshPluginOs={props.onRefreshPluginOs}
              onBoardSelect={props.onBoardSelect}
              onCardCreate={props.onCardCreate}
              onCardUpdate={props.onCardUpdate}
              onCardDelete={props.onCardDelete}
              onColumnCreate={props.onColumnCreate}
              onColumnUpdate={props.onColumnUpdate}
              onColumnDelete={props.onColumnDelete}
              onOpenCardInChat={props.onOpenCardInChat}
              workboardSyncLabel={props.workboardSyncLabel}
              workboardSyncDetail={props.workboardSyncDetail}
              workboardSyncBusy={props.workboardSyncBusy}
              onSyncWorkboard={props.onSyncWorkboard}
              onInstallPlugin={props.onInstallPlugin}
              onUninstallPlugin={props.onUninstallPlugin}
              onUpdatePlugin={props.onUpdatePlugin}
              onAttachFile={props.onAttachFile}
              onRefreshMarketplace={props.onRefreshMarketplace}
              receipts={Array.isArray(props.receipts) ? props.receipts : []}
              onClearReceipts={props.onClearReceipts}
              updateStatusMessage={props.updateStatusMessage}
              updateStatus={props.updateStatus}
              voiceAgentStatus={props.voiceAgentStatus}
              onCheckUpdates={
                props.onCheckUpdates
                  ? async () => {
                      await props.onCheckUpdates?.();
                    }
                  : undefined
              }
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
          )}
        </section>

        <DesktopStatusbar
          bottomPanelOpen={rightRail.open && (rightRail.tab === 'terminal' || rightRail.tab === 'logs')}
          codeBridge={codeBridge}
          effort={props.effort}
          modelLabel={activeModel?.label || 'Zavorth Core'}
          status={props.status}
          workspaceScope={props.workspaceScope}
          onOpenWorkspace={() => void props.onWorkspaceFolder()}
          onOpenSettings={() => props.onOpenSettingsOverlay?.() ?? props.onPanel('settings')}
          onRuntimeStateAction={props.onRuntimeStateAction}
          onPanel={props.onPanel}
          onToggleBottomPanel={() =>
            updateRightRail({
              open: !(rightRail.open && (rightRail.tab === 'terminal' || rightRail.tab === 'logs')),
              tab: rightRail.tab === 'logs' ? 'logs' : 'terminal',
            })
          }
          onOpenCodeBridge={() => setCodeBridgeOpen(true)}
        />
      </section>

      <DesktopRightRail
        activePanel={props.activePanel}
        activeTab={rightRail.tab}
        agentBusy={props.busy}
        approvals={props.approvals}
        events={props.events}
        focusFilePath={focusFilePath}
        messages={props.messages}
        open={rightRail.open}
        recentReceiptCount={props.receipts?.length ?? 0}
        runtimeCapabilities={props.runtimeCapabilities}
        status={props.status}
        tools={props.tools}
        width={rightRail.width}
        workspaceScope={props.workspaceScope}
        onClose={() => updateRightRail({ open: false })}
        onOpenWorkspace={() => void props.onWorkspaceFolder()}
        onPanel={props.onPanel}
        onResizeMouseDown={handleRightRailResizeMouseDown}
        onRuntimeStateAction={props.onRuntimeStateAction}
        onSubmit={async (value) => {
          await props.onSubmit(value);
        }}
        onTab={(tab) => updateRightRail({ open: true, tab })}
      />

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

      <CodeBridgeChecksPanel open={codeBridgeOpen} summary={codeBridge} onClose={() => setCodeBridgeOpen(false)} />

      <CommandPalette
        activePanel={props.activePanel}
        open={props.commandPaletteOpen}
        currentSessionId={props.currentSessionId}
        onClose={() => props.onCommandPalette(false)}
        onInsert={props.onInput}
        onPanel={props.onPanel}
        onRun={async (value) => {
          await props.onSubmit(value);
        }}
        onSwitchSession={props.onSwitchSession}
        onNewSession={props.onNewSession}
        onOpenSettings={() => props.onOpenSettingsOverlay?.() ?? props.onPanel('settings')}
        onOpenCommandCenter={() => setCommandCenterOpen(true)}
      />

      <CommandCenterOverlay
        open={commandCenterOpen}
        onClose={() => setCommandCenterOpen(false)}
        onAction={handleCommandCenterAction}
        input={commandCenterInput}
      />

      <CapabilityMapOverlay
        open={capabilityMapOpen}
        onClose={() => setCapabilityMapOpen(false)}
        tools={props.tools}
        channels={props.channels}
        agents={props.subagents}
        approvalsPending={props.approvals?.length}
        receiptsCount={props.receipts?.length}
        onOpenDomain={openCapabilityDomain}
      />
    </main>
  );
}
