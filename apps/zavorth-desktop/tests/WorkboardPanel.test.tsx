/**
 * @jest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import '@testing-library/jest-dom';
import React, { useState, useEffect } from 'react';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WorkboardPanel, {
  WorkboardBoard,
  WorkboardCard,
} from '../src/views/panels/WorkboardPanel';

jest.mock('nanostores', () => {
  if (!(globalThis as Record<string, unknown>).__testAtoms) {
    (globalThis as Record<string, unknown>).__testAtoms = [];
  }
  return {
    atom: (initial: unknown) => {
      let value = initial;
      const listeners: Array<(v: unknown) => void> = [];
      const store = {
        get: () => value,
        set: (v: unknown) => {
          value = v;
          listeners.forEach(fn => fn(v));
        },
        subscribe: (fn: (v: unknown) => void) => {
          listeners.push(fn);
          return () => {
            const idx = listeners.indexOf(fn);
            if (idx >= 0) listeners.splice(idx, 1);
          };
        },
      };
      (globalThis.__testAtoms as Array<unknown>).push(store);
      return store;
    },
  };
});

jest.mock('@nanostores/react', () => ({
  useStore: (store: { get: () => unknown; subscribe: (fn: (v: unknown) => void) => () => void }) => {
    const [value, setValue] = useState(store.get());
    useEffect(() => {
      const unsub = store.subscribe((v) => setValue(v));
      return unsub;
    }, [store]);
    return value;
  },
}));

jest.mock('@tabler/icons-react', () => {
  const createIcon = (name: string) => {
    const Icon = (props: Record<string, unknown>) => null;
    Icon.displayName = name;
    return Icon;
  };
  return new Proxy(
    {},
    {
      get: (_target, prop: string) => {
        if (typeof prop === 'string' && prop.startsWith('Icon')) {
          return createIcon(prop);
        }
        return null;
      },
    }
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

const ATOM_DEFAULTS = ['boards', 'cards', 'stats', '', 'all', false, true, null];

function resetAtoms() {
  const atoms = (globalThis.__testAtoms as Array<{ get: () => unknown; set: (v: unknown) => void }>);
  if (!atoms) return;
  atoms.forEach((a, i) => {
    a.set(ATOM_DEFAULTS[i % ATOM_DEFAULTS.length]);
  });
}

function renderPanel(overrides: Record<string, unknown> = {}) {
  const onBoardSelect = jest.fn();
  const onCardCreate = jest.fn();
  const onCardUpdate = jest.fn();
  const onCardDelete = jest.fn();
  const onColumnCreate = jest.fn();
  const onColumnUpdate = jest.fn();
  const onColumnDelete = jest.fn();

  return {
    onBoardSelect,
    onCardCreate,
    onCardUpdate,
    onCardDelete,
    onColumnCreate,
    onColumnUpdate,
    onColumnDelete,
    ...render(
      <WorkboardPanel
        boards={[MOCK_BOARD]}
        onBoardSelect={onBoardSelect}
        onCardCreate={onCardCreate}
        onCardUpdate={onCardUpdate}
        onCardDelete={onCardDelete}
        onColumnCreate={onColumnCreate}
        onColumnUpdate={onColumnUpdate}
        onColumnDelete={onColumnDelete}
        {...overrides}
      />
    ),
  };
}

async function switchToCardsTab() {
  const user = userEvent.setup();
  const cardsTab = screen.getByRole('tab', { name: /cards/i });
  await user.click(cardsTab);
}

async function switchToStatsTab() {
  const user = userEvent.setup();
  const statsTab = screen.getByRole('tab', { name: /stats/i });
  await user.click(statsTab);
}

beforeEach(() => {
  resetAtoms();
  cleanup();
});

afterEach(() => {
  cleanup();
});

describe('WorkboardPanel', () => {
  describe('Runtime dispatcher projection', () => {
    it('renders runtime board tasks when no local boards are provided', async () => {
      renderPanel({
        boards: [],
        runtimeWorkboard: {
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
        },
      });
      await switchToCardsTab();

      expect(screen.getByText('Claimed')).toBeInTheDocument();
      expect(screen.getByText('Render shared runtime task')).toBeInTheDocument();
      expect(screen.getByText('Visible from runtime.')).toBeInTheDocument();
      expect(screen.getByText('retry 1/2')).toBeInTheDocument();
      expect(screen.getByText('1 artifact')).toBeInTheDocument();
      expect(screen.getByText('1 comment')).toBeInTheDocument();
    });
  });

  describe('Renders board columns', () => {
    it('renders the kanban board with all columns after switching to Cards tab', async () => {
      renderPanel();
      await switchToCardsTab();

      expect(screen.getByText('To Do')).toBeInTheDocument();
      expect(screen.getByText('In Progress')).toBeInTheDocument();
      expect(screen.getByText('Done')).toBeInTheDocument();
    });

    it('displays column card counts', async () => {
      renderPanel();
      await switchToCardsTab();

      const todoHeader = screen.getByText('To Do').closest('.zvd-kanban-column-header');
      expect(todoHeader).toBeInTheDocument();
      expect(within(todoHeader as HTMLElement).getByText('2')).toBeInTheDocument();
    });
  });

  describe('Renders cards in columns', () => {
    it('displays card titles in their columns', async () => {
      renderPanel();
      await switchToCardsTab();

      expect(screen.getByText('Fix login bug')).toBeInTheDocument();
      expect(screen.getByText('Add dark mode')).toBeInTheDocument();
      expect(screen.getByText('Update docs')).toBeInTheDocument();
    });

    it('displays card descriptions', async () => {
      renderPanel();
      await switchToCardsTab();

      expect(screen.getByText('Users cannot login with SSO')).toBeInTheDocument();
      expect(screen.getByText('Implement dark theme support')).toBeInTheDocument();
    });

    it('displays card labels', async () => {
      renderPanel();
      await switchToCardsTab();

      expect(screen.getByText('bug')).toBeInTheDocument();
      expect(screen.getByText('feature')).toBeInTheDocument();
      expect(screen.getByText('docs')).toBeInTheDocument();
    });

    it('displays card priority badges', async () => {
      renderPanel();
      await switchToCardsTab();

      expect(screen.getByText('High')).toBeInTheDocument();
      expect(screen.getByText('Medium')).toBeInTheDocument();
      expect(screen.getByText('Low')).toBeInTheDocument();
      expect(screen.getByText('Critical')).toBeInTheDocument();
    });

    it('displays card dates', async () => {
      renderPanel();
      await switchToCardsTab();

      expect(screen.getByText('Jan 10')).toBeInTheDocument();
      expect(screen.getByText('Jan 11')).toBeInTheDocument();
    });
  });

  describe('Creates new card', () => {
    it('opens create card modal when clicking add button', async () => {
      const user = userEvent.setup();
      renderPanel();
      await switchToCardsTab();

      const addButtons = screen.getAllByTitle('Add card');
      await user.click(addButtons[0]);

      expect(screen.getByText('Create Card')).toBeInTheDocument();
    });

    it('calls onCardCreate with correct data', async () => {
      const user = userEvent.setup();
      const { onCardCreate } = renderPanel();
      await switchToCardsTab();

      const addButtons = screen.getAllByTitle('Add card');
      await user.click(addButtons[0]);

      const titleInput = screen.getByPlaceholderText('Card title...');
      await user.type(titleInput, 'New task');

      const createButton = screen.getByText('Create');
      await user.click(createButton);

      expect(onCardCreate).toHaveBeenCalledTimes(1);
    });
  });

  describe('Moves card between columns', () => {
    it('shows move right button for cards in non-last columns', async () => {
      renderPanel();
      await switchToCardsTab();

      const moveButtons = screen.getAllByTitle('Move right');
      expect(moveButtons.length).toBeGreaterThanOrEqual(1);
    });

    it('calls onCardUpdate when moving card right', async () => {
      const user = userEvent.setup();
      const { onCardUpdate } = renderPanel();
      await switchToCardsTab();

      const moveRightButtons = screen.getAllByTitle('Move right');
      await user.click(moveRightButtons[0]);

      expect(onCardUpdate).toHaveBeenCalledTimes(1);
    });
  });

  describe('Filters cards', () => {
    it('renders filter toggle button', async () => {
      renderPanel();
      await switchToCardsTab();

      expect(screen.getByTitle('Toggle filters')).toBeInTheDocument();
    });

    it('shows filter bar when toggled', async () => {
      const user = userEvent.setup();
      renderPanel();
      await switchToCardsTab();

      const filterButton = screen.getByTitle('Toggle filters');
      await user.click(filterButton);

      expect(screen.getByText('All Priorities')).toBeInTheDocument();
    });

    it('filters by priority when a priority is selected', async () => {
      const user = userEvent.setup();
      renderPanel();
      await switchToCardsTab();

      const filterButton = screen.getByTitle('Toggle filters');
      await user.click(filterButton);

      const prioritySelect = screen.getByDisplayValue('All Priorities');
      await user.selectOptions(prioritySelect, 'high');

      expect(screen.getByText('Fix login bug')).toBeInTheDocument();
      expect(screen.queryByText('Add dark mode')).not.toBeInTheDocument();
      expect(screen.queryByText('Update docs')).not.toBeInTheDocument();
    });

    it('shows assignee filter when cards have assignees', async () => {
      const user = userEvent.setup();
      renderPanel();
      await switchToCardsTab();

      const filterButton = screen.getByTitle('Toggle filters');
      await user.click(filterButton);

      expect(screen.getByText('All Assignees')).toBeInTheDocument();
    });

    it('filters by assignee', async () => {
      const user = userEvent.setup();
      renderPanel();
      await switchToCardsTab();

      const filterButton = screen.getByTitle('Toggle filters');
      await user.click(filterButton);

      const assigneeSelect = screen.getByDisplayValue('All Assignees');
      await user.selectOptions(assigneeSelect, 'Alice');

      expect(screen.getByText('Fix login bug')).toBeInTheDocument();
      expect(screen.getByText('Update docs')).toBeInTheDocument();
      expect(screen.queryByText('Add dark mode')).not.toBeInTheDocument();
    });
  });

  describe('Shows board statistics', () => {
    it('switches to stats tab and shows stat labels', async () => {
      renderPanel();
      await switchToStatsTab();

      expect(screen.getByText('Total Cards')).toBeInTheDocument();
      expect(screen.getByText('Completion Rate')).toBeInTheDocument();
      expect(screen.getByText('Assignees')).toBeInTheDocument();
      expect(screen.getByText('Columns')).toBeInTheDocument();
    });

    it('displays total card count in stats', async () => {
      renderPanel();
      await switchToStatsTab();

      const statValues = screen.getAllByText('4');
      expect(statValues.length).toBeGreaterThanOrEqual(1);
    });

    it('displays priority distribution section', async () => {
      renderPanel();
      await switchToStatsTab();

      expect(screen.getByText('Priority Distribution')).toBeInTheDocument();
    });

    it