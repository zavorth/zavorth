import type { VendorLicenseDecision } from '../contracts/VendorPlaneContract.js';
import {
  VendorReleaseContractService,
  type VendorReleaseContract,
} from './VendorReleaseContractService.js';

type VendorLicenseGuardRuntime = {
  contractService?: Pick<VendorReleaseContractService, 'readContracts' | 'getContract'>;
};

export class VendorLicenseGuardService {
  private readonly contractService: Pick<VendorReleaseContractService, 'readContracts' | 'getContract'>;

  constructor(runtime: VendorLicenseGuardRuntime = {}) {
    this.contractService = runtime.contractService || new VendorReleaseContractService();
  }

  public listDecisions(): VendorLicenseDecision[] {
    return this.contractService.readContracts().map((entry) => this.mapContract(entry));
  }

  public getDecision(vendorId: string | null | undefined): VendorLicenseDecision | null {
    const contract = this.contractService.getContract(vendorId);
    return contract ? this.mapContract(contract) : null;
  }

  private mapContract(contract: VendorReleaseContract): VendorLicenseDecision {
    const allowCoreCopy = contract.coreCopyPolicy === 'allow-with-attribution';
    return {
      vendorId: contract.id,
      displayName: contract.displayName,
      license: contract.license,
      releaseIsolation: contract.releaseIsolation,
      coreCopyPolicy: contract.coreCopyPolicy,
      reviewRequired: contract.reviewRequired,
      allowVendorSync: true,
      allowCoreCopy,
      rationale: contract.rationale,
      recommendedAction: contract.recommendedAction,
      summary: allowCoreCopy
        ? `${contract.displayName} pode ser sincronizado como vendor com atribuicao e trilha de versao.`
        : `${contract.displayName} deve permanecer isolado como vendor; ideias podem ser absorvidas, codigo do core nao.`,
    };
  }
}
