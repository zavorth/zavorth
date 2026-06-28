import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { parseSlashCommand, slashCommands, type DesktopPanel } from './slashCommands';
import { defaultWorkspaceScopes, workspaceScopeForMetadata, type DesktopWorkspaceScope } from './workspaceScopes';

export function useDesktopAppState() {
  const [status, setStatus] = useState<RuntimeStatus>(fallbackStatus);
  const [snapshot, setSnapshot] = useState<ExperienceSnapshot | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [learning, setLearning] = useState<LearningItem[]>([]);
  const [tools, setTools] = useState<ToolItem[]>([]);
  const [nexusStatus, setNexusStatus] = useState<unknown>(null);
  const [memoryEncryptionStatus, setMemoryEncryptionStatus] = useState<MemoryEncryptionStatus | null>(null);
  const [memoryEncryptionReceipt, setMemoryEncryptionReceipt] = useState<MemoryEncryptionMigrationReceipt | null>(null);
  const [runtimeCapabilities, setRuntimeCapabilities] = useState<RuntimeCapabilitiesSnapshot | null>(null);
  const [controlMemory, setControlMemory] = useState<ControlMemorySnapshot | null>(null);
  const [channelSetup, setChannelSetup] = useState<ChannelSetupSnapshot | null>(null);
  const [gatewayResilience, setGatewayResilience] = useState<GatewayResilienceSnapshot | null>(null);
  const [events, setEvents] = useState<BootEvent[]>([]);
  const [activePanel, setActivePanel] = useState<DesktopPanel>('chat');
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [experienceProfile, setExperienceProfile] = useState('personal');
  const [effort, setEffort] = useState('medium');
  const [inspectorOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [selectedModel, setSelectedModel] = useState('zavorth:core');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [accent, setAccent] = useState<'orange' | 'purple' | 'navy'>('orange');
  const [workspaceScopes, setWorkspaceScopes] = useState<DesktopWorkspaceScope[]>(defaultWorkspaceScopes);
  const [workspaceScopeId, setWorkspaceScopeId] = useState('local');
  const [runtimeConnectedModelIds, setRuntimeConnectedModelIds] = useState<string[]>(() => defaultConnectedModelIds());
  const [workspaceWriteApprovals, setWorkspaceWriteApprovals] = useState<any[]>([]);
  const [promptedWorkspaces, setPromptedWorkspaces] = useState<Set<string>>(() => new Set());
  const [showTrustPrompt, setShowTrustPrompt] = useState(false);
  const [trustLoading, setTrustLoading] = useState(false);
  const [proposedMandate, setProposedMandate] = useState<any>(null);
  const [activeMandate, setActiveMandate] = useState<any>(null);
  const [pendingHostCommands, setPendingHostCommands] = useState<any[]>([]);

  const bridgeReady = Boolean(window.zavorthDesktop);
  const sessionId = snapshot?.sessionId || 'desktop-main';
  const responseProfile = responseProfileByExperience[experienceProfile] || 'short';
  const connectedModelOptions = useMemo(() => {
    if (runtimeCapabilities) {
      return modelOptionsFromRuntimeCapabilities(runtimeCapabilities);
    }
    const connectedIds = new Set(runtimeConnectedModelIds.length > 0 ? runtimeConnectedModelIds : defaultConnectedModelIds());
    const options = modelOptions.filter(model => connectedIds.has(model.id));
    return options.length > 0 ? options : modelOptions.filter(model => model.connected !== false);
  }, [runtimeCapabilities, runtimeConnectedModelIds]);
  const activeWorkspaceScope = workspaceScopes.find(scope => scope.id === workspaceScopeId) || workspaceScopes[0];

  const applyRuntimeStateProjection = useCallback((home: ExperienceSnapshot | null) => {
    const runtimeState = runtimeStateFromSnapshot(home);
    const projections = asRecord(runtimeState.projections);
    const commandBar = asRecord(projections.commandBar);
    const projectedConnectedModelIds = Array.isArray(commandBar.connectedModelIds)
      ? commandBar.connectedModelIds.map(value => String(value || '').trim()).filter(Boolean)
      : [];
    if (projectedConnectedModelIds.length > 0) {
      setRuntimeConnectedModelIds(projectedConnectedModelIds);
    }
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
      setWorkspaceScopes(current => current.some(scope => scope.id === nextScope.id) ? current : [...current, nextScope]);
      setWorkspaceScopeId(workspaceId);
    }
  }, [connectedModelOptions]);

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
  }, [sessionId, applyRuntimeCapabilitiesToDesktop, activeWorkspaceScope]);

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
  }, [applyRuntimeStateProjection, responseProfile, sessionId]);

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
      setEvents(current => [event, ...current].slice(0, 8));
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
    setInput('');
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
    await applyRuntimeSelection({
      type: 'set-effort',
      payload: { effort: value },
    });
  }, [applyRuntimeSelection]);

  const handleModelSelection = useCallback(async (value: string) => {
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
      setPendingHostCommands(current => current.filter(cmd => cmd.operation_id !== operationId));
      appendLocalMessage(setMessages, 'system', `Host command proposal ${decision}d.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not resolve host command proposal.');
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    status: status || fallbackStatus,
    snapshot: snapshot || null,
    messages: messages || [],
    approvals: approvals || [],
    learning: learning || [],
    tools: tools || [],
    nexusStatus: nexusStatus || null,
    memoryEncryptionStatus: memoryEncryptionStatus || null,
    memoryEncryptionReceipt: memoryEncryptionReceipt || null,
    runtimeCapabilities: runtimeCapabilities || null,
    controlMemory: controlMemory || null,
    channelSetup: channelSetup || null,
    gatewayResilience: gatewayResilience || null,
    events: events || [],
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
    setAccent,
    setCommandPaletteOpen,
    setInput,
    setMessages,
    setActivePanel,
    setExperienceProfile,
    setSidebarCollapsed,
    setTheme,
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
    dispatchRuntimeStateAction,
  };
}
