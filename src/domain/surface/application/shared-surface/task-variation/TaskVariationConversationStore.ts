import type { IMessageContext } from "../../../../../contracts/IMessageBroker.js";
import type { Task } from "../../../../../contracts/TaskContract.js";
import type {
  TaskVariationConversationState,
  TaskVariationPreviewOption,
} from "./TaskVariationTypes.js";

const CONVERSATION_TTL_MS = 15 * 60 * 1000;

export class TaskVariationConversationStore {
  private readonly entries = new Map<string, TaskVariationConversationState>();

  public remember(
    ctx: Pick<IMessageContext, "platform" | "chatId" | "userId">,
    task: Pick<Task, "task_id">,
    options: TaskVariationPreviewOption[],
    compareTarget?: string,
  ): void {
    this.entries.set(this.buildKey(ctx), {
      taskId: String(task.task_id || "").trim(),
      compareTarget: String(compareTarget || "").trim() || undefined,
      previewOptions: options,
      recommendedOption: options[0],
      secondaryOption: options[1],
      updatedAt: Date.now(),
    });
  }

  public read(
    ctx: Pick<IMessageContext, "platform" | "chatId" | "userId">,
  ): TaskVariationConversationState | null {
    const key = this.buildKey(ctx);
    const entry = this.entries.get(key);
    if (!entry) {
      return null;
    }
    if (Date.now() - entry.updatedAt > CONVERSATION_TTL_MS) {
      this.entries.delete(key);
      return null;
    }
    return entry;
  }

  private buildKey(
    ctx: Pick<IMessageContext, "platform" | "chatId" | "userId">,
  ): string {
    return [
      String(ctx.platform || "").trim(),
      String(ctx.chatId || "").trim(),
      String(ctx.userId || "").trim(),
    ].join("::");
  }
}
