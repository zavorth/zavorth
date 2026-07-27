/** @jest-environment jsdom */
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CockpitDashboard } from '../../../apps/zavorth-desktop/src/components/CockpitDashboard';
import { WorkspaceRuntimeReadinessCard } from '../../../apps/zavorth-desktop/src/components/WorkspaceRuntimeReadinessCard';
import { ProviderSetupModal } from '../../../apps/zavorth-desktop/src/components/ProviderSetupModal';
import { WorkspacePolicyPreview } from '../../../apps/zavorth-desktop/src/components/WorkspacePolicyPreview';
import { ProviderRuntimeStatus } from '../../../apps/zavorth-desktop/src/components/ProviderRuntimeStatus';

// Mock apiClient calls used inside CockpitDashboard
jest.mock('../../../apps/zavorth-desktop/src/apiClient', () => ({
  getWorkspaceTrustStatus: jest.fn().mockResolvedValue({ ok: true, trusted: true }),
  loadActiveMandate: jest.fn().mockResolvedValue(null)
}));

// Mock the backend ModelSelectionService used inside ProviderRuntimeStatus
jest.mock('../../../src/services/ModelSelectionService.js', () => ({
  ModelSelectionService: {
    getInstance: jest.fn().mockReturnValue({
      selectProvider: jest.fn().mockResolvedValue({
        displayName: 'OpenAI',
        modelId: 'gpt-4o',
        runtimeReady: true
      })
    })
  }
}));

describe('PreTesterProductCompletionUx', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} })
    }) as jest.Mock;
  });

  it('should render CockpitDashboard sem crash, exibindo actions acionaveis e sem segredos', async () => {
    const mockRuntimeCapabilities = {
      providers: {
        connected: ['openai'],
        selectedModelId: 'gpt-4o'
      }
    };
    const mockStatus = { running: true };

    render(
      <CockpitDashboard
        workspaceId="test-ws"
        workspacePath="/path/to/my-workspace"
        runtimeCapabilities={mockRuntimeCapabilities}
        status={mockStatus}
        approvalsCount={0}
        onStart={jest.fn()}
        onRepair={jest.fn()}
      />
    );

    expect(await screen.findByText('Saude do Sistema & Runtime')).toBeInTheDocument();
    expect(screen.getByText('Start Runtime')).toBeInTheDocument();
    expect(screen.getByText('Repair Access')).toBeInTheDocument();

    const html = document.body.innerHTML;
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('null');
    expect(html).not.toContain('[object Object]');
  });

  it('should show o status correto no WorkspaceRuntimeReadinessCard', () => {
    const mockReadiness = {
      workspaceId: 'test-ws',
      ready: false,
      providerReady: false,
      modelReady: false,
      autonomyReady: false,
      policyReady: false,
      issues: [
        { code: 'WORKSPACE_UNTRUSTED', severity: 'error' as const, message: 'Untrusted workspace: enable workspace trust' }
      ]
    };

    render(
      <WorkspaceRuntimeReadinessCard
        readiness={mockReadiness}
      />
    );

    // If workspace is not trusted/ready, it should NOT display a success state, but show error/warning text
    expect(screen.getByText(/Untrusted/i)).toBeInTheDocument();
    expect(screen.getByText(/WORKSPACE_UNTRUSTED/i)).toBeInTheDocument();
    expect(screen.queryByText(/Ready to Operate/i)).not.toBeInTheDocument();

    const html = document.body.innerHTML;
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('null');
    expect(html).not.toContain('[object Object]');
  });

  it('should render WorkspacePolicyPreview with flags and risk', () => {
    const mockPolicyPreview = {
      providerId: 'openai',
      modelId: 'gpt-4o',
      allowedCapabilities: ['read_file', 'write_file'],
      autonomyProfile: 'RESTRICTED',
      allowDeveloperMode: false,
      allowHostPowerMode: false,
      allowPty: false,
      allowTaskMandates: true,
      allowTemporaryDirectoryTrust: true,
      allowProviderFallback: false,
      riskLevel: 'MEDIUM' as const,
      warnings: []
    };

    render(
      <WorkspacePolicyPreview
        preview={mockPolicyPreview}
      />
    );

    expect(screen.getByText(/Policy Preview \(Risk: MEDIUM\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Developer Mode: Blocked/i)).toBeInTheDocument();
    expect(screen.getByText(/Task Mandates: Allowed/i)).toBeInTheDocument();

    const html = document.body.innerHTML;
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('null');
    expect(html).not.toContain('[object Object]');
  });

  it('deve ocultar informations confidenciais no ProviderSetupModal', () => {
    const mockProvider = {
      id: 'openai-1',
      providerId: 'openai-1',
      type: 'openai' as const,
      displayName: 'OpenAI',
      configured: true,
      enabled: true,
      secretRef: 'OPENAI_API_KEY',
      requiresApiKey: true
    };

    render(
      <ProviderSetupModal
        isOpen={true}
        providerToEdit={mockProvider}
        onSave={jest.fn()}
        onClose={jest.fn()}
      />
    );

    const html = document.body.innerHTML;
    expect(html).not.toContain('sk-proj-');
    expect(html).not.toContain('Bearer');
    expect(html).not.toContain('Authorization');
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('null');
    expect(html).not.toContain('[object Object]');
  });

  it('should render ProviderRuntimeStatus usando mocks', async () => {
    render(<ProviderRuntimeStatus />);

    // Renders the loading/checking state first or final state depending on async resolve
    expect(await screen.findByText(/OpenAI/i)).toBeInTheDocument();
    expect(screen.getByText(/Ready/i)).toBeInTheDocument();

    const html = document.body.innerHTML;
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('null');
    expect(html).not.toContain('[object Object]');
  });

  it('DesktopWorkspaceView - not directly testable', () => {
    // DesktopWorkspaceView is not directly testable in jsdom unit tests
    // because it depends heavily on Electron window APIs, node ipcRenderer IPC bindings,
    // and complex workspace state initialization.
    // Impact: The view behavior must be validated via packaged desktop app manual QA or E2E integration test runs.
    // We verify that the view file exists in the filesystem to ensure integrity.
    const fs = require('fs');
    const path = require('path');
    const viewPath = path.resolve(__dirname, '../../../apps/zavorth-desktop/src/views/DesktopWorkspaceView.tsx');
    expect(fs.existsSync(viewPath)).toBe(true);
  });
});
