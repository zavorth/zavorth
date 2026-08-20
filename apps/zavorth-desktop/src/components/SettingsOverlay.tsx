import { useEffect, useState } from 'react';
import { IconSettings, IconServer, IconShield, IconCpu, IconActivity, IconFolder, IconX, IconClock, IconUsers, IconFileText, IconPlayerPlay, IconTrash, IconMicrophone } from '@tabler/icons-react';
import type {
  ApprovalItem,
  ChannelItem,
  ChannelSetupSnapshot,
  GatewayResilienceSnapshot,
  LearningItem,
  MemoryItem,
  RuntimeCapabilitiesSnapshot,
  ToolItem,
} from '../apiClient';
import type { BootEvent, RuntimeStatus } from '../global';
import { ProviderSettingsPanel } from '../panels/ProviderSettingsPanel';
import { InternalBetaDiagnosticsPanel } from '../panels/InternalBetaDiagnosticsPanel';
import { VoiceSettingsPanel } from '../panels/VoiceSettingsPanel';
import { asRecord, effortLabels, panelLabels, profileLabels } from '../primitives/desktopPrimitives';
import { errorMessage } from '../lib/errors';
import { parseAccent, parseThemeMode } from '../lib/typeGuards';
import { playTapSound } from '../lib/haptics';
import { getOnboardingAudience } from '../onboarding/desktopOnboarding';

interface SettingsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  accent: 'green' | 'orange' | 'purple' | 'navy';
  busy: boolean;
  effort: string;
  events: BootEvent[];
  nexusStatus: unknown;
  profile: string;
  runtimeCapabilities: RuntimeCapabilitiesSnapshot | null;
  gatewayResilience: GatewayResilienceSnapshot | null;
  status: RuntimeStatus;
  approvalsCount: number;
  theme: 'light' | 'dark' | 'system';
  onAccent(value: 'green' | 'orange' | 'purple' | 'navy'): void;
  onEffort(value: string): void;
  onProfile(value: string): void;
  onRepair(): void | Promise<void>;
  onGatewayResilienceAction(input: Record<string, unknown>): void | Promise<void>;
  onStart(): void | Promise<void>;
  onRuntimeStateAction(input: { domain: string; operation: string; metadata?: Record<string, unknown> }): void | Promise<void>;
  onTheme(value: 'light' | 'dark' | 'system'): void;
}

type TabType = 'general' | 'providers' | 'permissions' | 'mcp' | 'workspace' | 'voice' | 'diagnostics' | 'shortcuts' | 'cron' | 'subagents' | 'artifacts';

