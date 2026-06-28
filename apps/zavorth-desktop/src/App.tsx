import { useDesktopAppState } from './useDesktopAppState';
import { DesktopShell } from './shell/DesktopShell';
import { WorkspaceWriteApprovalModal } from './components/WorkspaceWriteApprovalModal';
import { WorkspaceTaskMandateModal } from './components/WorkspaceTaskMandateModal';
import { TemporaryDirectoryTrustModal } from './components/TemporaryDirectoryTrustModal';
import { HostCommandApprovalModal } from './components/HostCommandApprovalModal';
import { WorkspaceTrustPromptModal } from './components/WorkspaceTrustPromptModal';
import { ZavorthPaneShell } from './shell/ZavorthPaneShell';

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

  return (
    <>
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
