import type { IMessageContext } from "../../../../../contracts/IMessageBroker.js";
import type { Task } from "../../../../../contracts/TaskContract.js";
import type { SurfaceTaskDispatcherLike } from "../../../../../services/SurfaceRuntime.js";

export type NaturalTaskVariationIntent = {
  taskId?: string;
  resolveRecent?: {
    keywords: string[];
  } | null;
  adjustment?: string;
  adjustments?: string[];
  intro: string;
  previewOnly?: boolean;
  compareOnly?: boolean;
  compareTarget?: string;
};

export type TaskVariationPreviewOption = {
  label: string;
  adjustment: string;
};

export type TaskVariationConversationState = {
  taskId: string;
  compareTarget?: string;
  previewOptions: TaskVariationPreviewOption[];
  recommendedOption?: TaskVariationPreviewOption;
  secondaryOption?: TaskVariationPreviewOption;
  updatedAt: number;
};

export type SharedSurfaceTaskVariationCommandPackDeps = {
  surfaceTaskDispatcher: SurfaceTaskDispatcherLike | null;
  resolveTaskReference: (
    ref: string,
    ctx: Pick<IMessageContext, "userId">,
  ) => Task | null;
  resolveRecentTaskReference: (
    ctx: Pick<IMessageContext, "userId">,
    keywords: string[],
  ) => Task | null;
  extractRecentTaskContextKeywords: (rawText: string) => string[];
  normalizeNaturalText: (value: string | null | undefined) => string;
  extractNaturalChannelId: (normalized: string) => string | null;
  formatNaturalChannelLabel: (channelId: string) => string;
};
