import type {
  CapabilityHubItem,
  CapabilityHubReadiness,
} from './CapabilityHubContract.js';

export const ZAVORTH_CAPABILITY_STORE_CONTRACT_VERSION = '2026-05-15.experience-layer.checkpoint-4' as const;

export type ZavorthCapabilityStoreCategoryId =
  | 'communication'
  | 'productivity'
  | 'development'
  | 'daily-life'
  | 'automation'
  | 'security'
  | 'providers'
  | 'local-runtime';

export type ZavorthCapabilityStoreActionKind =
  | 'use_now'
  | 'setup_guide'
  | 'test_readiness'
  | 'view_requirements'
  | 'request_approval'
  | 'blocked';

export type ZavorthCapabilityStoreCard = {
  id: string;
  sourceCapabilityId: string;
  title: string;
  category: ZavorthCapabilityStoreCategoryId;
  summary: string;
  readiness: CapabilityHubReadiness;
  friendlyStatus: 'available' | 'needs_setup' | 'needs_test' | 'planned' | 'blocked';
  risk: string;
  approvalRequired: boolean;
  setupGuided: boolean;
  requirementsSummary: string[];
  primaryAction: {
    kind: ZavorthCapabilityStoreActionKind;
    label: string;
    command: string;
    mutatesState: boolean;
  };
  tags: string[];
};

export type ZavorthCapabilityStoreContract = {
  contractVersion: typeof ZAVORTH_CAPABILITY_STORE_CONTRACT_VERSION;
  schemaVersion: 1;
  surface: 'capability-store';
  selectedCategory: ZavorthCapabilityStoreCategoryId | null;
  query: string | null;
  summary: {
    total: number;
    visible: number;
    available: number;
    needsSetup: number;
    needsTest: number;
    planned: number;
    blocked: number;
  };
  categories: Array<{
    id: ZavorthCapabilityStoreCategoryId;
    title: string;
    count: number;
    available: number;
    needsSetup: number;
  }>;
  featured: ZavorthCapabilityStoreCard[];
  cards: ZavorthCapabilityStoreCard[];
  selected: ZavorthCapabilityStoreCard | null;
  source: {
    hubContractVersion: string;
    hubItemsUsed: number;
    commandCenterRoute: '/dashboard';
    executionAuthority: false;
  };
  safety: {
    storeDoesNotInstallByItself: true;
    rawSecretsSerialized: false;
    liveUseRequiresPolicyBroker: true;
    externalActionsRequireApproval: true;
  };
  invariants: string[];
};

export type ZavorthCapabilityStoreSourceItem = Pick<
  CapabilityHubItem,
  | 'id'
  | 'kind'
  | 'label'
  | 'summary'
  | 'description'
  | 'tags'
  | 'readiness'
  | 'requirements'
  | 'governance'
  | 'activation'
>;
