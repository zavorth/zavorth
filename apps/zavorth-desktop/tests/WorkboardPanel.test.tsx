import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ComponentType } from 'react';
import {
  renderUI,
  cleanupUI,
  click,
  pressKey,
  typeText,
  chooseOption,
  queryAllByText,
  queryByText,
  getByText,
  getByPlaceholderText,
  queryByTitle,
  queryAllByTitle,
  getByTitle,
  getTab,
} from './helpers/uiHarness';
import type { WorkboardBoard, WorkboardCard, WorkboardPanelProps } from '../src/views/panels/WorkboardPanel';
import type { RuntimeWorkboardProjection } from '../src/workboard/runtimeWorkboardProjection';

vi.mock('@tabler/icons-react', () => {
  const createIconStub = () => {
    const Icon = () => null;
    return Icon;
  };
  return Object.fromEntries(
    [
      'IconPlus',
      'IconTrash',
      'IconLayoutColumns',
      'IconFilter',
      'IconX',
      'IconCheck',
      'IconChevronLeft',
      'IconChevronRight',
      'IconTag',
      'IconUser',
      'IconAlertCircle',
      'IconChartBar',
      'IconClipboard',
      'IconLayoutKanban',
    ].map(name => [name, createIconStub()]),
  );
});

const MOCK_COLUMNS = [
  { id: 'col-1', name: 'To Do', order: 0, color: '#60a5fa' },
  { id: 'col-2', name: 'In Progress', order: 1, color: '#a78bfa' },
  { id: 'col-3', name: 'Done', order: 2, color: '#4ade80' },
];

const MOCK_CARDS: WorkboardCard[] = [
  {
    id: 'card-1',
    title: 'Fix login bug',
    description: 'Users cannot login with SSO',
    priority: 'high',
    assignee: 'Alice',
    labels: ['bug', 'auth'],
    columnId: 'col-1',
    createdAt: '2025-01-10T10:00:00Z',
  },
  {
    id: 'card-2',
    title: 'Add dark mode',
    description: 'Implement dark theme support',
    priority: 'medium',
    assignee: 'Bob',
    labels: ['feature'],
    columnId: 'col-2',
    createdAt: '2025-01-11T10:00:00Z',
  },
  {
    id: 'card-3',
    title: 'Update docs',
    priority: 'low',
    assignee: 'Alice',
    labels: ['docs'],
    columnId: 'col-3',
    createdAt: '2025-01-12T10:00:00Z',
  },
  {
    id: 'card-4',
    title: 'Critical hotfix',
    priority: 'critical',
    columnId: 'col-1',
    createdAt: '2025-01-13T10:00:00Z',
  },
];

const MOCK_BOARD: WorkboardBoard = {
  id: 'board-1',
  name: 'Sprint 1',
  description: 'First sprint',
  columns: MOCK_COLUMNS,
  cards: MOCK_CARDS,
};

const EMPTY_BOARD: WorkboardBoard = {
  id: 'board-2',
  name: 'Empty Board',
  columns: [...MOCK_COLUMNS],
  cards: [],
};

// Runtime tasks reach the panel exclusively through mapRuntimeWorkboardToBoard,
// which projects them onto a read-only board with id "runtime-workboard".
const RUNTIME_PROJECTION: RuntimeWorkboardProjection = {
  selectedTaskId: 'task-1',
  selectedTask: null,
  sessions: [
    {
      sessionId: 'session-1',
      objective: 'Shared dispatcher',
      status: 'running',
      maxDepth: 2,
      maxChildren: 4,
    },
  ],
  tasks: [
    {
      taskId: 'task-1',
      sessionId: 'session-1',
      parentTaskId: null,
      title: 'Render shared runtime task',
      status: 'claimed',
      claimedBy: 'desktop-worker',
      claimedAt: '2026-05-10T14:00:00.000Z',
      heartbeatAt: '2026-05-10T14:00:01.000Z',
      heartbeatDeadlineAt: '2026-05-10T14:01:00.000Z',
      blockedReason: null,
      summary: 'Visible from runtime.',
      attempts: 1,
      maxRetries: 2,
      failureCount: 0,
      artifactRefs: ['artifact:task-1'],
      comments: [
        {
          id: 'comment-1',
          author: 'desktop-worker',
          body: 'Claimed by desktop worker.',
          createdAt: '2026-05-10T14:00:01.000Z',
        },
      ],
      risk: 'read-only',
      createdAt: '2026-05-10T14:00:00.000Z',
      updatedAt: '2026-05-10T14:00:01.000Z',
    },
  ],
  workers: [],
  receipts: [],
  summary: {
    sessions: 1,
    queued: 0,
    running: 1,
    completed: 0,
    blocked: 0,
  },
  safety: {
    sqliteDurable: true,
    mutationRequiresApproval: true,
    retryBounded: true,
    spawnDepthBounded: true,
  },
};

