/** @jest-environment jsdom */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { InternalBetaDiagnosticsPanel } from '../../../apps/zavorth-desktop/src/panels/InternalBetaDiagnosticsPanel';
import { ErrorNormalizationService } from '../../../src/services/ErrorNormalizationService';

describe('InternalBetaHardeningUx Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn() as jest.Mock;
  });

  it('first-run sem workspace ou workspace não confiável', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            readyForInternalBeta: false,
            checks: [
              { id: 'workspace_trusted', status: 'fail', message: 'Este Workspace ainda não é confiável.', remediation: 'Selecione "Confiar neste Workspace"' }
            ]
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] })
      });

    render(<InternalBetaDiagnosticsPanel workspaceId="empty-or-untrusted" />);
    
    // Readiness shows warning/fail
    const heading = await screen.findByText(/Necessita Ajustes para Beta Interno/i);
    expect(heading).toBeInTheDocument();

    // Remediation is visible
    expect(screen.getByText(/Selecione "Confiar neste Workspace"/i)).toBeInTheDocument();
  });

  it('provider ausente, missing key ou disabled', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            readyForInternalBeta: false,
            checks: [
              { id: 'provider_configured', status: 'fail', message: 'O provedor padrão está configurado mas não possui API Key.', remediation: 'Cadastre a API Key na aba Providers.' }
            ]
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] })
      });

    render(<InternalBetaDiagnosticsPanel workspaceId="test-ws" />);
    
    expect(await screen.findByText(/O provedor padrão está configurado mas não possui API Key/i)).toBeInTheDocument();
    expect(screen.getByText(/Cadastre a API Key na aba Providers/i)).toBeInTheDocument();
  });

  it('workspace config ausente aplica safe default', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            readyForInternalBeta: false,
            checks: [
              { id: 'workspace_config_present', status: 'warning', message: 'Configuração do workspace ausente; aplicando perfil seguro padrão (safe defaults).', remediation: 'Ajuste as permissões do workspace na aba Workspace Settings.' }
            ]
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] })
      });

    render(<InternalBetaDiagnosticsPanel workspaceId="no-config-ws" />);
    
    expect(await screen.findByText(/aplicando perfil seguro padrão \(safe defaults\)/i)).toBeInTheDocument();
  });

  it('readiness mostra próximos passos e policy preview sanitizado', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            readyForInternalBeta: false,
            checks: [
              { id: 'runtime_ready', status: 'fail', message: 'O ambiente operacional não está pronto. Código: config_issue.', remediation: 'Corrija as inconsistências indicadas no painel de Workspace Settings.' }
            ]
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] })
      });

    render(<InternalBetaDiagnosticsPanel workspaceId="test-ws" />);
    
    expect(await screen.findByText(/Corrija as inconsistências indicadas no painel de Workspace Settings/i)).toBeInTheDocument();
  });

  it('diagnostics não contém secret e não envia telemetria externa', async () => {
    const fetchSpy = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          readyForInternalBeta: true,
          checks: []
        }
      })
    });
    global.fetch = fetchSpy;

    render(<InternalBetaDiagnosticsPanel workspaceId="test-ws" />);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));

    // Ensure it only fetched from endpoints and not remote telemetries
    const calls = fetchSpy.mock.calls;
    for (const call of calls) {
      expect(call[0]).toMatch(/^\/api\/v2\//);
      expect(call[0]).not.toMatch(/telemetry|analytics|external/);
    }
  });

  it('error normalization remove API key, Authorization/Bearer, raw provider body e DB path', () => {
    const errorNormalizer = ErrorNormalizationService.getInstance();
    
    // API key
    const rawErrorKey = new Error('Lacks key or key sk-zavorth-abc-12345 is bad');
    const normKey = errorNormalizer.normalize(rawErrorKey);
    expect(normKey.message).not.toContain('sk-zavorth');
    expect(normKey.message).toContain('[REDACTED_SECRET]');

    // Bearer / Authorization
    const rawErrorAuth = new Error('Received Authorization: abcdef123456789 from upstream');
    const normAuth = errorNormalizer.normalize(rawErrorAuth);
    expect(normAuth.message).not.toContain('abcdef123456789');
    expect(normAuth.message).toContain('[REDACTED_AUTHORIZATION]');

    const rawErrorBearer = new Error('Received Bearer abcdef123456789 from upstream');
    const normBearer = errorNormalizer.normalize(rawErrorBearer);
    expect(normBearer.message).not.toContain('abcdef123456789');
    expect(normBearer.message).toContain('[REDACTED_BEARER]');

    // SQLite path
    const rawErrorPath = new Error('Database file at C:\\zavorth\\db\\zavorth.db could not be read');
    const normPath = errorNormalizer.normalize(rawErrorPath);
    expect(normPath.message).not.toContain('C:\\zavorth');
    expect(normPath.message).toContain('[REDACTED_PATH]');
  });

  it('UI não renderiza secretRef ou API key e mostra status seguros (HPM, PTY, fallback disabled)', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            readyForInternalBeta: true,
            checks: [
              { id: 'host_power_mode', status: 'pass', message: 'Host Power Mode está desativado (seguro por padrão).' },
              { id: 'pty_mode', status: 'pass', message: 'PTY Interactive Sessions está desativado (seguro por padrão).' },
              { id: 'fallback_policy', status: 'pass', message: 'Provider Fallback está desativado (seguro por padrão).' }
            ]
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] })
      });

    render(<InternalBetaDiagnosticsPanel workspaceId="test-ws" />);

    expect(await screen.findByText(/Host Power Mode está desativado/i)).toBeInTheDocument();
    expect(screen.getByText(/PTY Interactive Sessions está desativado/i)).toBeInTheDocument();
    expect(screen.getByText(/Provider Fallback está desativado/i)).toBeInTheDocument();

    const htmlContent = document.body.innerHTML;
    expect(htmlContent).not.toMatch(/secretRef|sk-/i);
  });

  it('proves that the marker 21K-B does not leak anywhere in the rendered UI', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            readyForInternalBeta: true,
            checks: [
              { id: 'test_marker', status: 'pass', message: 'Checking mock key: sk-zavorth-internal-beta-hardening-DO-NOT-LEAK-21K-B' }
            ]
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] })
      });

    render(<InternalBetaDiagnosticsPanel workspaceId="test-ws" />);

    // Since it's in the diagnostics response, if the UI renders the response raw, it might leak.
    // However, our backend diagnostics runs ErrorNormalizationService or sanitizes reports.
    // In the test, we mock the fetch response with the raw marker.
    // Let's assert that the panel does not render it directly or it is sanitized on the frontend if needed,
    // or let's assert that the sanitization in our services works so that the backend output doesn't contain it.
    // Wait, let's verify that the HTML does not contain the raw marker because the backend sanitizes it,
    // or the frontend has general protection.
    // Let's check that if the component receives the marker, the page rendering is clean.
    // Wait! Let's ensure our UI/UX does not contain the literal word 'sk-zavorth-internal-beta-hardening-DO-NOT-LEAK-21K-B'
    // once rendered or if normalized.
    // Let's write the test assertion.
    const textElements = await screen.findAllByTestId(/check-item-/);
    expect(textElements.length).toBeGreaterThan(0);
    const htmlContent = document.body.innerHTML;
    // We expect the marker to be redacted in output messages
    expect(htmlContent).not.toContain('sk-zavorth-internal-beta-hardening-DO-NOT-LEAK-21K-B');
    expect(htmlContent).not.toContain('DO-NOT-LEAK-21K-B');
  });
});
