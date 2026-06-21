import { computeToolFingerprint } from '../../src/sdk/ExtensionToolFingerprint.js';
import type { CustomToolDescriptor } from '../../src/sdk/CustomToolDescriptor.js';

describe('ExtensionToolFingerprint Tests', () => {
  const descriptor: CustomToolDescriptor = {
    namespace: 'custom',
    name: 'testTool',
    description: 'A test tool.',
    inputSchema: { type: 'object', properties: { val: { type: 'string' } } },
    capabilities: ['filesystem', 'network'],
    riskClass: 'safe',
    handler: () => 'execute',
    metadata: { env: 'dev' },
  };

  it('fingerprint estaver para mesmo descriptor', () => {
    const f1 = computeToolFingerprint(descriptor);
    const f2 = computeToolFingerprint(descriptor);
    expect(f1).toBe(f2);
    expect(f1.length).toBe(64); // SHA-256 hex length
  });

  it('fingerprint muda quando inputSchema muda', () => {
    const f1 = computeToolFingerprint(descriptor);
    const f2 = computeToolFingerprint({
      ...descriptor,
      inputSchema: { type: 'object', properties: { val: { type: 'number' } } },
    });
    expect(f1).not.toBe(f2);
  });

  it('fingerprint muda quando capabilities mudam', () => {
    const f1 = computeToolFingerprint(descriptor);
    const f2 = computeToolFingerprint({
      ...descriptor,
      capabilities: ['filesystem'],
    });
    expect(f1).not.toBe(f2);
  });

  it('fingerprint muda quando risk muda', () => {
    const f1 = computeToolFingerprint(descriptor);
    const f2 = computeToolFingerprint({
      ...descriptor,
      riskClass: 'medium',
    });
    expect(f1).not.toBe(f2);
  });

  it('fingerprint nao inclui raw handler source ou raw secrets', () => {
    const f1 = computeToolFingerprint(descriptor);

    // Changing the handler source code should not change the fingerprint
    const f2 = computeToolFingerprint({
      ...descriptor,
      handler: () => {
        const secret = 'sk-123456';
        return secret;
      },
    });
    expect(f1).toBe(f2);
  });

  it('canonicalizacao e deterministica mesmo com ordem diferente de chaves no inputSchema', () => {
    const d1 = {
      ...descriptor,
      inputSchema: {
        type: 'object',
        properties: {
          a: { type: 'string' },
          b: { type: 'number' },
        },
      },
    };

    const d2 = {
      ...descriptor,
      inputSchema: {
        properties: {
          b: { type: 'number' },
          a: { type: 'string' },
        },
        type: 'object',
      },
    };

    const f1 = computeToolFingerprint(d1);
    const f2 = computeToolFingerprint(d2);
    expect(f1).toBe(f2);
  });
});
