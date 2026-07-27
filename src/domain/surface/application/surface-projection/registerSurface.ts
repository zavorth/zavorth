/**
 * F6 — One-call surface registration (profile + optional projector + certification).
 * Create a surface in minutes: preset + send path; polish with a custom projector later.
 */

import type {
  RegisterSurfaceProfileInput,
  SurfaceChannelId,
  SurfaceProfile,
  SurfaceProfilePresetId,
} from '../../../../contracts/surface/SurfaceAffordanceContract.js';
import {
  getSurfaceProfile,
  listSurfaceProfiles,
  registerSurfaceProfile,
  resolveSurfaceProfileForChannel,
  resetSurfaceProfileRegistryForTests,
  isAffordanceEnabled,
} from '../surface-affordance/index.js';
import type { SurfaceProjector } from './projectors/SurfaceProjectorContract.js';
import {
  getSurfaceProjector,
  listSurfaceProjectors,
  registerSurfaceProjector,
  resetSurfaceProjectorRegistryForTests,
} from './projectors/SurfaceProjectorRegistry.js';
import { PlainSurfaceProjector } from './projectors/PlainSurfaceProjector.js';
import { FallbackMessagingSurfaceProjector } from './projectors/FallbackMessagingSurfaceProjector.js';
import type { SurfaceRenderTarget } from '../surface-response/SurfaceResponseContract.js';

export const SURFACE_REGISTRATION_CONTRACT_VERSION = 'surface-registration/v1' as const;

export type RegisterSurfaceInput = {
  /** Stable surface id (usually same as channel). */
  id: string;
  channel?: SurfaceChannelId | string;
  label?: string;
  /** Default: chat-basic — works day-1 with text fallback. */
  preset?: SurfaceProfilePresetId;
  overrides?: RegisterSurfaceProfileInput['overrides'];
  /** Optional custom projector. If omitted, a sensible default is used. */
  projector?: SurfaceProjector;
  /**
   * When true (default), register a fallback text projector if none provided
   * and channel is not already covered by a builtin projector.
   */
  ensureProjector?: boolean;
};

export type SurfaceCertificationCheck = {
  id: string;
  status: 'pass' | 'warn' | 'fail';
  summary: string;
  recommendation: string | null;
};

export type SurfaceCertificationReport = {
  version: typeof SURFACE_REGISTRATION_CONTRACT_VERSION;
  surfaceId: string;
  channel: string;
  status: 'ready' | 'attention' | 'blocked';
  checks: SurfaceCertificationCheck[];
  profile: SurfaceProfile | null;
  hasProjector: boolean;
  blocking: string[];
  warnings: string[];
};

export type RegisterSurfaceResult = {
  profile: SurfaceProfile;
  projector: SurfaceProjector;
  certification: SurfaceCertificationReport;
};

function defaultProjectorForChannel(
  channel: string,
  renderTarget: SurfaceRenderTarget,
): SurfaceProjector {
  const existing = getSurfaceProjector(channel);
  // getSurfaceProjector falls back to plain — only reuse if channel matches exactly
  if (existing.channel === channel) {
    return existing;
  }
  const messaging = new Set([
    'whatsapp',
    'signal',
    'imessage',
    'slack',
    'teams',
    'email',
    'instagram',
  ]);
  if (messaging.has(channel)) {
    return new FallbackMessagingSurfaceProjector(
      channel,
      (renderTarget as SurfaceRenderTarget) || 'plain',
    );
  }
  return new PlainSurfaceProjector();
}

/**
 * Register a surface with preset defaults + optional projector.
 * Minimal call: `registerSurface({ id: 'my-bot', preset: 'chat-basic' })`
 */
export function registerSurface(input: RegisterSurfaceInput): RegisterSurfaceResult {
  if (!input?.id || !String(input.id).trim()) {
    throw new Error('registerSurface requires a non-empty id');
  }
  const id = String(input.id).trim();
  const channel = String(input.channel || id).trim().toLowerCase();
  const preset = input.preset || 'chat-basic';

  const profile = registerSurfaceProfile({
    id,
    channel: channel as SurfaceChannelId,
    label: input.label || id,
    preset,
    overrides: input.overrides,
  });

  let projector: SurfaceProjector;
  if (input.projector) {
    // Ensure projector.channel aligns for lookup
    const custom = input.projector;
    if (custom.channel !== channel && custom.channel !== id) {
      const wrapped: SurfaceProjector = {
        channel,
        project: (projInput) => {
          const out = custom.project(projInput);
          return { ...out, channel };
        },
      };
      registerSurfaceProjector(wrapped);
      projector = wrapped;
    } else {
      registerSurfaceProjector(custom);
      projector = custom;
    }
  } else if (input.ensureProjector !== false) {
    const existing = getSurfaceProjector(channel);
    if (existing.channel === channel || existing.channel === id) {
      projector = existing;
    } else {
      projector = defaultProjectorForChannel(channel, profile.renderTarget);
      // Re-bind channel id for custom surfaces
      if (projector.channel !== channel) {
        const bound: SurfaceProjector = {
          channel,
          project: (projInput) => {
            const out = projector.project(projInput);
            return { ...out, channel };
          },
        };
        registerSurfaceProjector(bound);
        projector = bound;
      } else {
        registerSurfaceProjector(projector);
      }
    }
  } else {
    projector = getSurfaceProjector(channel);
  }

  const certification = certifySurface(id);
  return { profile, projector, certification };
}

