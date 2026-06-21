import { validateExtensionTool } from '../../src/sdk/ExtensionToolValidation.js';
import type { CustomToolDescriptor } from '../../src/sdk/CustomToolDescriptor.js';

describe('ExtensionToolValidation Tests', () => {
  const baseDescriptor: CustomToolDescriptor = {
    namespace: 'custom',
    name: 'testTool',
    description: 'A test tool.',
    inputSchema: { type: 'object', properties: {} },
    capabilities: ['filesystem'],
    riskClass: 'safe',
  };

  it('passes validation for a fully valid descriptor', () => {
    expect(() => {
      validateExtensionTool(baseDescriptor);
    }).not.toThrow();
  });

  it('rejeita namespace ausente', () => {
    expect(() => {
      validateExtensionTool({ ...baseDescriptor, namespace: '' });
    }).toThrow('Namespace is required');
  });

  it('rejeita name ausente', () => {
    expect(() => {
      validateExtensionTool({ ...baseDescriptor, name: '' });
    }).toThrow('Name is required');
  });

  it('rejeita description ausente', () => {
    expect(() => {
      validateExtensionTool({ ...baseDescriptor, description: '' });
    }).toThrow('Description is required');
  });

  it('rejeita inputSchema ausente', () => {
    expect(() => {
      validateExtensionTool({ ...baseDescriptor, inputSchema: undefined });
    }).toThrow('Input schema is required');
  });

  it('rejeita capabilities ausentes ou vazias', () => {
    expect(() => {
      validateExtensionTool({ ...baseDescriptor, capabilities: [] });
    }).toThrow('Capabilities are required');
  });

  it('rejeita namespace/name inseguros (com espaços, path traversals, secrets)', () => {
    // Spaces
    expect(() => {
      validateExtensionTool({ ...baseDescriptor, namespace: 'custom space' });
    }).toThrow('Namespace and name must not contain spaces');

    // Path traversal
    expect(() => {
      validateExtensionTool({ ...baseDescriptor, name: 'dir/../file' });
    }).toThrow('Namespace and name must not contain path traversal characters');

    // Secrets in name/namespace
    expect(() => {
      validateExtensionTool({ ...baseDescriptor, name: 'openai_api_key' });
    }).toThrow('Namespace and name must not contain secret keywords');
  });

  it('rejeita namespace reservado', () => {
    expect(() => {
      validateExtensionTool({ ...baseDescriptor, namespace: 'core' });
    }).toThrow('Namespace "core" is reserved');

    expect(() => {
      validateExtensionTool({ ...baseDescriptor, namespace: 'system' });
    }).toThrow('Namespace "system" is reserved');
  });

  it('rejeita metadata com secrets em nivel raiz', () => {
    expect(() => {
      validateExtensionTool({
        ...baseDescriptor,
        metadata: {
          apiKey: 'some-raw-api-key',
        },
      });
    }).toThrow('contains forbidden secret keywords');
  });

  it('rejeita metadata com secrets aninhados (recursivo)', () => {
    // Nested object
    expect(() => {
      validateExtensionTool({
        ...baseDescriptor,
        metadata: {
          config: {
            auth: {
              token: 'secret-token',
            },
          },
        },
      });
    }).toThrow('contains forbidden secret keywords');

    // Array of objects
    expect(() => {
      validateExtensionTool({
        ...baseDescriptor,
        metadata: {
          endpoints: [
            { url: 'https://api.com', secretRef: 'ref-value' },
          ],
        },
      });
    }).toThrow('contains forbidden secret keywords');
  });

  it('rejeita riskClass invalido fora da enum permitida', () => {
    expect(() => {
      validateExtensionTool({ ...baseDescriptor, riskClass: 'invalid-risk' as any });
    }).toThrow('Invalid risk class');
  });
});
