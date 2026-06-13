import { ApprovalsPanel } from '../views/panels/ApprovalsPanel';
import { AutomationsPanel } from '../views/panels/AutomationsPanel';
import { ChannelsPanel } from '../views/panels/ChannelsPanel';
import { MemoryPanel } from '../views/panels/MemoryPanel';
import { PersonalizationPanel } from '../views/panels/PersonalizationPanel';
import { SettingsPanel } from '../views/panels/SettingsPanel';
import { SkillsPanel } from '../views/panels/SkillsPanel';
import type { WorkspaceViewProps } from '../views/workspaceTypes';

export function HubWorkspaceView(props: WorkspaceViewProps) {
  if (props.activePanel === 'approvals') {
    return <ApprovalsPanel approvals={props.approvals} busy={props.busy} />;
  }

  if (props.activePanel === 'memory') {
    return (
      <MemoryPanel
        encryptionReceipt={props.encryptionReceipt}
        encryptionStatus={props.encryptionStatus}
        items={props.memoryItems}
        learning={props.learning}
      />
    );
  }

  if (props.activePanel === 'skills') {
    return <SkillsPanel tools={props.tools} />;
  }

  if (props.activePanel === 'channels') {
    return <ChannelsPanel channels={props.channels} />;
  }

  return (
    <div className="zvd-hub-settings-grid">
      <SettingsPanel
        events={props.events}
        nexusStatus={props.nexusStatus}
        runtimeCapabilities={props.runtimeCapabilities}
        status={props.status}
      />
      <PersonalizationPanel
        accent={props.accent}
        effort={props.effort}
        profile={props.profile}
        theme={props.theme}
        onAccent={props.onAccent}
        onEffort={props.onEffort}
        onProfile={props.onProfile}
        onTheme={props.onTheme}
      />
      <AutomationsPanel
        busy={props.busy}
        runtimeCapabilities={props.runtimeCapabilities}
        onRuntimeStateAction={() => {}}
      />
    </div>
  );
}
