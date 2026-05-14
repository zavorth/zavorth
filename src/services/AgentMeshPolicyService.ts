import type {
  AgentMeshPermission,
  AgentMeshPolicyDecision,
  AgentMeshUserConsent,
} from '../contracts/AgentMeshConsentContract.js';
import { AGENT_MESH_CRITICAL_PERMISSIONS } from '../contracts/AgentMeshConsentContract.js';
import type { AgentMeshExecutionRequest } from '../contracts/AgentMeshExecutionContract.js';

export class AgentMeshPolicyService {
  public evaluateConsent(consent: AgentMeshUserConsent): AgentMeshPolicyDecision {
    const criticalPermissions = consent.grantedPermissions.filter((permission) =>
      AGENT_MESH_CRITICAL_PERMISSIONS.includes(permission),
    );
    const deniedPermissions = criticalPermissions.filter((permission) =>
      !consent.risksAcknowledged.includes(`critical-permission:${permission}`),
    );

    return {
      decision: deniedPermissions.length > 0 ? 'blocked' : criticalPermissions.length > 0 ? 'requires_approval' : 'allowed',
      reasons: deniedPermissions.length > 0
        ? deniedPermissions.map((permission) => `Critical permission requires explicit acknowledgement: ${permission}.`)
        : criticalPermissions.length > 0
          ? ['Critical permissions were acknowledged and still require owner approval.']
          : ['Consent permissions are within the default Agent Mesh policy.'],
      requiredPermissions: consent.grantedPermissions.slice(),
      deniedPermissions,
      criticalPermissions,
    };
  }

  public evaluateExecution(input: {
    request: AgentMeshExecutionRequest;
    consent: AgentMeshUserConsent | null;
  }): AgentMeshPolicyDecision {
    const requiredPermissions = this.resolveRequiredPermissions(input.request);
    if (!input.consent) {
      return {
        decision: 'blocked',
        reasons: ['Execution requires active user consent for the target bridge.'],
        requiredPermissions,
        deniedPermissions: requiredPermissions,
        criticalPermissions: requiredPermissions.filter((permission) => AGENT_MESH_CRITICAL_PERMISSIONS.includes(permission)),
      };
    }

    const granted = new Set(input.consent.grantedPermissions);
    const deniedPermissions = requiredPermissions.filter((permission) => !granted.has(permission));
    const criticalPermissions = requiredPermissions.filter((permission) => AGENT_MESH_CRITICAL_PERMISSIONS.includes(permission));
    const unacknowledgedCritical = criticalPermissions.filter((permission) =>
      !input.consent?.risksAcknowledged.includes(`critical-permission:${permission}`),
    );
    const denied = Array.from(new Set([...deniedPermissions, ...unacknowledgedCritical]));

    return {
      decision: denied.length > 0 ? 'blocked' : criticalPermissions.length > 0 ? 'requires_approval' : 'allowed',
      reasons: denied.length > 0
        ? denied.map((permission) => `Execution is missing approved permission: ${permission}.`)
        : criticalPermissions.length > 0
          ? ['Execution uses critical permissions and must remain owner-approved.']
          : ['Execution is allowed by consent and sandbox policy.'],
      requiredPermissions,
      deniedPermissions: denied,
      criticalPermissions,
    };
  }

  public resolveRequiredPermissions(request: AgentMeshExecutionRequest): AgentMeshPermission[] {
    const permissions = new Set<AgentMeshPermission>();
    if (request.intent.context.trim()) {
      permissions.add('share_context');
    }
    if ((request.intent.requestedTools || []).length > 0) {
      permissions.add('delegate_tools');
    }
    if (request.sandbox.allowNetworkAccess) {
      permissions.add('network_access');
    }
    if (request.sandbox.allowFileSystemWrites || request.sandbox.allowedWritePaths.length > 0) {
      permissions.add('filesystem_write');
    }
    if (request.sandbox.allowProcessExecution) {
      permissions.add('process_execution');
    }
    return Array.from(permissions);
  }
}
