import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ProviderRuntimeStatus } from '../../../apps/zavorth-desktop/src/components/ProviderRuntimeStatus.tsx';
import { ModelSelectionService } from '../../../src/services/ModelSelectionService.js';

jest.mock('../../../src/services/ModelSelectionService.js', () => {
  return {
    ModelSelectionService: {
      getInstance: jest.fn().mockReturnValue({
        selectProvider: jest.fn()
      })
    }
  };
});

describe('ProviderRuntimeStatus Component', () => {
  let mockSelectProvider: jest.Mock;

  beforeEach(() => {
    mockSelectProvider = ModelSelectionService.getInstance().selectProvider as jest.Mock;
    jest.clearAllMocks();
  });

  it('renders ready state when provider is fully configured', async () => {
    mockSelectProvider.mockResolvedValue({
      providerId: 'p1',
      displayName: 'Main Provider',
      modelId: 'gpt-4',
      configured: true,
      runtimeReady: true
    });

    render(<ProviderRuntimeStatus />);

    await waitFor(() => {
      expect(screen.getByText(/Main Provider/)).toBeInTheDocument();
      expect(screen.getByText(/gpt-4/)).toBeInTheDocument();
      expect(screen.getByText(/Ready/i)).toBeInTheDocument();
    });
  });

  it('renders missing key warning when provider is remote but lacks key', async () => {
    mockSelectProvider.mockResolvedValue({
      providerId: 'p2',
      displayName: 'Remote Provider',
      modelId: 'claude-3',
      configured: false,
      runtimeReady: false
    });

    render(<ProviderRuntimeStatus />);

    await waitFor(() => {
      expect(screen.getByText(/Missing API Key/i)).toBeInTheDocument();
      expect(screen.getByText(/Remote Provider/)).toBeInTheDocument();
    });
  });

  it('does not crash or leak when no provider is found', async () => {
    mockSelectProvider.mockRejectedValue(new Error('no_suitable_provider_found'));

    render(<ProviderRuntimeStatus />);

    await waitFor(() => {
      expect(screen.getByText(/No suitable provider found/i)).toBeInTheDocument();
    });
  });
});
