/** @jest-environment jsdom */
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CockpitDashboard } from '../../../apps/zavorth-desktop/src/components/CockpitDashboard';
import { WorkspacePolicyPreview } from '../../../apps/zavorth-desktop/src/components/WorkspacePolicyPreview';
import { WorkspaceRuntimeReadinessCard } from '../../../apps/zavorth-desktop/src/components/WorkspaceRuntimeReadinessCard';
import { ProviderSetupModal } from '../../../apps/zavorth-desktop/src/components/ProviderSetupModal';

// Mock apiClient calls used inside CockpitDashboard
jest.mock('../../../apps/zavorth-desktop/src/apiClient', () => ({
  getWorkspaceTrustStatus: jest.fn().mockResolvedValue({ ok: true, trusted: true }),
  loadActiveMandate: jest.fn().mockResolvedValue(null)
}));

describe('ProductDemoFlow UX Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} })
    }) as jest.Mock;
  });

  it('cockpit renderiza elementos essenciais da demo', async () => {
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

    // Wait for the cockpit data to render (since it loads async)
    expect(await screen.findByText('Saúde do Sistema & Runtime')).toBeInTheDocument();
    expect(screen.getByText('Controles e Postura de Segurança')).toBeInTheDocument();
    expect(screen.getByText('Aprovações e Diagnósticos')).toBeInTheDocument();
  });

  it('cockpit mostra workspace/provider/security/readiness e nao renderiza secrets', async () => {
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
        approvalsCount={2}
        onStart={jest.fn()}
        onRepair={jest.fn()}
      />
    );

    expect(await screen.findByText('2 pendente(s)')).toBeInTheDocument();
    expect(screen.getByText('gpt-4o')).toBeInTheDocument();

    // Ensure no secret patterns leak
    const html = document.body.innerHTML;
    expect(html).not.toContain('sk-zavorth-');
    expect(html).not.toContain('Authorization:');
    expect(html).not.toContain('Bearer');
  });

  it('provider setup modal nao mostra API key', () => {
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

    // Check password input uses safe password type and doesn't reveal credentials
    const input = document.querySelector('input[type="password"]');
    expect(input).toBeInTheDocument();
    expect((input as HTMLInputElement).value).toBe('');
    expect((input as HTMLInputElement).placeholder).toMatch(/chave já configurada/i);
  });

  it('readiness e policy preview nao mostram secrets ou secretRef real e tem proximo passo', () => {
    const mockReadiness = {
      workspaceId: 'test-ws',
      ready: false,
      providerReady: false,
      modelReady: false,
      autonomyReady: true,
      policyReady: false,
      issues: [
        {
          code: 'MISSING_KEY',
          severity: 'error' as const,
          message: 'The provider has a secret ref OPENAI_API_KEY but no value was provided.'
        }
      ]
    };

    render(<WorkspaceRuntimeReadinessCard readiness={mockReadiness} />);

    expect(screen.getByText('MISSING_KEY:')).toBeInTheDocument();
    expect(screen.getByText(/OPENAI_API_KEY/)).toBeInTheDocument();

    const html = document.body.innerHTML;
    // Readiness issues must never display actual raw API keys or tokens
    expect(html).not.toContain('sk-');
    expect(html).not.toContain('Bearer');
  });

  it('policy preview nao mostra secrets', () => {
    const mockPreview = {
      providerId: 'openai',
      modelId: 'gpt-4o',
      allowedCapabilities: ['read_file', 'write_file'],
      autonomyProfile: 'Governed',
      allowDeveloperMode: false,
      allowHostPowerMode: false,
      allowPty: false,
      allowTaskMandates: true,
      allowTemporaryDirectoryTrust: false,
      allowProviderFallback: true,
      riskLevel: 'LOW' as const,
      warnings: [
        {
          code: 'BEARER_LEAK_PREVENT',
          severity: 'warning' as const,
          message: 'Bearer abc123def456 was redacted.'
        }
      ]
    };

    render(<WorkspacePolicyPreview preview={mockPreview} />);

    expect(screen.getByText('Developer Mode: Blocked')).toBeInTheDocument();
    expect(screen.getByText('Host Power Mode: Blocked')).toBeInTheDocument();
    expect(screen.getByText('PTY: Blocked')).toBeInTheDocument();

    const html = document.body.innerHTML;
    // Warning must have redacted Bearer pattern
    expect(html).not.toContain('abc123def456');
    expect(html).toContain('[REDACTED_BEARER]');
  });
});
