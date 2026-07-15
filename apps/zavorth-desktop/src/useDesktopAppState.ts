import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import {
  dispatchRuntimeStateAction,
  loadDesktopPanelsData,
  loadHome,
  loadRuntimeStatus,
  repairAccess,
  resolveApproval as resolveApprovalRequest,
  resolveLearning as resolveLearningRequest,
  runMemoryEncryptionMigration,
  sendExperienceMessage,
  startRuntime,
  steerActiveRun,
  type ApprovalItem,
  type ChannelItem,
  type ChannelSetupSnapshot,
  type ChatMessage,
  type ControlMemorySnapshot,
  type ExperienceSnapshot,
  type GatewayResilienceSnapshot,
  type LearningItem,
  type MemoryEncryptionMigrationReceipt,
  type MemoryEncryptionStatus,
  type MemoryItem,
  type RuntimeCapabilitiesSnapshot,
  type ToolItem,
  loadWorkspaceWriteApprovals,
  resolveWorkspaceWriteApproval,
  getWorkspaceTrustStatus,
  resolveWorkspaceTrust,
  loadProposedMandate,
  loadActiveMandate,
  resolveProposedMandate,
  revokeActiveMandate,
  getPendingHostCommands,
  resolveHostCommand,
  mutateControlMemory,
  mutateChannelSetup,
  mutateGatewayResilience,
  createDesktopSession,
  switchDesktopSession,
} from './apiClient';
import type { BootEvent, RuntimeStatus } from './global';
import {
  appendLocalMessage,
  applyRuntimeCapabilitiesToDesktop,
  asRecord,
  defaultConnectedModelIds,
  desktopEffortFromRuntime,
  fallbackStatus,
  modelOptionsFromRuntimeCapabilities,
  normalizeMessages,
  responseProfileByExperience,
  runtimeInstrumentActionInput,
  runtimeStateFromSnapshot,
  runtimeStateState,
} from './appRuntimeState';
import { modelOptions } from './modelCatalog';
import { useDesktopAutomations } from './desktop-state/useDesktopAutomations';
import {
  loadCustomProfiles,
  persistCustomProfiles,
  createCustomProfile,
  addCustomProfile,
  deleteCustomProfile,
  mergeProfiles,
  type AgentProfile,
} from './desktop-state/agentProfiles';
import { useDesktopProduct } from './desktop-state/useDesktopProduct';
import { trackDesktopEvent } from './desktop-state/localTelemetry';
import {
  $status,
  setStatus,
  $snapshot,
  setSnapshot,
  $messages,
  setMessages,
  $busy,
  setBusy,
  $notice,
  setNotice,
  $selectedModel,
  setSelectedModel,
  $effort,
  setEffort,
  $experienceProfile,
  setExperienceProfile,
  $sessionId,
  setSessionIdOverride,
  $events,
  addEvent,
  $activePanel,
  setActivePanel,
  $commandPaletteOpen,
  setCommandPaletteOpen,
  $sidebarCollapsed,
  setSidebarCollapsed,
  $inspectorOpen,
  setInspectorOpen,
  $approvals,
  setApprovals,
  $workspaceWriteApprovals,
  setWorkspaceWriteApprovals,
  $proposedMandate,
  setProposedMandate,
  $activeMandate,
  setActiveMandate,
  $pendingHostCommands,
  setPendingHostCommands,
  $showTrustPrompt,
  setShowTrustPrompt,
  $trustLoading,
  setTrustLoading,
  $learning,
  setLearning,
  $tools,
  setTools,
  $controlMemory,
  setControlMemory,
  $memoryEncryptionStatus,
  setMemoryEncryptionStatus,
  $memoryEncryptionReceipt,
  setMemoryEncryptionReceipt,
  $themeMode,
  setThemeMode,
  $accentPreset,
  setAccentPreset,
  $density,
  setDensity,
  $composerInput,
  setComposerInput,
  $workspaceScopes,
  setWorkspaceScopes,
  $workspaceScopeId,
  setWorkspaceScopeId,
  $nexusStatus,
  setNexusStatus,
  $channelSetup,
  setChannelSetup,
  $gatewayResilience,
  setGatewayResilience,
  $runtimeCapabilities,
  setRuntimeCapabilities,
} from './store';

import { parseSlashCommand, slashCommands } from './slashCommands';
import { workspaceScopeForMetadata, type DesktopWorkspaceScope } from './workspaceScopes';
import { createLogger } from './logger.js';
import { shouldClearComposerAfterSend } from './composer/composerDrafts';

const logger = createLogger('shell');

import {
  loadSubagents,
  persistSubagents,
  createSubagent,
  appendSubagentTask,
  queueSubagentTask,
  startQueuedSubagentTask,
  blockSubagentTask,
  waitForSubagentIdle,
  completeSubagentTask,
  failSubagentTask,
  deleteSubagent,
  type ActiveSubagent,
} from './desktop-state/subagents';

import {
  appendReceipt,
  extractReceiptsFromSnapshot,
  loadReceipts,
  persistReceipts,
  type DesktopReceipt,
} from './desktop-state/receiptsLedger';

import { buildDesktopUpdateStatus, type DesktopUpdateStatus } from './desktop-state/desktopUpdate';
import { sendDesktopNotification } from './components/DesktopNotificationService';
import { asErrorLike } from './lib/errors';

export type { ActiveSubagent } from './desktop-state/subagents';
export type { AgentProfile } from './desktop-state/agentProfiles';
export type { ScheduledTask } from './desktop-state/useDesktopAutomations';

