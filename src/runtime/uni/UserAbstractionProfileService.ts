import type {
  UniversalIntentInput,
  UniversalIntentUserRole,
  UserAbstractionProfile,
} from './UniversalIntentContracts.js';

export class UserAbstractionProfileService {
  public resolve(input: UniversalIntentInput): UserAbstractionProfile {
    // Structured userRole only — free-text never flips technical detail product surface.
    const role = this.normalizeRole(input.userRole);
    if (role === 'operator') {
      return {
        role,
        detailLevel: 'technical',
        hideImplementationJargon: false,
        shouldExposeTechnicalDetails: true,
        summaryStyle: 'operator',
      };
    }
    if (role === 'builder') {
      return {
        role,
        detailLevel: 'balanced',
        hideImplementationJargon: false,
        shouldExposeTechnicalDetails: true,
        summaryStyle: 'simple',
      };
    }
    return {
      role,
      detailLevel: 'plain',
      hideImplementationJargon: true,
      shouldExposeTechnicalDetails: false,
      summaryStyle: 'simple',
    };
  }

  private normalizeRole(role: UniversalIntentUserRole | null | undefined): UniversalIntentUserRole {
    const normalized = String(role || '').trim();
    return normalized || 'common';
  }
}
