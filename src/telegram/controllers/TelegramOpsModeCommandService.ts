import { Context } from 'grammy';
import { DailyReportService } from '../../services/DailyReportService.js';
import { DemoGuideService } from '../../services/DemoGuideService.js';
import { DemoModeService } from '../../services/DemoModeService.js';
import { OperatorModeService } from '../../services/OperatorModeService.js';
import { PresentationModeService } from '../../services/PresentationModeService.js';
import { TelegramOpsDailyReportCommandService } from './TelegramOpsDailyReportCommandService.js';
import { TelegramOpsDemoCommandService } from './TelegramOpsDemoCommandService.js';
import { TelegramOpsSurfaceModeCommandService } from './TelegramOpsSurfaceModeCommandService.js';

export type TelegramOpsModeCommandServiceDeps = {
  dailyReportService: DailyReportService;
  demoGuideService: DemoGuideService;
  demoModeService: DemoModeService;
  operatorModeService: OperatorModeService;
  presentationModeService: PresentationModeService;
};

export class TelegramOpsModeCommandService {
  private readonly dailyReportCommands: TelegramOpsDailyReportCommandService;
  private readonly demoCommands: TelegramOpsDemoCommandService;
  private readonly surfaceModeCommands: TelegramOpsSurfaceModeCommandService;

  constructor(private readonly deps: TelegramOpsModeCommandServiceDeps) {
    this.dailyReportCommands = new TelegramOpsDailyReportCommandService({
      dailyReportService: this.deps.dailyReportService,
    });
    this.demoCommands = new TelegramOpsDemoCommandService({
      demoGuideService: this.deps.demoGuideService,
      demoModeService: this.deps.demoModeService,
      presentationModeService: this.deps.presentationModeService,
    });
    this.surfaceModeCommands = new TelegramOpsSurfaceModeCommandService({
      operatorModeService: this.deps.operatorModeService,
      presentationModeService: this.deps.presentationModeService,
    });
  }

  public async handleOperatorMode(ctx: Context, args: string): Promise<void> {
    await this.surfaceModeCommands.handleOperatorMode(ctx, args);
  }

  public async handlePresentationMode(ctx: Context, args: string): Promise<void> {
    await this.surfaceModeCommands.handlePresentationMode(ctx, args);
  }

  public async handleDemo(ctx: Context, args: string): Promise<void> {
    await this.demoCommands.handleDemo(ctx, args);
  }

  public async handleDailyReport(ctx: Context, args: string): Promise<void> {
    await this.dailyReportCommands.handleDailyReport(ctx, args);
  }

  public formatOperatorModeReply(
    status: {
      enabled: boolean;
      updatedAt: string | null;
      updatedBy: string | null;
      note: string | null;
    },
    mode: 'status' | 'activate' | 'deactivate',
  ): string {
    return this.surfaceModeCommands.formatOperatorModeReply(status, mode);
  }

  public formatPresentationModeReply(
    status: {
      enabled: boolean;
      updatedAt: string | null;
      updatedBy: string | null;
      note: string | null;
    },
    mode: 'status' | 'activate' | 'deactivate',
  ): string {
    return this.surfaceModeCommands.formatPresentationModeReply(status, mode);
  }

  public formatDemoModeReply(
    status: {
      enabled: boolean;
      updatedAt: string | null;
      updatedBy: string | null;
      note: string | null;
      autoPresentationEnabled: boolean;
    },
    mode: 'status' | 'activate' | 'deactivate',
  ): string {
    return this.demoCommands.formatDemoModeReply(status, mode);
  }

  public formatDailyReportStatusReply(
    status: {
      enabled: boolean;
      lastSentAt: string | null;
      updatedAt: string | null;
      updatedBy: string | null;
      note: string | null;
      nextPlannedAt: string | null;
    },
    mode: 'status' | 'activate' | 'deactivate' = 'status',
  ): string {
    return this.dailyReportCommands.formatDailyReportStatusReply(status, mode);
  }
}
