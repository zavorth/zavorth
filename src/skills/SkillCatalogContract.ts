import type {
  SkillSourceIngestionMode,
  SkillSourceKind,
  SkillSourceTrust,
} from '../services/SkillSourceRegistryService.js';

export type SkillSupportFileKind = 'root' | 'reference' | 'step' | 'example' | 'agent' | 'external';
export type SkillImportMode = SkillSourceIngestionMode | 'imported-copy' | 'unknown';
export type SkillRiskLevel = 'low' | 'medium' | 'high' | 'blocked';
export type SkillLicensePolicyLabel =
  | 'permissive'
  | 'attribution'
  | 'reciprocal'
  | 'review'
  | 'restricted'
  | 'unknown';

export type SkillSupportFile = {
  path: string;
  displayPath?: string;
  relativePath: string;
  kind: SkillSupportFileKind;
  external: boolean;
};

export type SkillRiskAssessment = {
  score: number;
  level: SkillRiskLevel;
  reviewRequired: boolean;
  reasons: string[];
};

export type SkillLicensePolicyDecision = {
  label: SkillLicensePolicyLabel;
  allowImport: boolean;
  allowRuntimeUse: boolean;
  allowCoreCopy: boolean;
  reviewRequired: boolean;
  summary: string;
};

export type SkillImportAuditReference = {
  lastEventId: string | null;
  trailFilePath: string | null;
  lastAction: 'preview' | 'import' | null;
  lastRecordedAt: string | null;
};

export type SkillOriginDocument = {
  version: number;
  importedAt: string | null;
  importMode: SkillSourceIngestionMode | 'manual';
  skillName: string;
  source: {
    id: string;
    label: string;
    kind: SkillSourceKind;
    trust: SkillSourceTrust;
    registrySource: string | null;
    upstream: string | null;
    pinnedRevision?: string | null;
    license: string | null;
    ownership: string | null;
  };
  originalSkillPath: string | null;
  originalRelativePath: string | null;
  copiedFiles: string[];
  governance?: {
    risk: SkillRiskAssessment | null;
    licensePolicy: SkillLicensePolicyDecision | null;
    audit: SkillImportAuditReference | null;
  } | null;
};

export type SkillProvenanceMetadata = {
  sourceId: string | null;
  sourceLabel: string | null;
  sourceKind: SkillSourceKind | null;
  sourceTrust: SkillSourceTrust | null;
  registrySource: string | null;
  ownership: string | null;
  license: string | null;
  importMode: SkillImportMode;
  imported: boolean;
  importedAt: string | null;
  originDocumentPath: string | null;
  attributionFilePath: string | null;
  upstreamSourceId: string | null;
  upstreamSourceLabel: string | null;
  upstreamSourceKind: SkillSourceKind | null;
  upstreamSourceTrust: SkillSourceTrust | null;
  upstreamRegistrySource: string | null;
  upstreamRepository: string | null;
  upstreamLicense: string | null;
  upstreamSkillPath: string | null;
  upstreamRelativePath: string | null;
  risk?: SkillRiskAssessment | null;
  licensePolicy?: SkillLicensePolicyDecision | null;
  audit?: SkillImportAuditReference | null;
};

export interface SkillMetadata {
  name: string;
  description: string;
  dirPath: string;
  displayDirPath?: string;
  skillFilePath: string;
  displaySkillFilePath?: string;
  supportFilePaths: string[];
  displaySupportFilePaths?: string[];
  supportFiles?: SkillSupportFile[];
  sourceId?: string;
  sourceLabel?: string;
  sourceKind?: string;
  sourceTrust?: SkillSourceTrust;
  sourceRegistrySource?: string | null;
  license?: string | null;
  bundleTags?: string[];
  provenance?: SkillProvenanceMetadata | null;
  risk?: SkillRiskAssessment | null;
  licensePolicy?: SkillLicensePolicyDecision | null;
  audit?: SkillImportAuditReference | null;
}

export type SkillCatalogEntry = {
  id: string;
  name: string;
  description: string;
  sourceId: string | null;
  sourceLabel: string | null;
  sourceTrust: SkillSourceTrust | null;
  license: string | null;
  imported: boolean;
  bundleTags: string[];
  supportFileCount: number;
  dirPath: string;
  skillFilePath: string;
  searchText: string;
  provenance: SkillProvenanceMetadata | null;
  risk: SkillRiskAssessment | null;
  licensePolicy: SkillLicensePolicyDecision | null;
  audit: SkillImportAuditReference | null;
  metadata: SkillMetadata;
};

export type SkillCatalogBundle = {
  tag: string;
  skillCount: number;
  skillNames: string[];
};

export type SkillCatalogSnapshot = {
  generatedAt: string;
  summary: {
    total: number;
    local: number;
    imported: number;
    trusted: number;
    review: number;
    blocked: number;
    withSupportFiles: number;
    bundled: number;
  };
  bundles: SkillCatalogBundle[];
  entries: SkillCatalogEntry[];
};
