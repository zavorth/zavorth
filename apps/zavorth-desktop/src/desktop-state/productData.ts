import type { PluginCategory, PluginItem, PluginStatus } from '../views/panels/PluginMarketplacePanel';
import type { WorkboardBoard, WorkboardCard, WorkboardColumn } from '../views/panels/WorkboardPanel';
import type { RuntimeWorkboardProjection } from '../workboard/runtimeWorkboardProjection';
import type { ToolItem } from '../apiClient';

export const WORKBOARD_STORAGE_KEY = 'zvd:workboard-boards:v1';

export function createDefaultWorkboard(): WorkboardBoard {
  const now = new Date().toISOString();
  return {
    id: 'board-daily',
    name: 'Daily delivery',
    description: 'Local workboard for planned, in-progress, and done tasks.',
    columns: [
      { id: 'todo', name: 'To Do', order: 0, color: '#60a5fa' },
      { id: 'doing', name: 'In Progress', order: 1, color: '#a78bfa' },
      { id: 'review', name: 'Review', order: 2, color: '#facc15' },
      { id: 'done', name: 'Done', order: 3, color: '#4ade80' },
    ],
    cards: [
      {
        id: 'card-welcome',
        title: 'Review project risks and next safe step',
        description: 'Start from chat or move this card through the board as work progresses.',
        priority: 'medium',
        columnId: 'todo',
        labels: ['onboarding'],
        createdAt: now,
      },
    ],
    labels: [
      { id: 'onboarding', name: 'onboarding', color: '#60a5fa' },
      { id: 'runtime', name: 'runtime', color: '#00e88f' },
    ],
  };
}

export function loadWorkboards(storage: Pick<Storage, 'getItem'> | null = typeof localStorage === 'undefined' ? null : localStorage): WorkboardBoard[] {
  if (!storage) return [createDefaultWorkboard()];
  try {
    const raw = storage.getItem(WORKBOARD_STORAGE_KEY);
    if (!raw) return [createDefaultWorkboard()];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return [createDefaultWorkboard()];
    return parsed.map(sanitizeBoard).filter((board): board is WorkboardBoard => Boolean(board));
  } catch {
    return [createDefaultWorkboard()];
  }
}

export function persistWorkboards(
  boards: WorkboardBoard[],
  storage: Pick<Storage, 'setItem'> | null = typeof localStorage === 'undefined' ? null : localStorage,
): WorkboardBoard[] {
  storage?.setItem(WORKBOARD_STORAGE_KEY, JSON.stringify(boards));
  return boards;
}

function sanitizeBoard(value: unknown): WorkboardBoard | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<WorkboardBoard>;
  const id = String(raw.id || '').trim();
  const name = String(raw.name || '').trim();
  if (!id || !name) return null;
  const columns = Array.isArray(raw.columns)
    ? raw.columns
        .map((column, order) => sanitizeColumn(column, order))
        .filter((column): column is WorkboardColumn => Boolean(column))
    : createDefaultWorkboard().columns;
  const cards = Array.isArray(raw.cards)
    ? raw.cards
        .map(sanitizeCard)
        .filter((card): card is WorkboardCard => Boolean(card))
    : [];
  return {
    id,
    name,
    description: raw.description ? String(raw.description) : undefined,
    columns: columns.length > 0 ? columns : createDefaultWorkboard().columns,
    cards,
    labels: Array.isArray(raw.labels) ? raw.labels as WorkboardBoard['labels'] : undefined,
  };
}

function sanitizeColumn(value: unknown, order: number): WorkboardColumn | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<WorkboardColumn>;
  const id = String(raw.id || '').trim();
  const name = String(raw.name || '').trim();
  if (!id || !name) return null;
  return {
    id,
    name,
    order: Number.isFinite(Number(raw.order)) ? Number(raw.order) : order,
    color: raw.color ? String(raw.color) : undefined,
  };
}

