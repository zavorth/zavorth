import type {
  CapabilityPackCatalogQuery,
  CapabilityPackCatalogSnapshot,
  CapabilityPackDefinition,
} from '../contracts/CapabilityPackCatalogContract.js';
import type { CapabilityImportManifest } from '../contracts/CapabilityImportContract.js';
import {
  ZavorthCapabilityPackCatalogService,
  type ZavorthCapabilityPackCatalogRuntime,
} from './ZavorthCapabilityPackCatalogService.js';

export class ZavorthCapabilityPackCatalogApiService {
  private readonly service: ZavorthCapabilityPackCatalogService;

  constructor(runtime: ZavorthCapabilityPackCatalogRuntime = {}) {
    this.service = new ZavorthCapabilityPackCatalogService(runtime);
  }

  public buildSnapshot(query: CapabilityPackCatalogQuery = {}): CapabilityPackCatalogSnapshot {
    return this.service.buildSnapshot(query);
  }

  public listPacks(query: CapabilityPackCatalogQuery = {}): CapabilityPackDefinition[] {
    return this.service.listPacks(query);
  }

  public getPack(id: string | null | undefined): CapabilityPackDefinition | null {
    return this.service.getPack(id);
  }

  public listManifests(query: CapabilityPackCatalogQuery = {}): CapabilityImportManifest[] {
    return this.service.listManifests(query);
  }

  public renderReport(query: CapabilityPackCatalogQuery = {}): string {
    return this.service.renderReport(query);
  }
}
