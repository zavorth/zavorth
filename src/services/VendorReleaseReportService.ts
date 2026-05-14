import {
  VendorReleaseIndexService,
} from './VendorReleaseIndexService.js';
import type { VendorReleaseIndexSnapshot } from '../contracts/VendorPlaneContract.js';

export type VendorReleaseReportSnapshot = {
  generatedAt: string;
  vendorIndex: VendorReleaseIndexSnapshot;
  summary: {
    total: number;
    updateAvailable: number;
    live: number;
    ready: number;
    reviewRequired: number;
    isolatedVendors: number;
  };
  narrative: {
    headline: string;
    operatorSummary: string;
  };
};

type VendorReleaseReportRuntime = {
  now?: () => Date;
  vendorReleaseIndexService?: Pick<VendorReleaseIndexService, 'buildSnapshot'>;
};

export class VendorReleaseReportService {
  private readonly now: () => Date;
  private readonly vendorReleaseIndexService: Pick<VendorReleaseIndexService, 'buildSnapshot'>;

  constructor(runtime: VendorReleaseReportRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.vendorReleaseIndexService = runtime.vendorReleaseIndexService || new VendorReleaseIndexService();
  }

  public buildSnapshot(): VendorReleaseReportSnapshot {
    const vendorIndex = this.vendorReleaseIndexService.buildSnapshot();
    const isolatedVendors = vendorIndex.entries.filter((entry) =>
      entry.licenseDecision.releaseIsolation === 'vendor-isolated').length;

    return {
      generatedAt: this.now().toISOString(),
      vendorIndex,
      summary: {
        total: vendorIndex.summary.total,
        updateAvailable: vendorIndex.summary.updateAvailable,
        live: vendorIndex.summary.live,
        ready: vendorIndex.summary.ready,
        reviewRequired: vendorIndex.summary.reviewRequired,
        isolatedVendors,
      },
      narrative: {
        headline: 'Release snapshot do vendor plane do Zavorth',
        operatorSummary: `${vendorIndex.summary.total} vendor(s), ${vendorIndex.summary.updateAvailable} update(s) pendente(s), `
          + `${vendorIndex.summary.live} sidecar(s) ativo(s) e ${isolatedVendors} vendor(s) isolado(s) por licenca.`,
      },
    };
  }

  public renderMarkdown(): string {
    const snapshot = this.buildSnapshot();
    const lines = [
      '# Zavorth Vendor Release Report',
      '',
      `Generated at: ${snapshot.generatedAt}`,
      '',
      snapshot.narrative.headline,
      snapshot.narrative.operatorSummary,
      '',
      '## Summary',
      '',
      `- Vendors: ${snapshot.summary.total}`,
      `- Updates available: ${snapshot.summary.updateAvailable}`,
      `- Live sidecars: ${snapshot.summary.live}`,
      `- Ready sidecars: ${snapshot.summary.ready}`,
      `- Review required: ${snapshot.summary.reviewRequired}`,
      `- Isolated vendors: ${snapshot.summary.isolatedVendors}`,
      '',
      '## Entries',
    ];

    for (const entry of snapshot.vendorIndex.entries) {
      lines.push(
        '',
        `### ${entry.displayName}`,
        '',
        `- Status: ${entry.status}`,
        `- License: ${entry.license}`,
        `- Integration mode: ${entry.integrationMode}`,
        `- Update available: ${entry.updateAvailable ? 'yes' : 'no'}`,
        `- Live/ready: ${entry.live ? 'live' : 'offline'} / ${entry.ready ? 'ready' : 'not-ready'}`,
        `- Release isolation: ${entry.licenseDecision.releaseIsolation}`,
        `- Core copy policy: ${entry.licenseDecision.coreCopyPolicy}`,
        `- Summary: ${entry.diff.summary}`,
        `- Recommended action: ${entry.licenseDecision.recommendedAction}`,
      );
    }

    return lines.join('\n');
  }
}
