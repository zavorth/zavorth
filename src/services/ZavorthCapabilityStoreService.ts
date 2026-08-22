import type {
  CapabilityHubReadiness,
} from '../contracts/CapabilityHubContract.js';
import {
  ZAVORTH_CAPABILITY_STORE_CONTRACT_VERSION,
  type ZavorthCapabilityStoreCard,
  type ZavorthCapabilityStoreCategoryId,
  type ZavorthCapabilityStoreContract,
  type ZavorthCapabilityStoreSourceItem,
} from '../contracts/ZavorthCapabilityStoreContract.js';
import {
  ZavorthCapabilityHubApiService,
  type CapabilityHubApiListInput,
} from './ZavorthCapabilityHubApiService.js';


export type ZavorthCapabilityStoreInput = {
  query?: unknown;
  category?: unknown;
  selectedId?: unknown;
};

export type ZavorthCapabilityStoreRuntime = {
  hub?: Pick<ZavorthCapabilityHubApiService, 'buildSnapshot'>;
};

const CATEGORY_LABELS: Record<ZavorthCapabilityStoreCategoryId, string> = {
  communication: 'Communication',
  productivity: 'Productivity',
  development: 'Development',
  'daily-life': 'Daily life',
  automation: 'Automation',
  security: 'Security',
  providers: 'Model providers',
  'local-runtime': 'local runtime',
};

export class ZavorthCapabilityStoreService {
  private readonly hub: Pick<ZavorthCapabilityHubApiService, 'buildSnapshot'>;

  constructor(runtime: ZavorthCapabilityStoreRuntime = {}) {
    this.hub = runtime.hub || new ZavorthCapabilityHubApiService();
  }

  public buildContract(input: ZavorthCapabilityStoreInput = {}): ZavorthCapabilityStoreContract {
    const category = normalizeCategory(input.category);
    const query = clean(input.query);
    const hubSnapshot = this.hub.buildSnapshot({
      search: query,
      selectedId: clean(input.selectedId) || null,
    } satisfies CapabilityHubApiListInput);
    const allCards = hubSnapshot.items.map((item) => this.toCard(item));
    const visible = allCards.filter((card) => !category || card.category === category);
    const selectedId = clean(input.selectedId);
    const selected = selectedId
      ? allCards.find((card) => card.id === selectedId || card.sourceCapabilityId === selectedId) || null
      : null;

    return {
      contractVersion: ZAVORTH_CAPABILITY_STORE_CONTRACT_VERSION,
      schemaVersion: 1,
      surface: 'capability-store',
      selectedCategory: category,
      query,
      summary: buildSummary(visible),
      categories: buildCategories(allCards),
      featured: this.pickFeatured(visible),
      cards: visible,
      selected,
      source: {
        hubContractVersion: hubSnapshot.contractVersion,
        hubItemsUsed: hubSnapshot.items.length,
        zavorthControlRoute: '/zavorthControl',
        executionAuthority: false,
      },
      safety: {
        storeDoesNotInstallByItself: true,
        rawSecretsSerialized: false,
        liveUseRequiresPolicyBroker: true,
        externalActionsRequireApproval: true,
      },
      invariants: [
        'Capability Store is a human-facing projection over Capability Hub, Provider Mesh, Channel Mesh, skills and runtime capabilities.',
        'Cards may guide setup or readiness tests, but they do not install, send, write or execute by themselves.',
        'Ready means evidence from the underlying hub; partial/planned/blocked states stay visible and honest.',
        'Tokens and API keys are represented as SecretRefs or requirements, never serialized in cards.',
      ],
    };
  }

  public renderText(contract: ZavorthCapabilityStoreContract): string {
    return [
      '[zavorth-capability-store]',
      `visible=${contract.summary.visible}/${contract.summary.total} available=${contract.summary.available} setup=${contract.summary.needsSetup} test=${contract.summary.needsTest} blocked=${contract.summary.blocked}`,
      `category=${contract.selectedCategory || 'all'} query=${contract.query || 'none'}`,
      '',
      '[categories]',
      ...contract.categories.map((category) =>
        `- ${category.id}: ${category.count} total | available=${category.available} | setup=${category.needsSetup}`,
      ),
      '',
      '[featured]',
      ...contract.featured.map((card) =>
        `- ${card.id}: ${card.title} | ${card.friendlyStatus} | action=${card.primaryAction.label}`,
      ),
      contract.selected ? ['', '[selected]', `${contract.selected.title}: ${contract.selected.summary}`, `requirements: ${contract.selected.requirementsSummary.join('; ') || 'none'}`].join('\n') : '',
      '',
    ].filter(Boolean).join('\n');
  }

  private toCard(item: ZavorthCapabilityStoreSourceItem): ZavorthCapabilityStoreCard {
    const category = categorize(item);
    const friendlyStatus = readinessToFriendlyStatus(item.readiness);
    return {
      id: item.id.replace(/:/g, '-'),
      sourceCapabilityId: item.id,
      title: item.label,
      category,
      summary: item.summary || item.description,
      readiness: item.readiness,
      friendlyStatus,
      risk: item.governance.risk,
      approvalRequired: item.governance.requiresApproval,
      setupGuided: item.activation.setupGuided,
      requirementsSummary: summarizeRequirements(item),
      primaryAction: buildPrimaryAction(item, friendlyStatus),
      tags: item.tags,
    };
  }

