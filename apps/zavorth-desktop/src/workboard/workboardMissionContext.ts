import type { MemoryItem } from '../apiClient';
import type { IdentityStudioProfile } from '../identity/identityStudio';
import type { WorkboardBoard, WorkboardCard } from '../views/panels/WorkboardPanel';

const priorityWeight: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export type WorkboardMissionContext = {
  identityLabel: string;
  memoryCount: number;
  nextAction: string;
  focusSummary: string;
  memoryHints: string[];
};

export function buildWorkboardMissionContext(input: {
  board: WorkboardBoard | null;
  identity?: IdentityStudioProfile | null;
  memoryItems?: MemoryItem[];
}): WorkboardMissionContext {
  const board = input.board;
  const identity = input.identity;
  const memoryItems = Array.isArray(input.memoryItems) ? input.memoryItems : [];
  const activeCards = board ? cardsOutsideDoneColumn(board) : [];
  const nextCard = activeCards.sort(compareCardsForNextAction)[0] || null;
  const doneCount = board ? board.cards.length - activeCards.length : 0;
  const totalCount = board?.cards.length || 0;

  return {
    identityLabel: identity
      ? `${identity.agentName} - ${identity.sessionPreset}`
      : 'Zavorth - default',
    memoryCount: memoryItems.length,
    nextAction: nextCard
      ? `Next: ${nextCard.title}`
      : totalCount > 0
        ? 'Next: review completed delivery'
        : 'Next: create the first work item',
    focusSummary: totalCount > 0
      ? `${doneCount}/${totalCount} done`
      : 'No active board yet',
    memoryHints: memoryItems
      .map(item => String(item.title || item.key || item.kind || item.content || '').trim())
      .filter(Boolean)
      .slice(0, 3),
  };
}

function cardsOutsideDoneColumn(board: WorkboardBoard): WorkboardCard[] {
  const doneColumn = board.columns[board.columns.length - 1];
  if (!doneColumn) return [...board.cards];
  return board.cards.filter(card => card.columnId !== doneColumn.id);
}

function compareCardsForNextAction(a: WorkboardCard, b: WorkboardCard): number {
  const priorityDelta = (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
  if (priorityDelta !== 0) return priorityDelta;
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}
