import { describe, expect, it } from 'vitest';
import {
  buildCardChatContext,
  createCard,
  createDefaultWorkboard,
  deleteCard,
  mapMarketplaceSkillsToPlugins,
  mapToolsToPlugins,
  extractRuntimeWorkboard,
  upsertCard,
} from '../src/desktop-state/productData';

describe('product workboard helpers', () => {
  it('creates a default daily board with columns', () => {
    const board = createDefaultWorkboard();
    expect(board.columns.length).toBeGreaterThanOrEqual(3);
    expect(board.cards.length).toBeGreaterThan(0);
  });

  it('creates updates and deletes cards', () => {
    const boards = [createDefaultWorkboard()];
    const boardId = boards[0].id;
    const withCard = createCard(boards, boardId, {
      title: 'Ship desktop product sprint',
      priority: 'high',
      columnId: boards[0].columns[0].id,
    });
    expect(withCard[0].cards.some(card => card.title.includes('Ship desktop'))).toBe(true);

    const card = withCard[0].cards.find(item => item.title.includes('Ship desktop'))!;
    const moved = upsertCard(withCard, boardId, {
      ...card,
      columnId: boards[0].columns[1].id,
      priority: 'critical',
    });
    expect(moved[0].cards.find(item => item.id === card.id)?.columnId).toBe(boards[0].columns[1].id);

    const removed = deleteCard(moved, boardId, card.id);
    expect(removed[0].cards.some(item => item.id === card.id)).toBe(false);
  });

  it('builds chat context from a board card', () => {
    const board = createDefaultWorkboard();
    const card = board.cards[0];
    const context = buildCardChatContext(board, card);
    expect(context).toContain(card.title);
    expect(context).toContain(board.name);
    expect(context.toLowerCase()).toContain('priority');
  });
});

describe('product marketplace helpers', () => {
  it('maps marketplace skills to plugin items', () => {
    const plugins = mapMarketplaceSkillsToPlugins([
      {
        id: 'skill-review',
        name: 'Code Review',
        description: 'Reviews diffs safely',
        author: 'Zavorth',
        version: '1.2.0',
        category: 'development',
        installed: true,
        rating: 4.5,
        downloads: 1200,
        tags: ['code'],
      },
    ]);
    expect(plugins).toHaveLength(1);
    expect(plugins[0].status).toBe('installed');
    expect(plugins[0].category).toBe('development');
  });

  it('maps runtime tools as marketplace fallback', () => {
    const plugins = mapToolsToPlugins([
      { id: 'tool.fs', name: 'fs', title: 'Filesystem', description: 'Read files', status: 'ready' },
    ]);
    expect(plugins[0].id).toBe('tool.fs');
    expect(plugins[0].status).toBe('installed');
  });

  it('extracts runtime workboard projection from snapshot shapes', () => {
    const projection = extractRuntimeWorkboard({
      runtime: {
        workboard: {
          sessions: [{ sessionId: 's1', objective: 'Ship', status: 'running', maxDepth: 2, maxChildren: 3 }],
          tasks: [{
            taskId: 't1',
            sessionId: 's1',
            parentTaskId: null,
            title: 'Task',
            status: 'running',
            claimedBy: null,
            heartbeatAt: null,
            blockedReason: null,
            summary: null,
          }],
        },
      },
    });
    expect(projection?.tasks).toHaveLength(1);
    expect(projection?.sessions[0].objective).toBe('Ship');
  });

  it('extracts workboard from experience home raw.runtimeState and dispatch result', () => {
    const fromHome = extractRuntimeWorkboard({
      raw: {
        runtimeState: {
          projections: {
            workboard: {
              sessions: [{ sessionId: 'desktop-main', objective: 'Daily', status: 'running', maxDepth: 3, maxChildren: 8 }],
              tasks: [{
                taskId: 'card-1',
                sessionId: 'desktop-main',
                parentTaskId: null,
                title: 'From home',
                status: 'queued',
                claimedBy: null,
                heartbeatAt: null,
                blockedReason: null,
                summary: null,
              }],
            },
          },
        },
      },
    });
    expect(fromHome?.tasks[0].title).toBe('From home');

    const fromDispatch = extractRuntimeWorkboard({
      ok: true,
      snapshot: {
        state: {
          workboard: {
            sessions: [],
            tasks: [{
              taskId: 'card-2',
              sessionId: 'desktop-main',
              parentTaskId: null,
              title: 'From dispatch',
              status: 'running',
              claimedBy: null,
              heartbeatAt: null,
              blockedReason: null,
              summary: null,
            }],
          },
        },
      },
    });
    expect(fromDispatch?.tasks[0].title).toBe('From dispatch');
  });
});
