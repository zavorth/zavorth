import type {
  CapabilityHubItem,
  CapabilityHubItemKind,
  CapabilityHubQuery,
  CapabilityHubReadiness,
  CapabilityHubSnapshot,
} from '../contracts/CapabilityHubContract.js';
import {
  ZavorthCapabilityHubService,
  type ZavorthCapabilityHubRuntime,
} from './ZavorthCapabilityHubService.js';

export type CapabilityHubApiListInput = {
  search?: string | null;
  kind?: CapabilityHubItemKind | null;
  readiness?: CapabilityHubReadiness | null;
  selectedId?: string | null;
};

export type CapabilityHubApiInspectResult = {
  found: boolean;
  item: CapabilityHubItem | null;
  related: CapabilityHubItem[];
};

export class ZavorthCapabilityHubApiService {
  private readonly hubService: ZavorthCapabilityHubService;

  constructor(runtime: ZavorthCapabilityHubRuntime = {}) {
    this.hubService = new ZavorthCapabilityHubService(runtime);
  }

  public buildSnapshot(input: CapabilityHubApiListInput = {}): CapabilityHubSnapshot {
    return this.hubService.buildSnapshot(this.toQuery(input));
  }

  public list(input: CapabilityHubApiListInput = {}): CapabilityHubItem[] {
    return this.hubService.listItems(this.toQuery(input));
  }

  public inspect(id: string): CapabilityHubApiInspectResult {
    const item = this.hubService.getItem(id);
    if (!item) {
      return {
        found: false,
        item: null,
        related: [],
      };
    }

    const related = this.hubService
      .listItems({ includeItems: true })
      .filter((candidate) => candidate.id !== item.id)
      .filter((candidate) =>
        candidate.kind === item.kind
        || candidate.tags.some((tag) => item.tags.includes(tag)))
      .slice(0, 6);

    return {
      found: true,
      item,
      related,
    };
  }

  public renderReport(input: CapabilityHubApiListInput = {}): string {
    return this.hubService.renderReport(this.toQuery(input));
  }

  private toQuery(input: CapabilityHubApiListInput): CapabilityHubQuery {
    return {
      query: input.search || null,
      kind: input.kind || null,
      readiness: input.readiness || null,
      selectedId: input.selectedId || null,
    };
  }
}
