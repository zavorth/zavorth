import { DangerousCommandBlocker } from '../security/DangerousCommandBlocker.js';
import { logger } from '../logger.js';
import type {
SystemOverlordActionRequest,
  SystemOverlordAutonomyLevel,
  SystemOverlordCapability,
  SystemOverlordCapabilityDecision,
  SystemOverlordExecutionProfile,
  SystemOverlordRuntimeTarget,
} from '../contracts/SystemOverlordContract.js';

const PROFILE_RANK: Record<SystemOverlordExecutionProfile, number> = {
  safe: 1,
  trusted: 2,
  dangerous: 3,
  owner: 4,
};

const CAPABILITY_REQUIREMENTS: Record<SystemOverlordCapability, {
  profile: SystemOverlordExecutionProfile;
  autonomyLevel: SystemOverlordAutonomyLevel;
  runtimeTarget: SystemOverlordRuntimeTarget;
}> = {
  'host.shell': { profile: 'trusted', autonomyLevel: 3, runtimeTarget: 'host' },
  'host.files.write': { profile: 'trusted', autonomyLevel: 2, runtimeTarget: 'host' },
  'host.install': { profile: 'trusted', autonomyLevel: 3, runtimeTarget: 'container' },
  'desktop.automation': { profile: 'dangerous', autonomyLevel: 5, runtimeTarget: 'desktop' },
  'browser.control': { profile: 'dangerous', autonomyLevel: 5, runtimeTarget: 'browser' },
  'docker.exec': { profile: 'trusted', autonomyLevel: 3, runtimeTarget: 'container' },
  'wsl.exec': { profile: 'trusted', autonomyLevel: 4, runtimeTarget: 'wsl' },
  'network.tunnel': { profile: 'dangerous', autonomyLevel: 4, runtimeTarget: 'host' },
  'secrets.read': { profile: 'dangerous', autonomyLevel: 5, runtimeTarget: 'host' },
  'node.invoke': { profile: 'trusted', autonomyLevel: 4, runtimeTarget: 'node' },
  'computer_use.visual_action': { profile: 'dangerous', autonomyLevel: 5, runtimeTarget: 'desktop' },
};

export class CapabilityPolicyService {
  public evaluate(request: SystemOverlordActionRequest): SystemOverlordCapabilityDecision {
    const capability = request.capability;
    const profile = this.normalizeProfile(request.profile);
    const autonomyLevel = this.normalizeAutonomyLevel(request.autonomyLevel);
    const command = String(request.command || '').trim();
    const requirement = CAPABILITY_REQUIREMENTS[capability];
    const mutating = this.isMutating(capability, command);
    const structuredSupervisedPayload = this.isStructuredSupervisedPayload(capability, command);
    const safeReadOnlyShell =
      capability === 'host.shell' && !mutating && this.isReadOnlyDiagnosticCommand(command);
    const requiredProfile = safeReadOnlyShell ? 'safe' : requirement.profile;
    const requiredAutonomyLevel = safeReadOnlyShell ? 1 : requirement.autonomyLevel;
    const runtimeTarget = this.resolveRuntimeTarget(requirement.runtimeTarget, command, mutating);

    if (command && !structuredSupervisedPayload && !DangerousCommandBlocker.isSafe(command)) {
      return {
        allowed: false,
        requiresApproval: false,
        reason: 'Comando bloqueado pela blacklist de seguranca do Zavorth.',
        capability,
        profile,
        requiredProfile,
        autonomyLevel,
        requiredAutonomyLevel,
        runtimeTarget,
        mutating,
        blockedReason: 'dangerous_command',
      };
    }

    if (PROFILE_RANK[profile] < PROFILE_RANK[requiredProfile]) {
      return {
        allowed: false,
        requiresApproval: true,
        reason: `A capability ${capability} exige perfil ${requiredProfile}; perfil atual: ${profile}.`,
        capability,
        profile,
        requiredProfile,
        autonomyLevel,
        requiredAutonomyLevel,
        runtimeTarget,
        mutating,
        blockedReason: 'profile_upgrade_required',
      };
    }

    if (autonomyLevel < requiredAutonomyLevel) {
      return {
        allowed: Boolean(request.approved),
        requiresApproval: !request.approved,
        reason: request.approved
          ? `Aprovacao recebida para autonomia nivel ${requiredAutonomyLevel}.`
          : `A capability ${capability} exige autonomia nivel ${requiredAutonomyLevel}; nivel atual: ${autonomyLevel}.`,
        capability,
        profile,
        requiredProfile,
        autonomyLevel,
        requiredAutonomyLevel,
        runtimeTarget,
        mutating,
        blockedReason: request.approved ? null : 'autonomy_upgrade_required',
      };
    }

    if (this.requiresExplicitApproval(capability, mutating) && !request.approved) {
      return {
        allowed: false,
        requiresApproval: true,
        reason: `A capability ${capability} e mutavel/sensivel e precisa de aprovacao explicita.`,
        capability,
        profile,
        requiredProfile,
        autonomyLevel,
        requiredAutonomyLevel,
        runtimeTarget,
        mutating,
        blockedReason: 'approval_required',
      };
    }

    return {
      allowed: true,
      requiresApproval: false,
      reason: `Capability ${capability} autorizada no perfil ${profile}.`,
      capability,
      profile,
      requiredProfile,
      autonomyLevel,
      requiredAutonomyLevel,
      runtimeTarget,
      mutating,
      blockedReason: null,
    };
  }

