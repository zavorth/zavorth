import type { IMessageContext } from "../../../../contracts/IMessageBroker.js";
import type { Task } from "../../../../contracts/TaskContract.js";
import { RecentTaskResolver } from "../../../../services/RecentTaskResolver.js";
import { TaskVariationConversationStore } from "./task-variation/TaskVariationConversationStore.js";
import { TaskVariationIntentParser } from "./task-variation/TaskVariationIntentParser.js";
import type {
  NaturalTaskVariationIntent,
  SharedSurfaceTaskVariationCommandPackDeps,
} from "./task-variation/TaskVariationTypes.js";

export type { SharedSurfaceTaskVariationCommandPackDeps };

export class SharedSurfaceTaskVariationCommandPack {
  private readonly conversationStore = new TaskVariationConversationStore();
  private readonly parser: TaskVariationIntentParser;

  public constructor(
    private readonly deps: SharedSurfaceTaskVariationCommandPackDeps,
  ) {
    this.parser = new TaskVariationIntentParser(deps);
  }

  public async maybeHandle(
    ctx: IMessageContext,
    rawText: string,
  ): Promise<boolean> {
    const intent =
      this.parser.parseContextualTaskVariationIntent(
        rawText,
        this.conversationStore.read(ctx),
      ) || this.parser.parseNaturalTaskVariationIntent(rawText);
    if (!intent) {
      return false;
    }

    await this.handleNaturalTaskVariationIntent(ctx, intent);
    return true;
  }

  private async handleNaturalTaskVariationIntent(
    ctx: IMessageContext,
    intent: NaturalTaskVariationIntent,
  ): Promise<void> {
    await ctx.reply(intent.intro);
    const task =
      (intent.taskId
        ? this.deps.resolveTaskReference(intent.taskId, ctx)
        : null) ||
      this.deps.resolveRecentTaskReference(
        ctx,
        intent.resolveRecent?.keywords || [],
      );
    if (!task) {
      await ctx.reply(
        "Nao encontrei uma tarefa recente para abrir essa nova variacao. Use a referencia da tarefa se quiser ser mais explicito.",
      );
      return;
    }

    if (intent.previewOnly) {
      this.rememberTaskVariationConversation(ctx, task);
      await ctx.reply(this.parser.buildTaskVariationPreviewReply(task));
      return;
    }

    if (intent.compareOnly) {
      this.rememberTaskVariationConversation(ctx, task, intent.compareTarget);
      await ctx.reply(
        this.parser.buildTaskVariationRecommendationReply(
          task,
          intent.compareTarget,
        ),
      );
      return;
    }

    if (intent.adjustments && intent.adjustments.length > 0) {
      await this.handleTaskVariationBatch(ctx, task, intent.adjustments);
      return;
    }

    if (!intent.adjustment) {
      await ctx.reply(
        "Entendi a ideia geral, mas ainda preciso do ajuste desejado para abrir a nova variacao.",
      );
      return;
    }

    await this.handleTaskVariation(ctx, task, intent.adjustment);
  }

  private async handleTaskVariation(
    ctx: IMessageContext,
    task: Task,
    adjustment: string,
  ): Promise<void> {
    if (!this.deps.surfaceTaskDispatcher) {
      await ctx.reply(
        `${RecentTaskResolver.formatTaskStatus(task)}\n\nEste runtime nao expoe o dispatcher canonico para abrir uma nova variacao desse pedido.`,
      );
      return;
    }

    const originalText = String(
      task.raw_message || task.normalized_message || "",
    ).trim();
    if (!originalText) {
      await ctx.reply(
        "Nao encontrei o pedido original dessa tarefa para abrir uma nova variacao.",
      );
      return;
    }

    const result = await this.dispatchTaskVariation(ctx, task, adjustment);

    await ctx.reply(
      [
        "Abri uma nova task canonica com base no pedido anterior e no ajuste que voce pediu.",
        "",
        `Task base: ${task.task_id}`,
        `Nova task: ${String(result.task?.task_id || "").trim() || "n/d"}`,
        `Ajuste aplicado: ${adjustment}`,
      ].join("\n"),
    );
  }

  private async handleTaskVariationBatch(
    ctx: IMessageContext,
    task: Task,
    adjustments: string[],
  ): Promise<void> {
    const uniqueAdjustments = Array.from(
      new Set(
        adjustments.map((entry) => String(entry || "").trim()).filter(Boolean),
      ),
    );
    if (uniqueAdjustments.length === 0) {
      await ctx.reply(
        "Nao encontrei ajustes suficientes para abrir multiplas variacoes dessa tarefa.",
      );
      return;
    }

    if (uniqueAdjustments.length === 1) {
      await this.handleTaskVariation(ctx, task, uniqueAdjustments[0]);
      return;
    }

    const created: Array<{ taskId: string; adjustment: string }> = [];
    for (const adjustment of uniqueAdjustments) {
      const result = await this.dispatchTaskVariation(ctx, task, adjustment);
      created.push({
        taskId: String(result.task?.task_id || "").trim() || "n/d",
        adjustment,
      });
    }

    await ctx.reply(
      [
        "Abri mais de uma variacao canonica com base na conversa recente.",
        "",
        `Task base: ${task.task_id}`,
        ...created.map(
          (entry, index) =>
            `${index + 1}. ${entry.taskId} -> ${entry.adjustment}`,
        ),
      ].join("\n"),
    );
  }

  private async dispatchTaskVariation(
    ctx: IMessageContext,
    task: Task,
    adjustment: string,
  ): Promise<{ task?: { task_id?: string } | null }> {
    if (!this.deps.surfaceTaskDispatcher) {
      throw new Error("Dispatcher de task variation indisponivel.");
    }

    const originalText = String(
      task.raw_message || task.normalized_message || "",
    ).trim();
    const variationText = [
      originalText,
      "",
      `Ajuste adicional para esta nova variacao: ${adjustment}`,
    ].join("\n");

    return this.deps.surfaceTaskDispatcher.dispatchTaskMessage({
      ctx: ctx as any,
      platform: ctx.platform,
      chatId: ctx.chatId,
      text: variationText,
      sourceUserId: String(ctx.userId || "").trim(),
      source: ctx.platform,
      threadId: ctx.threadId || null,
      composerPayload: ctx.composerPayload || null,
      surfacePolicy: {
        transport: ctx.transport || null,
      },
    });
  }

  private rememberTaskVariationConversation(
    ctx: Pick<IMessageContext, "platform" | "chatId" | "userId">,
    task: Pick<Task, "task_id">,
    compareTarget?: string,
  ): void {
    this.conversationStore.remember(
      ctx,
      task,
      this.parser.getTaskVariationPreviewOptions(compareTarget),
      compareTarget,
    );
  }
}
