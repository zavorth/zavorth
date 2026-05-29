import type {
  ProfileRuntimeBundle,
  SurfaceExperienceBundle,
  SurfaceExperienceProjection,
} from '../contracts/ProfileManifestContract.js';
import { ProfileEnforcementReceiptService } from './ProfileEnforcementReceiptService.js';

export type SurfaceExperienceProjectionInput = {
  surface?: string | null;
  profileBundle?: ProfileRuntimeBundle | null;
  surfaceExperienceBundle?: SurfaceExperienceBundle | null;
};

export class SurfaceExperienceProjectionService {
  private readonly receipts = new ProfileEnforcementReceiptService();

  public build(input: SurfaceExperienceProjectionInput = {}): SurfaceExperienceProjection | null {
    const bundle = input.surfaceExperienceBundle
      || input.profileBundle?.surfaceExperienceBundle
      || null;
    if (!bundle) return null;

    const activeSurface = normalizeText(input.surface, bundle.defaultSurface);
    const allowedSurfaces = unique(bundle.allowedSurfaces);
    const surfaceAllowed = allowedSurfaces.length === 0 || allowedSurfaces.includes(activeSurface);
    return {
      contractVersion: 'SurfaceExperienceProjection/v1',
      profileId: bundle.profileId,
      label: bundle.label,
      description: bundle.description,
      activeSurface,
      defaultSurface: bundle.defaultSurface,
      allowedSurfaces,
      surfaceAllowed,
      headline: surfaceAllowed
        ? `${bundle.label} on ${activeSurface}`
        : `${bundle.label} is not intended for ${activeSurface}`,
      guidance: surfaceAllowed
        ? this.guidanceFor(activeSurface, bundle)
        : `Switch to ${bundle.defaultSurface} or choose one of: ${allowedSurfaces.join(', ') || bundle.defaultSurface}.`,
      navigationHints: allowedSurfaces.map((surface) => ({
        id: `surface:${bundle.profileId}:${surface}`,
        label: labelForSurface(surface),
        surface,
        primary: surface === bundle.defaultSurface,
      })),
      tags: bundle.tags,
      checksum: bundle.checksum,
      profileEnforcementReceipt: this.receipts.fromSurface({
        bundle,
        activeSurface,
        surfaceAllowed,
        allowedSurfaces,
      }),
    };
  }

  private guidanceFor(surface: string, bundle: SurfaceExperienceBundle): string {
    switch (surface) {
      case 'telegram':
        return 'Keep messages compact, actionable and approval-first.';
      case 'zavorthControl':
      case 'web':
        return 'Show visual state, receipts, approvals and history without blocking conversation.';
      case 'api':
        return 'Return stable structured data and avoid presentation-only wording.';
      case 'cli':
      default:
        return `${bundle.description || 'Use the terminal as the primary conversational control surface.'}`;
    }
  }
}

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((entry) => normalizeText(entry)).filter(Boolean)));
}

function labelForSurface(surface: string): string {
  switch (surface) {
    case 'cli':
      return 'Terminal';
    case 'zavorthControl':
    case 'web':
      return 'ZavorthControl';
    case 'telegram':
      return 'Telegram';
    case 'api':
      return 'API';
    default:
      return surface;
  }
}
