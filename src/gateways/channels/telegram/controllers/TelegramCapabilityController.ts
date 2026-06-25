import { Context } from 'grammy';
import { CapabilityDefinition } from '../../../../contracts/CapabilityContract.js';
import { TelegramResearchController } from '../../../../gateways/channels/telegram/controllers/TelegramResearchController.js';
import { TelegramPipelineController } from '../../../../gateways/channels/telegram/controllers/TelegramPipelineController.js';
import { TelegramInspectionController } from '../../../../gateways/channels/telegram/controllers/TelegramInspectionController.js';
import { TelegramFileDeliveryController } from '../../../../gateways/channels/telegram/controllers/TelegramFileDeliveryController.js';
import { TelegramOpsController } from '../../../../gateways/channels/telegram/controllers/TelegramOpsController.js';

type TelegramCapabilityControllerDeps = {
  researchController: TelegramResearchController;
  pipelineController: TelegramPipelineController;
  inspectionController: TelegramInspectionController;
  fileDeliveryController: TelegramFileDeliveryController;
  opsController: Pick<TelegramOpsController, 'handleCapabilities' | 'handleDashboard'>;
};

export class TelegramCapabilityController {
  constructor(private readonly deps: TelegramCapabilityControllerDeps) {}

  public async handleCommand(
    ctx: Context,
    capability: CapabilityDefinition | null,
    commandArgs: string,
    userId: string,
  ): Promise<boolean> {
    const action = String(capability?.command?.handler_action || '').trim().toLowerCase();
    const handlerConfig = capability?.command?.handler_config || {};

    if (!action) {
      return false;
    }

    switch (action) {
      case 'research_queue': {
        const mode = String(handlerConfig.mode || 'research').trim().toLowerCase();
        if (mode === 'deepresearch') {
          await this.deps.researchController.handleDeepResearch(ctx, commandArgs);
          return true;
        }
        await this.deps.researchController.handleResearch(ctx, commandArgs);
        return true;
      }

      case 'workflow_named': {
        const workflow = String(handlerConfig.workflow || '').trim();
        if (!workflow) {
          return false;
        }
        await this.deps.pipelineController.handleNamedWorkflow(ctx, workflow, commandArgs);
        return true;
      }

      case 'workflow_dynamic':
        await this.deps.pipelineController.handleWorkflow(ctx, commandArgs);
        return true;

      case 'file_delivery':
        await this.deps.fileDeliveryController.handleCommand(ctx, commandArgs, userId);
        return true;

      case 'inspection_tasks':
        await this.deps.inspectionController.handleTasks(ctx, commandArgs, userId);
        return true;

      case 'inspection_logs':
        await this.deps.inspectionController.handleLogs(ctx, commandArgs);
        return true;

      case 'inspection_files':
        await this.deps.inspectionController.handleTaskFiles(ctx, commandArgs, userId);
        return true;

      case 'inspection_diff':
        await this.deps.inspectionController.handleTaskDiff(ctx, commandArgs, userId);
        return true;

      case 'ops_capabilities':
        await this.deps.opsController.handleCapabilities(ctx);
        return true;

      case 'ops_dashboard':
        await this.deps.opsController.handleDashboard(ctx);
        return true;

      default:
        return false;
    }
  }
}
