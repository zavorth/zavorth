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

  it('first run without a workspace or with an untrusted workspace', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            readyForInternalBeta: false,
            checks: [
              { id: 'workspace_trusted', status: 'fail', message: 'This workspace is not trusted yet.', remediation: 'Select "Trust this Workspace"' }
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
    const heading = await screen.findByText(/Needs Internal Beta Adjustments/i);
    expect(heading).toBeInTheDocument();

    // Remediation is visible
    expect(screen.getByText(/Select "Trust this Workspace"/i)).toBeInTheDocument();
  });

  it('provider missing, missing key ou disabled', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            readyForInternalBeta: false,
            checks: [
              { id: 'provider_configured', status: 'fail', message: 'The default provider is configured but has no API key.', remediation: 'Add the API key in Providers.' }
            ]
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] })
      });

    render(<InternalBetaDiagnosticsPanel workspaceId="test-ws" />);

    expect(await screen.findByText(/The default provider is configured but has no API key/i)).toBeInTheDocument();
    expect(screen.getByText(/Cadastre a API Key na aba Providers/i)).toBeInTheDocument();
  });

  it('workspace config missing aplica safe default', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            readyForInternalBeta: false,
            checks: [
              { id: 'workspace_config_present', status: 'warning', message: 'Configuraction do workspace missing; aplicando profile seguro padrao (safe defaults).', remediation: 'Ajuste as permissions do workspace na aba Workspace Settings.' }
            ]
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] })
      });

    render(<InternalBetaDiagnosticsPanel workspaceId="no-config-ws" />);

    expect(await screen.findByText(/aplicando profile seguro padrao \(safe defaults\)/i)).toBeInTheDocument();
  });

  it('readiness mostra nexts passos e policy preview sanitizado', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            readyForInternalBeta: false,
            checks: [
              { id: 'runtime_ready', status: 'fail', message: 'The operational environment is not ready. Code: config_issue.', remediation: 'Fix the inconsistencies shown in Workspace Settings.' }
            ]
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] })
      });

    render(<InternalBetaDiagnosticsPanel workspaceId="test-ws" />);

    expect(await screen.findByText(/Fix the inconsistencies indicated in the Workspace Settings panel/i)).toBeInTheDocument();
  });

  it('diagnostics hide secrets and do not send external telemetry', async () => {
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

  it('UI hides secretRef and API keys and shows safe statuses (HPM, PTY, fallback disabled)', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            readyForInternalBeta: true,
            checks: [
              { id: 'host_power_mode', status: 'pass', message: 'Host Power Mode esta desativado (seguro por padrao).' },
              { id: 'pty_mode', status: 'pass', message: 'PTY Interactive Sessions esta desativado (seguro por padrao).' },
              { id: 'fallback_policy', status: 'pass', message: 'Provider Fallback esta desativado (seguro por padrao).' }
            ]
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] })
      });

    render(<InternalBetaDiagnosticsPanel workspaceId="test-ws" />);

    expect(await screen.findByText(/Host Power Mode esta desativado/i)).toBeInTheDocument();
    expect(screen.getByText(/PTY Interactive Sessions esta desativado/i)).toBeInTheDocument();
    expect(screen.getByText(/Provider Fallback esta desativado/i)).toBeInTheDocument();

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