type WorkboardPanelComponent = ComponentType<WorkboardPanelProps>;

async function loadPanelModule(): Promise<WorkboardPanelComponent> {
  // The panel keeps its UI state in module-level nanostores atoms; resetting the
  // module registry gives every test a pristine store without mocking nanostores.
  vi.resetModules();
  const { default: WorkboardPanel } = await import('../src/views/panels/WorkboardPanel');
  return WorkboardPanel;
}

function makeHandlers(): Pick<
  WorkboardPanelProps,
  | 'onBoardSelect'
  | 'onCardCreate'
  | 'onCardUpdate'
  | 'onCardDelete'
  | 'onColumnCreate'
  | 'onColumnUpdate'
  | 'onColumnDelete'
> {
  return {
    onBoardSelect: vi.fn(),
    onCardCreate: vi.fn(),
    onCardUpdate: vi.fn(),
    onCardDelete: vi.fn(),
    onColumnCreate: vi.fn(),
    onColumnUpdate: vi.fn(),
    onColumnDelete: vi.fn(),
  };
}

async function renderWorkboard(overrides: Partial<WorkboardPanelProps> = {}) {
  const WorkboardPanel = await loadPanelModule();
  const handlers = makeHandlers();
  const container = renderUI(
    <WorkboardPanel boards={[MOCK_BOARD]} {...handlers} {...overrides} />,
  );
  return { handlers, container };
}

async function switchTab(container: HTMLElement, namePattern: RegExp): Promise<void> {
  click(getTab(container, namePattern));
}

beforeEach(() => {
  cleanupUI();
});

afterEach(() => {
  cleanupUI();
});

