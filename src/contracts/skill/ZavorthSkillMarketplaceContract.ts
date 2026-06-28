export const ZAVORTH_SKILL_MARKETPLACE_CONTRACT_VERSION = '2026-06-22.zavorth.skill-marketplace.v1' as const;

export type ZavorthMarketplaceSkillEntry = {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  license: string;
  category: string;
  tags: string[];
  downloads: number;
  rating: number;
  updatedAt: string;
  sourceUrl: string | null;
  skillPath: string;
};

export type ZavorthMarketplaceCategory = {
  id: string;
  label: string;
  description: string;
  skillCount: number;
};

export type ZavorthMarketplaceSortMode = 'popular' | 'recent' | 'rating';

export type ZavorthMarketplaceSearchInput = {
  query?: string;
  category?: string;
  tags?: string[];
  sort?: ZavorthMarketplaceSortMode;
  limit?: number;
};

export type ZavorthMarketplaceSearchResult = {
  entries: ZavorthMarketplaceSkillEntry[];
  total: number;
  page: number;
  pageSize: number;
};

export type ZavorthMarketplaceInstallInput = {
  skillId: string;
  approvalId?: string;
};

export type ZavorthMarketplaceInstallResult = {
  installed: boolean;
  skillPath: string;
  warnings: string[];
};

export type ZavorthMarketplaceStats = {
  totalSkills: number;
  totalCategories: number;
  totalDownloads: number;
  averageRating: number;
  lastUpdated: string;
};

export type ZavorthMarketplaceIndexCategory = {
  id: string;
  label: string;
  description: string;
  skillCount: number;
};

export type ZavorthMarketplaceIndexDocument = {
  schemaVersion: string;
  categories: ZavorthMarketplaceIndexCategory[];
  remoteRegistry: string | null;
};

export type ZavorthMarketplaceRemoteTrustLevel = 'official' | 'verified-publisher' | 'community';

export type ZavorthMarketplaceRemoteSkillEntry = ZavorthMarketplaceSkillEntry & {
  publisherId: string;
  trustLevel: ZavorthMarketplaceRemoteTrustLevel;
  packageHash: string;
  signature: string;
};

export type ZavorthMarketplaceRemoteRegistryDocument = {
  schemaVersion: 'zavorth.marketplace-remote-registry/v1';
  generatedAt: string;
  entries: ZavorthMarketplaceRemoteSkillEntry[];
  revokedVersions?: Array<{
    skillId: string;
    version: string;
    reason: string;
  }>;
};

export type ZavorthMarketplaceRemoteRegistryVerification = {
  trusted: boolean;
  totalEntries: number;
  trustedEntries: number;
  blockedEntries: number;
  issues: Array<{
    skillId: string;
    severity: 'error' | 'warn';
    code: 'untrusted-publisher' | 'unsigned' | 'invalid-signature' | 'invalid-hash' | 'insecure-source-url' | 'revoked-version';
    message: string;
  }>;
};
