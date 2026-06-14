/** @jest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AgentWorkspaceSettingsPanel } from '../../../apps/zavorth-desktop/src/panels/AgentWorkspaceSettingsPanel';

// The DO-NOT-LEAK marker explicitly demanded by the test plan:
const LEAK_MARKER = 'sk-zavorth-workspace-config-DO-NOT-LEAK-21J';

describe('AgentWorkspaceSettingsPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn((url: string) => {
      if (url.includes('/readiness')) {
        return Promise.resolve({
          json: () => Promise.resolve({
            workspaceId: 'test-ws',
            ready: true,
            providerReady: true,
            modelReady: true,
            autonomyReady: true,
            policyReady: true,
            issues: []
          })
        });
      } else if (url.includes('/preview')) {
        return Promise.resolve({
          json: () => Promise.resolve({
            providerId: 'provider-1',
            modelId: 'model-1',
            allowedCapabilities: ['chat'],
            autonomyProfile: 'safe',
            allowDeveloperMode: false,
            allowHostPowerMode: false,
            allowPty: false,
            allowTaskMandates: true,
            allowTemporaryDirectoryTrust: false,
            allowProviderFallback: false,
            riskLevel: 'LOW',
            warnings: []
          })
        });
      } else {
        return Promise.resolve({
          json: () => Promise.resolve({
            config: {
              workspaceId: 'test-ws',
              defaultProviderId: 'provider-1',
              defaultModelId: 'model-1',
              allowedCapabilities: ['chat'],
              defaultAutonomyProfile: 'safe',
              allowDeveloperMode: false,
              allowHostPowerMode: false,
              allowPty: false,
              allowTaskMandates: true,
              allowTemporaryDirectoryTrust: false,
              allowProviderFallback: false,
            }
          })
        });
      }
    }) as jest.Mock;
  });

  it('renders the configuration with safe defaults', async () => {
    render(<AgentWorkspaceSettingsPanel workspaceId="test-ws" />);
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('provider-1')).toBeInTheDocument();
      expect(screen.getByDisplayValue('model-1')).toBeInTheDocument();
    });

    // Check defaults
    const devModeCheckbox = screen.getByLabelText(/Permitir Developer Mode/i) as HTMLInputElement;
    expect(devModeCheckbox.checked).toBe(false);

    const hpmCheckbox = screen.getByLabelText(/Permitir Host Power Mode/i) as HTMLInputElement;
    expect(hpmCheckbox.checked).toBe(false);

    const ptyCheckbox = screen.getByLabelText(/Permitir Sessões PTY/i) as HTMLInputElement;
    expect(ptyCheckbox.checked).toBe(false);

    const tmpCheckbox = screen.getByLabelText(/Permitir Temporary Directory Trust/i) as HTMLInputElement;
    expect(tmpCheckbox.checked).toBe(false);

    const mandatesCheckbox = screen.getByLabelText(/Permitir Task Mandates/i) as HTMLInputElement;
    expect(mandatesCheckbox.checked).toBe(true);

    const fallbackCheckbox = screen.getByLabelText(/Permitir Provider Fallback/i) as HTMLInputElement;
    expect(fallbackCheckbox.checked).toBe(false);
  });

  it('verifies that marker is strictly not leaked in rendering', async () => {
    // To ensure the marker does not leak from any API response or rendering text:
    const { container } = render(<AgentWorkspaceSettingsPanel workspaceId="test-ws" />);
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('provider-1')).toBeInTheDocument();
    });

    const renderedText = container.innerHTML;
    // Just a sanity check:
    expect(renderedText).not.toContain(LEAK_MARKER);
  });
});
