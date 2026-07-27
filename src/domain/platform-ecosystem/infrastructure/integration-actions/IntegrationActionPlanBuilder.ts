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
      label: 'validate now',
      description: doctor.status === 'ok'
        ? 'run a new quick check to confirm the binding remains healthy.'
        : 'Update the doctor now to confirm what is still missing in this integration.',
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
        summary: 'Read-only access and lightweight validation.',
        details: [
          'Atualiza o doctor desta integration.',
          'Executa um probe real leve when houver suporte.',
          'Does not change secrets or install dependencies.',
        ],
        requiresConfirmation: false,
      },
    });

    if (repairableRequirements.length > 0) {
      actions.push({
        id: 'repair-runtime',
        label: 'Repair runtime binding',
        description: 'Apply secrets already stored in the hub to the runtime and revalidate this integration.',
        command: null,
        executable: true,
        manualOnly: false,
        kind: 'install_step',
        severity: doctor.status === 'ok' ? 'recommended' : 'primary',
        blocking: true,
        impact: {
          level: 'writes_runtime',
          summary: 'Applies already saved configuration to the local runtime.',
          details: [
            'Aplica secrets e configurations already salvos no Integration Hub ao .env do Zavorth.',
            'Updates environment variables for the current process.',
            'Runs new validation after application.',
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
      doctor.nextAction.label || 'run doctor',
      doctor.nextAction.reason || 'Revalidar a integration.',
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
        label: 'Inspecionar integration',
        description: 'Open this integration summary to review requirements and the next step.',
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
