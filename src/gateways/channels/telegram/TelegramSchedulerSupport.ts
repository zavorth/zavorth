import { Context, InputFile } from 'grammy';
import { config } from '../../../config/index.js';
import { SchedulerService } from '../../../services/SchedulerService.js';
import { RuntimeProfileService } from '../../../services/RuntimeProfileService.js';
import { Database } from '../../../storage/Database.js';
import { SchedulerRepository } from '../../../storage/SchedulerRepository.js';

type BotApiLike = {
  sendMessage(chatId: string | number, text: string, options?: Record<string, unknown>): Promise<unknown>;
  sendDocument?(
    chatId: string | number,
    document: InputFile,
    options?: Record<string, unknown>,
  ): Promise<unknown>;
};

type LoggerLike = Pick<typeof console, 'error'>;
type SchedulerHandler = (ctx: Context, text: string) => Promise<void>;
type RepositoryFactory = (db: Database) => SchedulerRepository;
type SchedulerFactory = (repo: SchedulerRepository) => SchedulerService;

export type TelegramSchedulerBootstrapDeps = {
  botApi: BotApiLike;
  processTextMessage: SchedulerHandler;
  onReady: (service: SchedulerService) => void;
  dbFactory?: () => Promise<Database>;
  createRepository?: RepositoryFactory;
  createSchedulerService?: SchedulerFactory;
  allowedUserIds?: string[];
  logger?: LoggerLike;
  runtimeProfileService?: Pick<RuntimeProfileService, 'getProfile' | 'supportsRecurringAutomation'>;
};

export class TelegramSchedulerBootstrap {
  private logger: LoggerLike;

  constructor(private deps: TelegramSchedulerBootstrapDeps) {
    this.logger = deps.logger || console;
  }

  public async init(): Promise<void> {
    try {
      const dbFactory = this.deps.dbFactory || (() => Database.getInstance());
      const createRepository = this.deps.createRepository || ((db: Database) => new SchedulerRepository(db));
      const createSchedulerService =
        this.deps.createSchedulerService || ((repo: SchedulerRepository) => new SchedulerService(repo, {
          runtimeProfileService: this.deps.runtimeProfileService || new RuntimeProfileService(),
        }));

      const db = await dbFactory();
      const schedulerService = createSchedulerService(createRepository(db));
      this.deps.onReady(schedulerService);
      schedulerService.start(async (command: string, userId: string) => {
        await this.dispatchScheduledCommand(command, userId);
      });
    } catch (error) {
      this.logger.error('Erro ao inicializar SchedulerService:', error);
    }
  }

  private async dispatchScheduledCommand(command: string, userId: string): Promise<void> {
    try {
      await this.deps.processTextMessage(this.createScheduledContext(userId), command);
    } catch (error) {
      this.logger.error('Falha ao processar task agendada:', error);
    }
  }

  private createScheduledContext(userId: string): Context {
    const numericUserId = Number.parseInt(userId, 10) || 0;

    return {
      chat: { id: numericUserId },
      from: { id: numericUserId, username: 'Scheduled_Task' },
      reply: async (text: string) => {
        try {
          const targetId = this.resolveScheduledReplyTarget(userId);
          if (targetId) {
            await this.deps.botApi.sendMessage(targetId, `[AGENDAMENTO]\n${text}`, {
              parse_mode: 'Markdown',
            });
          }
        } catch (error) {
          this.logger.error('Falha ao enviar resposta de task agendada', error);
        }
      },
      replyWithDocument: async (document: InputFile, options?: Record<string, unknown>) => {
        try {
          const targetId = this.resolveScheduledReplyTarget(userId);
          if (targetId && typeof this.deps.botApi.sendDocument === 'function') {
            await this.deps.botApi.sendDocument(targetId, document, options);
          }
        } catch (error) {
          this.logger.error('Falha ao enviar documento de task agendada', error);
        }
      },
    } as unknown as Context;
  }

  private resolveScheduledReplyTarget(userId: string): string {
    const allowedUserIds = this.deps.allowedUserIds || config.allowedUserIds;
    return allowedUserIds[0] || userId;
  }
}
