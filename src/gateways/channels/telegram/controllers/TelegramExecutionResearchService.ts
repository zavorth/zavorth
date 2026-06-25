import { Task } from '../../../../contracts/TaskContract.js';
import { LogRepository } from '../../../../storage/LogRepository.js';
import { DeepSearchService } from '../../../../services/DeepSearchService.js';
import { TaskResponseEnvelopeService } from '../../../../services/TaskResponseEnvelopeService.js';
import { UserFacingResponseService } from '../../../../services/UserFacingResponseService.js';

type PersistTaskFn = (task: Task) => void;

export type TelegramExecutionResearchServiceDeps = {
  logRepo: LogRepository;
  persistTask: PersistTaskFn;
};

export class TelegramExecutionResearchService {
  private readonly deepSearchService: DeepSearchService;

  constructor(private readonly deps: TelegramExecutionResearchServiceDeps) {
    this.deepSearchService = new DeepSearchService(this.deps.logRepo);
  }

  public async executeStructuredWebResearch(
    task: Task,
    query: string,
  ): Promise<{ output: string; success: boolean }> {
    if (!query) {
      task.executor_used = 'web_research';
      task.error_summary = 'Nenhuma pergunta foi recebida para a pesquisa web.';
      this.deps.persistTask(task);
      return {
        output: 'Nao consegui fazer a pesquisa web porque a pergunta veio vazia.',
        success: false,
      };
    }

    try {
      const result = await this.deepSearchService.research(query);
      task.executor_used = 'web_research';
      task.stdout_summary = this.truncateSummary(result);
      task.result_summary = this.truncateSummary(result);
      task.error_summary = null;
      task.metadata = {
        ...(task.metadata || {}),
        web_research_query: query,
        web_research_completed_at: new Date().toISOString(),
      };
      this.deps.persistTask(task);
      const userFacingText = UserFacingResponseService.formatStructuredResearchSuccess(query, result);
      const operationalText = TaskResponseEnvelopeService.buildResearchSuccess(task, query, result);
      TaskResponseEnvelopeService.capture(task, 'research_success', userFacingText, operationalText);
      this.deps.persistTask(task);
      this.deps.logRepo.log('info', 'ResponseEnvelope', operationalText, {
        taskId: task.task_id,
        kind: 'research_success',
      });
      return {
        output: userFacingText,
        success: true,
      };
    } catch (error: unknown) {
      const message = String(error?.message || error || 'Falha desconhecida na pesquisa web.').trim();
      task.executor_used = 'web_research';
      task.error_summary = this.truncateSummary(message);
      task.metadata = {
        ...(task.metadata || {}),
        web_research_query: query,
        web_research_failed_at: new Date().toISOString(),
      };
      this.deps.persistTask(task);
      const userFacingText = UserFacingResponseService.formatStructuredResearchFailure(query, message);
      const operationalText = TaskResponseEnvelopeService.buildResearchFailure(task, query, message);
      TaskResponseEnvelopeService.capture(task, 'research_failure', userFacingText, operationalText);
      this.deps.persistTask(task);
      this.deps.logRepo.log('warn', 'ResponseEnvelope', operationalText, {
        taskId: task.task_id,
        kind: 'research_failure',
      });
      return {
        output: userFacingText,
        success: false,
      };
    }
  }

  private truncateSummary(value: unknown, maxLength = 1000): string | null {
    const text = typeof value === 'string' ? value.trim() : '';
    if (!text) {
      return null;
    }

    return text.length <= maxLength ? text : `${text.slice(0, maxLength)}\n[...]`;
  }
}
