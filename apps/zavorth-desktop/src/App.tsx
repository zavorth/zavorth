import { useCallback, useEffect, useMemo, useState } from 'react';
import { dispatchRuntimeStateAction, loadDesktopPanelsData, loadHome, loadRuntimeStatus, repairAccess, resolveApproval as resolveApprovalRequest, resolveLearning as resolveLearningRequest, runMemoryEncryptionMigration, sendExperienceMessage, startRuntime, steerActiveRun, type ApprovalItem, type ChatMessage, type ExperienceSnapshot, type LearningItem, type MemoryEncryptionMigrationReceipt, type MemoryEncryptionStatus, type MemoryItem, type RuntimeCapabilitiesSnapshot, type ToolItem } from './apiClient';
import type { BootEvent, RuntimeStatus } from './global';
import { appendLocalMessage, applyRuntimeCapabilitiesToDesktop, asRecord, defaultConnectedModelIds, desktopEffortFromRuntime, fallbackStatus, modelOptionsFromRuntimeCapabilities, normalizeMessages, responseProfileByExperience, runtimeInstrumentActionInput, runtimeStateFromSnapshot, runtimeStateState } from './appRuntimeState';
import { modelOptions } from './modelCatalog';
import { DesktopShell } from './shell/DesktopShell';
import { parseSlashCommand, slashCommands, type DesktopPanel } from './slashCommands';
import { defaultWorkspaceScopes, workspaceScopeForMetadata, type DesktopWorkspaceScope } from './workspaceScopes';

export function App() {
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
      setMemoryEncryptionStatus(data.memoryEncryptionStatus);
      setRuntimeCapabilities(data.runtimeCapabilities);
      applyRuntimeCapabilitiesToDesktop({
        capabilities: data.runtimeCapabilities,
        setSelectedModel,
        setEffort,
        setWorkspaceScopes,
        setWorkspaceScopeId,
      });
    } catch {
      setApprovals([]);
      setLearning([]);
      setTools([]);
      setNexusStatus(null);
      setMemoryEncryptionStatus(null);
      setRuntimeCapabilities(null);
    }
  }, []);

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
      .then(() => mounted ? refreshHome() : null)
      .then(() => mounted ? refreshPanels() : null)
      .catch(() => undefined);
    const off = window.zavorthDesktop!.onBootEvent(event => {
      setEvents(current => [event, ...current].slice(0, 8));
    });

    return () => {
      mounted = false;
      off();
    };
  }, [bridgeReady, refreshHome, refreshPanels, refreshRuntime]);

  const memoryItems = useMemo(() => {
    const memory = snapshot?.memory || {};
    return [
      ...((Array.isArray(memory.items) ? memory.items : []) as MemoryItem[]),
      ...((Array.isArray(memory.receipts) ? memory.receipts : []) as MemoryItem[]),
    ];
  }, [snapshot]);

  const channelItems = useMemo(() => {
    const channels = snapshot?.channels || {};
    return [
      ...((Array.isArray(channels.routes) ? channels.routes : []) as any[]),
      ...((Array.isArray(channels.readiness) ? channels.readiness : []) as any[]),
    ];
  }, [snapshot]);

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

  return (
    <DesktopShell
      activePanel={activePanel}
      approvals={approvals}
      busy={busy}
      channels={channelItems}
      commandPaletteOpen={commandPaletteOpen}
      effort={effort}
      accent={accent}
      encryptionReceipt={memoryEncryptionReceipt}
      encryptionStatus={memoryEncryptionStatus}
      events={events}
      input={input}
      inspectorOpen={inspectorOpen}
      learning={learning}
      memoryItems={memoryItems}
      modelOptions={connectedModelOptions}
      messages={messages}
      nexusStatus={nexusStatus}
      notice={notice}
      profile={experienceProfile}
      runtimeMessage={status.message}
      runtimeCapabilities={runtimeCapabilities}
      selectedModel={selectedModel}
      showNotice={Boolean(notice)}
      showRuntimeSetup={!status.running}
      sidebarCollapsed={sidebarCollapsed}
      status={status}
      theme={theme}
      tools={tools}
      workspaceScope={activeWorkspaceScope}
      workspaceScopes={workspaceScopes}
      onAccessRepair={requestAccessRepair}
      onAccent={setAccent}
      onCommandPalette={setCommandPaletteOpen}
      onEffort={handleEffortSelection}
      onEncryptionAction={handleMemoryEncryptionAction}
      onInput={setInput}
      onLearningDecision={resolveLearning}
      onModel={handleModelSelection}
      onNewSession={() => {
        setMessages([]);
        setInput('');
        setActivePanel('chat');
      }}
      onPanel={setActivePanel}
      onProfile={setExperienceProfile}
      onRefresh={async () => {
        await refreshRuntime();
        await refreshHome();
        await refreshPanels();
      }}
      onReviewDecision={resolveApproval}
      onRuntimeStart={requestRuntimeStart}
      onRuntimeStateAction={requestRuntimeInstrument}
      onSidebarCollapsed={setSidebarCollapsed}
      onSubmit={sendMessage}
      onTheme={setTheme}
      onWorkspaceFolder={handleWorkspaceFolderSelection}
      onWorkspaceScope={handleWorkspaceScopeSelection}
    />
  );
}