function sanitizeCard(value: unknown): WorkboardCard | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<WorkboardCard>;
  const id = String(raw.id || '').trim();
  const title = String(raw.title || '').trim();
  const columnId = String(raw.columnId || '').trim();
  if (!id || !title || !columnId) return null;
  const priority = raw.priority === 'low' || raw.priority === 'high' || raw.priority === 'critical'
    ? raw.priority
    : 'medium';
  return {
    id,
    title,
    description: raw.description ? String(raw.description) : undefined,
    priority,
    assignee: raw.assignee ? String(raw.assignee) : undefined,
    labels: Array.isArray(raw.labels) ? raw.labels.map(label => String(label)) : undefined,
    columnId,
    createdAt: String(raw.createdAt || new Date(0).toISOString()),
    updatedAt: raw.updatedAt ? String(raw.updatedAt) : undefined,
  };
}

export function upsertCard(
  boards: WorkboardBoard[],
  boardId: string,
  card: WorkboardCard,
): WorkboardBoard[] {
  return boards.map(board => {
    if (board.id !== boardId) return board;
    const exists = board.cards.some(item => item.id === card.id);
    return {
      ...board,
      cards: exists
        ? board.cards.map(item => (item.id === card.id ? card : item))
        : [...board.cards, card],
    };
  });
}

