/** @jest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { InternalBetaDiagnosticsPanel } from '../../../apps/zavorth-desktop/src/panels/InternalBetaDiagnosticsPanel';

describe('InternalBetaDiagnosticsPanel UI Tests (Phase 21K-B)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn() as jest.Mock;
  });

  it('renders loading state initially', () => {
    (global.fetch as jest.Mock).mockReturnValue(new Promise(() => {})); // Never resolves
    render(<InternalBetaDiagnosticsPanel workspaceId="test-ws" />);
    expect(screen.getByTestId('diagnostics-loading')).toBeInTheDocument();
  });

  it('renders report and checklist on successful fetch', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            readyForInternalBeta: true,
            generatedAt: new Date().toISOString(),
            checks: [
              { id: 'database_reachable', status: 'pass', message: 'SQLite connected' },
              { id: 'provider_configured', status: 'pass', message: 'OpenAI configured' }
            ]
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: 'step_trust_workspace', title: 'Trust Workspace', description: 'Mark trusted', status: 'completed', manual: false },
            { id: 'step_setup_provider', title: 'Configure AI Provider', description: 'Register keys', status: 'pending', manual: false }
          ]
        })
      });

    render(<InternalBetaDiagnosticsPanel workspaceId="test-ws" />);

    // Wait for the panel container
    const panel = await screen.findByTestId('diagnostics-panel');
    expect(panel).toBeInTheDocument();

    // Check readiness header
    expect(screen.getByTestId('overall-readiness')).toHaveTextContent('Pronto para Beta Interno');

    // Check checks list
    expect(await screen.findByText('SQLite connected')).toBeInTheDocument();
    expect(screen.getByText('OpenAI configured')).toBeInTheDocument();

    // Check checklist items
    expect(screen.getByText('Trust Workspace')).toBeInTheDocument();
    expect(screen.getByText('Configure AI Provider')).toBeInTheDocument();
  });

  it('never renders secrets or token references in UI output', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            readyForInternalBeta: false,
            generatedAt: new Date().toISOString(),
            checks: [
              { id: 'provider_configured', status: 'fail', message: 'Secret sk-zavorth-key is missing', remediation: 'Bearer token needed' }
            ]
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: 'step_setup_provider', title: 'secret reference is empty', description: 'Fill API key', status: 'pending', manual: false }
          ]
        })
      });

    render(<InternalBetaDiagnosticsPanel workspaceId="test-ws" />);

    // Wait for rendering
    await screen.findByTestId('diagnostics-panel');

    const htmlContent = document.body.innerHTML;
    // Assert no raw keys or headers are shown in HTML (ignoring redacted placeholders)
    expect(htmlContent).not.toMatch(/Authorization:|Bearer\s|secretRef|sk-[A-Za-z0-9]{5,}/i);
    expect(htmlContent).not.toContain('sk-zavorth-internal-beta-hardening-DO-NOT-LEAK-21K-B');
  });

  it('renders error state if fetch fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false });

    render(<InternalBetaDiagnosticsPanel workspaceId="test-ws" />);

    const errorContainer = await screen.findByTestId('diagnostics-error');
    expect(errorContainer).toBeInTheDocument();
    expect(errorContainer).toHaveTextContent('Falha ao consultar diagnósticos locais.');
  });
});
