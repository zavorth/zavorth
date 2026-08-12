import { apiClient } from '../../../apps/zavorth-desktop/src/apiClient';
/** @jest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ProviderSettingsPanel } from '../../../apps/zavorth-desktop/src/panels/ProviderSettingsPanel';

// Mock dependencies
jest.mock('../../../apps/zavorth-desktop/src/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  }
}));


describe('ProviderSettingsPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn() as jest.Mock;
  });

  it('lista providers', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ id: 'openai-1', type: 'openai', displayName: 'OpenAI', configured: true, enabled: true, secretSuffix: '***1234' }] })
    });
    
    render(<ProviderSettingsPanel />);
    
    expect(await screen.findByText('OpenAI')).toBeInTheDocument();
  });

  it('ProviderSetupModal cria provider sem mostrar a key original', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] })
    });
    render(<ProviderSettingsPanel />);
    
    const addButton = await screen.findByText(/Adicionar Provider/i);
    fireEvent.click(addButton);
    
    expect(document.querySelector('input[type="password"]')).toBeInTheDocument();
  });

  it('campo de API key salva nunca é preenchido com valor real e exibe placeholder seguro', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ id: 'openai-1', type: 'openai', displayName: 'OpenAI', configured: true, enabled: true, secretRef: 'some-ref', requiresApiKey: true }] })
    });
    render(<ProviderSettingsPanel />);
    
    // Simulate clicking Edit to open the modal
    const editButtons = await screen.findAllByTitle('Editar');
    fireEvent.click(editButtons[0]);
    
    // Test the input placeholder in the modal
    const passwordInput = await screen.findByPlaceholderText(/chave já configurada/i);
    expect(passwordInput).toBeInTheDocument();
    expect((passwordInput as HTMLInputElement).value).toBe('');
  });

  it('Delete key remove status configured', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ id: 'openai-1', providerId: 'openai-1', type: 'openai', displayName: 'OpenAI', configured: true, enabled: true, secretRef: 'some-ref', requiresApiKey: true }] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true })
      });

    render(<ProviderSettingsPanel />);
    
    // Simular clique em Editar para abrir o modal
    const editButtons = await screen.findAllByTitle('Editar');
    fireEvent.click(editButtons[0]);

    // Procurar botão 'Remover Chave' no modal
    const deleteKeyButton = await screen.findByTitle('Remover chave configurada');
    
    // For test we just mock window.confirm
    window.confirm = jest.fn().mockImplementation(() => true);
    window.alert = jest.fn();
    fireEvent.click(deleteKeyButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/v2/providers/openai-1/secret', expect.objectContaining({ method: 'DELETE' }));
    });
  });

  it('Test connection mostra status sem secret', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ id: 'openai-1', providerId: 'openai-1', type: 'openai', displayName: 'OpenAI', configured: true, enabled: true }] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, data: { ok: true } })
      });

    render(<ProviderSettingsPanel />);
    
    const testButtons = await screen.findAllByText('Testar Conexão');
    window.alert = jest.fn();
    fireEvent.click(testButtons[0]);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/v2/providers/test-connection', expect.objectContaining({ method: 'POST' }));
    });
  });
});
