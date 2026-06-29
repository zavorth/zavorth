import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { parseSlashCommand, slashCommands } from './slashCommands';
import { workspaceScopeForMetadata, type DesktopWorkspaceScope } from './workspaceScopes';

import {
  $status, setStatus,
  $snapshot, setSnapshot,
  $messages, setMessages,
  $busy, setBusy,
  $notice, setNotice,
  $selectedModel, setSelectedModel,
  $effort, setEffort,
  $experienceProfile, setExperienceProfile,
  $sessionId,
  $events, addEvent,
  
  $activePanel, setActivePanel,
  $commandPaletteOpen, setCommandPaletteOpen,
  $sidebarCollapsed, setSidebarCollapsed,
  $inspectorOpen, setInspectorOpen,
  
  $approvals, setApprovals,
  $workspaceWriteApprovals, setWorkspaceWriteApprovals,
  $proposedMandate, setProposedMandate,
  $activeMandate, setActiveMandate,
  $pendingHostCommands, setPendingHostCommands,
  $showTrustPrompt, setShowTrustPrompt,
  $trustLoading, setTrustLoading,
  
  $learning, setLearning,
  $tools, setTools,
  $controlMemory, setControlMemory,
  $memoryEncryptionStatus, setMemoryEncryptionStatus,
  $memoryEncryptionReceipt, setMemoryEncryptionReceipt,
  
  $themeMode, setThemeMode,
  $accentPreset, setAccentPreset,
  
  $composerInput, setComposerInput,
  
  $workspaceScopes, setWorkspaceScopes,
  $workspaceScopeId, setWorkspaceScopeId,
  $nexusStatus, setNexusStatus,
  $channelSetup, setChannelSetup,
  $gatewayResilience, setGatewayResilience,
  $runtimeCapabilities, setRuntimeCapabilities,
} from './store';

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

  const bridgeReady = Boolean(window.zavorthDesktop);
  const sessionId = useStore($sessionId);
  const responseProfile = responseProfileByExperience[experienceProfile] || 'short';

  const connectedModelOptions = useMemo(() => {
    if (runtimeCapabilities) {
      return modelOptionsFromRuntimeCapabilities(runtimeCapabilities);
    }
    const connectedIds = new Set(defaultConnectedModelIds());
    return modelOptions.filter(model => model.connected !== false);
  }, [runtimeCapabilities]);

  const activeWorkspaceScope = workspaceScopes.find(scope => scope.id === workspaceScopeId) || workspaceScopes[0];

  const applyRuntimeStateProjection = useCallback((home: ExperienceSnapshot | null) => {
    const runtimeState = runtimeStateFromSnapshot(home);
    const projections = asRecord(runtimeState.projections);
    const commandBar = asRecord(projections.commandBar);
    const projectedConnectedModelIds = Array.isArray(commandBar.connectedModelIds)
      ? commandBar.connectedModelIds.map(value => String(value || '').trim()).filter(Boolean)
      : [];
    const state = runtimeStateState(home);
    const model = asRecord(state.model);
    const effortState = asRecord(state.effort);
    const workspace = asRecord(state.workspace);
    const runtimeModelId = String(model.id || '').trim();
    const modelConnected = projectedConnectedModelIds.length > 0
      ? projectedConnectedModelIds.includes(runtimeModelId)
      : connectedModelOptions.some(option => option.id === runtimeModelId);
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
      setWorkspaceScopes(workspaceScopes.some(scope => scope.id === nextScope.id) ? workspaceScopes : [...workspaceScopes, nextScope]);
      setWorkspaceScopeId(workspaceId);
    }
  }, [connectedModelOptions, workspaceScopes]);

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

  const refreshHome = useCallback(async () => {
    try {
      const home = await loadHome(sessionId, responseProfile);
      setSnapshot(home);
      applyRuntimeStateProjection(home);
      const homeMessages = normalizeMessages(home.chat?.messages);
      setMessages(homeMessages);
      setNotice('');
      return home;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not reach the local runtime.');
      return null;
    }
  }, [responseProfile, sessionId, applyRuntimeStateProjection]);

  useEffect(() => {
    if (!bridgeReady) {
      return;
    }

    let mounted = true;
    void refreshRuntime()
      .then(() => (mounted ? refreshHome() : null))
      .then(() => (mounted ? refreshPanels() : null))
      .catch(() => undefined);
    const off = window.zavorthDesktop!.onBootEvent(event => {
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
        .catch(() => {});

      if (activeWorkspaceScope.id && activeWorkspaceScope.kind === 'folder') {
        loadProposedMandate(activeWorkspaceScope.id)
          .then(setProposedMandate)
          .catch(() => {});
        loadActiveMandate(activeWorkspaceScope.id)
          .then(setActiveMandate)
          .catch(() => {});
        getPendingHostCommands(activeWorkspaceScope.id)
          .then(setPendingHostCommands)
          .catch(() => {});
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
              setPromptedWorkspaces(prev => {
                const next = new Set(prev);
                next.add(activeWorkspaceScope.id!);
                return next;
              });
            } else {
              setShowTrustPrompt(false);
            }
          }
        })
        .catch(() => {});
    } else {
      setShowTrustPrompt(false);
    }
  }, [activeWorkspaceScope.id, activeWorkspaceScope.kind, activeWorkspaceScope.path, promptedWorkspaces]);

  const handleTrustWorkspaceFromPrompt = async (
    allowRiskUpTo: 'LOW' | 'MEDIUM',
    allowPackageInstall: boolean,
    allowNetwork: boolean
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
    } catch (err) {
      console.error(err);
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
    const channels = snapshot?.channels || {};
    const setupOptions = Array.isArray(channelSetup?.assistant?.options)
      ? channelSetup.assistant.options.map((option: any) => ({
          id: option.channelId,
          name: option.label,
          channel: option.channelId,
          configured: option.configured,
          liveReady: option.readiness === 'ready',
          status: option.readiness || channelSetup.assistant?.status,
          summary: option.summary,
        }))
      : [];
    return [
      ...((Array.isArray(channels.routes) ? channels.routes : []) as any[]),
      ...((Array.isArray(channels.readiness) ? channels.readiness : []) as any[]),
      ...setupOptions,
    ];
  }, [channelSetup, snapshot]);

  async function resolveApproval(approvalId: string, decision: 'approve' | 'reject') {
    setBusy(true);
    try {
      await resolveApprovalRequest(approvalId, decision);
      await refreshPanels();
      appendLocalMessage(setMessages, 'system', `Approval ${decision === 'approve' ? 'approved' : 'rejected'}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not resolve approval.');
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
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not resolve learning candidate.');
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
        appendLocalMessage(setMessages, 'system', `Memory protection ${result.receipt.status}: ${result.receipt.reason}`);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not update memory protection.');
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
      appendLocalMessage(setMessages, 'system', `Memory ${input.action}: ${result?.receipt?.receiptId || 'receipt created'}.`);
      await refreshPanels();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not update memory.');
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
      appendLocalMessage(setMessages, 'system', `Channel ${input.action}: ${result?.receipt?.receiptId || result?.action || 'done'}.`);
      await refreshPanels();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not run channel setup.');
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
      appendLocalMessage(setMessages, 'system', `Gateway resilience: ${result?.receipt?.receiptId || result?.status || 'updated'}.`);
      await refreshPanels();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not update gateway resilience.');
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage(rawText = input) {
    const text = rawText.trim();
    if (!text || busy) {
      return;
    }

    const parsed = parseSlashCommand(text);
    setComposerInput('');
    setNotice('');

    if (parsed.kind === 'help') {
      appendLocalMessage(setMessages, 'system', slashCommands.map(command => `${command.usage} - ${command.description}`).join('\n'));
      return;
    }
    if (parsed.kind === 'panel') {
      setActivePanel(parsed.panel);
      return;
    }
    if (parsed.kind === 'set-effort') {
      setEffort(parsed.effort);
      appendLocalMessage(setMessages, 'system', `Effort set to ${parsed.effort}.`);
      return;
    }
    if (parsed.kind === 'set-profile') {
      setExperienceProfile(parsed.profile);
      appendLocalMessage(setMessages, 'system', `Profile set to ${parsed.profile}.`);
      return;
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
          connectedModelIds: connectedModelOptions.map(model => model.id),
          profile: experienceProfile,
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
      return;
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
        connectedModelIds: connectedModelOptions.map(model => model.id),
        profile: experienceProfile,
        workspace: workspaceScopeForMetadata(activeWorkspaceScope),
      });
      if (result.snapshot) {
        setSnapshot(result.snapshot);
        applyRuntimeStateProjection(result.snapshot);
      }
      const nextMessages = normalizeMessages(result.snapshot?.chat?.messages);
      const replies = normalizeMessages(result.replies || result.messages);
      if (nextMessages.length > 0) {
        setMessages(nextMessages);
      } else if (replies.length > 0) {
        setMessages(current => [...current, ...replies]);
      } else {
        appendLocalMessage(setMessages, 'assistant', result.error || 'Zavorth received the request.');
      }
      await refreshPanels();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not send message.');
      appendLocalMessage(setMessages, 'system', 'The message could not be delivered to the local runtime.');
    } finally {
      setBusy(false);
    }
  }

  async function requestRuntimeStart() {
    setBusy(true);
    try {
      const next = await startRuntime();
      setStatus(next);
      setNotice(next.message);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not start runtime.');
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
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not repair access.');
    } finally {
      setBusy(false);
    }
  }

  const requestRuntimeInstrument = useCallback(async (input: {
    domain: string;
    operation: string;
    metadata?: Record<string, unknown>;
  }) => {
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
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not update runtime control.');
    }
  }, [refreshHome, refreshPanels, sessionId]);

  const applyRuntimeSelection = useCallback(async (input: {
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
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not persist runtime selection.');
    }
  }, [refreshHome, refreshPanels, sessionId]);

  const handleEffortSelection = useCallback(async (value: string) => {
    setEffort(value);
    await applyRuntimeSelection({
      type: 'set-effort',
      payload: { effort: value },
    });
  }, [applyRuntimeSelection]);

  const handleModelSelection = useCallback(async (value: string) => {
    setSelectedModel(value);
    const model = connectedModelOptions.find(option => option.id === value);
    await applyRuntimeSelection({
      type: 'route-model',
      connectedModelIds: connectedModelOptions.map(option => option.id),
      payload: {
        dynamicRouting: {
          modelId: value,
          providerId: model?.family || value.split(':')[0] || 'runtime',
          intent: 'desktop-model-picker',
          reason: `Desktop selected ${model?.label || value}.`,
          fallbackModelIds: connectedModelOptions.map(option => option.id).filter(id => id !== value).slice(0, 4),
          risk: 'low',
        },
      },
    });
  }, [applyRuntimeSelection, connectedModelOptions]);

  const handleWorkspaceScopeSelection = useCallback(async (value: string) => {
    const scope = workspaceScopes.find(candidate => candidate.id === value);
    if (!scope) {
      return;
    }
    await applyRuntimeSelection({
      type: 'set-workspace',
      payload: {
        workspace: workspaceScopeForMetadata(scope),
      },
    });
  }, [applyRuntimeSelection, workspaceScopes]);

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
      appendLocalMessage(setMessages, 'system', `Workspace approval ${decision === 'approve' ? 'allowed' : 'blocked'}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not resolve workspace write approval.');
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
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not resolve task mandate.');
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
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not revoke task mandate.');
    } finally {
      setBusy(false);
    }
  }

  const handleHostCommandResolve = useCallback(async (operationId: string, decision: 'approve' | 'deny', strongPhrase?: string) => {
    setBusy(true);
    try {
      await resolveHostCommand(operationId, decision, strongPhrase);
      setPendingHostCommands(pendingHostCommands.filter(cmd => cmd.operation_id !== operationId));
      appendLocalMessage(setMessages, 'system', `Host command proposal ${decision}d.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not resolve host command proposal.');
    } finally {
      setBusy(false);
    }
  }, [pendingHostCommands]);

  const handleSwitchSession = useCallback(async (nextSessionId: string) => {
    setBusy(true);
    try {
      if (window.zavorthDesktop?.switchSession) {
        const res = await window.zavorthDesktop.switchSession(nextSessionId);
        if (res.ok) {
          await refreshHome();
          await refreshPanels();
          setActivePanel('chat');
        } else {
          setNotice(res.error || 'Failed to switch session.');
        }
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Error switching session.');
    } finally {
      setBusy(false);
    }
  }, [refreshHome, refreshPanels]);

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
        height: 240
      });
      setKaelActive(true);
    }
  }, [kaelActive]);

  useEffect(() => {
    if (!window.zavorthDesktop?.kaelOverlay) return;

    const unsubControl = window.zavorthDesktop.kaelOverlay.onControl((payload: any) => {
      if (payload?.type === 'submit-prompt' && payload?.text) {
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
    selectedModel,
    sidebarCollapsed,
    theme,
    accent,
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
    setAccent,
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
    dispatchRuntimeStateAction,
    handleToggleKael,
  };
}