  public inferCapabilityFromCommand(command: string): SystemOverlordCapability {
    const normalized = String(command || '').trim().toLowerCase();
    if (/\b(npm|pnpm|yarn)\s+(install|add)\b|\bpip(?:3)?\s+install\b|\bapt(?:-get)?\s+install\b|\bwinget\s+install\b|\bchoco\s+install\b/.test(normalized)) {
      return 'host.install';
    }
    if (/^docker\b/.test(normalized)) {
      return 'docker.exec';
    }
    if (/^wsl\b/.test(normalized)) {
      return 'wsl.exec';
    }
    if (/\b(cloudflared|ngrok|tailscale|ssh\s+-R)\b/.test(normalized)) {
      return 'network.tunnel';
    }
    return 'host.shell';
  }

  private normalizeProfile(value: SystemOverlordExecutionProfile | null | undefined): SystemOverlordExecutionProfile {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'trusted' || normalized === 'dangerous' || normalized === 'owner') {
      return normalized;
    }
    return 'safe';
  }

  private normalizeAutonomyLevel(value: SystemOverlordAutonomyLevel | null | undefined): SystemOverlordAutonomyLevel {
    const numeric = Number(value || 1);
    if (numeric >= 6) {
      return 6;
    }
    if (numeric >= 5) {
      return 5;
    }
    if (numeric >= 4) {
      return 4;
    }
    if (numeric >= 3) {
      return 3;
    }
    if (numeric >= 2) {
      return 2;
    }
    return 1;
  }

  private isMutating(capability: SystemOverlordCapability, command: string): boolean {
    if (
      capability !== 'host.shell'
      && capability !== 'docker.exec'
      && capability !== 'wsl.exec'
    ) {
      return true;
    }
    if (!command) {
      return false;
    }
    if (this.isReadOnlyDiagnosticCommand(command)) {
      return false;
    }
    return true;
  }

  private isReadOnlyDiagnosticCommand(command: string): boolean {
    const normalized = String(command || '').trim().toLowerCase();
    if (!normalized || /[;&|><`]/.test(normalized) || /\$\(/.test(normalized)) {
      return false;
    }
    return /^(pwd|dir|ls|whoami|hostname|where\b|which\b|git\s+status\b|git\s+diff(?:\s+--stat)?\b|git\s+branch\b|node\s+-v\b|npm\s+-v\b|pnpm\s+-v\b|yarn\s+-v\b|python(?:3)?\s+--version\b|py\s+-v\b|type\b|cat\b)/i.test(normalized);
  }

  private isStructuredSupervisedPayload(capability: SystemOverlordCapability, command: string): boolean {
    if (capability === 'host.shell') {
      return false;
    }

    const normalized = String(command || '').trim();
    if (!normalized.startsWith('{') || !normalized.endsWith('}')) {
      return false;
    }

    try {
      const parsed = JSON.parse(normalized);
      return Boolean(parsed && typeof parsed === 'object' && !Array.isArray(parsed));
    } catch (error) { logger.warn('[Capability] JSON parse failed', error); return false; }
  }

  private requiresExplicitApproval(capability: SystemOverlordCapability, mutating: boolean): boolean {
    if (capability === 'host.shell') {
      return mutating;
    }
    return true;
  }

  private resolveRuntimeTarget(
    defaultTarget: SystemOverlordRuntimeTarget,
    command: string,
    mutating: boolean,
  ): SystemOverlordRuntimeTarget {
    const normalized = String(command || '').trim().toLowerCase();
    if (/\b(sudo|tcpdump|nmap|iptables|mount|umount|modprobe|gcc|g\+\+)\b/.test(normalized)) {
      return 'microvm';
    }
    if (defaultTarget === 'host' && mutating && /\b(npm\s+run\s+(build|test)|npm\s+test|pytest|jest|vitest|playwright|cypress)\b/i.test(normalized)) {
      return 'container';
    }
    return defaultTarget;
  }
}