  private pickFeatured(cards: ZavorthCapabilityStoreCard[]): ZavorthCapabilityStoreCard[] {
    return [
      ...cards.filter((card) => card.friendlyStatus === 'available'),
      ...cards.filter((card) => card.friendlyStatus === 'needs_setup'),
      ...cards.filter((card) => card.friendlyStatus === 'needs_test'),
      ...cards,
    ].filter((card, index, all) => all.findIndex((candidate) => candidate.id === card.id) === index)
      .slice(0, 8);
  }
}

function categorize(item: ZavorthCapabilityStoreSourceItem): ZavorthCapabilityStoreCategoryId {
  if (item.kind === 'provider') {
    return 'providers';
  }
  if (item.kind === 'channel') {
    return 'communication';
  }
  if (item.kind === 'runtime-capability' || item.kind === 'mcp') {
    return 'local-runtime';
  }
  return 'daily-life';
}

function readinessToFriendlyStatus(readiness: CapabilityHubReadiness): ZavorthCapabilityStoreCard['friendlyStatus'] {
  if (readiness === 'ready') {
    return 'available';
  }
  if (readiness === 'needs_configuration' || readiness === 'partial') {
    return 'needs_setup';
  }
  if (readiness === 'needs_probe') {
    return 'needs_test';
  }
  if (readiness === 'planned' || readiness === 'disabled') {
    return 'planned';
  }
  return 'blocked';
}

function buildPrimaryAction(
  item: ZavorthCapabilityStoreSourceItem,
  friendlyStatus: ZavorthCapabilityStoreCard['friendlyStatus'],
): ZavorthCapabilityStoreCard['primaryAction'] {
  if (friendlyStatus === 'available') {
    return {
      kind: item.governance.requiresApproval ? 'request_approval' : 'use_now',
      label: item.governance.requiresApproval ? 'Review approval' : 'Use now',
      command: `zavorth capability inspect ${item.id}`,
      mutatesState: false,
    };
  }
  if (friendlyStatus === 'needs_setup') {
    return {
      kind: 'setup_guide',
      label: 'Open setup guide',
      command: `zavorth capability-store --select ${item.id}`,
      mutatesState: false,
    };
  }
  if (friendlyStatus === 'needs_test') {
    return {
      kind: 'test_readiness',
      label: 'Test readiness',
      command: `zavorth capability-store --select ${item.id}`,
      mutatesState: false,
    };
  }
  if (friendlyStatus === 'planned') {
    return {
      kind: 'view_requirements',
      label: 'View requirements',
      command: `zavorth capability-store --select ${item.id}`,
      mutatesState: false,
    };
  }
  return {
    kind: 'blocked',
    label: 'Blocked',
    command: `zavorth capability-store --select ${item.id}`,
    mutatesState: false,
  };
}

function summarizeRequirements(item: ZavorthCapabilityStoreSourceItem): string[] {
  return [
    ...item.requirements.secretRefs.map((entry) => `SecretRef: ${entry}`),
    ...item.requirements.envKeys.map((entry) => `Env: ${entry}`),
    ...item.requirements.accounts.map((entry) => `Account: ${entry}`),
    ...item.requirements.binaries.map((entry) => `Binary: ${entry}`),
    ...item.requirements.manualSteps,
  ].filter(Boolean).slice(0, 6);
}

function buildSummary(cards: ZavorthCapabilityStoreCard[]): ZavorthCapabilityStoreContract['summary'] {
  return {
    total: cards.length,
    visible: cards.length,
    available: cards.filter((card) => card.friendlyStatus === 'available').length,
    needsSetup: cards.filter((card) => card.friendlyStatus === 'needs_setup').length,
    needsTest: cards.filter((card) => card.friendlyStatus === 'needs_test').length,
    planned: cards.filter((card) => card.friendlyStatus === 'planned').length,
    blocked: cards.filter((card) => card.friendlyStatus === 'blocked').length,
  };
}

function buildCategories(cards: ZavorthCapabilityStoreCard[]): ZavorthCapabilityStoreContract['categories'] {
  const categories = Object.keys(CATEGORY_LABELS) as ZavorthCapabilityStoreCategoryId[];
  return categories.map((id) => {
    const scoped = cards.filter((card) => card.category === id);
    return {
      id,
      title: CATEGORY_LABELS[id],
      count: scoped.length,
      available: scoped.filter((card) => card.friendlyStatus === 'available').length,
      needsSetup: scoped.filter((card) => card.friendlyStatus === 'needs_setup').length,
    };
  }).filter((category) => category.count > 0);
}

function normalizeCategory(value: unknown): ZavorthCapabilityStoreCategoryId | null {
  const normalized = clean(value);
  if (!normalized) {
    return null;
  }
  const id = normalized.toLowerCase() as ZavorthCapabilityStoreCategoryId;
  return Object.prototype.hasOwnProperty.call(CATEGORY_LABELS, id) ? id : null;
}

function clean(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text ? text : null;
}
