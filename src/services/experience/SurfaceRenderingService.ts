import {
  EXPERIENCE_SURFACE_RENDERING_CONTRACT_VERSION,
  type ExperienceAction,
  type ExperienceHealthStatus,
  type ExperienceProfileOption,
  type ExperienceProfileSelection,
  type ExperienceSurface,
  type ExperienceSurfaceRendering,
} from './ExperienceContracts.js';
import type { SurfaceExperienceProjection } from '../../contracts/ProfileManifestContract.js';

export type SurfaceRenderingInput = {
  surface: ExperienceSurface;
  profileSelection?: ExperienceProfileSelection | null;
  surfaceExperience?: SurfaceExperienceProjection | null;
  healthStatus?: ExperienceHealthStatus | null;
  pendingApprovals?: number | null;
  pendingLearning?: number | null;
};

export class SurfaceRenderingService {
  public build(input: SurfaceRenderingInput): ExperienceSurfaceRendering {
    const activeProfile = input.profileSelection?.options.find((option: ExperienceProfileOption) => option.active) || null;
    const profileId = input.profileSelection?.activeProfileId || activeProfile?.id || null;
    const layout = layoutForSurface(input.surface);
    const density = densityFor(input.surface, activeProfile?.planningDepth);
    const tone = toneFor(profileId, activeProfile?.trustMode);
    const pendingApprovals = Math.max(0, Number(input.pendingApprovals || 0));
    const pendingLearning = Math.max(0, Number(input.pendingLearning || 0));
    const sections = sectionsFor(layout, pendingApprovals, pendingLearning);
    const warnings = [
      ...(input.profileSelection?.warnings || []),
      input.surfaceExperience && !input.surfaceExperience.surfaceAllowed
        ? input.surfaceExperience.guidance
        : '',
    ].filter(Boolean);

    return {
      contractVersion: EXPERIENCE_SURFACE_RENDERING_CONTRACT_VERSION,
      surface: input.surface,
      profileId,
      layout,
      density,
      tone,
      headline: headlineFor(input.surface, activeProfile?.label || input.surfaceExperience?.label || 'Zavorth'),
      subhead: subheadFor(input.surface, input.healthStatus || 'attention', pendingApprovals),
      promptPlaceholder: placeholderFor(input.surface, profileId),
      primarySections: sections.primarySections,
      secondarySections: sections.secondarySections,
      hiddenByDefault: sections.hiddenByDefault,
      navigation: navigationFor(input.surface, input.profileSelection),
      limits: limitsFor(layout, density),
      actions: actionsFor(input.surface, profileId, pendingApprovals),
      warnings,
    };
  }
}

function layoutForSurface(surface: ExperienceSurface): ExperienceSurfaceRendering['layout'] {
  if (isZavorthControlSurface(surface)) return 'zavorthControl-tabs';
  if (isChatOpsSurface(surface)) return 'chatops-card';
  if (surface === 'api') return 'api-json';
  return 'chat-first';
}

function densityFor(surface: ExperienceSurface, planningDepth: string | undefined): ExperienceSurfaceRendering['density'] {
  if (isChatOpsSurface(surface)) return 'compact';
  if (planningDepth === 'deep') return 'rich';
  if (planningDepth === 'brief') return 'compact';
  return 'balanced';
}

function toneFor(profileId: string | null, trustMode: string | undefined): ExperienceSurfaceRendering['tone'] {
  if (profileId === 'developer' || profileId === 'creator') return 'developer';
  if (profileId === 'operator' || trustMode === 'strict') return 'operator';
  if (profileId === 'team') return 'executive';
  return 'calm';
}

function sectionsFor(
  layout: ExperienceSurfaceRendering['layout'],
  pendingApprovals: number,
  pendingLearning: number,
): Pick<ExperienceSurfaceRendering, 'primarySections' | 'secondarySections' | 'hiddenByDefault'> {
  if (layout === 'zavorthControl-tabs') {
    return {
      primarySections: ['inbox', pendingApprovals > 0 ? 'approvals' : 'timeline', 'receipts'],
      secondarySections: ['providers', 'channels', 'skills', pendingLearning > 0 ? 'learning' : 'memory'],
      hiddenByDefault: ['raw-events', 'debug-metadata', 'internal-policy-ledger'],
    };
  }
  if (layout === 'chatops-card') {
    return {
      primarySections: ['reply', pendingApprovals > 0 ? 'approval-card' : 'next-action'],
      secondarySections: ['receipt-link', 'short-status'],
      hiddenByDefault: ['timeline', 'diff-full', 'raw-events', 'debug-metadata'],
    };
  }
  if (layout === 'api-json') {
    return {
      primarySections: ['agent', 'actions', 'receipts'],
      secondarySections: ['timeline', 'profileSelection', 'surfaceExperience'],
      hiddenByDefault: [],
    };
  }
  return {
    primarySections: ['chat', pendingApprovals > 0 ? 'approval-inline' : 'next-action', 'status-line'],
    secondarySections: ['timeline', 'receipts', 'profile'],
    hiddenByDefault: ['debug-metadata', 'raw-events', 'large-cards'],
  };
}

