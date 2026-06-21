import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { KanbanTool } from '../../src/tools/KanbanTool';

describe('KanbanTool', () => {
  let tool: KanbanTool;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kanban-test-'));
    tool = new KanbanTool({ storageDir: tempDir });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('exposes correct name', () => {
    expect(tool.name).toBe('kanban_board');
  });

  it('returns error when action is missing', async () => {
    const result = await tool.execute({});
    expect(result).toContain('Erro');
    expect(result).toContain('action');
  });

  it('returns error for invalid action', async () => {
    const result = await tool.execute({ action: 'invalid_action' });
    expect(result).toContain('Erro');
    expect(result).toContain('invalida');
  });

  it('creates a board', async () => {
    const result = await tool.execute({ action: 'create_board', title: 'My Board' });

    expect(result).toContain('Quadro');
    expect(result).toContain('criado com sucesso');
    expect(fs.existsSync(path.join(tempDir, 'my_board.json'))).toBe(true);
  });

  it('returns error when creating duplicate board', async () => {
    await tool.execute({ action: 'create_board', title: 'Test Board' });
    const result = await tool.execute({ action: 'create_board', title: 'Test Board' });

    expect(result).toContain('Erro');
    expect(result).toContain('ja existe');
  });

  it('adds a card to a board', async () => {
    await tool.execute({ action: 'create_board', title: 'Board1' });
    const result = await tool.execute({
      action: 'add_card',
      board_id: 'board1',
      title: 'Task 1',
      description: 'Do something',
      column: 'todo',
      priority: 'high',
    });

    expect(result).toContain('adicionado');
    expect(result).toContain('Task 1');
  });

  it('returns error when adding card without title', async () => {
    await tool.execute({ action: 'create_board', title: 'Board1' });
    const result = await tool.execute({ action: 'add_card', board_id: 'board1' });

    expect(result).toContain('Erro');
    expect(result).toContain('title');
  });

  it('moves a card between columns', async () => {
    await tool.execute({ action: 'create_board', title: 'Board1' });
    const addResult = await tool.execute({
      action: 'add_card',
      board_id: 'board1',
      title: 'Task 1',
      column: 'backlog',
    });

    const cardId = addResult.split('ID: ')[1];
    const moveResult = await tool.execute({
      action: 'move_card',
      board_id: 'board1',
      card_id: cardId,
      column: 'in_progress',
    });

    expect(moveResult).toContain('movido');
    expect(moveResult).toContain('in_progress');
  });

  it('lists cards on a board', async () => {
    await tool.execute({ action: 'create_board', title: 'Board1' });
    await tool.execute({ action: 'add_card', board_id: 'board1', title: 'Task 1' });
    await tool.execute({ action: 'add_card', board_id: 'board1', title: 'Task 2' });

    const result = await tool.execute({ action: 'list_cards', board_id: 'board1' });

    expect(result).toContain('Task 1');
    expect(result).toContain('Task 2');
    expect(result).toContain('2 cartoes');
  });

  it('returns message when listing empty board', async () => {
    await tool.execute({ action: 'create_board', title: 'Empty' });
    const result = await tool.execute({ action: 'list_cards', board_id: 'empty' });

    expect(result).toContain('vazio');
  });

  it('assigns a card', async () => {
    await tool.execute({ action: 'create_board', title: 'Board1' });
    const addResult = await tool.execute({ action: 'add_card', board_id: 'board1', title: 'Task 1' });
    const cardId = addResult.split('ID: ')[1];

    const result = await tool.execute({
      action: 'assign_card',
      board_id: 'board1',
      card_id: cardId,
      assignee: 'user@example.com',
    });

    expect(result).toContain('atribuido');
    expect(result).toContain('user@example.com');
  });

  it('deletes a card', async () => {
    await tool.execute({ action: 'create_board', title: 'Board1' });
    const addResult = await tool.execute({ action: 'add_card', board_id: 'board1', title: 'Task 1' });
    const cardId = addResult.split('ID: ')[1];

    const result = await tool.execute({
      action: 'delete_card',
      board_id: 'board1',
      card_id: cardId,
    });

    expect(result).toContain('removido');
  });

  it('returns error when board not found', async () => {
    const result = await tool.execute({ action: 'list_cards', board_id: 'nonexistent' });
    expect(result).toContain('Erro');
    expect(result).toContain('nao encontrado');
  });

  it('returns error for invalid column', async () => {
    await tool.execute({ action: 'create_board', title: 'Board1' });
    const result = await tool.execute({
      action: 'add_card',
      board_id: 'board1',
      title: 'Task',
      column: 'invalid_column',
    });

    expect(result).toContain('Erro');
    expect(result).toContain('coluna');
  });
});
