import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

(global as any).IS_REACT_ACT_ENVIRONMENT = true;

function ProviderConfigUi({ keySuffix, rawKey }: { keySuffix: string, rawKey: string }) {
  return (
    <div>
      <h3>Configurar Provedor</h3>
      <span data-testid="suffix-display">Chave terminada em: {keySuffix}</span>
    </div>
  );
}

describe('ProviderSecretMetadataUiLeak', () => {
  it('deve exibir o suffix na UI local mas nao vazar rawKey', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<ProviderConfigUi keySuffix="1234" rawKey="sk-secret-key-1234" />);
    });

    const display = container.querySelector('[data-testid="suffix-display"]');
    expect(display?.textContent).toContain('1234');
    expect(container.innerHTML).not.toContain('sk-secret-key-1234');
    
    document.body.removeChild(container);
  });
});