describe('WorkboardPanel', () => {
  describe('Runtime dispatcher projection', () => {
    // Replaces the retired inline-runtimeWorkboard rendering coverage: the panel
    // no longer consumes a raw RuntimeWorkboardProjection prop; runtime state is
    // mapped to a read-only board by mapRuntimeWorkboardToBoard instead.
    it('renders projected runtime tasks inside their status columns', async () => {
      const { mapRuntimeWorkboardToBoard } = await import('../src/workboard/runtimeWorkboardProjection');
      const { container } = await renderWorkboard({ boards: [mapRuntimeWorkboardToBoard(RUNTIME_PROJECTION)] });
      await switchTab(container, /cards/i);

      expect(getByText(container, 'Claimed')).toBeTruthy();
      expect(getByText(container, 'Render shared runtime task')).toBeTruthy();
      expect(queryByText(container, /Visible from runtime\./)).not.toBeNull();
      expect(getByText(container, 'retry 1/2')).toBeTruthy();
      expect(getByText(container, '1 artifact')).toBeTruthy();
      expect(getByText(container, '1 comment')).toBeTruthy();
      expect(getByText(container, 'worker desktop-worker')).toBeTruthy();
    });

    it('blocks editing affordances while viewing the read-only runtime projection', async () => {
      const { mapRuntimeWorkboardToBoard } = await import('../src/workboard/runtimeWorkboardProjection');
      const { container } = await renderWorkboard({ boards: [mapRuntimeWorkboardToBoard(RUNTIME_PROJECTION)] });

      expect(queryByText(container, /This is the runtime projection/)).not.toBeNull();

      await switchTab(container, /cards/i);
      expect(queryAllByTitle(container, 'Add card')).toHaveLength(0);
      expect(queryByText(container, 'Add Column')).toBeNull();
      expect(container.querySelector('[placeholder="Column name"]')).toBeNull();

      const card = queryAllByText(container, 'Render shared runtime task')[0].closest('.zvd-kanban-card');
      if (!card) throw new Error('Runtime card not rendered');
      click(card);

      expect(getByText(container, 'Runtime card')).toBeTruthy();
      expect(getByText(container, 'Read-only projection')).toBeTruthy();
      const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('.zvd-modal button'));
      expect(buttons.some(button => button.textContent === 'Save')).toBe(false);
      expect(buttons.some(button => button.textContent === 'Delete')).toBe(false);
      const titleInput = container.querySelector<HTMLInputElement>('.zvd-modal input');
      expect(titleInput?.disabled).toBe(true);
    });
  });

  describe('Renders board columns', () => {
    it('renders the kanban board with all columns after switching to Cards tab', async () => {
      const { container } = await renderWorkboard();
      await switchTab(container, /cards/i);

      expect(getByText(container, 'To Do')).toBeTruthy();
      expect(getByText(container, 'In Progress')).toBeTruthy();
      expect(getByText(container, 'Done')).toBeTruthy();
    });

    it('displays column card counts', async () => {
      const { container } = await renderWorkboard();
      await switchTab(container, /cards/i);

      const todoHeader = getByText(container, 'To Do').closest('.zvd-kanban-column-header');
      if (!todoHeader) throw new Error('To Do header not rendered');
      expect(queryAllByText(todoHeader, '2').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Renders cards in columns', () => {
    it('displays card titles in their columns', async () => {
      const { container } = await renderWorkboard();
      await switchTab(container, /cards/i);

      expect(getByText(container, 'Fix login bug')).toBeTruthy();
      expect(getByText(container, 'Add dark mode')).toBeTruthy();
      expect(getByText(container, 'Update docs')).toBeTruthy();
    });

    it('displays card descriptions', async () => {
      const { container } = await renderWorkboard();
      await switchTab(container, /cards/i);

      expect(getByText(container, 'Users cannot login with SSO')).toBeTruthy();
      expect(getByText(container, 'Implement dark theme support')).toBeTruthy();
    });

    it('displays card labels', async () => {
      const { container } = await renderWorkboard();
      await switchTab(container, /cards/i);

      expect(getByText(container, 'bug')).toBeTruthy();
      expect(getByText(container, 'feature')).toBeTruthy();
      expect(getByText(container, 'docs')).toBeTruthy();
    });

    it('displays card priority badges', async () => {
      const { container } = await renderWorkboard();
      await switchTab(container, /cards/i);

      expect(getByText(container, 'High')).toBeTruthy();
      expect(getByText(container, 'Medium')).toBeTruthy();
      expect(getByText(container, 'Low')).toBeTruthy();
      expect(getByText(container, 'Critical')).toBeTruthy();
    });

    it('displays card dates', async () => {
      const { container } = await renderWorkboard();
      await switchTab(container, /cards/i);

      expect(getByText(container, 'Jan 10')).toBeTruthy();
      expect(getByText(container, 'Jan 11')).toBeTruthy();
    });
  });

  describe('Creates new card', () => {
    it('opens create card modal when clicking add button', async () => {
      const { container } = await renderWorkboard();
      await switchTab(container, /cards/i);

      click(getByTitle(container, 'Add card'));

      expect(getByText(container, 'Create Card')).toBeTruthy();
    });

    it('calls onCardCreate with correct data', async () => {
      const { handlers, container } = await renderWorkboard();
      await switchTab(container, /cards/i);

      click(getByTitle(container, 'Add card'));
      typeText(getByPlaceholderText(container, 'Card title...'), 'New task');
      click(getByText(container, 'Create'));

      expect(handlers.onCardCreate).toHaveBeenCalledTimes(1);
      expect(handlers.onCardCreate).toHaveBeenCalledWith(
        'board-1',
        expect.objectContaining({ title: 'New task' }),
      );
    });
  });

  describe('Moves card between columns', () => {
    it('shows move right button for cards in non-last columns', async () => {
      const { container } = await renderWorkboard();
      await switchTab(container, /cards/i);

      expect(queryAllByTitle(container, 'Move right').length).toBeGreaterThanOrEqual(1);
    });

    it('calls onCardUpdate when moving card right', async () => {
      const { handlers, container } = await renderWorkboard();
      await switchTab(container, /cards/i);

      click(queryAllByTitle(container, 'Move right')[0]);

      expect(handlers.onCardUpdate).toHaveBeenCalledTimes(1);
      expect(handlers.onCardUpdate).toHaveBeenCalledWith(
        'board-1',
        expect.objectContaining({ id: 'card-1', columnId: 'col-2' }),
      );
    });
  });

  describe('Filters cards', () => {
    it('renders filter toggle button', async () => {
      const { container } = await renderWorkboard();
      await switchTab(container, /cards/i);

      expect(queryByTitle(container, 'Toggle filters')).not.toBeNull();
    });

    it('shows filter bar when toggled', async () => {
      const { container } = await renderWorkboard();
      await switchTab(container, /cards/i);
      click(getByTitle(container, 'Toggle filters'));

      expect(getByText(container, 'All Priorities')).toBeTruthy();
    });

    it('filters by priority when a priority is selected', async () => {
      const { container } = await renderWorkboard();
      await switchTab(container, /cards/i);
      click(getByTitle(container, 'Toggle filters'));

      const prioritySelect = container.querySelector<HTMLSelectElement>('.zvd-filter-select');
      if (!prioritySelect) throw new Error('Priority filter not rendered');
      chooseOption(prioritySelect, 'high');

      expect(getByText(container, 'Fix login bug')).toBeTruthy();
      expect(queryByText(container, 'Add dark mode')).toBeNull();
      expect(queryByText(container, 'Update docs')).toBeNull();
    });

    it('shows assignee filter when cards have assignees', async () => {
      const { container } = await renderWorkboard();
      await switchTab(container, /cards/i);
      click(getByTitle(container, 'Toggle filters'));

      expect(getByText(container, 'All Assignees')).toBeTruthy();
    });

    it('filters by assignee', async () => {
      const { container } = await renderWorkboard();
      await switchTab(container, /cards/i);
      click(getByTitle(container, 'Toggle filters'));

      const selects = container.querySelectorAll<HTMLSelectElement>('.zvd-filter-select');
      const assigneeSelect = selects[1];
      if (!assigneeSelect) throw new Error('Assignee filter not rendered');
      chooseOption(assigneeSelect, 'Alice');

      expect(getByText(container, 'Fix login bug')).toBeTruthy();
      expect(getByText(container, 'Update docs')).toBeTruthy();
      expect(queryByText(container, 'Add dark mode')).toBeNull();
    });
  });

  describe('Shows board statistics', () => {
    it('switches to stats tab and shows stat labels', async () => {
      const { container } = await renderWorkboard();
      await switchTab(container, /stats/i);

      expect(getByText(container, 'Total Cards')).toBeTruthy();
      expect(getByText(container, 'Completion Rate')).toBeTruthy();
      expect(getByText(container, 'Assignees')).toBeTruthy();
      expect(getByText(container, 'Columns')).toBeTruthy();
    });

    it('displays total card count in stats', async () => {
      const { container } = await renderWorkboard();
      await switchTab(container, /stats/i);

      expect(queryAllByText(container, '4').length).toBeGreaterThanOrEqual(1);
    });

    it('displays priority distribution section', async () => {
      const { container } = await renderWorkboard();
      await switchTab(container, /stats/i);

      expect(getByText(container, 'Priority Distribution')).toBeTruthy();
    });

    it('displays cards per column section', async () => {
      const { container } = await renderWorkboard();
      await switchTab(container, /stats/i);

      expect(getByText(container, 'Cards per Column')).toBeTruthy();
    });
  });

  describe('Handles empty board', () => {
    it('shows empty state when no boards provided', async () => {
      const { container } = await renderWorkboard({ boards: [] });

      expect(queryByText(container, /No boards available/)).not.toBeNull();
    });

    it('shows "No cards" in empty columns', async () => {
      const { container } = await renderWorkboard({ boards: [EMPTY_BOARD] });
      await switchTab(container, /cards/i);

      expect(queryAllByText(container, 'No cards').length).toBeGreaterThanOrEqual(1);
    });

    it('shows empty state for cards tab with no board selected', async () => {
      const { container } = await renderWorkboard({ boards: [] });
      await switchTab(container, /cards/i);

      expect(queryByText(container, /Select a board/)).not.toBeNull();
    });

    it('shows empty state for stats tab with no board selected', async () => {
      const { container } = await renderWorkboard({ boards: [] });
      await switchTab(container, /stats/i);

      expect(queryByText(container, /Select a board/)).not.toBeNull();
    });
  });

  describe('Column management', () => {
    it('renders add column input in cards view', async () => {
      const { container } = await renderWorkboard();
      await switchTab(container, /cards/i);

      expect(container.querySelector('[placeholder="Column name"]')).not.toBeNull();
    });

    it('calls onColumnCreate when adding a column', async () => {
      const { handlers, container } = await renderWorkboard();
      await switchTab(container, /cards/i);

      typeText(getByPlaceholderText(container, 'Column name'), 'Testing');
      click(getByTitle(container, 'Add column'));

      expect(handlers.onColumnCreate).toHaveBeenCalledWith('board-1', 'Testing');
    });

    it('adds column on Enter key', async () => {
      const { handlers, container } = await renderWorkboard();
      await switchTab(container, /cards/i);

      const columnInput = getByPlaceholderText(container, 'Column name');
      typeText(columnInput, 'Review');
      pressKey(columnInput, 'Enter');

      expect(handlers.onColumnCreate).toHaveBeenCalledWith('board-1', 'Review');
    });

    it('disables add button when column name is empty', async () => {
      const { container } = await renderWorkboard();
      await switchTab(container, /cards/i);

      const addButton = getByTitle(container, 'Add column') as HTMLButtonElement;
      expect(addButton.disabled).toBe(true);
    });
  });
});
