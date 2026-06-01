import type {
  IntegrationActionPlan,
  IntegrationDoctorSnapshot,
  IntegrationGuidedAction,
  IntegrationManifest,
} from '../../../../contracts/IntegrationHubContract.js';
import type { IntegrationHealthService } from '../../../../services/IntegrationHealthService.js';
import type { IntegrationActionRecipeService } from './IntegrationActionRecipeService.js';
import type { IntegrationActionRuntimeBindingSupport } from './IntegrationActionRuntimeBindingSupport.js';

type IntegrationActionPlanBuilderRuntime = {
  now: () => Date;
  healthService: Pick<IntegrationHealthService, 'buildDoctorSnapshot'>;
  recipeService: Pick<IntegrationActionRecipeService, 'buildRecipeActions' | 'createActionFromCommand' | 'createActionFromStep'>;
  runtimeBindingSupport: Pick<IntegrationActionRuntimeBindingSupport, 'getRepairableRequirements'>;
};

export class IntegrationActionPlanBuilder {
  private readonly now: () => Date;
  private readonly healthService: Pick<IntegrationHealthService, 'buildDoctorSnapshot'>;
  private readonly recipeService: Pick<IntegrationActionRecipeService, 'buildRecipeActions' | 'createActionFromCommand' | 'createActionFromStep'>;
  private readonly runtimeBindingSupport: Pick<IntegrationActionRuntimeBindingSupport, 'getRepairableRequirements'>;

  constructor(runtime: IntegrationActionPlanBuilderRuntime) {
    this.now = runtime.now;
    this.healthService = runtime.healthService;
    this.recipeService = runtime.recipeService;
    this.runtimeBindingSupport = runtime.runtimeBindingSupport;
  }

  public buildActionPlan(manifest: IntegrationManifest): IntegrationActionPlan {
    const doctor = this.healthService.buildDoctorSnapshot(manifest.id);
    const actions = this.buildGuidedActions(manifest, doctor);
    const primary =
      actions.find((entry) => entry.severity === 'primary' && entry.executable)
      || actions.find((entry) => entry.severity === 'primary')
      || actions.find((entry) => entry.executable)
      || actions[0]
      || null;

    return {
      generatedAt: this.now().toISOString(),
      integrationId: manifest.id,
      primaryActionId: primary?.id || null,
      actions,
    };
  }

  private buildGuidedActions(
    manifest: IntegrationManifest,
    doctor: IntegrationDoctorSnapshot,
  ): IntegrationGuidedAction[] {
    const actions: IntegrationGuidedAction[] = [];
    const repairableRequirements = this.runtimeBindingSupport.getRepairableRequirements(manifest);

    actions.push({
      id: 'validate-now',
      label: 'Validar agora',
      description: doctor.status === 'ok'
        ? 'Rodar uma nova checagem rapida para confirmar que o binding continua saudavel.'
        : 'Atualizar o doctor agora para confirmar o que ainda falta nesta integracao.',
      command: `npm run integrations:doctor -- --id ${manifest.id}`,
      executable: true,
      manualOnly: false,
      kind: 'doctor',
      severity: doctor.status === 'ok'
        ? 'recommended'
        : (repairableRequirements.length > 0 ? 'recommended' : 'primary'),
      blocking: false,
      impact: {
        level: 'read_only',
        summary: 'Somente leitura e validacao leve.',
        details: [
          'Atualiza o doctor desta integracao.',
          'Executa um probe real leve quando houver suporte.',
          'Nao altera segredos nem instala dependencias.',
        ],
        requiresConfirmation: false,
      },
    });

    if (repairableRequirements.length > 0) {
      actions.push({
        id: 'repair-runtime',
        label: 'Reparar binding do runtime',
        description: 'Aplicar no runtime os segredos ja guardados no hub e revalidar esta integracao.',
        command: null,
        executable: true,
        manualOnly: false,
        kind: 'install_step',
        severity: doctor.status === 'ok' ? 'recommended' : 'primary',
        blocking: true,
        impact: {
          level: 'writes_runtime',
          summary: 'Aplica configuracao ja guardada ao runtime local.',
          details: [
            'Aplica segredos e configuracoes ja salvos no Integration Hub ao .env do Zavorth.',
            'Atualiza variaveis de ambiente do processo atual.',
            'Roda nova validacao depois da aplicacao.',
          ],
          requiresConfirmation: true,
        },
      });
    }

    for (const action of this.recipeService.buildRecipeActions(manifest, doctor)) {
      if (!actions.some((entry) => entry.id === action.id)) {
        actions.push(action);
      }
    }

    const doctorAction = this.recipeService.createActionFromCommand(
      manifest.id,
      'doctor:next',
      doctor.nextAction.label || 'Rodar doctor',
      doctor.nextAction.reason || 'Revalidar a integracao.',
      doctor.nextAction.command || null,
      doctor.status === 'ok' ? 'recommended' : 'primary',
      false,
      'doctor',
    );
    if (doctorAction) {
      actions.push(doctorAction);
    }

    for (const step of manifest.installSteps) {
      const action = this.recipeService.createActionFromStep(manifest.id, step, doctor);
      if (
        action &&
        !actions.some((entry) =>
          (entry.command && action.command && entry.command === action.command) || entry.label === action.label,
        )
      ) {
        actions.push(action);
      }
    }

    if (actions.length === 0) {
      actions.push({
        id: 'inspect:manifest',
        label: 'Inspecionar integracao',
        description: 'Abrir o resumo desta integracao para revisar requisitos e proximo passo.',
        command: `npm run integrations:show -- --id ${manifest.id}`,
        executable: true,
        manualOnly: false,
        kind: 'inspect',
        severity: 'recommended',
        blocking: false,
      });
    }

    return actions;
  }
}
