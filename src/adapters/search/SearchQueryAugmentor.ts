import type { SearchEvidenceDomain } from '../../contracts/core/SearchQueryContract.js';
import { getEvidenceDomainProfile } from '../../agents/EvidenceDomainProfiles.js';

export type AugmentationResult = {
  effectiveQuery: string;
  augmentationApplied: boolean;
  augmentationKind: string;
};

export function augmentSearchQuery(
  query: string,
  domain: SearchEvidenceDomain | 'auto' | null | undefined,
): AugmentationResult {
  const base = String(query || '').replace(/\s+/g, ' ').trim();
  if (!base) {
    return { effectiveQuery: base, augmentationApplied: false, augmentationKind: 'none' };
  }

  const effectiveDomain = (domain && domain !== 'auto' ? domain : null) as SearchEvidenceDomain | null;

  if (effectiveDomain === 'medical') {
    return {
      effectiveQuery: `${base} site:pubmed.ncbi.nlm.nih.gov`,
      augmentationApplied: true,
      augmentationKind: 'site:pubmed',
    };
  }

  if (effectiveDomain === 'scientific') {
    return {
      effectiveQuery: `${base} DOI arXiv PubMed SciELO`,
      augmentationApplied: true,
      augmentationKind: 'scientific-filters',
    };
  }

  if (effectiveDomain === 'consumer') {
    return {
      effectiveQuery: `${base} independent review benchmark comparison`,
      augmentationApplied: true,
      augmentationKind: 'consumer-filters',
    };
  }

  if (effectiveDomain === 'ai_news') {
    return {
      effectiveQuery: `${base} OpenAI Anthropic Google DeepMind Meta AI`,
      augmentationApplied: true,
      augmentationKind: 'ai-news-sources',
    };
  }

  if (effectiveDomain === 'legal') {
    return {
      effectiveQuery: `${base} case law court ruling judgment tribunal`,
      augmentationApplied: true,
      augmentationKind: 'legal-sources',
    };
  }

  const profile = effectiveDomain ? getEvidenceDomainProfile(effectiveDomain) : null;
  if (profile && profile.primarySearches.length > 0) {
    const firstTemplate = profile.primarySearches[0];
    const augmented = firstTemplate.replace('{query}', base);
    if (augmented && augmented !== base) {
      return {
        effectiveQuery: augmented,
        augmentationApplied: true,
        augmentationKind: `profile:${effectiveDomain}`,
      };
    }
  }

  return { effectiveQuery: base, augmentationApplied: false, augmentationKind: 'none' };
}
