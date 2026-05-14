import type {
  EngineeringExecutionProfile,
  EngineeringIntent,
  EngineeringRunLoopSnapshot,
  EngineeringRunSnapshot,
  EngineeringRunStatus,
  RepairProposal,
} from '../contracts/EngineeringCoreContract.js';
import type {
  SystemOverlordActionRecord,
  SystemOverlordAutonomyLevel,
  SystemOverlordCapability,
} from '../contracts/SystemOverlordContract.js';
import { RepairPlannerService } from './RepairPlannerService.js';
import type { SupervisedExecutionGatewayService } from './SupervisedExecutionGatewayService.js';

type ExecutionGatewayLike = Pick<
  SupervisedExecutionGatewayService,
  'execute' | 'inferCapabilityFromCommand'
>;

export type EngineeringRunLoopInput = {
  run: EngineeringRunSnapshot;
  approved?: boolean;
  dryRun?: boolean;
  commandOverride?: string | null;
  requestedBy?: string | null;
  maxAttempts?: number | null;
};

export type EngineeringRunLoopResult = {
  status: EngineeringRunStatus;
  loop: EngineeringRunLoopSnapshot;
  hostActions: SystemOverlordActionRecord[];
  repairProposal: RepairProposal | null;
  replySummary: string;
};

export class EngineeringRunLoopService {
  private readonly executionGateway: ExecutionGatewayLike;
  private readonly repairPlanner: RepairPlannerService;
  private readonly maxAttempts: number;

  constructor(options: {
    executionGatewayService: ExecutionGatewayLike;
    repairPlannerService?: RepairPlannerService;
    maxAttempts?: number;
  }) {
    this.executionGateway = options.executionGatewayService;
    this.repairPlanner = options.repairPlannerService || new RepairPlannerService();
    this.maxAttempts = Math.max(1, Math.min(Number(options.maxAttempts || 3), 8));
  }

  public async execute(input: EngineeringRunLoopInput): Promise<EngineeringRunLoopResult> {
    const maxAttempts = Math.max(1, Math.min(Number(input.maxAttempts || this.maxAttempts), 8));
    const commandsPlanned = this.planCommands(input.run, input.commandOverride).slice(0, maxAttempts);
    if (commandsPlanned.length === 0) {
      return {
        status: 'ready',
        hostActions: [],
        repairProposal: null,
        replySummary: 'Nenhum comando supervisionado foi planejado para este run; preciso de um proximo passo mais especifico.',
        loop: this.buildLoop({
          status: 'no_action',
          attempt: 0,
          maxAttempts,
          commandsPlanned,
          commandsExecuted: [],
          lastFailureSummary: null,
          nextStep: 'Pedir ao usuario um comando/objetivo mais especifico ou propor patch.',
        }),
      };
    }

    const hostActions: SystemOverlordActionRecord[] = [];
    const commandsExecuted: string[] = [];
    let repairProposal: RepairProposal | null = null;

    for (const command of commandsPlanned) {
      const capability = this.executionGateway.inferCapabilityFromCommand(command);
      const resolvedCapability = input.run.intent.preferredCapability || capability;
      const action = await this.executionGateway.execute({
        runId: input.run.runId,
        requestedBy: input.requestedBy || input.run.request.scope?.userId || 'engineering-core',
        surface: input.run.request.scope?.platform || 'engineering-core',
        profile: this.resolveProfile(input.run.plan.profile, resolvedCapability, Boolean(input.approved)),
        autonomyLevel: this.resolveAutonomyLevel(input.run.intent),
        capability: resolvedCapability,
        command,
        workspace: input.run.context.workspace,
        objective: input.run.intent.objective,
        approved: input.approved === true,
        dryRun: input.dryRun === true,
        metadata: {
          loop: 'engineering-run-loop',
          intentKind: input.run.intent.kind,
          runId: input.run.runId,
        },
      });
      hostActions.push(action);
      commandsExecuted.push(command);

      if (action.status === 'pending_approval') {
        return {
          status: 'waiting_user',
          hostActions,
          repairProposal,
          replySummary: `Parei para aprovacao antes de executar "${command}": ${action.errorMessage || action.decision.reason}`,
          loop: this.buildLoop({
            status: 'waiting_approval',
            attempt: hostActions.length,
            maxAttempts,
            commandsPlanned,
            commandsExecuted,
            lastFailureSummary: null,
            nextStep: 'Pedir aprovacao explicita do operador para continuar.',
          }),
        };
      }

      if (action.status === 'blocked' || action.status === 'failed') {
        repairProposal = this.repairPlanner.planFromFailure({
          command,
          stderr: action.stderr || action.errorMessage || action.decision.reason,
        });
        return {
          status: 'failed',
          hostActions,
          repairProposal,
          replySummary: `O loop supervisionado parou em "${command}": ${action.errorMessage || action.decision.reason}`,
          loop: this.buildLoop({
            status: 'failed',
            attempt: hostActions.length,
            maxAttempts,
            commandsPlanned,
            commandsExecuted,
            lastFailureSummary: action.errorMessage || action.decision.reason,
            nextStep: repairProposal.summary,
          }),
        };
      }

      if (input.dryRun) {
        break;
      }
    }

    return {
      status: 'completed',
      hostActions,
      repairProposal,
      replySummary: `Loop supervisionado concluido com ${commandsExecuted.length} comando(s): ${commandsExecuted.join(', ') || 'n/d'}.`,
      loop: this.buildLoop({
        status: 'completed',
        attempt: hostActions.length,
        maxAttempts,
        commandsPlanned,
        commandsExecuted,
        lastFailureSummary: null,
        nextStep: null,
      }),
    };
  }

