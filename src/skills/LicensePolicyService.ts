import type {
  SkillLicensePolicyDecision,
  SkillLicensePolicyLabel,
} from './SkillCatalogContract.js';

export type SkillLicenseClassificationInput = {
  license: string | null;
  confidence: 'high' | 'medium' | 'low';
  evidence?: string[];
};

const PERMISSIVE_PATTERNS = [
  /^mit$/i,
  /^apache(?:-|\s*)2(?:\.0)...$/i,
  /^bsd(?:[-\s].*)...$/i,
  /^isc$/i,
  /^unlicense$/i,
];
const ATTRIBUTION_PATTERNS = [
  /^cc[\s-]*by(?:[\s-]*4(?:\.0)...)...$/i,
  /creative commons attribution/i,
];
const RECIPROCAL_PATTERNS = [
  /^agpl/i,
  /^gpl/i,
  /^lgpl/i,
  /^mpl/i,
  /^sspl/i,
];
const RESTRICTED_PATTERNS = [
  /all rights reserved/i,
  /no redistribution/i,
  /proprietary/i,
  /commercial use only/i,
];

export class LicensePolicyService {
  public evaluateClassification(input: SkillLicenseClassificationInput): SkillLicensePolicyDecision {
    const normalizedLicense = String(input.license || '').trim();
    const confidence = input.confidence || 'low';
    const evidenceSuffix = this.buildEvidenceSuffix(input.evidence);

    if (!normalizedLicense) {
      return {
        label: 'unknown',
        allowImport: true,
        allowRuntimeUse: true,
        allowCoreCopy: false,
        reviewRequired: true,
        summary: `License not identified; manual review required.${evidenceSuffix}`,
      };
    }

    if (normalizedLicense.toLowerCase() === 'mixed') {
      return {
        label: 'review',
        allowImport: true,
        allowRuntimeUse: true,
        allowCoreCopy: false,
        reviewRequired: true,
        summary: `Source classified as "mixed"; import is allowed only with review and attribution.${evidenceSuffix}`,
      };
    }

    if (RESTRICTED_PATTERNS.some((pattern) => pattern.test(normalizedLicense))) {
      return {
        label: 'restricted',
        allowImport: false,
        allowRuntimeUse: false,
        allowCoreCopy: false,
        reviewRequired: true,
        summary: `License ${normalizedLicense} restricts redistribution or runtime use.${evidenceSuffix}`,
      };
    }

    const mappedLabel = this.resolveLabel(normalizedLicense);
    const baseDecision = this.buildBaseDecision(mappedLabel, normalizedLicense, evidenceSuffix);

    if (confidence === 'high') {
      return baseDecision;
    }

    return {
      ...baseDecision,
      reviewRequired: true,
      summary: `${baseDecision.summary} Confidence ${confidence} requires additional review.`,
    };
  }

  private resolveLabel(license: string): SkillLicensePolicyLabel {
    if (PERMISSIVE_PATTERNS.some((pattern) => pattern.test(license))) {
      return 'permissive';
    }
    if (ATTRIBUTION_PATTERNS.some((pattern) => pattern.test(license))) {
      return 'attribution';
    }
    if (RECIPROCAL_PATTERNS.some((pattern) => pattern.test(license))) {
      return 'reciprocal';
    }
    return 'review';
  }

  private buildBaseDecision(
    label: SkillLicensePolicyLabel,
    license: string,
    evidenceSuffix: string,
  ): SkillLicensePolicyDecision {
    switch (label) {
      case 'permissive':
        return {
          label,
          allowImport: true,
          allowRuntimeUse: true,
          allowCoreCopy: true,
          reviewRequired: false,
          summary: `License ${license} is considered permissive for import and runtime use.${evidenceSuffix}`,
        };
      case 'attribution':
        return {
          label,
          allowImport: true,
          allowRuntimeUse: true,
          allowCoreCopy: false,
          reviewRequired: true,
          summary: `License ${license} requires attribution; import is allowed with review.${evidenceSuffix}`,
        };
      case 'reciprocal':
        return {
          label,
          allowImport: true,
          allowRuntimeUse: true,
          allowCoreCopy: false,
          reviewRequired: true,
          summary: `License ${license} is reciprocal; import is allowed, but Zavorth core must not copy code directly.${evidenceSuffix}`,
        };
      case 'review':
        return {
          label,
          allowImport: true,
          allowRuntimeUse: true,
          allowCoreCopy: false,
          reviewRequired: true,
          summary: `License ${license} is not mapped as permissive; keep the import under review.${evidenceSuffix}`,
        };
      case 'restricted':
      case 'unknown':
      default:
        return {
          label: label === 'unknown' ? 'unknown' : 'restricted',
          allowImport: false,
          allowRuntimeUse: false,
          allowCoreCopy: false,
          reviewRequired: true,
          summary: `License ${license || 'unknown'} blocked by policy.${evidenceSuffix}`,
        };
    }
  }

  private buildEvidenceSuffix(evidence: string[] | undefined): string {
    const normalized = Array.isArray(evidence)
      ? evidence.map((entry) => String(entry || '').trim()).filter(Boolean)
      : [];
    if (normalized.length === 0) {
      return '';
    }
    return ` Evidence: ${normalized.join(', ')}.`;
  }
}