export function useDesktopAppState() {
  const status = useStore($status);
  const snapshot = useStore($snapshot);
  const messages = useStore($messages);
  const approvals = useStore($approvals);
  const learning = useStore($learning);
  const tools = useStore($tools);
  const controlMemory = useStore($controlMemory);
  const nexusStatus = useStore($nexusStatus);
  const memoryEncryptionStatus = useStore($memoryEncryptionStatus);
  const memoryEncryptionReceipt = useStore($memoryEncryptionReceipt);
  const runtimeCapabilities = useStore($runtimeCapabilities);
  const channelSetup = useStore($channelSetup);
  const gatewayResilience = useStore($gatewayResilience);
  const events = useStore($events);
  const activePanel = useStore($activePanel);
  const commandPaletteOpen = useStore($commandPaletteOpen);
  const experienceProfile = useStore($experienceProfile);
  const effort = useStore($effort);
  const inspectorOpen = useStore($inspectorOpen);
  const input = useStore($composerInput);
  const busy = useStore($busy);
  const notice = useStore($notice);
  const selectedModel = useStore($selectedModel);
  const sidebarCollapsed = useStore($sidebarCollapsed);
  const theme = useStore($themeMode);
  const accent = useStore($accentPreset);
  const density = useStore($density);
  const workspaceScopes = useStore($workspaceScopes);
  const workspaceScopeId = useStore($workspaceScopeId);
  const workspaceWriteApprovals = useStore($workspaceWriteApprovals);
  const showTrustPrompt = useStore($showTrustPrompt);
  const trustLoading = useStore($trustLoading);
  const proposedMandate = useStore($proposedMandate);
  const activeMandate = useStore($activeMandate);
  const pendingHostCommands = useStore($pendingHostCommands);

  const [promptedWorkspaces, setPromptedWorkspaces] = useState<Set<string>>(() => new Set());
  const [kaelActive, setKaelActive] = useState(false);
  const [subagents, setSubagents] = useState<ActiveSubagent[]>(() => loadSubagents());
  const [customProfiles, setCustomProfiles] = useState<AgentProfile[]>(() => loadCustomProfiles());
  const [receipts, setReceipts] = useState<DesktopReceipt[]>(() => loadReceipts());
  const [updateStatus, setUpdateStatus] = useState<DesktopUpdateStatus | null>(null);
  const prevBusyForNotify = useRef(false);
  const prevRunningForNotify = useRef<boolean | null>(null);

  const bridgeReady = Boolean(window.zavorthDesktop);
  const sessionId = useStore($sessionId);
  const responseProfile = responseProfileByExperience[experienceProfile] || 'short';
  const allProfiles = useMemo(() => mergeProfiles(customProfiles), [customProfiles]);
  const activeAgentProfile = useMemo(
    () => allProfiles.find((profile) => profile.id === experienceProfile) || allProfiles[0],
    [allProfiles, experienceProfile],
  );

  const connectedModelOptions = useMemo(() => {
    if (runtimeCapabilities) {
      return modelOptionsFromRuntimeCapabilities(runtimeCapabilities);
    }
    const connectedIds = new Set(defaultConnectedModelIds());
    return modelOptions.filter((model) => model.connected !== false);
  }, [runtimeCapabilities]);

  const activeWorkspaceScope = workspaceScopes.find((scope) => scope.id === workspaceScopeId) || workspaceScopes[0];

  const automations = useDesktopAutomations({
    workspaceScope: activeWorkspaceScope,
    selectedModel,
    profile: experienceProfile,
    effort,
  });

  const recordReceipt = useCallback((input: Parameters<typeof appendReceipt>[1]) => {
    setReceipts((current) => appendReceipt(current, input));
  }, []);

  const product = useDesktopProduct({
    tools,
    snapshot,
    sessionId,
    setInput: (value) => {
      if (typeof value === 'function') {
        setComposerInput(value($composerInput.get()));
      } else {
        setComposerInput(value);
      }
    },
    setActivePanel: (panel) => setActivePanel(panel as typeof activePanel),
    setNotice,
    getComposerInput: () => $composerInput.get(),
  });

  useEffect(() => {
    const fromSnapshot = extractReceiptsFromSnapshot(snapshot);
    if (fromSnapshot.length === 0) return;
    setReceipts((current) => {
      const ids = new Set(current.map((item) => item.id));
      const merged = [...fromSnapshot.filter((item) => !ids.has(item.id)), ...current];
      return persistReceipts(merged);
    });
  }, [snapshot]);

  useEffect(() => {
    if (prevBusyForNotify.current && !busy) {
      void sendDesktopNotification({
        title: 'Zavorth',
        body: 'Response finished.',
        silent: false,
      });
      recordReceipt({
        kind: 'chat',
        title: 'Chat response finished',
        summary: 'A desktop run completed.',
        status: 'ok',
        sessionId,
        source: 'zavorth-desktop',
      });
      trackDesktopEvent('run_finished', { sessionId: sessionId || null });
    }
    prevBusyForNotify.current = busy;
  }, [busy, recordReceipt, sessionId]);

  useEffect(() => {
    if (prevRunningForNotify.current === null) {
      prevRunningForNotify.current = status.running;
      return;
    }
    if (prevRunningForNotify.current && !status.running) {
      void sendDesktopNotification({
        title: 'Zavorth runtime offline',
        body: status.message || 'Local runtime is not reachable.',
      });
      recordReceipt({
        kind: 'runtime',
        title: 'Runtime went offline',
        summary: status.message || 'Local runtime is not reachable.',
        status: 'failed',
        source: 'zavorth-desktop',
      });
      trackDesktopEvent('runtime_offline', {});
    }
    if (!prevRunningForNotify.current && status.running) {
      recordReceipt({
        kind: 'runtime',
        title: 'Runtime ready',
        summary: status.message || 'Local runtime is reachable.',
        status: 'ok',
        source: 'zavorth-desktop',
      });
      trackDesktopEvent('runtime_online', {});
    }
    prevRunningForNotify.current = status.running;
  }, [recordReceipt, status.message, status.running]);

  useEffect(() => {
    if (approvals.length > 0) {
      void sendDesktopNotification({
        title: 'Approval needed',
        body: `${approvals.length} pending decision${approvals.length === 1 ? '' : 's'} in Zavorth Desktop.`,
      });
    }
  }, [approvals.length]);

  const applyRuntimeStateProjection = useCallback(
    (home: ExperienceSnapshot | null) => {
      const runtimeState = runtimeStateFromSnapshot(home);
      const projections = asRecord(runtimeState.projections);
      const commandBar = asRecord(projections.commandBar);
      const projectedConnectedModelIds = Array.isArray(commandBar.connectedModelIds)
        ? commandBar.connectedModelIds.map((value) => String(value || '').trim()).filter(Boolean)
        : [];
      const state = runtimeStateState(home);
      const model = asRecord(state.model);
      const effortState = asRecord(state.effort);
      const workspace = asRecord(state.workspace);
      const runtimeModelId = String(model.id || '').trim();
      const modelConnected =
        projectedConnectedModelIds.length > 0
          ? projectedConnectedModelIds.includes(runtimeModelId)
          : connectedModelOptions.some((option) => option.id === runtimeModelId);
      if (runtimeModelId && modelConnected) {
        setSelectedModel(runtimeModelId);
      }
      if (effortState.level) {
        setEffort(desktopEffortFromRuntime(effortState.level));
      }
      const workspaceId = String(workspace.id || '').trim();
      if (workspaceId) {
        const nextScope: DesktopWorkspaceScope = {
          id: workspaceId,
          label: String(workspace.label || workspaceId),
          shortLabel: String(workspace.label || workspaceId),
          kind: String(workspace.kind || '').toLowerCase() === 'chat' ? 'chat' : 'folder',
          path: workspace.path ? String(workspace.path) : null,
        };
        setWorkspaceScopes(
          workspaceScopes.some((scope) => scope.id === nextScope.id)
            ? workspaceScopes
            : [...workspaceScopes, nextScope],
        );
        setWorkspaceScopeId(workspaceId);
      }
    },
    [connectedModelOptions, workspaceScopes],
  );

  const refreshRuntime = useCallback(async () => {
    if (!bridgeReady) {
      return fallbackStatus;
    }
    const next = await loadRuntimeStatus();
    setStatus(next);
    return next;
  }, [bridgeReady]);

  const refreshPanels = useCallback(async () => {
    try {
      const data = await loadDesktopPanelsData();
      setApprovals(data.approvals);
      setLearning(data.learning);
      setTools(data.tools);
      setNexusStatus(data.nexusStatus);
      setControlMemory(data.controlMemory);
      setChannelSetup(data.channelSetup);
      setGatewayResilience(data.gatewayResilience);
      setMemoryEncryptionStatus(data.memoryEncryptionStatus);
      setRuntimeCapabilities(data.runtimeCapabilities);
      applyRuntimeCapabilitiesToDesktop({
        capabilities: data.runtimeCapabilities,
        setSelectedModel,
        setEffort,
        setWorkspaceScopes,
        setWorkspaceScopeId,
      });
      const wRes = await loadWorkspaceWriteApprovals(sessionId);
      setWorkspaceWriteApprovals(wRes);

      if (activeWorkspaceScope.id && activeWorkspaceScope.kind === 'folder') {
        const pm = await loadProposedMandate(activeWorkspaceScope.id).catch(() => null);
        setProposedMandate(pm);
        const am = await loadActiveMandate(activeWorkspaceScope.id).catch(() => null);
        setActiveMandate(am);
      } else {
        setProposedMandate(null);
        setActiveMandate(null);
      }
    } catch {
      setApprovals([]);
      setLearning([]);
      setTools([]);
      setNexusStatus(null);
      setMemoryEncryptionStatus(null);
      setRuntimeCapabilities(null);
      setWorkspaceWriteApprovals([]);
      setProposedMandate(null);
      setActiveMandate(null);
      setPendingHostCommands([]);
    }
  }, [sessionId, activeWorkspaceScope]);

  const refreshHome = useCallback(
    async (explicitSessionId?: string) => {
      try {
        const targetSessionId = String(explicitSessionId || sessionId || '').trim() || 'desktop-main';
        const home = await loadHome(targetSessionId, responseProfile);
        setSnapshot(home);
        applyRuntimeStateProjection(home);
        const homeMessages = normalizeMessages(home.chat?.messages);
        setMessages(homeMessages);
        setNotice('');
        return home;
      } catch (error: unknown) {
        const err = asErrorLike(error);

        setNotice(error instanceof Error ? err.message : 'Could not reach the local runtime.');
        return null;
      }
    },
    [responseProfile, sessionId, applyRuntimeStateProjection],
  );

  useEffect(() => {
    if (!bridgeReady) {
      return;
    }

    let mounted = true;
    void refreshRuntime()
      .then(() => (mounted ? refreshHome() : null))
      .then(() => (mounted ? refreshPanels() : null))
      .catch(() => undefined);
    const off = window.zavorthDesktop!.onBootEvent((event) => {
      addEvent(event);
    });

    return () => {
      mounted = false;
      off();
    };
  }, [bridgeReady, refreshHome, refreshPanels, refreshRuntime]);

  useEffect(() => {
    if (!bridgeReady) {
      return;
    }

    const interval = setInterval(() => {
      loadWorkspaceWriteApprovals(sessionId)
        .then((wRes) => {
          setWorkspaceWriteApprovals(wRes);
        })
        .catch((err) => {
          logger.warn('[auto-fix] Empty catch block', err);
        });

      if (activeWorkspaceScope.id && activeWorkspaceScope.kind === 'folder') {
        loadProposedMandate(activeWorkspaceScope.id)
          .then(setProposedMandate)
          .catch((err) => {
            logger.warn('[auto-fix] Empty catch block', err);
          });
        loadActiveMandate(activeWorkspaceScope.id)
          .then(setActiveMandate)
          .catch((err) => {
            logger.warn('[auto-fix] Empty catch block', err);
          });
        getPendingHostCommands(activeWorkspaceScope.id)
          .then(setPendingHostCommands)
          .catch((err) => {
            logger.warn('[auto-fix] Empty catch block', err);
          });
      }
    }, 3000);

    return () => {
      clearInterval(interval);
    };
  }, [bridgeReady, sessionId, activeWorkspaceScope.id, activeWorkspaceScope.kind]);

  useEffect(() => {
    if (activeWorkspaceScope.kind === 'folder' && activeWorkspaceScope.id && activeWorkspaceScope.path) {
      getWorkspaceTrustStatus(activeWorkspaceScope.id)
        .then((res) => {
          if (res.ok) {
            if (!res.trusted && !promptedWorkspaces.has(activeWorkspaceScope.id)) {
              setShowTrustPrompt(true);
              setPromptedWorkspaces((prev) => {
                const next = new Set(prev);
                next.add(activeWorkspaceScope.id!);
                return next;
              });
            } else {
              setShowTrustPrompt(false);
            }
          }
        })
        .catch((err) => {
          logger.warn('[auto-fix] Empty catch block', err);
        });
    } else {
      setShowTrustPrompt(false);
    }
  }, [activeWorkspaceScope.id, activeWorkspaceScope.kind, activeWorkspaceScope.path, promptedWorkspaces]);

  const handleTrustWorkspaceFromPrompt = async (
    allowRiskUpTo: 'LOW' | 'MEDIUM',
    allowPackageInstall: boolean,
    allowNetwork: boolean,
  ) => {
    setTrustLoading(true);
    try {
      if (activeWorkspaceScope.path) {
        await resolveWorkspaceTrust({
          workspaceId: activeWorkspaceScope.id,
          rootPath: activeWorkspaceScope.path,
          trusted: true,
          allowRiskUpTo,
          allowPackageInstall,
          allowNetwork,
        });
        await refreshPanels();
        setShowTrustPrompt(false);
      }
    } catch (error: unknown) {
      const err = asErrorLike(error);

      logger.error(err);
    } finally {
      setTrustLoading(false);
    }
  };

  const memoryItems = useMemo(() => {
    const memory = snapshot?.memory || {};
    return [
      ...((Array.isArray(memory.items) ? memory.items : []) as MemoryItem[]),
      ...((Array.isArray(memory.receipts) ? memory.receipts : []) as MemoryItem[]),
      ...((Array.isArray(controlMemory?.facts) ? controlMemory.facts : []) as MemoryItem[]),
    ];
  }, [controlMemory, snapshot]);

  const channelItems = useMemo(() => {
    const channels = (snapshot?.channels || {}) as {
      routes?: ChannelItem[];
      readiness?: ChannelItem[];
    };
    const setupOptions: ChannelItem[] = Array.isArray(channelSetup?.assistant?.options)
      ? channelSetup.assistant.options.map((option) => ({
          id: option.channelId,
          name: option.label,
          channel: option.channelId,
          configured: option.configured,
          liveReady: option.readiness === 'ready',
          status: option.readiness || channelSetup.assistant?.status,
          summary: option.summary,
        }))
      : [];
    const routes = Array.isArray(channels.routes) ? channels.routes : [];
    const readiness = Array.isArray(channels.readiness) ? channels.readiness : [];
    return [...routes, ...readiness, ...setupOptions];
  }, [channelSetup, snapshot]);

  async function resolveApproval(
    approvalId: string,
    decision: 'once' | 'session' | 'always' | 'deny' | 'approve' | 'reject',
  ) {
    setBusy(true);
    try {
      await resolveApprovalRequest(approvalId, decision);
      await refreshPanels();
      const label =
        decision === 'deny' || decision === 'reject'
          ? 'denied'
          : decision === 'session'
            ? 'allowed for session'
            : decision === 'always'
              ? 'always allowed'
              : 'allowed once';
      appendLocalMessage(setMessages, 'system', `Approval ${label}.`);
      recordReceipt({
        kind: 'approval',
        title: `Approval ${decision}`,
        summary: `Decision ${decision} for ${approvalId}.`,
        status: decision === 'deny' || decision === 'reject' ? 'failed' : 'ok',
        sessionId,
        source: 'zavorth-desktop',
        metadata: { approvalId, decision },
      });
      trackDesktopEvent('approval_resolved', { decision });
    } catch (error: unknown) {
      const err = asErrorLike(error);

      setNotice(error instanceof Error ? err.message : 'Could not resolve approval.');
    } finally {
      setBusy(false);
    }
  }

  async function resolveLearning(candidateId: string, decision: 'approve' | 'reject' | 'forget') {
    setBusy(true);
    try {
      await resolveLearningRequest(candidateId, decision);
      await refreshPanels();
      appendLocalMessage(setMessages, 'system', `Learning candidate marked as ${decision}.`);
    } catch (error: unknown) {
      const err = asErrorLike(error);

      setNotice(error instanceof Error ? err.message : 'Could not resolve learning candidate.');
    } finally {
      setBusy(false);
    }
  }

  async function handleMemoryEncryptionAction(action: 'preview' | 'apply' | 'rollback') {
    setBusy(true);
    try {
      const result = await runMemoryEncryptionMigration({
        action,
        backupPath: action === 'rollback' ? memoryEncryptionReceipt?.backupPath : null,
      });
      if (result.status) {
        setMemoryEncryptionStatus(result.status);
      }
      if (result.receipt) {
        setMemoryEncryptionReceipt(result.receipt);
        appendLocalMessage(
          setMessages,
          'system',
          `Memory protection ${result.receipt.status}: ${result.receipt.reason}`,
        );
      }
    } catch (error: unknown) {
      const err = asErrorLike(error);

      setNotice(error instanceof Error ? err.message : 'Could not update memory protection.');
    } finally {
      setBusy(false);
      void refreshPanels();
    }
  }

  async function handleMemoryControlAction(input: {
    action: 'forget' | 'updatePreference';
    id: string;
    content?: string;
  }) {
    setBusy(true);
    try {
      const result = await mutateControlMemory(input);
      appendLocalMessage(
        setMessages,
        'system',
        `Memory ${input.action}: ${result?.receipt?.receiptId || 'receipt created'}.`,
      );
      await refreshPanels();
    } catch (error: unknown) {
      const err = asErrorLike(error);

      setNotice(error instanceof Error ? err.message : 'Could not update memory.');
    } finally {
      setBusy(false);
    }
  }

  async function handleChannelSetupAction(input: {
    action: 'applyScaffold' | 'doctor' | 'testConnection';
    channelId?: string | null;
    mode?: string | null;
    extraEntries?: Array<{ key: string; value: string }>;
  }) {
    setBusy(true);
    try {
      const result = await mutateChannelSetup(input);
      if (result?.result?.assistant) {
        setChannelSetup({ ok: true, assistant: result.result.assistant });
      }
      appendLocalMessage(
        setMessages,
        'system',
        `Channel ${input.action}: ${result?.receipt?.receiptId || result?.action || 'done'}.`,
      );
      await refreshPanels();
    } catch (error: unknown) {
      const err = asErrorLike(error);

      setNotice(error instanceof Error ? err.message : 'Could not run channel setup.');
    } finally {
      setBusy(false);
    }
  }

  async function handleGatewayResilienceAction(input: Record<string, unknown>) {
    setBusy(true);
    try {
      const result = await mutateGatewayResilience(input);
      if (result?.resilience) {
        setGatewayResilience(result.resilience);
      }
      appendLocalMessage(
        setMessages,
        'system',
        `Gateway resilience: ${result?.receipt?.receiptId || result?.status || 'updated'}.`,
      );
      await refreshPanels();
    } catch (error: unknown) {
      const err = asErrorLike(error);

      setNotice(error instanceof Error ? err.message : 'Could not update gateway resilience.');
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage(rawText = input): Promise<{ ok: boolean; assistantText?: string }> {
    const text = rawText.trim();
    if (!text || $busy.get()) {
      return { ok: false };
    }

    const parsed = parseSlashCommand(text);
    if (shouldClearComposerAfterSend(rawText, input)) {
      setComposerInput('');
    }
    setNotice('');

    if (parsed.kind === 'help') {
      appendLocalMessage(
        setMessages,
        'system',
        slashCommands.map((command) => `${command.usage} - ${command.description}`).join('\n'),
      );
      return { ok: true };
    }
    if (parsed.kind === 'panel') {
      setActivePanel(parsed.panel);
      return { ok: true };
    }
    if (parsed.kind === 'set-effort') {
      setEffort(parsed.effort);
      appendLocalMessage(setMessages, 'system', `Effort set to ${parsed.effort}.`);
      return { ok: true };
    }
    if (parsed.kind === 'set-profile') {
      setExperienceProfile(parsed.profile);
      appendLocalMessage(setMessages, 'system', `Profile set to ${parsed.profile}.`);
      return { ok: true };
    }
    if (parsed.kind === 'stop') {
      setBusy(true);
      try {
        await steerActiveRun({
          sessionId,
          message: 'Stop the current run as soon as the active executor reaches a safe cancellation point.',
        });
        appendLocalMessage(setMessages, 'system', 'Stop requested for the active run.');
      } catch {
        const result = await sendExperienceMessage({
          text: 'Stop the current run as soon as it is safe.',
          sessionId,
          responseProfile,
          effort,
          model: selectedModel,
          connectedModelIds: connectedModelOptions.map((model) => model.id),
          profile: experienceProfile,
          profileConfig: {
            id: activeAgentProfile.id,
            name: activeAgentProfile.name,
            systemPrompt: activeAgentProfile.systemPrompt,
            effort: activeAgentProfile.effort,
            costLimit: activeAgentProfile.costLimit,
          },
          workspace: workspaceScopeForMetadata(activeWorkspaceScope),
        });
        const projectedSnapshot = result.snapshot || snapshot;
        setSnapshot(projectedSnapshot);
        applyRuntimeStateProjection(projectedSnapshot);
        appendLocalMessage(setMessages, 'system', result.error || 'Stop request sent.');
      } finally {
        setBusy(false);
        void refreshPanels();
      }
      return { ok: true };
    }

    if (parsed.kind === 'llm-roles') {
      const slashText = `/${parsed.command}${parsed.args ? ` ${parsed.args}` : ''}`.trim();
      appendLocalMessage(setMessages, 'user', slashText);
      setBusy(true);
      try {
        // Prefer Control API (same store as other surfaces), fall back to chat slash text.
        const isStrong = parsed.command === 'strong';
        const body = isStrong
          ? { action: 'forceStrong', enabled: !/^(off|default|0|false)$/i.test(parsed.args || 'on') }
          : /setup/i.test(parsed.args)
            ? { action: 'setup' }
            : null;
        if (body) {
          const res = await fetch('/api/llm-roles?userId=desktop&surface=desktop', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          const payload = await res.json().catch(() => ({}));
          if (res.ok) {
            appendLocalMessage(
              setMessages,
              'assistant',
              String(payload?.statusText || payload?.prompt || (isStrong ? 'Force-strong updated.' : 'Roles updated.')),
            );
            return { ok: true };
          }
        }
        const statusRes = await fetch('/api/llm-roles?userId=desktop&surface=desktop');
        if (statusRes.ok && (!parsed.args || /status|show/i.test(parsed.args))) {
          const payload = await statusRes.json();
          appendLocalMessage(setMessages, 'assistant', String(payload?.statusText || 'LLM roles loaded.'));
          return { ok: true };
        }
        // Fall through: send slash to experience runtime so shared-surface can handle roles.
        const result = await sendExperienceMessage({
          text: slashText,
          sessionId,
          responseProfile,
          effort,
          model: selectedModel,
          connectedModelIds: connectedModelOptions.map((model) => model.id),
          profile: experienceProfile,
          profileConfig: {
            id: activeAgentProfile.id,
            name: activeAgentProfile.name,
            systemPrompt: activeAgentProfile.systemPrompt,
            effort: activeAgentProfile.effort,
            costLimit: activeAgentProfile.costLimit,
          },
          workspace: workspaceScopeForMetadata(activeWorkspaceScope),
        });
        const projectedSnapshot = result.snapshot || snapshot;
        setSnapshot(projectedSnapshot);
        applyRuntimeStateProjection(projectedSnapshot);
        const replies = result.replies || result.messages || [];
        if (replies.length === 0 && result.error) {
          appendLocalMessage(setMessages, 'system', result.error);
        }
      } catch (err: unknown) {
        appendLocalMessage(
          setMessages,
          'system',
          err instanceof Error ? err.message : 'Could not run LLM role command.',
        );
      } finally {
        setBusy(false);
        void refreshPanels();
      }
      return { ok: true };
    }

    const outbound = parsed.kind === 'send' ? parsed.text : parsed.text;
    appendLocalMessage(setMessages, 'user', outbound);
    setBusy(true);
    try {
      const result = await sendExperienceMessage({
        text: outbound,
        sessionId,
        responseProfile,
        effort,
        model: selectedModel,
        connectedModelIds: connectedModelOptions.map((model) => model.id),
        profile: experienceProfile,
        profileConfig: {
          id: activeAgentProfile.id,
          name: activeAgentProfile.name,
          systemPrompt: activeAgentProfile.systemPrompt,
          effort: activeAgentProfile.effort,
          costLimit: activeAgentProfile.costLimit,
        },
        workspace: workspaceScopeForMetadata(activeWorkspaceScope),
      });
      if (result.snapshot) {
        setSnapshot(result.snapshot);
        applyRuntimeStateProjection(result.snapshot);
      }
      const nextMessages = normalizeMessages(result.snapshot?.chat?.messages);
      const replies = normalizeMessages(result.replies || result.messages);
      let assistantText = '';
      if (nextMessages.length > 0) {
        setMessages(nextMessages);
        assistantText = [...nextMessages].reverse().find((message) => message.role === 'assistant')?.content || '';
      } else if (replies.length > 0) {
        setMessages((current) => [...current, ...replies]);
        assistantText = [...replies].reverse().find((message) => message.role === 'assistant')?.content || '';
      } else {
        const fallback = result.error || 'Zavorth received the request.';
        appendLocalMessage(setMessages, 'assistant', fallback);
        assistantText = fallback;
      }
      if (result.receiptId) {
        recordReceipt({
          id: result.receiptId,
          kind: 'chat',
          title: 'Chat delivery receipt',
          summary: `Message handled in session ${sessionId}.`,
          status: result.error ? 'failed' : 'ok',
          sessionId,
          source: 'experience',
        });
      }
      const ok = !result.error;
      trackDesktopEvent('chat_send', { ok });
      await refreshPanels();
      return { ok, assistantText: assistantText || undefined };
    } catch (error: unknown) {
      const err = asErrorLike(error);

      setNotice(error instanceof Error ? err.message : 'Could not send message.');
      appendLocalMessage(setMessages, 'system', 'The message could not be delivered to the local runtime.');
      recordReceipt({
        kind: 'chat',
        title: 'Chat delivery failed',
        summary: error instanceof Error ? err.message : 'Could not send message.',
        status: 'failed',
        sessionId,
        source: 'zavorth-desktop',
      });
      return { ok: false };
    } finally {
      setBusy(false);
    }
  }

  const clearReceipts = useCallback(() => {
    setReceipts(persistReceipts([]));
  }, []);

  const checkDesktopUpdates = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = Boolean(options?.silent);
      try {
        const result = await window.zavorthDesktop?.checkUpdates?.();
        const status = buildDesktopUpdateStatus({
          currentVersion: result?.version || '0.1.0',
          latestVersion: result?.latestVersion || result?.version || '0.1.0',
          providerConfigured: result?.providerConfigured !== false,
          downloaded: Boolean(result?.downloaded),
          deferredUntil: result?.deferredUntil || null,
          rollbackVersion: result?.rollbackVersion || null,
          channel: result?.channel || 'github',
          source: result?.source || result?.channel || 'github',
          githubRepo: result?.githubRepo || 'zavorth/zavorth',
          releaseUrl: result?.releaseUrl || null,
          releaseNotes: result?.changelog ? [result.changelog] : [],
          error: result?.error || (!result ? 'Update bridge unavailable.' : null),
        });
        setUpdateStatus(status);
        if (!silent) {
          setNotice(status.message);
          recordReceipt({
            kind: 'system',
            title: 'Update check',
            summary: status.message,
            status: status.state === 'error' ? 'failed' : 'info',
            source: 'zavorth-desktop-update',
          });
        } else if (status.state === 'available' || status.state === 'ready-to-install' || status.state === 'error') {
          // Background check only surfaces noteworthy states.
          setNotice(status.message);
        }
        trackDesktopEvent('update_check', { state: status.state, silent });
        return status;
      } catch (error: unknown) {
        const err = asErrorLike(error);

        const status = buildDesktopUpdateStatus({
          currentVersion: '0.1.0',
          providerConfigured: false,
          error: error instanceof Error ? err.message : 'Update check failed.',
        });
        setUpdateStatus(status);
        return status;
      }
    },
    [recordReceipt],
  );

  const downloadDesktopUpdate = useCallback(async () => {
    const result = await window.zavorthDesktop?.downloadUpdate?.();
    setNotice(result?.message || result?.error || 'Download requested.');
    recordReceipt({
      kind: 'system',
      title: 'Update download',
      summary: result?.message || result?.error || 'Download requested.',
      status: result?.ok ? 'ok' : 'failed',
      source: 'zavorth-desktop-update',
    });
    await checkDesktopUpdates();
  }, [checkDesktopUpdates, recordReceipt]);

  const installDesktopUpdate = useCallback(async () => {
    const result = await window.zavorthDesktop?.installUpdate?.();
    setNotice(result?.message || result?.error || 'Install requested.');
    recordReceipt({
      kind: 'system',
      title: 'Update install',
      summary: result?.message || result?.error || 'Install requested.',
      status: result?.ok ? 'ok' : 'failed',
      source: 'zavorth-desktop-update',
    });
    await checkDesktopUpdates();
  }, [checkDesktopUpdates, recordReceipt]);

  const deferDesktopUpdate = useCallback(async () => {
    const result = await window.zavorthDesktop?.deferUpdate?.({ days: 7 });
    setNotice(result?.message || result?.error || 'Update deferred.');
    await checkDesktopUpdates();
  }, [checkDesktopUpdates]);

  const rollbackDesktopUpdate = useCallback(async () => {
    const result = await window.zavorthDesktop?.rollbackUpdate?.();
    setNotice(result?.message || result?.error || 'Rollback info.');
    recordReceipt({
      kind: 'system',
      title: 'Update rollback info',
      summary: result?.message || result?.error || 'Rollback info.',
      status: result?.ok ? 'info' : 'failed',
      source: 'zavorth-desktop-update',
    });
  }, [recordReceipt]);

  const openGithubReleases = useCallback(async () => {
    const result =
      (await window.zavorthDesktop?.openGithubReleases?.()) || (await window.zavorthDesktop?.downloadUpdate?.());
    setNotice(result?.message || result?.error || 'Opened GitHub Releases.');
    trackDesktopEvent('open_github_releases', { ok: Boolean(result?.ok !== false) });
  }, []);

  const [voiceAgentStatus, setVoiceAgentStatus] = useState<{
    running: boolean;
    message: string;
    hotkey: string;
    wakeWord: string | null;
    mode: string;
  } | null>(null);

  const refreshVoiceAgentStatus = useCallback(async () => {
    const result = await window.zavorthDesktop?.getVoiceAgentStatus?.();
    if (!result) {
      setVoiceAgentStatus({
        running: false,
        message: 'Voice companion bridge unavailable; Desktop dictation still works.',
        hotkey: 'Ctrl+Shift+Space',
        wakeWord: null,
        mode: 'desktop-dictation',
      });
      return;
    }
    setVoiceAgentStatus({
      running: Boolean(result.running),
      message: result.message || result.error || '',
      hotkey: result.hotkey || 'Ctrl+Shift+Space',
      wakeWord: result.wakeWord || null,
      mode: result.mode || 'desktop-dictation',
    });
  }, []);

  const startVoiceAgent = useCallback(async () => {
    const result = await window.zavorthDesktop?.startVoiceAgent?.();
    setNotice(result?.message || result?.error || 'Voice companion start requested.');
    recordReceipt({
      kind: 'system',
      title: 'Voice companion',
      summary: result?.message || result?.error || 'Start requested.',
      status: result?.ok ? 'ok' : 'failed',
      source: 'zavorth-desktop-voice',
    });
    await refreshVoiceAgentStatus();
  }, [recordReceipt, refreshVoiceAgentStatus]);

  useEffect(() => {
    void refreshVoiceAgentStatus();
    const timer = window.setInterval(() => {
      void refreshVoiceAgentStatus();
    }, 45000);
    return () => window.clearInterval(timer);
  }, [refreshVoiceAgentStatus]);

  // Local-first update check once after shell loads (non-blocking, honest about unconfigured channel).
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void checkDesktopUpdates({ silent: true });
    }, 1800);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional one-shot after mount
  }, []);

  const openSetup = useCallback(async () => {
    const result = await window.zavorthDesktop?.startSetup?.();
    setNotice(result?.message || 'Setup launch requested.');
    trackDesktopEvent('open_setup', { ok: Boolean(result?.ok) });
  }, []);

  const openLogs = useCallback(async () => {
    const result = await window.zavorthDesktop?.openLogs?.();
    setNotice(result?.path ? `Logs: ${result.path}` : 'Log folder open requested.');
    trackDesktopEvent('open_logs', {});
  }, []);

  async function requestRuntimeStart() {
    setBusy(true);
    try {
      const next = await startRuntime();
      setStatus(next);
      setNotice(next.message);
    } catch (error: unknown) {
      const err = asErrorLike(error);

      setNotice(error instanceof Error ? err.message : 'Could not start runtime.');
    } finally {
      setBusy(false);
    }
  }

  async function requestAccessRepair() {
    setBusy(true);
    try {
      const next = await repairAccess();
      setStatus(next);
      setNotice(next.message);
    } catch (error: unknown) {
      const err = asErrorLike(error);

      setNotice(error instanceof Error ? err.message : 'Could not repair access.');
    } finally {
      setBusy(false);
    }
  }

  const requestRuntimeInstrument = useCallback(
    async (input: { domain: string; operation: string; metadata?: Record<string, unknown> }) => {
      try {
        const actionInput = runtimeInstrumentActionInput(input);
        await dispatchRuntimeStateAction({
          type: actionInput.type,
          approved: true,
          sessionId,
          source: 'zavorth-desktop-statusbar',
          payload: actionInput.payload,
        });
        await refreshHome();
        await refreshPanels();
      } catch (error: unknown) {
        const err = asErrorLike(error);

        setNotice(error instanceof Error ? err.message : 'Could not update runtime control.');
      }
    },
    [refreshHome, refreshPanels, sessionId],
  );

  const applyRuntimeSelection = useCallback(
    async (input: {
      type: 'set-effort' | 'route-model' | 'set-workspace';
      payload: Record<string, unknown>;
      connectedModelIds?: string[];
    }) => {
      try {
        await dispatchRuntimeStateAction({
          type: input.type,
          approved: true,
          sessionId,
          source: 'zavorth-desktop-bridge',
          connectedModelIds: input.connectedModelIds,
          payload: {
            ...input.payload,
            metadata: {
              trustedDesktopBridge: true,
              requestedFrom: 'desktop-command-bar',
            },
          },
        });
        await refreshHome();
        await refreshPanels();
      } catch (error: unknown) {
        const err = asErrorLike(error);

        setNotice(error instanceof Error ? err.message : 'Could not persist runtime selection.');
      }
    },
    [refreshHome, refreshPanels, sessionId],
  );

  const handleEffortSelection = useCallback(
    async (value: string) => {
      setEffort(value);
      await applyRuntimeSelection({
        type: 'set-effort',
        payload: { effort: value },
      });
    },
    [applyRuntimeSelection],
  );

  const handleModelSelection = useCallback(
    async (value: string) => {
      setSelectedModel(value);
      const model = connectedModelOptions.find((option) => option.id === value);
      await applyRuntimeSelection({
        type: 'route-model',
        connectedModelIds: connectedModelOptions.map((option) => option.id),
        payload: {
          dynamicRouting: {
            modelId: value,
            providerId: model?.family || value.split(':')[0] || 'runtime',
            intent: 'desktop-model-picker',
            reason: `Desktop selected ${model?.label || value}.`,
            fallbackModelIds: connectedModelOptions
              .map((option) => option.id)
              .filter((id) => id !== value)
              .slice(0, 4),
            risk: 'low',
          },
        },
      });
    },
    [applyRuntimeSelection, connectedModelOptions],
  );

  const handleWorkspaceScopeSelection = useCallback(
    async (value: string) => {
      const scope = workspaceScopes.find((candidate) => candidate.id === value);
      if (!scope) {
        return;
      }
      await applyRuntimeSelection({
        type: 'set-workspace',
        payload: {
          workspace: workspaceScopeForMetadata(scope),
        },
      });
    },
    [applyRuntimeSelection, workspaceScopes],
  );

  const handleWorkspaceFolderSelection = useCallback(async () => {
    const result = await window.zavorthDesktop?.selectWorkspaceFolder();
    if (!result || result.canceled || !result.path || !result.label) {
      return;
    }
    const nextScope: DesktopWorkspaceScope = {
      id: `folder:${result.path}`,
      label: result.label,
      shortLabel: result.label,
      kind: 'folder',
      path: result.path,
    };
    await applyRuntimeSelection({
      type: 'set-workspace',
      payload: {
        workspace: workspaceScopeForMetadata(nextScope),
      },
    });
  }, [applyRuntimeSelection]);

  async function handleWorkspaceWriteApprovalResolve(operationId: string, decision: 'approve' | 'deny') {
    setBusy(true);
    try {
      await resolveWorkspaceWriteApproval(operationId, decision);
      const wRes = await loadWorkspaceWriteApprovals(sessionId);
      setWorkspaceWriteApprovals(wRes);
      appendLocalMessage(
        setMessages,
        'system',
        `Workspace approval ${decision === 'approve' ? 'allowed' : 'blocked'}.`,
      );
    } catch (error: unknown) {
      const err = asErrorLike(error);

      setNotice(error instanceof Error ? err.message : 'Could not resolve workspace write approval.');
    } finally {
      setBusy(false);
    }
  }

  async function handleProposedMandateResolve(approved: boolean) {
    if (!activeWorkspaceScope.id) return;
    setBusy(true);
    try {
      await resolveProposedMandate(activeWorkspaceScope.id, approved);
      const pm = await loadProposedMandate(activeWorkspaceScope.id).catch(() => null);
      setProposedMandate(pm);
      const am = await loadActiveMandate(activeWorkspaceScope.id).catch(() => null);
      setActiveMandate(am);
      appendLocalMessage(setMessages, 'system', `Task mandate ${approved ? 'approved' : 'denied'}.`);
    } catch (error: unknown) {
      const err = asErrorLike(error);

      setNotice(error instanceof Error ? err.message : 'Could not resolve task mandate.');
    } finally {
      setBusy(false);
    }
  }

  async function handleActiveMandateRevoke() {
    if (!activeWorkspaceScope.id) return;
    setBusy(true);
    try {
      await revokeActiveMandate(activeWorkspaceScope.id);
      setProposedMandate(null);
      setActiveMandate(null);
      appendLocalMessage(setMessages, 'system', 'Task mandate has been revoked.');
    } catch (error: unknown) {
      const err = asErrorLike(error);

      setNotice(error instanceof Error ? err.message : 'Could not revoke task mandate.');
    } finally {
      setBusy(false);
    }
  }

  const handleHostCommandResolve = useCallback(
    async (operationId: string, decision: 'approve' | 'deny', strongPhrase?: string) => {
      setBusy(true);
      try {
        await resolveHostCommand(operationId, decision, strongPhrase);
        setPendingHostCommands(
          pendingHostCommands.filter((cmd) => cmd.operation_id !== operationId && cmd.operationId !== operationId),
        );
        appendLocalMessage(setMessages, 'system', `Host command proposal ${decision}d.`);
      } catch (error: unknown) {
        const err = asErrorLike(error);

        setNotice(error instanceof Error ? err.message : 'Could not resolve host command proposal.');
      } finally {
        setBusy(false);
      }
    },
    [pendingHostCommands],
  );

  const handleSwitchSession = useCallback(
    async (nextSessionId: string) => {
      const id = String(nextSessionId || '').trim();
      if (!id) return;
      setBusy(true);
      try {
        setSessionIdOverride(id);
        setMessages([]);
        setComposerInput('');
        await switchDesktopSession(id);
        await refreshHome(id);
        await refreshPanels();
        setActivePanel('chat');
      } catch (error: unknown) {
        const err = asErrorLike(error);

        setNotice(err instanceof Error ? err.message : 'Error switching session.');
      } finally {
        setBusy(false);
      }
    },
    [refreshHome, refreshPanels],
  );

  const handleNewSession = useCallback(
    async (workspaceId?: string) => {
      setBusy(true);
      try {
        const targetWorkspaceId = String(workspaceId || '').trim();
        if (targetWorkspaceId && targetWorkspaceId !== 'chat') {
          const scope = workspaceScopes.find((candidate) => candidate.id === targetWorkspaceId);
          if (scope) {
            await applyRuntimeSelection({
              type: 'set-workspace',
              payload: { workspace: workspaceScopeForMetadata(scope) },
            });
          }
        } else if (targetWorkspaceId === 'chat') {
          const chatScope = workspaceScopes.find((scope) => scope.kind === 'chat') || workspaceScopes[0];
          if (chatScope) {
            await applyRuntimeSelection({
              type: 'set-workspace',
              payload: { workspace: workspaceScopeForMetadata(chatScope) },
            });
          }
        }

        const surface =
          targetWorkspaceId && targetWorkspaceId !== 'chat'
            ? targetWorkspaceId
            : activeWorkspaceScope?.label || activeWorkspaceScope?.id || 'desktop';

        const created = await createDesktopSession({
          label: 'New Chat',
          surface,
          workspaceId:
            targetWorkspaceId && targetWorkspaceId !== 'chat' ? targetWorkspaceId : activeWorkspaceScope?.id || null,
        });

        setSessionIdOverride(created.sessionId);
        setMessages([]);
        setComposerInput('');
        setActivePanel('chat');

        try {
          await switchDesktopSession(created.sessionId);
        } catch {
          // Runtime may lazy-create on first home load.
        }

        await refreshHome(created.sessionId);
        await refreshPanels();
      } catch (error: unknown) {
        const err = asErrorLike(error);

        setNotice(err instanceof Error ? err.message : 'Could not create a new session.');
        // Local fallback so the user still gets a clean thread.
        const fallbackId = `desktop-local-${Date.now().toString(36)}`;
        setSessionIdOverride(fallbackId);
        setMessages([]);
        setComposerInput('');
        setActivePanel('chat');
      } finally {
        setBusy(false);
      }
    },
    [
      activeWorkspaceScope?.id,
      activeWorkspaceScope?.label,
      applyRuntimeSelection,
      refreshHome,
      refreshPanels,
      workspaceScopes,
    ],
  );

  const handleAddSubagent = useCallback((role: string, typeName: string) => {
    setSubagents((current) => persistSubagents([...current, createSubagent(role, typeName)]));
  }, []);

  const handleDeleteSubagent = useCallback((id: string) => {
    setSubagents((current) => persistSubagents(deleteSubagent(current, id)));
  }, []);

  async function handleTriggerSubagentTask(id: string, task: string) {
    const agent = subagents.find((item) => item.id === id);
    if (!agent || !task.trim()) return;
    const safeTask = task.trim();
    const queued = $busy.get();
    setSubagents((current) =>
      persistSubagents(queued ? queueSubagentTask(current, id, safeTask) : appendSubagentTask(current, id, safeTask)),
    );
    setActivePanel('chat');
    if (queued) {
      const ready = await waitForSubagentIdle(() => $busy.get());
      if (!ready) {
        setSubagents((current) =>
          persistSubagents(
            blockSubagentTask(current, id, 'A tarefa continua na fila porque a execução atual ainda não terminou.'),
          ),
        );
        return;
      }
      setSubagents((current) => persistSubagents(startQueuedSubagentTask(current, id)));
    }
    if ($busy.get()) {
      const ready = await waitForSubagentIdle(() => $busy.get());
      if (!ready) {
        setSubagents((current) =>
          persistSubagents(
            failSubagentTask(current, id, 'O runtime ainda está ocupado. Tente novamente em instantes.'),
          ),
        );
        return;
      }
    }
    const delivery = await sendMessage(
      `[Agente especializado: ${agent.role} / ${agent.typeName}]\n\nExecute esta tarefa e responda com evidências claras:\n${safeTask}`,
    );
    setSubagents((current) =>
      persistSubagents(
        delivery.ok
          ? completeSubagentTask(current, id, safeTask, delivery.assistantText)
          : failSubagentTask(current, id, 'O runtime não recebeu a tarefa. Verifique a conexão e tente novamente.'),
      ),
    );
  }

  const handleAddCustomProfile = useCallback(
    (name: string, prompt: string, effortValue: AgentProfile['effort'], costLimit: number) => {
      const profile = createCustomProfile({
        name,
        systemPrompt: prompt,
        effort: effortValue,
        costLimit,
      });
      setCustomProfiles((current) => persistCustomProfiles(addCustomProfile(current, profile)));
    },
    [],
  );

  const handleDeleteCustomProfile = useCallback(
    (id: string) => {
      setCustomProfiles((current) => persistCustomProfiles(deleteCustomProfile(current, id)));
      if (experienceProfile === id) {
        setExperienceProfile('personal');
        setEffort('medium');
      }
    },
    [experienceProfile],
  );

  const handleActivateProfile = useCallback((profile: AgentProfile) => {
    setExperienceProfile(profile.id);
    setEffort(profile.effort);
    setNotice(`Perfil ${profile.name} ativado para as próximas mensagens.`);
  }, []);

  const handleToggleKael = useCallback(async () => {
    if (!window.zavorthDesktop?.kaelOverlay) return;
    if (kaelActive) {
      await window.zavorthDesktop.kaelOverlay.close();
      setKaelActive(false);
    } else {
      const screenWidth = window.screen.availWidth;
      const screenHeight = window.screen.availHeight;
      await window.zavorthDesktop.kaelOverlay.open({
        x: screenWidth - 260,
        y: screenHeight - 280,
        width: 240,
        height: 240,
      });
      setKaelActive(true);
    }
  }, [kaelActive]);

  useEffect(() => {
    if (!window.zavorthDesktop?.kaelOverlay) return;

    const unsubControl = window.zavorthDesktop.kaelOverlay.onControl((payload) => {
      if (payload?.type === 'submit-prompt' && typeof payload.text === 'string' && payload.text.trim()) {
        void sendMessage(payload.text);
      } else if (payload?.type === 'pop-in') {
        setKaelActive(false);
      }
    });

    return () => {
      unsubControl?.();
    };
  }, [sendMessage]);

  useEffect(() => {
    if (!window.zavorthDesktop?.kaelOverlay || !kaelActive) return;

    let mascotState: 'idle' | 'thinking' | 'working' | 'finished' = 'idle';
    if (busy) {
      mascotState = 'working';
    }

    let bubbleText: string | null = null;
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === 'assistant') {
        const textOnly = lastMsg.content || '';
        bubbleText = textOnly.length > 80 ? textOnly.slice(0, 77) + '...' : textOnly;
      }
    }

    window.zavorthDesktop.kaelOverlay.state({
      state: mascotState,
      bubbleText,
    });
  }, [busy, messages, kaelActive]);

  return {
    status,
    messages,
    approvals,
    learning,
    tools,
    nexusStatus,
    memoryEncryptionStatus,
    memoryEncryptionReceipt,
    runtimeCapabilities,
    channelSetup,
    gatewayResilience,
    events,
    activePanel,
    commandPaletteOpen,
    experienceProfile,
    effort,
    inspectorOpen,
    input,
    busy,
    notice,
    setNotice,
    selectedModel,
    sidebarCollapsed,
    theme,
    accent,
    density,
    workspaceScopes,
    workspaceWriteApprovals,
    showTrustPrompt,
    trustLoading,
    proposedMandate,
    activeMandate,
    pendingHostCommands,
    sessionId,
    connectedModelOptions,
    activeWorkspaceScope,
    memoryItems,
    channelItems,
    kaelActive,
    setAccent: setAccentPreset,
    setDensity,
    setCommandPaletteOpen,
    setInput: setComposerInput,
    setMessages,
    setActivePanel,
    setExperienceProfile,
    setSidebarCollapsed,
    setTheme: setThemeMode,
    setShowTrustPrompt,
    refreshRuntime,
    refreshHome,
    refreshPanels,
    handleTrustWorkspaceFromPrompt,
    resolveApproval,
    resolveLearning,
    handleMemoryEncryptionAction,
    handleMemoryControlAction,
    handleChannelSetupAction,
    handleGatewayResilienceAction,
    sendMessage,
    requestRuntimeStart,
    requestAccessRepair,
    requestRuntimeInstrument,
    handleEffortSelection,
    handleModelSelection,
    handleWorkspaceScopeSelection,
    handleWorkspaceFolderSelection,
    handleWorkspaceWriteApprovalResolve,
    handleProposedMandateResolve,
    handleActiveMandateRevoke,
    handleHostCommandResolve,
    handleSwitchSession,
    handleNewSession,
    dispatchRuntimeStateAction,
    handleToggleKael,
    subagents,
    onAddSubagent: handleAddSubagent,
    onDeleteSubagent: handleDeleteSubagent,
    onTriggerSubagentTask: handleTriggerSubagentTask,
    customProfiles,
    allProfiles,
    onAddCustomProfile: handleAddCustomProfile,
    onDeleteCustomProfile: handleDeleteCustomProfile,
    onActivateProfile: handleActivateProfile,
    scheduledTasks: automations.scheduledTasks,
    onAddScheduledTask: automations.handleAddScheduledTask,
    onDeleteScheduledTask: automations.handleDeleteScheduledTask,
    onToggleScheduledTask: automations.handleToggleScheduledTask,
    onRunScheduledTask: automations.handleRunScheduledTask,
    loadScheduledTaskLogs: automations.loadScheduledTaskLogs,
    boards: product.boards,
    runtimeWorkboard: product.runtimeWorkboard,
    marketplacePlugins: product.marketplacePlugins,
    marketplaceLoading: product.marketplaceLoading,
    marketplaceSource: product.marketplaceSource,
    refreshMarketplace: product.refreshMarketplace,
    pluginOsData: product.pluginOsData,
    pluginOsLabels: product.pluginOsLabels,
    pluginOsError: product.pluginOsError,
    onEnablePluginOs: product.handleEnablePluginOs,
    onDisablePluginOs: product.handleDisablePluginOs,
    onInspectPluginOs: product.handleInspectPluginOs,
    onRecommendPluginOs: product.handleRecommendPluginOs,
    onCatalogApplyPluginOs: product.handleCatalogApplyPluginOs,
    onOnboardingPluginOs: product.handleOnboardingPluginOs,
    onUndoOnboardingPluginOs: product.handleUndoOnboardingPluginOs,
    onSuggestActionPluginOs: product.handleSuggestActionPluginOs,
    pluginOsSuggest: product.pluginOsSuggest,
    pluginOsReceipts: product.pluginOsReceipts,
    pluginOsInjectMode: product.pluginOsInjectMode,
    onRefreshPluginOs: product.refreshPluginOs,
    onBoardSelect: product.handleBoardSelect,
    onCardCreate: product.handleCardCreate,
    onCardUpdate: product.handleCardUpdate,
    onCardDelete: product.handleCardDelete,
    onColumnCreate: product.handleColumnCreate,
    onColumnUpdate: product.handleColumnUpdate,
    onColumnDelete: product.handleColumnDelete,
    onOpenCardInChat: product.handleOpenCardInChat,
    onInstallPlugin: product.handleInstallPlugin,
    onUninstallPlugin: product.handleUninstallPlugin,
    onUpdatePlugin: product.handleUpdatePlugin,
    onAttachFile: product.handleAttachFile,
    receipts,
    clearReceipts,
    recordReceipt,
    updateStatus,
    checkDesktopUpdates,
    downloadDesktopUpdate,
    installDesktopUpdate,
    deferDesktopUpdate,
    rollbackDesktopUpdate,
    openGithubReleases,
    voiceAgentStatus,
    refreshVoiceAgentStatus,
    startVoiceAgent,
    openSetup,
    openLogs,
    workboardSync: product.workboardSync,
    workboardSyncBusy: product.workboardSyncBusy,
    onSyncWorkboard: product.handleSyncBoard,
  };
}