export function SettingsOverlay({
  isOpen,
  onClose,
  ...props
}: SettingsOverlayProps) {
  const isPersonalAudience = getOnboardingAudience() === 'personal';

  const handleExport = async () => {
    try {
      const res = await fetch('/api/v2/providers');
      const data = await res.json();
      const providers = data.data || [];

      const backup = {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        settings: {
          theme: localStorage.getItem('zvd:theme') || 'system',
          accent: localStorage.getItem('zvd:accent') || 'green',
          profile: props.profile,
          effort: props.effort,
        },
        providers: providers,
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `zavorth-config-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      alert('Failed to export settings: ' + errorMessage(err));
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const backup = JSON.parse(event.target?.result as string);
        if (!backup.version || !backup.settings) {
          throw new Error('Invalid backup format.');
        }

        if (backup.settings.theme) props.onTheme(backup.settings.theme);
        if (backup.settings.accent) props.onAccent(backup.settings.accent);
        if (backup.settings.profile) props.onProfile(backup.settings.profile);
        if (backup.settings.effort) props.onEffort(backup.settings.effort);

        if (Array.isArray(backup.providers)) {
          for (const prov of backup.providers) {
            await fetch('/api/v2/providers', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: prov.type,
                displayName: prov.displayName,
                baseUrl: prov.baseUrl,
                requiresApiKey: prov.requiresApiKey,
                apiKey: prov.apiKey,
                enabled: prov.enabled,
              }),
            });
          }
        }

        alert('Settings imported successfully.');
        window.location.reload();
      } catch (err: unknown) {
        alert('Failed to import backup: ' + errorMessage(err));
      }
    };
    reader.readAsText(file);
  };
  const settingsTabs: TabType[] = [
    'general',
    'providers',
    'permissions',
    ...(isPersonalAudience ? [] : (['mcp'] as TabType[])),
    'workspace',
    'voice',
    'diagnostics',
    'shortcuts',
    'cron',
    'subagents',
    'artifacts',
  ];

  const readTabFromLocation = (): TabType => {
    try {
      const params = new URLSearchParams(window.location.search);
      const hash = window.location.hash.replace(/^#/, '');
      const raw = (params.get('settingsTab') || params.get('tab') || hash || '').trim().toLowerCase();
      if (raw === 'mcp' && isPersonalAudience) return 'general';
      if (settingsTabs.includes(raw as TabType)) return raw as TabType;
    } catch {
      // ignore
    }
    return 'general';
  };

  const [activeTab, setActiveTab] = useState<TabType>(() => (isOpen ? readTabFromLocation() : 'general'));
  const [sidebarSide, setSidebarSide] = useState(() => localStorage.getItem('zvd:sidebar-side') || 'left');
  const [soundsEnabled, setSoundsEnabled] = useState(() => localStorage.getItem('zvd:sounds-enabled') !== 'false');

  // Deep-link: ...settingsTab=providers or #providers when overlay opens
  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(readTabFromLocation());
  }, [isOpen]);

  const selectTab = (tab: TabType) => {
    setActiveTab(tab);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('settingsTab', tab);
      window.history.replaceState({}, '', url.toString());
    } catch {
      // ignore
    }
  };

  if (!isOpen) return null;

  const capabilities = props.runtimeCapabilities;
  const workspaceKnowledge = capabilities?.workspaceKnowledge;

  return (
    <div className="zvd-settings-overlay" onClick={onClose}>
      <style>{`
        .zvd-settings-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0, 0, 0, 0.22);
          backdrop-filter: blur(2px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--zvd-text);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          animation: zvdFadeIn 200ms ease;
        }
        .zvd-settings-window {
          background: var(--zvd-surface);
          border: 1px solid var(--zvd-stroke-hairline);
          border-radius: 28px;
          width: 90%;
          max-width: 860px;
          height: 80vh;
          display: flex;
          box-shadow: var(--zvd-shadow-elevation);
          overflow: hidden;
          animation: zvdPopUp 250ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .zvd-settings-sidebar {
          width: 220px;
          background: var(--zvd-sidebar);
          border-right: 1px solid var(--zvd-stroke-hairline);
          padding: 24px 12px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .zvd-settings-sidebar-title {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--zvd-muted);
          padding: 0 12px 10px;
        }
        .zvd-settings-tab-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          background: transparent;
          border: none;
          color: var(--zvd-muted);
          padding: 10px 12px;
          border-radius: 20px;
          cursor: pointer;
          font-size: 14px;
          text-align: left;
          transition: all 150ms ease;
        }
        .zvd-settings-tab-btn:hover {
          background: var(--zvd-border-soft);
          color: var(--zvd-text);
        }
        .zvd-settings-tab-btn--active {
          background: var(--zvd-accent-soft);
          color: var(--zvd-accent) !important;
          font-weight: 600;
        }
        .zvd-settings-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: var(--zvd-surface);
        }
        .zvd-settings-header {
          padding: 20px 24px;
          border-bottom: 1px solid var(--zvd-stroke-hairline);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .zvd-settings-header h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 650;
        }
        .zvd-settings-close {
          background: transparent;
          border: none;
          color: var(--zvd-muted);
          cursor: pointer;
          padding: 4px;
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 150ms ease;
        }
        .zvd-settings-close:hover {
          background: var(--zvd-border-soft);
          color: var(--zvd-text);
        }
        .zvd-settings-body {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
        }
        .zvd-settings-form-group {
          margin-bottom: 24px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .zvd-settings-form-group label {
          font-size: 13px;
          font-weight: 600;
          color: var(--zvd-text);
        }
        .zvd-settings-select {
          background: var(--zvd-sidebar);
          border: 1px solid var(--zvd-stroke-hairline);
          border-radius: 20px;
          padding: 10px 16px;
          color: var(--zvd-text);
          font-size: 14px;
          outline: none;
          cursor: pointer;
        }
        .zvd-settings-select:focus {
          border-color: var(--zvd-accent);
        }
        .zvd-settings-card {
          background: var(--zvd-sidebar);
          border: 1px solid var(--zvd-stroke-hairline);
          border-radius: 16px;
          padding: 16px;
          margin-bottom: 20px;
        }
        .zvd-settings-card-title {
          font-size: 15px;
          font-weight: 650;
          margin-bottom: 6px;
        }
        .zvd-settings-card-desc {
          font-size: 13px;
          color: var(--zvd-muted);
        }
      `}</style>
      <div className="zvd-settings-window" onClick={e => e.stopPropagation()}>
        <div className="zvd-settings-sidebar">
          <div className="zvd-settings-sidebar-title">Settings</div>
          <button
            type="button"
            className={`zvd-settings-tab-btn ${activeTab === 'general' ? 'zvd-settings-tab-btn--active' : ''}`}
            onClick={() => { playTapSound(); selectTab('general'); }}
          >
            <IconSettings size={18} />
            General
          </button>
          <button
            type="button"
            className={`zvd-settings-tab-btn ${activeTab === 'providers' ? 'zvd-settings-tab-btn--active' : ''}`}
            onClick={() => { playTapSound(); selectTab('providers'); }}
          >
            <IconServer size={18} />
            AI Providers
          </button>
          <button
            type="button"
            className={`zvd-settings-tab-btn ${activeTab === 'permissions' ? 'zvd-settings-tab-btn--active' : ''}`}
            onClick={() => { playTapSound(); selectTab('permissions'); }}
          >
            <IconShield size={18} />
            Permissions
          </button>
          {!isPersonalAudience ? (
            <button
              type="button"
              className={`zvd-settings-tab-btn ${activeTab === 'mcp' ? 'zvd-settings-tab-btn--active' : ''}`}
              onClick={() => { playTapSound(); selectTab('mcp'); }}
            >
              <IconCpu size={18} />
              MCP Servers
            </button>
          ) : null}
          <button
            type="button"
            className={`zvd-settings-tab-btn ${activeTab === 'workspace' ? 'zvd-settings-tab-btn--active' : ''}`}
            onClick={() => { playTapSound(); selectTab('workspace'); }}
          >
            <IconFolder size={18} />
            Workspace
          </button>
          <button
            type="button"
            className={`zvd-settings-tab-btn ${activeTab === 'voice' ? 'zvd-settings-tab-btn--active' : ''}`}
            onClick={() => { playTapSound(); selectTab('voice'); }}
          >
            <IconMicrophone size={18} />
            Voice
          </button>
          <button
            type="button"
            className={`zvd-settings-tab-btn ${activeTab === 'diagnostics' ? 'zvd-settings-tab-btn--active' : ''}`}
            onClick={() => { playTapSound(); selectTab('diagnostics'); }}
          >
            <IconActivity size={18} />
            Diagnostics
          </button>
        </div>

        <div className="zvd-settings-content">
          <div className="zvd-settings-header">
            <h2>
              {activeTab === 'general' && 'General Settings'}
              {activeTab === 'providers' && 'AI Providers'}
              {activeTab === 'permissions' && 'Permission Control'}
              {activeTab === 'mcp' && 'Model Context Protocol (MCP)'}
              {activeTab === 'workspace' && 'Workspace Settings'}
              {activeTab === 'voice' && 'Voice (STT / TTS)'}
              {activeTab === 'diagnostics' && 'Diagnostics Panel' || activeTab === 'shortcuts' && 'Keyboard Shortcuts' || activeTab === 'cron' && 'Scheduled Routines (Cron)' || activeTab === 'subagents' && 'Running Subagents' || activeTab === 'artifacts' && 'Generated Artifacts'}
            </h2>
            <button className="zvd-settings-close" onClick={onClose} aria-label="Close">
              <IconX size={18} />
            </button>
          </div>

          <div className="zvd-settings-body">
            {activeTab === 'general' && (
              <div className="flex flex-col gap-5">
                <div className="zvd-settings-form-group">
                  <label>Experience Profile</label>
                  <select
                    className="zvd-settings-select"
                    value={props.profile}
                    onChange={e => props.onProfile(e.target.value)}
                  >
                    {profileLabels.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <span className="text-xs text-gray-500">
                    Adjusts detail level and suggested prompts.
                  </span>
                </div>

                <div className="zvd-settings-form-group">
                  <label>Reasoning Effort</label>
                  <select
                    className="zvd-settings-select"
                    value={props.effort}
                    onChange={e => props.onEffort(e.target.value)}
                  >
                    {effortLabels.map(ef => (
                      <option key={ef} value={ef}>{ef}</option>
                    ))}
                  </select>
                  <span className="text-xs text-gray-500">
                    Controls logical reasoning depth.
                  </span>
                </div>

                <div className="zvd-settings-form-group">
                  <label>Appearance</label>
                  <select
                    className="zvd-settings-select"
                    value={props.theme}
                    onChange={e => props.onTheme(parseThemeMode(e.target.value))}
                  >
                    <option value="system">System</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </div>

                <div className="zvd-settings-form-group">
                  <label>Accent Color</label>
                  <select
                    className="zvd-settings-select"
                    value={props.accent}
                    onChange={e => props.onAccent(parseAccent(e.target.value, ['green', 'orange', 'purple', 'navy'] as const, 'green'))}
                  >
                    <option value="green">Green (brand)</option>
                    <option value="orange">Orange</option>
                    <option value="purple">Purple</option>
                    <option value="navy">Dark Blue</option>
                  </select>
                </div>
                <div className="zvd-settings-form-group">
                  <label>Sidebar Position</label>
                  <select
                    className="zvd-settings-select"
                    value={sidebarSide}
                    onChange={e => {
                      const val = e.target.value;
                      setSidebarSide(val);
                      localStorage.setItem('zvd:sidebar-side', val);
                      window.location.reload(); // Reload to apply layout class easily
                    }}
                  >
                    <option value="left">Left</option>
                    <option value="right">Right</option>
                  </select>
                </div>

                <div className="zvd-settings-form-group">
                  <label>Sound Effects and Haptics</label>
                  <select
                    className="zvd-settings-select"
                    value={soundsEnabled ? 'true' : 'false'}
                    onChange={e => {
                      const val = e.target.value === 'true';
                      setSoundsEnabled(val);
                      localStorage.setItem('zvd:sounds-enabled', val ? 'true' : 'false');
                    }}
                  >
                    <option value="true">Enabled</option>
                    <option value="false">Disabled</option>
                  </select>
                </div>

                <div className="zvd-settings-form-group" style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #27272a' }}>
                  <label>Backup and Restore</label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleExport}
                      className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-md py-2 px-4 text-sm font-semibold transition-colors"
                    >
                      Export Settings
                    </button>
                    <label className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-md py-2 px-4 text-sm font-semibold transition-colors cursor-pointer text-center">
                      Import Settings
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleImport}
                        style={{ display: 'none' }}
                      />
                    </label>
                  </div>
                  <span className="text-xs text-gray-500">
                    Export API keys and preferences to a local secure backup file.
                  </span>
                </div>

              </div>
            )}

            {activeTab === 'providers' && (
              <ProviderSettingsPanel />
            )}

            {activeTab === 'permissions' && (
              <div className="flex flex-col gap-3">
                <div className="text-sm text-gray-400 mb-4">
                  Active permissions and security policies managed by the local runtime.
                </div>
                <div className="zvd-settings-card">
                  <div className="zvd-settings-card-title">Network Resilience</div>
                  <div className="zvd-settings-card-desc">
                    Status: {props.gatewayResilience?.ok ? 'Active and Secure' : 'Disconnected'}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'mcp' && !isPersonalAudience && (
              <div className="flex flex-col gap-3 text-center py-12 text-gray-500">
                No additional MCP servers are connected right now.
              </div>
            )}

            {activeTab === 'voice' && <VoiceSettingsPanel />}

            {activeTab === 'workspace' && (
              <div className="flex flex-col gap-4">
                <div className="zvd-settings-card">
                  <div className="zvd-settings-card-title">Active Workspace</div>
                  <div className="zvd-settings-card-desc">
                    Path: {capabilities?.workspace?.path || 'No directory selected'}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'diagnostics' && (
              <InternalBetaDiagnosticsPanel workspaceId={capabilities?.workspace?.id || 'chat'} />
            )}

            {activeTab === 'cron' && (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-gray-400 mb-2">Configure and monitor scheduled routines executed by the background supervisor.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[
                    { name: 'Settings Backup', expr: '0 0 * * *', status: 'Active', desc: 'Compressed local daily backup' },
                    { name: 'Update Check', expr: '*/30 * * * *', status: 'Active', desc: 'Check for new versions every 30 minutes' },
                    { name: 'Temporary Cache Cleanup', expr: '0 2 * * 0', status: 'Inactive', desc: 'Optimizes storage on Sundays' }
                  ].map((job, idx) => (
                    <div key={idx} className="zvd-settings-card flex justify-between items-center" style={{ margin: 0 }}>
                      <div>
                        <div className="zvd-settings-card-title flex items-center gap-2">
                          {job.name}
                          <span style={{ fontSize: '10px', background: job.status === 'Active' ? 'rgba(16, 185, 129, 0.15)' : '#27272a', color: job.status === 'Active' ? '#10b981' : '#a1a1aa', padding: '2px 6px', borderRadius: '4px' }}>
                            {job.status}
                          </span>
                        </div>
                        <div className="zvd-settings-card-desc" style={{ fontSize: '12px' }}>Expression: <code>{job.expr}</code> — {job.desc}</div>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" className="zvd-onboarding-button zvd-onboarding-button--secondary text-xs" style={{ padding: '6px 12px' }}>
                          <IconPlayerPlay size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'subagents' && (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-gray-400 mb-2">Track distributed tasks executed by specialist subagents.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[
                    { role: 'Nanostores State Refactor', model: 'gpt-4o', status: 'Completed', time: '1m 24s' },
                    { role: 'Rich Markdown Renderer', model: 'claude-3-5-sonnet', status: 'Completed', time: '2m 10s' }
                  ].map((agent, idx) => (
                    <div key={idx} className="zvd-settings-card flex justify-between items-center" style={{ margin: 0 }}>
                      <div>
                        <div className="zvd-settings-card-title flex items-center gap-2">
                          {agent.role}
                          <span style={{ fontSize: '10px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '2px 6px', borderRadius: '4px' }}>
                            {agent.status}
                          </span>
                        </div>
                        <div className="zvd-settings-card-desc" style={{ fontSize: '12px' }}>Model: {agent.model} ? Duration: {agent.time}</div>
                      </div>
                      <button type="button" className="zvd-onboarding-button zvd-onboarding-button--secondary text-xs" style={{ padding: '6px 12px', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                        <IconTrash size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'artifacts' && (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-gray-400 mb-2">Static files and reports generated on demand in chat sessions.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[
                    { name: 'walkthrough.md', size: '1.2 KB', desc: 'Executive summary of the visual redesign' },
                    { name: 'implementation_plan.md', size: '13.4 KB', desc: 'Delivery timeline' }
                  ].map((file, idx) => (
                    <div key={idx} className="zvd-settings-card flex justify-between items-center" style={{ margin: 0 }}>
                      <div>
                        <div className="zvd-settings-card-title">{file.name}</div>
                        <div className="zvd-settings-card-desc" style={{ fontSize: '12px' }}>{file.size} ? {file.desc}</div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="zvd-onboarding-button zvd-onboarding-button--secondary text-xs"
                          style={{ padding: '6px 12px' }}
                          onClick={() => alert('Markdown file preview is integrated into chat. Use direct markdown links in chat to open files.')}
                        >
                          Preview
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
{activeTab === 'shortcuts' && (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-gray-400 mb-2">Use global keyboard shortcuts to speed up your Zavorth workflow.</p>
                <div style={{ border: '1px solid #27272a', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#121214', borderBottom: '1px solid #27272a' }}>
                        <th style={{ padding: '12px 16px', fontWeight: '600', color: '#a1a1aa' }}>Action</th>
                        <th style={{ padding: '12px 16px', fontWeight: '600', color: '#a1a1aa' }}>Shortcut</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #27272a' }}>
                        <td style={{ padding: '12px 16px', color: '#e4e4e7' }}>Open Command Palette</td>
                        <td style={{ padding: '12px 16px' }}><kbd style={{ background: '#27272a', padding: '2px 6px', borderRadius: '4px', fontSize: '12px', border: '1px solid #3f3f46' }}>Ctrl / Cmd + K</kbd></td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #27272a' }}>
                        <td style={{ padding: '12px 16px', color: '#e4e4e7' }}>Show / Hide Sidebar</td>
                        <td style={{ padding: '12px 16px' }}><kbd style={{ background: '#27272a', padding: '2px 6px', borderRadius: '4px', fontSize: '12px', border: '1px solid #3f3f46' }}>Ctrl / Cmd + B</kbd></td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #27272a' }}>
                        <td style={{ padding: '12px 16px', color: '#e4e4e7' }}>Open / Close Terminal Rail</td>
                        <td style={{ padding: '12px 16px' }}><kbd style={{ background: '#27272a', padding: '2px 6px', borderRadius: '4px', fontSize: '12px', border: '1px solid #3f3f46' }}>Ctrl / Cmd + J</kbd></td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #27272a' }}>
                        <td style={{ padding: '12px 16px', color: '#e4e4e7' }}>Open Settings Panel</td>
                        <td style={{ padding: '12px 16px' }}><kbd style={{ background: '#27272a', padding: '2px 6px', borderRadius: '4px', fontSize: '12px', border: '1px solid #3f3f46' }}>Ctrl / Cmd + ,</kbd></td>
                      </tr>
                      <tr>
                        <td style={{ padding: '12px 16px', color: '#e4e4e7' }}>Close Active Modals / Panels</td>
                        <td style={{ padding: '12px 16px' }}><kbd style={{ background: '#27272a', padding: '2px 6px', borderRadius: '4px', fontSize: '12px', border: '1px solid #3f3f46' }}>Esc</kbd></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