  private planCommands(run: EngineeringRunSnapshot, commandOverride?: string | null): string[] {
    const override = String(commandOverride || '').trim();
    if (override) {
      return [override];
    }

    const packageManager = run.context.packageManager || 'npm';
    const scripts = run.context.scripts || {};
    if (run.intent.kind === 'diagnose_build') {
      const commands: string[] = [];
      if (scripts.build) {
        commands.push(`${packageManager} run build`);
      }
      if (scripts.test) {
        commands.push(packageManager === 'npm' ? 'npm test' : `${packageManager} test`);
      }
      return commands.length > 0 ? commands : run.intent.suggestedCommands;
    }

    if (run.intent.kind === 'install_and_retry') {
      const commands = [packageManager === 'npm' ? 'npm install' : `${packageManager} install`];
      if (scripts.test) {
        commands.push(packageManager === 'npm' ? 'npm test' : `${packageManager} test`);
      } else if (scripts.build) {
        commands.push(`${packageManager} run build`);
      }
      return commands;
    }

    if (run.intent.kind === 'create_project') {
      return run.intent.suggestedCommands.length > 0 ? run.intent.suggestedCommands : ['npm init -y'];
    }

    if (run.intent.kind === 'system_overlord_operation') {
      return run.intent.suggestedCommands;
    }

    return run.intent.suggestedCommands;
  }

  private resolveProfile(
    currentProfile: EngineeringExecutionProfile,
    capability: SystemOverlordCapability,
    approved: boolean,
  ): EngineeringExecutionProfile {
    if (!approved) {
      return currentProfile;
    }
    if (
      capability === 'desktop.automation'
      || capability === 'browser.control'
      || capability === 'computer_use.visual_action'
      || capability === 'network.tunnel'
      || capability === 'secrets.read'
    ) {
      return currentProfile === 'owner' ? 'owner' : 'dangerous';
    }
    if (currentProfile === 'safe') {
      return 'trusted';
    }
    return currentProfile;
  }

  private resolveAutonomyLevel(intent: EngineeringIntent): SystemOverlordAutonomyLevel {
    if (intent.preferredAutonomyLevel) {
      return intent.preferredAutonomyLevel;
    }
    if (intent.kind === 'next_step') {
      return 1;
    }
    if (intent.kind === 'undo_change') {
      return 2;
    }
    return intent.mutating || intent.requiresSession ? 3 : 1;
  }

  private buildLoop(loop: EngineeringRunLoopSnapshot): EngineeringRunLoopSnapshot {
    return loop;
  }
}