function navigationFor(surface: ExperienceSurface, selection?: ExperienceProfileSelection | null): ExperienceSurfaceRendering['navigation'] {
  const base = [
    { id: 'chat', label: 'Chat', target: isZavorthControlSurface(surface) ? '/control...tab=inbox' : 'zavorth chat' },
    { id: 'approvals', label: 'Approvals', target: isZavorthControlSurface(surface) ? '/control...tab=approvals' : 'zavorth approve' },
    { id: 'receipts', label: 'Receipts', target: isZavorthControlSurface(surface) ? '/control...tab=receipts' : 'zavorth receipts' },
    { id: 'profile', label: 'Profile', target: selection?.activeProfileId ? `zavorth profile use ${selection.activeProfileId}` : 'zavorth profile' },
  ];
  return base.map((item) => ({
    ...item,
    active: item.id === 'chat',
  }));
}

function limitsFor(
  layout: ExperienceSurfaceRendering['layout'],
  density: ExperienceSurfaceRendering['density'],
): ExperienceSurfaceRendering['limits'] {
  if (layout === 'chatops-card') return { maxCards: 1, maxTimelineItems: 3, maxSuggestions: 3 };
  if (layout === 'zavorthControl-tabs') return { maxCards: density === 'rich' ? 8 : 5, maxTimelineItems: density === 'rich' ? 20 : 10, maxSuggestions: 6 };
  if (layout === 'api-json') return { maxCards: 20, maxTimelineItems: 50, maxSuggestions: 10 };
  return { maxCards: 3, maxTimelineItems: 6, maxSuggestions: 4 };
}

function actionsFor(surface: ExperienceSurface, profileId: string | null, pendingApprovals: number): ExperienceAction[] {
  const actions: ExperienceAction[] = [{
    id: 'surface.ask',
    label: 'Ask Zavorth',
    kind: 'natural',
    command: isZavorthControlSurface(surface) ? null : 'zavorth chat',
    route: isZavorthControlSurface(surface) ? '/control...tab=inbox' : null,
    risk: 'safe',
    requiresApproval: false,
    reason: 'Primary conversation entry point for this surface.',
  }];
  if (pendingApprovals > 0) {
    actions.push({
      id: 'surface.approve',
      label: 'Review approvals',
      kind: 'approval',
      command: 'zavorth approve',
      route: isZavorthControlSurface(surface) ? '/control...tab=approvals' : null,
      risk: 'attention',
      requiresApproval: false,
      reason: 'Shows risk, scope and receipts before a decision.',
    });
  }
  if (profileId) {
    actions.push({
      id: 'surface.profile',
      label: 'Switch profile',
      kind: 'context',
      command: `zavorth profile use ${profileId}`,
      route: null,
      risk: 'safe',
      requiresApproval: false,
      reason: 'Profiles change cognition, runtime policy and surface guidance together.',
    });
  }
  return actions;
}

function headlineFor(surface: ExperienceSurface, profileLabel: string): string {
  if (isZavorthControlSurface(surface)) return `${profileLabel} zavorthControl`;
  if (surface === 'telegram') return `${profileLabel} ChatOps`;
  if (surface === 'api') return `${profileLabel} API projection`;
  return `${profileLabel} terminal`;
}

function subheadFor(surface: ExperienceSurface, health: ExperienceHealthStatus, pendingApprovals: number): string {
  if (pendingApprovals > 0) return `${pendingApprovals} approval(s) need a decision.`;
  if (health === 'ready') return isZavorthControlSurface(surface) ? 'Chat, timeline and evidence stay separated into focused tabs.'
    : 'Ready for a natural request.';
  return 'Zavorth will explain what is missing and offer the next safe repair.';
}

function placeholderFor(surface: ExperienceSurface, profileId: string | null): string {
  if (surface === 'telegram') return 'Send a short request or approval decision.';
  if (isZavorthControlSurface(surface)) return 'Ask Zavorth anything...';
  if (surface === 'api') return 'Send ExperienceCommand/v1 JSON.';
  return profileId ? `Ask as ${profileId}...` : 'Ask Zavorth...';
}

function isZavorthControlSurface(surface: ExperienceSurface): boolean {
  return String(surface) === 'web' || String(surface) === 'zavorthControl';
}

function isChatOpsSurface(surface: ExperienceSurface): boolean {
  return ['telegram', 'discord', 'slack', 'email'].includes(String(surface));
}
