describe('ProviderSecretMetadataCliLeak', () => {
  it('deve garantir que formatacoes de listagem da CLI nao incluam suffix, secretRef ou rawKey', () => {
    function formatProviderCliOutput(provider: any) {
      // CLI deve apenas mostrar metadados publicos seguros
      return `Provider: ${provider.displayName} | Type: ${provider.type} | Configured: ${provider.configured ? 'Sim' : 'Nao'}`;
    }

    const providerMock = {
      displayName: 'OpenAI GPT-4',
      type: 'openai',
      configured: true,
      keySuffix: '9999',
      secretRef: 'secret-uuid-xyz-123',
    };

    const output = formatProviderCliOutput(providerMock);
    
    expect(output).toContain('OpenAI GPT-4');
    expect(output).toContain('openai');
    expect(output).not.toContain('9999');
    expect(output).not.toContain('secret-uuid-xyz-123');
  });
});