/**
 * Non-blocking certification: surfaces can register with warnings.
 * Critical path: text projection + fallback for approval actions.
 */
export function certifySurface(surfaceId: string): SurfaceCertificationReport {
  const id = String(surfaceId || '').trim();
  const profile =
    getSurfaceProfile(id) ||
    (() => {
      try {
        return resolveSurfaceProfileForChannel(id);
      } catch {
        return null;
      }
    })();

  const projector = getSurfaceProjector(id);
  const hasProjector = Boolean(projector);
  const checks: SurfaceCertificationCheck[] = [];

  checks.push({
    id: 'profile-defined',
    status: profile ? 'pass' : 'fail',
    summary: profile ? `Profile ${profile.id} (${profile.preset})` : 'No profile',
    recommendation: profile ? null : 'Call registerSurface({ id, preset: "chat-basic" })',
  });

  checks.push({
    id: 'projector-defined',
    status: hasProjector ? 'pass' : 'fail',
    summary: hasProjector ? `Projector channel=${projector.channel}`
      : 'No projector (will use plain fallback at resolve time)',
    recommendation: hasProjector ? null : 'Provide projector or ensureProjector: true',
  });

  if (profile) {
    const hasButtons = isAffordanceEnabled(profile, 'inline_buttons');
    const hasSlash = isAffordanceEnabled(profile, 'slash_commands');
    const hasText = isAffordanceEnabled(profile, 'text');
    const hasSelect = isAffordanceEnabled(profile, 'select_menu');

    checks.push({
      id: 'critical-action-fallback',
      status: hasButtons || hasSlash || hasText || hasSelect ? 'pass' : 'fail',
      summary: hasButtons ? 'Native buttons available'
        : hasSlash ? 'Slash/command fallback available'
          : hasText ? 'Text fallback available'
            : 'No action delivery path',
      recommendation:
        hasButtons || hasSlash || hasText
          ? null
          : 'Enable text or slash_commands on the preset',
    });

    checks.push({
      id: 'voice-reply-optional',
      status: 'pass',
      summary: isAffordanceEnabled(profile, 'voice_reply') ? 'voice_reply enabled (optional)'
        : 'voice_reply off (default)',
      recommendation: null,
    });

    checks.push({
      id: 'reactions-optional',
      status: 'pass',
      summary: isAffordanceEnabled(profile, 'reactions') ? 'reactions enabled (✅/❌ shortcuts)'
        : 'reactions off',
      recommendation: null,
    });

    if (!hasButtons && profile.preset === 'chat-interactive') {
      checks.push({
        id: 'interactive-without-buttons',
        status: 'warn',
        summary: 'chat-interactive preset but inline_buttons disabled by override',
        recommendation: 'Re-enable inline_buttons or use chat-basic',
      });
    }
  }

  const blocking = checks.filter((c) => c.status === 'fail').map((c) => c.summary);
  const warnings = checks.filter((c) => c.status === 'warn').map((c) => c.summary);
  const status: SurfaceCertificationReport['status'] =
    blocking.length > 0 ? 'blocked' : warnings.length > 0 ? 'attention' : 'ready';

  return {
    version: SURFACE_REGISTRATION_CONTRACT_VERSION,
    surfaceId: id,
    channel: profile?.channel || id,
    status,
    checks,
    profile,
    hasProjector,
    blocking,
    warnings,
  };
}

export function listRegisteredSurfaces(): Array<{
  id: string;
  channel: string;
  preset: string;
  projectorChannel: string;
  certification: SurfaceCertificationReport['status'];
}> {
  return listSurfaceProfiles().map((profile) => {
    const cert = certifySurface(profile.id);
    const projector = getSurfaceProjector(profile.channel);
    return {
      id: profile.id,
      channel: profile.channel,
      preset: profile.preset,
      projectorChannel: projector.channel,
      certification: cert.status,
    };
  });
}

/** Test helper: reset profile + projector registries. */
export function resetSurfaceRegistrationForTests(): void {
  resetSurfaceProfileRegistryForTests();
  resetSurfaceProjectorRegistryForTests();
}

export function listSurfaceProjectorChannels(): string[] {
  return listSurfaceProjectors().map((p) => p.channel);
}
