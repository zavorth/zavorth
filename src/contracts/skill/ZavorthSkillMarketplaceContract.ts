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
