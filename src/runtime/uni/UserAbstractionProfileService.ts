import type {
  UniversalIntentInput,
  UniversalIntentUserRole,
  UserAbstractionProfile,
} from './UniversalIntentContracts.js';

export class UserAbstractionProfileService {
  public resolve(input: UniversalIntentInput): UserAbstractionProfile {
    const role = this.normalizeRole(input.userRole);
    const wantsTechnicalDetails = this.wantsTechnicalDetails(input.text);
    if (role === 'operator') {
      return {
        role,
        detailLevel: 'technical',
        hideImplementationJargon: false,
        shouldExposeTechnicalDetails: true,
        summaryStyle: 'operator',
      };
    }
    if (role === 'builder' || wantsTechnicalDetails) {
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

  private wantsTechnicalDetails(text: string): boolean {
    const normalized = String(text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    return /\b(tecnico|tecnica|detalhes|debug|diagnostico|diagnosticar|verbose|explique o plano)\b/.test(normalized);
  }
}
