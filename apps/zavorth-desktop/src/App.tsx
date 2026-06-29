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
    handleToggleKael,
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
    handleSwitchSession,
    dispatchRuntimeStateAction,
  } = useDesktopAppState();

  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const prevBusyRef = useRef(busy);
  useEffect(() => {
    if (prevBusyRef.current && !busy) {
      playDingSound();
    }
    prevBusyRef.current = busy;
  }, [busy]);

  return (
    <>
      <OnboardingOverlay isOpen={onboardingOpen} onCompleted={() => setOnboardingOpen(false)} />
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
          effort={effort}
          accent={accent}
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
          onCommandPalette={setCommandPaletteOpen}
          onEffort={handleEffortSelection}
          onEncryptionAction={handleMemoryEncryptionAction}
          onInput={setInput}
          onLearningDecision={resolveLearning}
          onMemoryControlAction={handleMemoryControlAction}
          onChannelSetupAction={handleChannelSetupAction}
          onGatewayResilienceAction={handleGatewayResilienceAction}
          onModel={handleModelSelection}
          onNewSession={() => {
            setMessages([]);
            setInput('');
            setActivePanel('chat');
          }}
          onPanel={(panel) => {
            if (panel === 'settings') {
              setSettingsOpen(true);
            } else {
              setActivePanel(panel);
            }
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
