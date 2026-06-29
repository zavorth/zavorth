import { useState, useMemo } from 'react';
import { IconSettings, IconServer, IconShield, IconCpu, IconActivity, IconFolder, IconX, IconClock, IconUsers, IconFileText, IconPlayerPlay, IconTrash } from '@tabler/icons-react';
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
import { CockpitDashboard } from './CockpitDashboard';
import { asRecord, effortLabels, panelLabels, profileLabels } from '../primitives/desktopPrimitives';

interface SettingsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  accent: 'orange' | 'purple' | 'navy';
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
  onAccent(value: 'orange' | 'purple' | 'navy'): void;
  onEffort(value: string): void;
  onProfile(value: string): void;
  onRepair(): void | Promise<void>;
  onGatewayResilienceAction(input: Record<string, unknown>): void | Promise<void>;
  onStart(): void | Promise<void>;
  onRuntimeStateAction(input: { domain: string; operation: string; metadata?: Record<string, unknown> }): void | Promise<void>;
  onTheme(value: 'light' | 'dark' | 'system'): void;
}

type TabType = 'general' | 'providers' | 'permissions' | 'mcp' | 'workspace' | 'diagnostics' | 'shortcuts' | 'cron' | 'subagents' | 'artifacts';

export function SettingsOverlay({
  isOpen,
  onClose,
  ...props
}: SettingsOverlayProps) {
  
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
          accent: localStorage.getItem('zvd:accent') || 'orange',
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
    } catch (err: any) {
      alert('Falha ao exportar configurações: ' + err.message);
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
          throw new Error('Formato de backup inválido.');
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

        alert('Configurações importadas com sucesso!');
        window.location.reload();
      } catch (err: any) {
        alert('Erro ao importar backup: ' + err.message);
      }
    };
    reader.readAsText(file);
  };
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [sidebarSide, setSidebarSide] = useState(() => localStorage.getItem('zvd:sidebar-side') || 'left');
  const [soundsEnabled, setSoundsEnabled] = useState(() => localStorage.getItem('zvd:sounds-enabled') !== 'false');

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
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(12px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #f5f5f7;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          animation: zvdFadeIn 200ms ease;
        }
        .zvd-settings-window {
          background: #18181a;
          border: 1px solid #27272a;
          border-radius: 16px;
          width: 90%;
          max-width: 860px;
          height: 80vh;
          display: flex;
          box-shadow: 0 30px 60px rgba(0,0,0,0.6);
          overflow: hidden;
          animation: zvdPopUp 250ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .zvd-settings-sidebar {
          width: 220px;
          background: #121214;
          border-right: 1px solid #27272a;
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
          color: #71717a;
          padding: 0 12px 10px;
        }
        .zvd-settings-tab-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          background: transparent;
          border: none;
          color: #a1a1aa;
          padding: 10px 12px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          text-align: left;
          transition: all 150ms ease;
        }
        .zvd-settings-tab-btn:hover {
          background: #1f1f23;
          color: #fff;
        }
        .zvd-settings-tab-btn--active {
          background: rgba(216, 107, 42, 0.08);
          color: var(--zvd-accent, #d86b2a) !important;
          font-weight: 600;
        }
        .zvd-settings-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: #18181a;
        }
        .zvd-settings-header {
          padding: 20px 24px;
          border-bottom: 1px solid #27272a;
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
          color: #71717a;
          cursor: pointer;
          padding: 4px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 150ms ease;
        }
        .zvd-settings-close:hover {
          background: #27272a;
          color: #fff;
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
          color: #d4d4d8;
        }
        .zvd-settings-select {
          background: #202022;
          border: 1px solid #27272a;
          border-radius: 8px;
          padding: 10px 12px;
          color: #fff;
          font-size: 14px;
          outline: none;
          cursor: pointer;
        }
        .zvd-settings-select:focus {
          border-color: var(--zvd-accent, #d86b2a);
        }
        .zvd-settings-card {
          background: #202022;
          border: 1px solid #27272a;
          border-radius: 12px;
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
          color: #a1a1aa;
        }
      `}</style>
      <div className="zvd-settings-window" onClick={e => e.stopPropagation()}>
        <div className="zvd-settings-sidebar">
          <div className="zvd-settings-sidebar-title">Configurações</div>
          <button
            type="button"
            className={`zvd-settings-tab-btn ${activeTab === 'general' ? 'zvd-settings-tab-btn--active' : ''}`}
            onClick={() => { require('../lib/haptics').playTapSound(); setActiveTab('general'); }}
          >
            <IconSettings size={18} />
            Geral
          </button>
          <button
            type="button"
            className={`zvd-settings-tab-btn ${activeTab === 'providers' ? 'zvd-settings-tab-btn--active' : ''}`}
            onClick={() => { require('../lib/haptics').playTapSound(); setActiveTab('providers'); }}
          >
            <IconServer size={18} />
            AI Providers
          </button>
          <button
            type="button"
            className={`zvd-settings-tab-btn ${activeTab === 'permissions' ? 'zvd-settings-tab-btn--active' : ''}`}
            onClick={() => { require('../lib/haptics').playTapSound(); setActiveTab('permissions'); }}
          >
            <IconShield size={18} />
            Permissões
          </button>
          <button
            type="button"
            className={`zvd-settings-tab-btn ${activeTab === 'mcp' ? 'zvd-settings-tab-btn--active' : ''}`}
            onClick={() => { require('../lib/haptics').playTapSound(); setActiveTab('mcp'); }}
          >
            <IconCpu size={18} />
            MCP Servers
          </button>
          <button
            type="button"
            className={`zvd-settings-tab-btn ${activeTab === 'workspace' ? 'zvd-settings-tab-btn--active' : ''}`}
            onClick={() => { require('../lib/haptics').playTapSound(); setActiveTab('workspace'); }}
          >
            <IconFolder size={18} />
            Workspace
          </button>
          <button
            type="button"
            className={`zvd-settings-tab-btn ${activeTab === 'diagnostics' ? 'zvd-settings-tab-btn--active' : ''}`}
            onClick={() => { require('../lib/haptics').playTapSound(); setActiveTab('diagnostics'); }}
          >
            <IconActivity size={18} />
            Diagnósticos
          </button>
        </div>

        <div className="zvd-settings-content">
          <div className="zvd-settings-header">
            <h2>
              {activeTab === 'general' && 'Configurações Gerais'}
              {activeTab === 'providers' && 'AI Providers'}
              {activeTab === 'permissions' && 'Controle de Permissões'}
              {activeTab === 'mcp' && 'Model Context Protocol (MCP)'}
              {activeTab === 'workspace' && 'Configurações do Workspace'}
              {activeTab === 'diagnostics' && 'Painel de Diagnósticos' || activeTab === 'shortcuts' && 'Atalhos de Teclado' || activeTab === 'cron' && 'Rotinas Agendadas (Cron)' || activeTab === 'subagents' && 'Subagentes em Execução' || activeTab === 'artifacts' && 'Artefatos Gerados'}
            </h2>
            <button className="zvd-settings-close" onClick={onClose} aria-label="Fechar">
              <IconX size={18} />
            </button>
          </div>

          <div className="zvd-settings-body">
            {activeTab === 'general' && (
              <div className="flex flex-col gap-5">
                <div className="zvd-settings-form-group">
                  <label>Perfil de Experiência</label>
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
                    Ajusta o nível de detalhe e os prompts sugeridos.
                  </span>
                </div>

                <div className="zvd-settings-form-group">
                  <label>Esforço de Raciocínio</label>
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
                    Controla a profundidade do raciocínio lógico.
                  </span>
                </div>

                <div className="zvd-settings-form-group">
                  <label>Aparência</label>
                  <select
                    className="zvd-settings-select"
                    value={props.theme}
                    onChange={e => props.onTheme(e.target.value as any)}
                  >
                    <option value="system">Sistema</option>
                    <option value="light">Claro</option>
                    <option value="dark">Escuro</option>
                  </select>
                </div>

                <div className="zvd-settings-form-group">
                  <label>Cor de Destaque</label>
                  <select
                    className="zvd-settings-select"
                    value={props.accent}
                    onChange={e => props.onAccent(e.target.value as any)}
                  >
                    <option value="orange">Laranja</option>
                    <option value="purple">Roxo</option>
                    <option value="navy">Azul Escuro</option>
                  </select>
                </div>
                <div className="zvd-settings-form-group">
                  <label>Posição da Sidebar (Sidebar Flip)</label>
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
                    <option value="left">Esquerda</option>
                    <option value="right">Direita</option>
                  </select>
                </div>

                <div className="zvd-settings-form-group">
                  <label>Efeitos Sonoros e Haptics</label>
                  <select
                    className="zvd-settings-select"
                    value={soundsEnabled ? 'true' : 'false'}
                    onChange={e => {
                      const val = e.target.value === 'true';
                      setSoundsEnabled(val);
                      localStorage.setItem('zvd:sounds-enabled', val ? 'true' : 'false');
                    }}
                  >
                    <option value="true">Ativados</option>
                    <option value="false">Desativados</option>
                  </select>
                </div>

                <div className="zvd-settings-form-group" style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #27272a' }}>
                  <label>Backup e Restauração</label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleExport}
                      className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-md py-2 px-4 text-sm font-semibold transition-colors"
                    >
                      Exportar Configurações
                    </button>
                    <label className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-md py-2 px-4 text-sm font-semibold transition-colors cursor-pointer text-center">
                      Importar Configurações
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleImport}
                        style={{ display: 'none' }}
                      />
                    </label>
                  </div>
                  <span className="text-xs text-gray-500">
                    Exporte suas chaves de API e preferências para um arquivo de backup seguro localmente.
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
                  Permissões ativas e políticas de segurança gerenciadas pelo runtime local.
                </div>
                <div className="zvd-settings-card">
                  <div className="zvd-settings-card-title">Resiliência de Rede</div>
                  <div className="zvd-settings-card-desc">
                    Status: {props.gatewayResilience?.ok ? 'Ativo e Seguro' : 'Desconectado'}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'mcp' && (
              <div className="flex flex-col gap-3 text-center py-12 text-gray-500">
                Sem servidores MCP adicionais conectados no momento.
              </div>
            )}

            {activeTab === 'workspace' && (
              <div className="flex flex-col gap-4">
                <div className="zvd-settings-card">
                  <div className="zvd-settings-card-title">Workspace Ativo</div>
                  <div className="zvd-settings-card-desc">
                    Caminho: {capabilities?.workspace?.path || 'Nenhum diretório selecionado'}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'diagnostics' && (
              <InternalBetaDiagnosticsPanel workspaceId={capabilities?.workspace?.id || 'chat'} />
            )}
            
            {activeTab === 'cron' && (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-gray-400 mb-2">Configure e monitore rotinas agendadas executadas pelo supervisor em segundo plano.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[
                    { name: 'Backup de Configurações', expr: '0 0 * * *', status: 'Ativo', desc: 'Backup diário compactado local' },
                    { name: 'Verificação de Atualizações', expr: '*/30 * * * *', status: 'Ativo', desc: 'Verificar novas versões a cada 30 min' },
                    { name: 'Limpeza de Cache Temporário', expr: '0 2 * * 0', status: 'Inativo', desc: 'Otimiza armazenamento aos domingos' }
                  ].map((job, idx) => (
                    <div key={idx} className="zvd-settings-card flex justify-between items-center" style={{ margin: 0 }}>
                      <div>
                        <div className="zvd-settings-card-title flex items-center gap-2">
                          {job.name}
                          <span style={{ fontSize: '10px', background: job.status === 'Ativo' ? 'rgba(16, 185, 129, 0.15)' : '#27272a', color: job.status === 'Ativo' ? '#10b981' : '#a1a1aa', padding: '2px 6px', borderRadius: '4px' }}>
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
                <p className="text-sm text-gray-400 mb-2">Acompanhe tarefas distribuídas e executadas por subagentes especialistas.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[
                    { role: 'Nanostores State Refactor', model: 'gpt-4o', status: 'Concluído', time: '1m 24s' },
                    { role: 'Rich Markdown Renderer', model: 'claude-3-5-sonnet', status: 'Concluído', time: '2m 10s' }
                  ].map((agent, idx) => (
                    <div key={idx} className="zvd-settings-card flex justify-between items-center" style={{ margin: 0 }}>
                      <div>
                        <div className="zvd-settings-card-title flex items-center gap-2">
                          {agent.role}
                          <span style={{ fontSize: '10px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '2px 6px', borderRadius: '4px' }}>
                            {agent.status}
                          </span>
                        </div>
                        <div className="zvd-settings-card-desc" style={{ fontSize: '12px' }}>Modelo: {agent.model} • Duração: {agent.time}</div>
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
                <p className="text-sm text-gray-400 mb-2">Arquivos e relatórios estáticos gerados sob demanda nas sessões de chat.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[
                    { name: 'walkthrough.md', size: '1.2 KB', desc: 'Resumo executivo do redesenho visual' },
                    { name: 'implementation_plan.md', size: '13.4 KB', desc: 'Cronograma de entrega das fases' }
                  ].map((file, idx) => (
                    <div key={idx} className="zvd-settings-card flex justify-between items-center" style={{ margin: 0 }}>
                      <div>
                        <div className="zvd-settings-card-title">{file.name}</div>
                        <div className="zvd-settings-card-desc" style={{ fontSize: '12px' }}>{file.size} • {file.desc}</div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="zvd-onboarding-button zvd-onboarding-button--secondary text-xs"
                          style={{ padding: '6px 12px' }}
                          onClick={() => alert('Visualização de arquivos markdown está integrada ao chat. Use links markdown directos no chat para abri-los.')}
                        >
                          Visualizar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
{activeTab === 'shortcuts' && (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-gray-400 mb-2">Use atalhos globais de teclado para agilizar seu fluxo de trabalho no Zavorth.</p>
                <div style={{ border: '1px solid #27272a', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#121214', borderBottom: '1px solid #27272a' }}>
                        <th style={{ padding: '12px 16px', fontWeight: '600', color: '#a1a1aa' }}>Ação</th>
                        <th style={{ padding: '12px 16px', fontWeight: '600', color: '#a1a1aa' }}>Atalho</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #27272a' }}>
                        <td style={{ padding: '12px 16px', color: '#e4e4e7' }}>Abrir Paleta de Comandos</td>
                        <td style={{ padding: '12px 16px' }}><kbd style={{ background: '#27272a', padding: '2px 6px', borderRadius: '4px', fontSize: '12px', border: '1px solid #3f3f46' }}>Ctrl / ⌘ + K</kbd></td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #27272a' }}>
                        <td style={{ padding: '12px 16px', color: '#e4e4e7' }}>Mostrar / Ocultar Sidebar</td>
                        <td style={{ padding: '12px 16px' }}><kbd style={{ background: '#27272a', padding: '2px 6px', borderRadius: '4px', fontSize: '12px', border: '1px solid #3f3f46' }}>Ctrl / ⌘ + B</kbd></td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #27272a' }}>
                        <td style={{ padding: '12px 16px', color: '#e4e4e7' }}>Mostrar / Ocultar Painel do Terminal</td>
                        <td style={{ padding: '12px 16px' }}><kbd style={{ background: '#27272a', padding: '2px 6px', borderRadius: '4px', fontSize: '12px', border: '1px solid #3f3f46' }}>Ctrl / ⌘ + J</kbd></td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #27272a' }}>
                        <td style={{ padding: '12px 16px', color: '#e4e4e7' }}>Abrir Painel de Configurações</td>
                        <td style={{ padding: '12px 16px' }}><kbd style={{ background: '#27272a', padding: '2px 6px', borderRadius: '4px', fontSize: '12px', border: '1px solid #3f3f46' }}>Ctrl / ⌘ + ,</kbd></td>
                      </tr>
                      <tr>
                        <td style={{ padding: '12px 16px', color: '#e4e4e7' }}>Fechar Modais / Painéis Ativos</td>
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
