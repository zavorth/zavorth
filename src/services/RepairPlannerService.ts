import type {
  EngineeringAction,
  RepairProposal,
} from '../contracts/EngineeringCoreContract.js';
import { FailureClassifierService } from './FailureClassifierService.js';

type RepairPlannerServiceOptions = {
  failureClassifierService?: FailureClassifierService;
};

export class RepairPlannerService {
  private readonly failureClassifierService: FailureClassifierService;

  constructor(options: RepairPlannerServiceOptions = {}) {
    this.failureClassifierService = options.failureClassifierService || new FailureClassifierService();
  }

  public planFromFailure(input: { stderr?: string | null; command?: string | null }): RepairProposal {
    const classification = this.failureClassifierService.classify(input);
    const actions: EngineeringAction[] = [];

    switch (classification.kind) {
      case 'missing_dependency':
        actions.push(
          { kind: 'install_dependency', label: 'Instalar a dependencia faltante' },
          { kind: 'rerun_step', label: 'Reexecutar o passo original' },
        );
        return {
          kind: 'install_dependency',
          summary: 'Planejar instalacao da dependencia e repetir a etapa.',
          confidence: classification.confidence,
          actions,
        };
      case 'missing_toolchain':
      case 'missing_secret':
        actions.push({ kind: 'ask_user', label: 'Pedir a acao manual necessaria ao operador' });
        return {
          kind: classification.kind === 'missing_secret' ? 'provide_secret' : 'human_required',
          summary: classification.summary,
          confidence: classification.confidence,
          actions,
        };
      case 'typescript_error':
      case 'test_failure':
        actions.push(
          { kind: 'inspect_fs', label: 'Inspecionar os arquivos ligados a falha' },
          { kind: 'propose_patch', label: 'Propor um patch para corrigir a falha' },
          { kind: 'rerun_step', label: 'Validar a correcao com nova execucao' },
        );
        return {
          kind: 'propose_patch',
          summary: classification.summary,
          confidence: classification.confidence,
          actions,
        };
      case 'external_transient_error':
        actions.push(
          { kind: 'rerun_step', label: 'Repetir a etapa em uma nova tentativa' },
          { kind: 'ask_user', label: 'Avisar o operador se a falha persistir' },
        );
        return {
          kind: 'rerun_step',
          summary: classification.summary,
          confidence: classification.confidence,
          actions,
        };
      default:
        actions.push({ kind: 'ask_user', label: 'Pedir contexto adicional athe operator' });
        return {
          kind: 'human_required',
          summary: classification.summary,
          confidence: classification.confidence,
          actions,
        };
    }
  }
}
