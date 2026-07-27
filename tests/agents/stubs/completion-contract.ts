/**
 * Minimal stub for the removed src/agents/completion/completion-contract module.
 * Created so that the existing test suite can validate the contract engine
 * that was previously implemented in production code.
 */

export interface ContractEvidence {
  requirementId: string;
  data: {
    passed: boolean;
    type?: string;
    description?: string;
    timestamp?: string;
    data?: Record<string, unknown>;
  };
}

export interface ContractRequirement {
  type: string;
  description: string;
  required: boolean;
  check: () => Promise<{ passed: boolean; evidence?: ContractEvidence['data'] }>;
}

export interface Contract {
  id: string;
  requirements: ContractRequirement[];
  evidence: ContractEvidence[];
  status?: 'passed' | 'failed';
}

export interface ContractResult {
  status: 'passed' | 'failed';
}

export class CompletionContractEngine {
  createContract(id: string, requirements: ContractRequirement[]): Contract {
    return {
      id,
      requirements,
      evidence: [],
    };
  }

  async verifyContract(contract: Contract): Promise<ContractResult> {
    contract.evidence = [];
    const results: boolean[] = [];

    for (let i = 0; i < contract.requirements.length; i++) {
      const req = contract.requirements[i];
      const result = await req.check();
      results.push(result.passed);

      if (result.evidence) {
        contract.evidence.push({
          requirementId: `${contract.id}:${i + 1}`,
          data: {
            passed: result.passed,
            ...result.evidence,
          },
        });
      }
    }

    const allPassed = results.every(Boolean);
    contract.status = allPassed ? 'passed' : 'failed';
    return { status: contract.status };
  }

  getContractStatus(contract: Contract): string {
    return contract.status ?? 'pending';
  }
}