export function createCard(
  boards: WorkboardBoard[],
  boardId: string,
  input: Omit<WorkboardCard, 'id' | 'createdAt'>,
): WorkboardBoard[] {
  const card: WorkboardCard = {
    ...input,
    id: `card-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  };
  return upsertCard(boards, boardId, card);
}

export function deleteCard(boards: WorkboardBoard[], boardId: string, cardId: string): WorkboardBoard[] {
  return boards.map(board => board.id === boardId
    ? { ...board, cards: board.cards.filter(card => card.id !== cardId) }
    : board);
}

export function createColumn(boards: WorkboardBoard[], boardId: string, name: string): WorkboardBoard[] {
  return boards.map(board => {
    if (board.id !== boardId) return board;
    const column: WorkboardColumn = {
      id: `col-${Date.now().toString(36)}`,
      name,
      order: board.columns.length,
      color: '#71717a',
    };
    return { ...board, columns: [...board.columns, column] };
  });
}

export function renameColumn(boards: WorkboardBoard[], boardId: string, columnId: string, name: string): WorkboardBoard[] {
  return boards.map(board => board.id === boardId
    ? {
        ...board,
        columns: board.columns.map(column => column.id === columnId ? { ...column, name } : column),
      }
    : board);
}

export function deleteColumn(boards: WorkboardBoard[], boardId: string, columnId: string): WorkboardBoard[] {
  return boards.map(board => {
    if (board.id !== boardId) return board;
    if (board.columns.length <= 1) return board;
    const fallback = board.columns.find(column => column.id !== columnId)?.id;
    return {
      ...board,
      columns: board.columns.filter(column => column.id !== columnId),
      cards: board.cards.map(card => card.columnId === columnId && fallback
        ? { ...card, columnId: fallback }
        : card),
    };
  });
}

export function buildCardChatContext(board: WorkboardBoard, card: WorkboardCard): string {
  const column = board.columns.find(item => item.id === card.columnId)?.name || card.columnId;
  const parts = [
    `Workboard card: ${card.title}`,
    `Board: ${board.name}`,
    `Column: ${column}`,
    `Priority: ${card.priority}`,
    card.assignee ? `Assignee: ${card.assignee}` : null,
    card.description ? `Notes: ${card.description}` : null,
    'Please plan the next safe step and only act after approval when risk is real.',
  ].filter(Boolean);
  return parts.join('\n');
}

const CATEGORY_MAP: Record<string, PluginCategory> = {
  productivity: 'productivity',
  development: 'development',
  design: 'design',
  communication: 'communication',
  analytics: 'analytics',
  security: 'security',
  automation: 'automation',
  research: 'productivity',
  media: 'other',
  devops: 'development',
  data: 'analytics',
  other: 'other',
};

export function mapMarketplaceSkillsToPlugins(skills: unknown[]): PluginItem[] {
  return skills
    .map((skill): PluginItem | null => {
      if (!skill || typeof skill !== 'object') return null;
      const raw = skill as Record<string, unknown>;
      const id = String(raw.id || raw.name || '').trim();
      const name = String(raw.name || raw.id || '').trim();
      if (!id || !name) return null;
      const categoryKey = String(raw.category || 'other').toLowerCase();
      const category = CATEGORY_MAP[categoryKey] || 'other';
      const installed = Boolean(raw.installed || raw.installedAt);
      const status: PluginStatus = installed ? 'installed' : 'available';
      return {
        id,
        name,
        description: String(raw.description || 'Skill package for Zavorth.'),
        author: String(raw.author || 'Zavorth'),
        version: String(raw.version || '0.0.0'),
        category,
        status,
        rating: Number(raw.rating || 0) || 0,
        reviewCount: Number(raw.reviewCount || raw.downloads || 0) || 0,
        downloads: Number(raw.downloads || 0) || 0,
        tags: Array.isArray(raw.tags) ? raw.tags.map(tag => String(tag)) : undefined,
        featured: Boolean(raw.featured || Number(raw.downloads || 0) > 100),
        lastUpdated: raw.installedAt ? String(raw.installedAt) : undefined,
      };
    })
    .filter((item): item is PluginItem => Boolean(item));
}

export function mapToolsToPlugins(tools: ToolItem[]): PluginItem[] {
  return tools
    .map((tool, index): PluginItem | null => {
      const id = String(tool.id || tool.name || `tool-${index}`).trim();
      const name = String(tool.title || tool.name || id).trim();
      if (!id || !name) return null;
      const statusText = String(tool.status || '').toLowerCase();
      const status: PluginStatus = statusText.includes('install') || statusText.includes('ready') || statusText.includes('trusted')
        ? 'installed'
        : 'available';
      return {
        id,
        name,
        description: String(tool.description || 'Runtime tool exposed by Zavorth.'),
        author: String(tool.source || 'runtime'),
        version: 'runtime',
        category: 'development',
        status,
        rating: 0,
        reviewCount: 0,
        downloads: 0,
        tags: tool.risk ? [String(tool.risk)] : undefined,
      };
    })
    .filter((item): item is PluginItem => Boolean(item));
}

export function extractRuntimeWorkboard(snapshot: unknown): RuntimeWorkboardProjection | null {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const root = snapshot as Record<string, unknown>;
  const nestedSnapshot = root.snapshot && typeof root.snapshot === 'object'
    ? root.snapshot as Record<string, unknown>
    : null;
  const raw = root.raw && typeof root.raw === 'object' ? root.raw as Record<string, unknown> : null;
  const runtimeState = raw?.runtimeState && typeof raw.runtimeState === 'object'
    ? raw.runtimeState as Record<string, unknown>
    : nestedSnapshot;
  const candidates = [
    root.workboard,
    root.runtimeWorkboard,
    (root.runtime as Record<string, unknown> | undefined)?.workboard,
    (root.projections as Record<string, unknown> | undefined)?.workboard,
    (root.state as Record<string, unknown> | undefined)?.workboard,
    runtimeState?.workboard,
    (runtimeState?.projections as Record<string, unknown> | undefined)?.workboard,
    (runtimeState?.state as Record<string, unknown> | undefined)?.workboard,
    nestedSnapshot?.workboard,
    (nestedSnapshot?.projections as Record<string, unknown> | undefined)?.workboard,
    (nestedSnapshot?.state as Record<string, unknown> | undefined)?.workboard,
  ];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue;
    const value = candidate as Partial<RuntimeWorkboardProjection>;
    if (Array.isArray(value.tasks) || Array.isArray(value.sessions)) {
      return {
        selectedTaskId: value.selectedTaskId ?? null,
        selectedTask: value.selectedTask ?? null,
        sessions: Array.isArray(value.sessions) ? value.sessions as RuntimeWorkboardProjection['sessions'] : [],
        tasks: Array.isArray(value.tasks) ? value.tasks as RuntimeWorkboardProjection['tasks'] : [],
        workers: Array.isArray(value.workers) ? value.workers as RuntimeWorkboardProjection['workers'] : [],
        receipts: Array.isArray(value.receipts) ? value.receipts as RuntimeWorkboardProjection['receipts'] : [],
        summary: value.summary || {
          sessions: 0,
          queued: 0,
          running: 0,
          completed: 0,
          blocked: 0,
        },
        safety: value.safety || {
          sqliteDurable: true,
          mutationRequiresApproval: true,
          retryBounded: true,
          spawnDepthBounded: true,
        },
      };
    }
  }
  return null;
}
