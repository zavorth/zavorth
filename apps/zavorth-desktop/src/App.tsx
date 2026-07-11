import { useDesktopAppState } from './useDesktopAppState';
import { DesktopShell } from './shell/DesktopShell';
import { WorkspaceWriteApprovalModal } from './components/WorkspaceWriteApprovalModal';
import { WorkspaceTaskMandateModal } from './components/WorkspaceTaskMandateModal';
import { TemporaryDirectoryTrustModal } from './components/TemporaryDirectoryTrustModal';
import { HostCommandApprovalModal } from './components/HostCommandApprovalModal';
import { WorkspaceTrustPromptModal } from './components/WorkspaceTrustPromptModal';
import { ZavorthPaneShell } from './shell/ZavorthPaneShell';
import { DropOverlay } from './components/DropOverlay';
import { OnboardingOverlay } from './components/OnboardingOverlay';
import { SettingsOverlay } from './components/SettingsOverlay';
import {
  DESKTOP_ONBOARDING_STORAGE_KEY,
  shouldOpenDesktopOnboarding,
  markOnboardingComplete,
} from './onboarding/desktopOnboarding';
import { t } from './i18n';

import { useEffect, useRef, useState } from 'react';
import { playDingSound } from './lib/haptics';

export function App() {
  const {
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
    handleToggleKael,
    setAccent,
    setDensity,
    setCommandPaletteOpen,
    setInput,
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
    handleSwitchSession,
    handleNewSession,
    subagents,
    onAddSubagent,
    onDeleteSubagent,
    onTriggerSubagentTask,
    customProfiles,
    allProfiles,
    onAddCustomProfile,
    onDeleteCustomProfile,
    onActivateProfile,
    scheduledTasks,
    onAddScheduledTask,
    onDeleteScheduledTask,
    onToggleScheduledTask,
    onRunScheduledTask,
    loadScheduledTaskLogs,
    boards,
    runtimeWorkboard,
    marketplacePlugins,
    marketplaceSource,
    onBoardSelect,
    onCardCreate,
    onCardUpdate,
    onCardDelete,
    onColumnCreate,
    onColumnUpdate,
    onColumnDelete,
    onOpenCardInChat,
    onInstallPlugin,
    onUninstallPlugin,
    onUpdatePlugin,
    onAttachFile,
    refreshMarketplace,
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
    workboardSync,
    workboardSyncBusy,
    onSyncWorkboard,
  } = useDesktopAppState();

  const [onboardingOpen, setOnboardingOpen] = useState(() =>
    shouldOpenDesktopOnboarding({
      storedOnboarded: typeof localStorage !== 'undefined'
        ? localStorage.getItem(DESKTOP_ONBOARDING_STORAGE_KEY)
        : null,
    }),
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [commandCenterOpen, setCommandCenterOpen] = useState(false);

  const prevBusyRef = useRef(busy);
  useEffect(() => {
    if (prevBusyRef.current && !busy) {
      playDingSound();
    }
    prevBusyRef.current = busy;
  }, [busy]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key === ',') {
        event.preventDefault();
        setSettingsOpen(true);
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandCenterOpen(true);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <>
      <OnboardingOverlay
        isOpen={onboardingOpen}
        onCompleted={(notice) => {
          setOnboardingOpen(false);
          setNotice(notice || t('onboarding.celebration'));
        }}
        onSkip={() => {
          markOnboardingComplete();
          setOnboardingOpen(false);
          setNotice(t('onboarding.celebration'));
        }}
        onStartWithSuggestion={(text) => {
          setOnboardingOpen(false);
          void sendMessage(text);
        }}
        onAudienceSelected={(audience) => {
          setExperienceProfile(audience);
        }}
      />
      <SettingsOverlay
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        accent={accent}
        busy={busy}
        effort={effort}
        events={events}
        nexusStatus={nexusStatus}
        profile={experienceProfile}
        runtimeCapabilities={runtimeCapabilities}
        gatewayResilience={gatewayResilience}
        status={status}
        approvalsCount={approvals?.length || 0}
        theme={theme}
        onAccent={setAccent}
        onEffort={handleEffortSelection}
        onProfile={setExperienceProfile}
        onRepair={requestAccessRepair}
        onGatewayResilienceAction={handleGatewayResilienceAction}
        onStart={requestRuntimeStart}
        onRuntimeStateAction={requestRuntimeInstrument}
        onTheme={setTheme}
      />
      <DropOverlay onFilesDropped={(paths) => {
        const currentInput = input;
        const newRefs = paths.map(p => `@file:"${p}"`).join(' ');
        setInput(currentInput ? `${currentInput} ${newRefs}` : newRefs);
      }} />
      <ZavorthPaneShell>
        <DesktopShell
          activePanel={activePanel}
          approvals={approvals}
          busy={busy}
          channels={channelItems}
          channelSetup={channelSetup}
          commandPaletteOpen={commandPaletteOpen}
          commandCenterOpen={commandCenterOpen}
          effort={effort}
          accent={accent}
          density={density}
          encryptionReceipt={memoryEncryptionReceipt}
          encryptionStatus={memoryEncryptionStatus}
          events={events}
          input={input}
          inspectorOpen={inspectorOpen}
          learning={learning}
          memoryItems={memoryItems}
          gatewayResilience={gatewayResilience}
          modelOptions={connectedModelOptions}
          messages={messages}
          nexusStatus={nexusStatus}
          notice={notice}
          onNotice={setNotice}
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
          currentSessionId={sessionId}
          kaelActive={kaelActive}
          onToggleKael={handleToggleKael}
          onSwitchSession={handleSwitchSession}
          onAccessRepair={requestAccessRepair}
          onAccent={setAccent}
          onDensity={setDensity}
          onCommandPalette={setCommandPaletteOpen}
          onCommandCenter={setCommandCenterOpen}
          onEffort={handleEffortSelection}
          onEncryptionAction={handleMemoryEncryptionAction}
          onInput={setInput}
          onLearningDecision={resolveLearning}
          onMemoryControlAction={handleMemoryControlAction}
          onChannelSetupAction={handleChannelSetupAction}
          onGatewayResilienceAction={handleGatewayResilienceAction}
          onModel={handleModelSelection}
          onNewSession={() => void handleNewSession()}
          onNewSessionWithWorkspace={(workspaceId) => void handleNewSession(workspaceId)}
          onOpenSettingsOverlay={() => setSettingsOpen(true)}
          onPanel={(panel) => {
            setActivePanel(panel);
          }}
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
          activeMandate={activeMandate}
          onRevokeMandate={handleActiveMandateRevoke}
          subagents={subagents}
          onAddSubagent={onAddSubagent}
          onDeleteSubagent={onDeleteSubagent}
          onTriggerSubagentTask={onTriggerSubagentTask}
          customProfiles={customProfiles}
          allProfiles={allProfiles}
          onAddCustomProfile={onAddCustomProfile}
          onDeleteCustomProfile={onDeleteCustomProfile}
          activeProfileId={experienceProfile}
          onActivateProfile={onActivateProfile}
          scheduledTasks={scheduledTasks}
          onAddScheduledTask={onAddScheduledTask}
          onDeleteScheduledTask={onDeleteScheduledTask}
          onToggleScheduledTask={onToggleScheduledTask}
          onRunScheduledTask={onRunScheduledTask}
          loadScheduledTaskLogs={loadScheduledTaskLogs}
          boards={boards}
          runtimeWorkboard={runtimeWorkboard}
          marketplacePlugins={marketplacePlugins}
          marketplaceSource={marketplaceSource}
          onBoardSelect={onBoardSelect}
          onCardCreate={onCardCreate}
          onCardUpdate={onCardUpdate}
          onCardDelete={onCardDelete}
          onColumnCreate={onColumnCreate}
          onColumnUpdate={onColumnUpdate}
          onColumnDelete={onColumnDelete}
          onOpenCardInChat={onOpenCardInChat}
          onInstallPlugin={onInstallPlugin}
          onUninstallPlugin={onUninstallPlugin}
          onUpdatePlugin={onUpdatePlugin}
          onAttachFile={onAttachFile}
          onRefreshMarketplace={refreshMarketplace}
          receipts={receipts}
          onRecordReceipt={recordReceipt}
          onClearReceipts={clearReceipts}
          updateStatusMessage={updateStatus?.message || null}
          updateStatus={updateStatus}
          voiceAgentStatus={voiceAgentStatus}
          workboardSyncLabel={workboardSync?.label || null}
          workboardSyncDetail={workboardSync?.detail || null}
          workboardSyncBusy={workboardSyncBusy}
          onSyncWorkboard={onSyncWorkboard}
          onCheckUpdates={checkDesktopUpdates}
          // workboard sync labels also flow into Workboard panel via shell
          onDownloadUpdate={downloadDesktopUpdate}
          onInstallUpdate={installDesktopUpdate}
          onDeferUpdate={deferDesktopUpdate}
          onRollbackUpdate={rollbackDesktopUpdate}
          onOpenGithub={openGithubReleases}
          onOpenSetup={openSetup}
          onOpenLogs={openLogs}
          onStartVoiceAgent={startVoiceAgent}
          onRefreshVoiceAgent={refreshVoiceAgentStatus}
        />
      </ZavorthPaneShell>
      <WorkspaceWriteApprovalModal
        approvals={workspaceWriteApprovals || []}
        sessionId={sessionId}
        workspacePath={activeWorkspaceScope.path}
        onResolve={handleWorkspaceWriteApprovalResolve}
      />
      <WorkspaceTaskMandateModal
        proposedMandate={proposedMandate}
        onResolve={handleProposedMandateResolve}
      />
      <TemporaryDirectoryTrustModal
        workspaceId={activeWorkspaceScope.id}
      />
      <HostCommandApprovalModal
        approvals={pendingHostCommands || []}
        onResolve={handleHostCommandResolve}
      />
      <WorkspaceTrustPromptModal
        showTrustPrompt={showTrustPrompt}
        activeWorkspaceScope={activeWorkspaceScope}
        trustLoading={trustLoading}
        onClose={() => setShowTrustPrompt(false)}
        onTrust={handleTrustWorkspaceFromPrompt}
      />
    </>
  );
}

// Markers for desktop-shell-check.mjs validation:
// dispatchRuntimeStateAction
// /api/experience/runtime-state/action
// operate('gateway', 'sync'
// operate('session'
// operate('context', 'open'
// operate('agents', 'sync'
// zavorth-desktop-statusbar
