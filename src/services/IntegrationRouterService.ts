import type {
  IntegrationCapability,
  IntegrationCatalogEntry,
  IntegrationManifest,
} from '../contracts/IntegrationHubContract.js';
import { IntegrationHealthService } from './IntegrationHealthService.js';

import { IntegrationInstallerService } from './IntegrationInstallerService.js';
import { IntegrationRegistryService } from './IntegrationRegistryService.js';
import { VendorLicenseGuardService } from './VendorLicenseGuardService.js';
import { VendorReleaseIndexService } from './VendorReleaseIndexService.js';

type RouterRuntime = {
  registryService?: IntegrationRegistryService;
  installerService?: IntegrationInstallerService;
  healthService?: IntegrationHealthService;
  vendorReleaseIndexService?: Pick<VendorReleaseIndexService, 'getEntry'>;
  vendorLicenseGuardService?: Pick<VendorLicenseGuardService, 'getDecision'>;
};

export class IntegrationRouterService {
  private readonly registryService: IntegrationRegistryService;
  private readonly installerService: IntegrationInstallerService;
  private readonly healthService: IntegrationHealthService;
  private readonly vendorReleaseIndexService: Pick<VendorReleaseIndexService, 'getEntry'>;
  private readonly vendorLicenseGuardService: Pick<VendorLicenseGuardService, 'getDecision'>;

  constructor(runtime: RouterRuntime = {}) {
    this.registryService = runtime.registryService || new IntegrationRegistryService();
    this.installerService = runtime.installerService || new IntegrationInstallerService();
    this.healthService = runtime.healthService || new IntegrationHealthService();
    this.vendorReleaseIndexService = runtime.vendorReleaseIndexService || new VendorReleaseIndexService();
    this.vendorLicenseGuardService = runtime.vendorLicenseGuardService || new VendorLicenseGuardService();
  }

  public listCatalogEntries(): IntegrationCatalogEntry[] {
    return this.registryService.listManifests().map((manifest) => {
      const doctor = this.healthService.buildDoctorSnapshot(manifest.id);
      const installed = this.installerService.getInstalled(manifest.id);
      const vendorIndex = this.vendorReleaseIndexService.getEntry(manifest.id);
      const vendorLicense = vendorIndex
        ? this.vendorLicenseGuardService.getDecision(manifest.id)
        : null;
      return {
        manifest,
        installed,
        doctor,
        readiness: doctor.status === 'ok'
          ? 'ready'
          : installed ? 'needs_configuration'
            : 'planned',
        vendor: vendorIndex && vendorLicense
          ? {
            index: vendorIndex,
            license: vendorLicense,
          }
          : null,
      };
    });
  }

  public listByCapability(capability: IntegrationCapability): IntegrationCatalogEntry[] {
    return this.listCatalogEntries().filter((entry) => entry.manifest.capabilities.includes(capability));
  }

  public listReadyByCapability(capability: IntegrationCapability): IntegrationCatalogEntry[] {
    return this.listByCapability(capability).filter((entry) => entry.doctor.status === 'ok');
  }

  public getPreferredForCapability(capability: IntegrationCapability): IntegrationCatalogEntry | null {
    const ready = this.listReadyByCapability(capability);
    if (ready.length > 0) {
      return ready[0];
    }

    const fallback = this.listByCapability(capability).find((entry) => entry.manifest.supportLevel === 'native');
    return fallback || this.listByCapability(capability)[0] || null;
  }

  public buildCapabilityNotes(capability: IntegrationCapability): string[] {
    const preferred = this.getPreferredForCapability(capability);
    if (!preferred) {
      return [`No candidate integration appeared for capability ${capability}.`];
    }

    const notes = [`Best current candidate for ${capability}: ${preferred.manifest.label}.`];
    if (preferred.doctor.status !== 'ok') {
      notes.push(`Configuration still missing: ${preferred.doctor.nextAction.reason}`);
    } else {
      notes.push('It already seems ready to join the Zavorth routing.');
    }
    return notes;
  }
}
