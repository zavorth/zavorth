import type { CustomToolDescriptor } from './CustomToolDescriptor.js';
import { validateExtensionTool } from './ExtensionToolValidation.js';
import { computeToolFingerprint } from './ExtensionToolFingerprint.js';
import { ServiceRegistry } from '../bootstrap/ServiceRegistry.js';
import { ServiceTokens } from '../bootstrap/ServiceTokens.js';
import type { SecurityAuditLogger } from '../services/SecurityAuditLogger.js';

export type ExtensionRegistrationResult = {
  namespace: string;
  name: string;
  qualifiedName: string;
  fingerprint: string;
  status: 'registered_unapproved' | 'pending_approval' | 'drift_detected' | 'rejected';
  riskClass: string;
};

export class ZavorthExtensionFacade {
  private static readonly registeredTools = new Map<
    string,
    {
      descriptor: CustomToolDescriptor;
      fingerprint: string;
    }
  >();

  private constructor() {
    // Prevent instantiation
  }

  public static registerCustomTool(descriptor: CustomToolDescriptor): ExtensionRegistrationResult {
    // 1. Validate descriptor
    validateExtensionTool(descriptor);

    const namespace = descriptor.namespace.trim();
    const name = descriptor.name.trim();
    const qualifiedName = `${namespace}:${name}`;
    const normalizedKey = qualifiedName.toLowerCase();

    // 2. Compute fingerprint
    const fingerprint = computeToolFingerprint(descriptor);

    // 3. Resolve audit logger
    const hasLogger = ServiceRegistry.has(ServiceTokens.SecurityAuditLogger);
    if (!hasLogger) {
      throw new Error('Audit logger is unavailable in the service container. Tool registration is blocked.');
    }
    const auditLogger = ServiceRegistry.get(ServiceTokens.SecurityAuditLogger);

    // 4. Duplicate and drift checks
    const existing = this.registeredTools.get(normalizedKey);
    let status: ExtensionRegistrationResult['status'] = 'pending_approval';
    let isDrift = false;

    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        status = 'drift_detected';
        isDrift = true;
      } else {
        throw new Error(`Duplicate tool collision: Tool "${qualifiedName}" is already registered.`);
      }
    } else {
      // New tool status mapping
      const riskClass = descriptor.riskClass || 'unknown';
      if (riskClass === 'safe') {
        status = 'registered_unapproved';
      } else {
        status = 'pending_approval';
      }
    }

    // Update local registry (drift updates the signature but remains governable)
    this.registeredTools.set(normalizedKey, { descriptor, fingerprint });

    // 5. Emit safe audit event
    try {
      auditLogger.logMcpRuntimeEvent({
        event: isDrift ? 'mcp_schema_drift_detected' : 'mcp_tool_registered',
        serverId: namespace,
        toolName: name,
        namespacedToolId: qualifiedName,
        fingerprint,
        previousFingerprint: existing?.fingerprint,
        effectiveAllowed: status === 'registered_unapproved',
      });
    } catch (err: any) {
      // If native validation in logger fails, fail clearly
      throw new Error(`Audit logging failed: ${err.message}`);
    }

    return {
      namespace,
      name,
      qualifiedName,
      fingerprint,
      status,
      riskClass: descriptor.riskClass || 'unknown',
    };
  }

  /**
   * Resets registered tools for test isolation.
   */
  public static resetForTests(): void {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('resetForTests is only allowed in test environment');
    }
    this.registeredTools.clear();
  }
}
