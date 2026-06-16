import type { CustomToolDescriptor } from './CustomToolDescriptor.js';

const RESERVED_NAMESPACES = new Set(['core', 'system', 'zavorth', 'admin']);
const PERMITTED_RISK_CLASSES = new Set(['safe', 'low', 'medium', 'high', 'critical', 'unknown']);

function checkObjectForSecrets(obj: any): void {
  if (!obj || typeof obj !== 'object') {
    return;
  }
  const secretPattern = /token|secret|key|auth|password|bearer|sk-|ciphertext|authTag/i;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      checkObjectForSecrets(item);
    }
    return;
  }

  for (const [key, value] of Object.entries(obj)) {
    if (secretPattern.test(key)) {
      throw new Error(`Rejected: Metadata key "${key}" contains forbidden secret keywords.`);
    }
    if (typeof value === 'string') {
      const isobviousSecret =
        secretPattern.test(value) ||
        value.startsWith('sk-') ||
        value.startsWith('Bearer ') ||
        (value.length > 40 && /[a-zA-Z0-9]{40,}/.test(value));
      if (isobviousSecret) {
        throw new Error(`Rejected: Metadata value for "${key}" contains an obvious raw secret or token.`);
      }
    } else if (typeof value === 'object') {
      checkObjectForSecrets(value);
    }
  }
}

export function validateExtensionTool(descriptor: CustomToolDescriptor): void {
  if (!descriptor) {
    throw new Error('Descriptor is required.');
  }

  const namespace = String(descriptor.namespace || '').trim();
  const name = String(descriptor.name || '').trim();
  const description = String(descriptor.description || '').trim();

  // 1. Check basic field existence
  if (!descriptor.namespace || !namespace) {
    throw new Error('Namespace is required and cannot be empty.');
  }
  if (!descriptor.name || !name) {
    throw new Error('Name is required and cannot be empty.');
  }
  if (!descriptor.description || !description) {
    throw new Error('Description is required and cannot be empty.');
  }
  if (!descriptor.inputSchema) {
    throw new Error('Input schema is required.');
  }
  if (!descriptor.capabilities || !Array.isArray(descriptor.capabilities) || descriptor.capabilities.length === 0) {
    throw new Error('Capabilities are required and must be a non-empty array.');
  }

  // 2. Risk check
  if (descriptor.riskClass && !PERMITTED_RISK_CLASSES.has(descriptor.riskClass)) {
    throw new Error(`Invalid risk class: ${descriptor.riskClass}`);
  }

  // 3. String safety validation (whitespace, path traversal, secrets keywords)
  if (namespace.includes(' ') || name.includes(' ')) {
    throw new Error('Namespace and name must not contain spaces.');
  }
  if (
    namespace.includes('..') ||
    name.includes('..') ||
    namespace.includes('/') ||
    name.includes('/') ||
    namespace.includes('\\') ||
    name.includes('\\')
  ) {
    throw new Error('Namespace and name must not contain path traversal characters (.., /, \\).');
  }

  const secretKeywordPattern = /token|secret|key|auth|password|bearer|sk-/i;
  if (secretKeywordPattern.test(namespace) || secretKeywordPattern.test(name)) {
    throw new Error('Namespace and name must not contain secret keywords.');
  }

  // 4. Reserved namespace validation
  if (RESERVED_NAMESPACES.has(namespace.toLowerCase())) {
    throw new Error(`Namespace "${namespace}" is reserved and cannot be used by extensions.`);
  }

  // 5. Recursive metadata validation for secrets
  if (descriptor.metadata) {
    checkObjectForSecrets(descriptor.metadata);
  }
}
