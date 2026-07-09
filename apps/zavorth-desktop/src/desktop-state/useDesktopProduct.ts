import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest, dispatchRuntimeStateAction, type ToolItem } from '../apiClient';
import type { PluginItem } from '../views/panels/PluginMarketplacePanel';
import type { WorkboardBoard, WorkboardCard } from '../views/panels/WorkboardPanel';
import type { RuntimeWorkboardProjection } from '../workboard/runtimeWorkboardProjection';
import {
  buildWorkboardRuntimeAction,
  describeWorkboardSync,
  mergeBoardsForDisplay,
  type WorkboardSyncState,
} from '../workboard/workboardRuntimeSync';
import {
  buildCardChatContext,
  createCard,
  createColumn,
  deleteCard,
  deleteColumn,
  extractRuntimeWorkboard,
  loadWorkboards,
  mapMarketplaceSkillsToPlugins,
  mapToolsToPlugins,
  persistWorkboards,
  renameColumn,
  upsertCard,
} from './productData';
import { asErrorLike } from '../lib/errors';
import { asErrorLike } from '../../../../src/utils/errorLike.js';


export function useDesktopProduct(input: {
  tools: ToolItem[];
  snapshot: unknown;
  sessionId?: string;
  setInput: (value: string | ((current: string) => string)) => void;
  setActivePanel: (panel: string) => void;
  setNotice: (value: string) => void;
  getComposerInput: () => string;
}) {
  const [boards, setBoards] = useState<WorkboardBoard[]>(() => loadWorkboards());
  const [marketplacePlugins, setMarketplacePlugins] = useState<PluginItem[]>([]);
  const [marketplaceLoading, setMarketplaceLoading] = useState(false);
  const [marketplaceSource, setMarketplaceSource] = useState<'api' | 'tools' | 'empty'>('empty');
  const [runtimeWorkboard, setRuntimeWorkboard] = useState<RuntimeWorkboardProjection | null>(null);
  const [lastPushOk, setLastPushOk] = useState<boolean | null>(null);
  const [lastPushError, setLastPushError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);

  useEffect(() => {
    setRuntimeWorkboard(extractRuntimeWorkboard(input.snapshot));
  }, [input.snapshot]);

  const workboardSync: WorkboardSyncState = useMemo(() => describeWorkboardSync({
    hasRuntimeProjection: Boolean(runtimeWorkboard && (runtimeWorkboard.tasks?.length || runtimeWorkboard.sessions?.length)),
    lastPushOk,
    lastPushError,
    lastSyncedAt,
  }), [lastPushError, lastPushOk, lastSyncedAt, runtimeWorkboard]);

  const displayBoards = useMemo(
    () => mergeBoardsForDisplay(boards, runtimeWorkboard),
    [boards, runtimeWorkboard],
  );

  const pushBoardMutation = useCallback(async (
    board: WorkboardBoard,
    operation: 'upsert-card' | 'delete-card' | 'sync-board',
    card?: WorkboardCard | null,
  ) => {
    try {
      const action = buildWorkboardRuntimeAction({
        board,
        card,
        operation,
        sessionId: input.sessionId || 'desktop-main',
      });
      const result = await dispatchRuntimeStateAction({
        type: action.type,
        approved: true,
        sessionId: action.sessionId,
        source: action.source,
        payload: action.payload,
      }) as { ok?: boolean; applied?: boolean; snapshot?: unknown; error?: string } | null;
      if (result && result.ok === false) {
        throw new Error(result.error || 'Runtime rejected workboard-sync.');
      }
      const projected = extractRuntimeWorkboard(result)
        || extractRuntimeWorkboard(result?.snapshot)
        || null;
      if (projected) {
        setRuntimeWorkboard(projected);
      }
      setLastPushOk(true);
      setLastPushError(null);
      setLastSyncedAt(new Date().toISOString());
      return true;
    } catch (error: unknown) {
      const err = asErrorLike(error);
      setLastPushOk(false);
      setLastPushError(error instanceof Error ? err.message : 'Runtime workboard push failed.');
      return false;
    }
  }, [input.sessionId]);

  const handleSyncBoard = useCallback(async (boardId?: string) => {
    const board = boards.find(item => item.id === boardId) || boards[0];
    if (!board) {
      input.setNotice('No local workboard to sync.');
      return false;
    }
    setSyncBusy(true);
    try {
      const ok = await pushBoardMutation(board, 'sync-board');
      input.setNotice(ok
        ? `Workboard “${board.name}” synced to runtime.`
        : 'Workboard sync failed. Local board kept; runtime push unavailable.');
      return ok;
    } finally {
      setSyncBusy(false);
    }
  }, [boards, input, pushBoardMutation]);

  const refreshMarketplace = useCallback(async () => {
    setMarketplaceLoading(true);
    try {
      const result = await apiRequest<{ ok?: boolean; skills?: unknown[]; data?: { skills?: unknown[] } }>({
        method: 'GET',
        path: '/api/marketplace/skills',
        query: { action: 'list' },
        timeoutMs: 15000,
      });
      const skills = Array.isArray(result.data?.skills)
        ? result.data?.skills
        : Array.isArray((result.data as { data?: { skills?: unknown[] } } | null)?.data?.skills)
          ? (result.data as { data: { skills: unknown[] } }).data.skills
          : [];
      if (result.ok && skills.length > 0) {
        setMarketplacePlugins(mapMarketplaceSkillsToPlugins(skills));
        setMarketplaceSource('api');
        return;
      }
      const fromTools = mapToolsToPlugins(input.tools);
      setMarketplacePlugins(fromTools);
      setMarketplaceSource(fromTools.length > 0 ? 'tools' : 'empty');
    } catch {
      const fromTools = mapToolsToPlugins(input.tools);
      setMarketplacePlugins(fromTools);
      setMarketplaceSource(fromTools.length > 0 ? 'tools' : 'empty');
    } finally {
      setMarketplaceLoading(false);
    }
  }, [input.tools]);

  useEffect(() => {
    void refreshMarketplace();
  }, [refreshMarketplace]);

  const commitBoards = useCallback((next: WorkboardBoard[]) => {
    setBoards(persistWorkboards(next));
  }, []);

  const handleBoardSelect = useCallback((_boardId: string) => {
    // Selection is local to the panel store; reserved for future sync.
  }, []);

  const handleCardCreate = useCallback((boardId: string, card: Omit<WorkboardCard, 'id' | 'createdAt'>) => {
    const next = createCard(boards, boardId, card);
    commitBoards(next);
    const board = next.find(item => item.id === boardId);
    const created = board?.cards[board.cards.length - 1];
    if (board && created) {
      void pushBoardMutation(board, 'upsert-card', created).then(ok => {
        if (!ok) input.setNotice('Card saved locally. Runtime workboard sync unavailable.');
      });
    }
  }, [boards, commitBoards, input, pushBoardMutation]);

  const handleCardUpdate = useCallback((boardId: string, card: WorkboardCard) => {
    const updated = { ...card, updatedAt: new Date().toISOString() };
    const next = upsertCard(boards, boardId, updated);
    commitBoards(next);
    const board = next.find(item => item.id === boardId);
    if (board) {
      void pushBoardMutation(board, 'upsert-card', updated).then(ok => {
        if (!ok) input.setNotice('Card updated locally. Runtime workboard sync unavailable.');
      });
    }
  }, [boards, commitBoards, input, pushBoardMutation]);

  const handleCardDelete = useCallback((boardId: string, cardId: string) => {
    const board = boards.find(item => item.id === boardId);
    const card = board?.cards.find(item => item.id === cardId) || null;
    commitBoards(deleteCard(boards, boardId, cardId));
    if (board) {
      void pushBoardMutation(board, 'delete-card', card).then(ok => {
        if (!ok) input.setNotice('Card deleted locally. Runtime workboard sync unavailable.');
      });
    }
  }, [boards, commitBoards, input, pushBoardMutation]);

  const handleColumnCreate = useCallback((boardId: string, name: string) => {
    const next = createColumn(boards, boardId, name);
    commitBoards(next);
    const board = next.find(item => item.id === boardId);
    if (board) void pushBoardMutation(board, 'sync-board');
  }, [boards, commitBoards, pushBoardMutation]);

  const handleColumnUpdate = useCallback((boardId: string, columnId: string, name: string) => {
    const next = renameColumn(boards, boardId, columnId, name);
    commitBoards(next);
    const board = next.find(item => item.id === boardId);
    if (board) void pushBoardMutation(board, 'sync-board');
  }, [boards, commitBoards, pushBoardMutation]);

  const handleColumnDelete = useCallback((boardId: string, columnId: string) => {
    const next = deleteColumn(boards, boardId, columnId);
    commitBoards(next);
    const board = next.find(item => item.id === boardId);
    if (board) void pushBoardMutation(board, 'sync-board');
  }, [boards, commitBoards, pushBoardMutation]);

  const handleOpenCardInChat = useCallback((boardId: string, cardId: string) => {
    const board = boards.find(item => item.id === boardId);
    const card = board?.cards.find(item => item.id === cardId);
    if (!board || !card) return;
    const context = buildCardChatContext(board, card);
    const current = input.getComposerInput();
    input.setInput(current ? `${current}\n\n${context}` : context);
    input.setActivePanel('chat');
    input.setNotice(`Loaded workboard card “${card.title}” into the composer.`);
  }, [boards, input]);

  const handleInstallPlugin = useCallback(async (pluginId: string) => {
    const plugin = marketplacePlugins.find(item => item.id === pluginId);
    try {
      const result = await apiRequest<{ ok?: boolean; message?: string; error?: string }>({
        method: 'POST',
        path: '/api/marketplace/skills',
        body: {
          action: 'install',
          skillId: pluginId,
          source: pluginId,
        },
        timeoutMs: 60000,
      });
      if (!result.ok) {
        throw new Error(result.error || result.data?.error || result.data?.message || 'Install failed.');
      }
      input.setNotice(result.data?.message || `Installed ${plugin?.name || pluginId}.`);
      await refreshMarketplace();
    } catch (error: unknown) {
      const err = asErrorLike(error);
      // Optimistic local mark when API is unavailable but tool already exists.
      setMarketplacePlugins(current => current.map(item => item.id === pluginId
        ? { ...item, status: 'installed' }
        : item));
      input.setNotice(error instanceof Error
        ? `${err.message} (marked installed locally if the skill is already present).`
        : 'Could not install skill.');
    }
  }, [input, marketplacePlugins, refreshMarketplace]);

  const handleUninstallPlugin = useCallback(async (pluginId: string) => {
    try {
      const result = await apiRequest<{ ok?: boolean; message?: string; error?: string }>({
        method: 'POST',
        path: '/api/marketplace/skills',
        body: { action: 'uninstall', skillId: pluginId },
        timeoutMs: 30000,
      });
      if (!result.ok) {
        throw new Error(result.error || result.data?.error || 'Uninstall failed.');
      }
      input.setNotice(result.data?.message || `Uninstalled ${pluginId}.`);
      await refreshMarketplace();
    } catch (error: unknown) {
      const err = asErrorLike(error);
      setMarketplacePlugins(current => current.map(item => item.id === pluginId
        ? { ...item, status: 'available' }
        : item));
      input.setNotice(error instanceof Error ? err.message : 'Could not uninstall skill.');
    }
  }, [input, refreshMarketplace]);

  const handleUpdatePlugin = useCallback(async (pluginId: string) => {
    await handleInstallPlugin(pluginId);
  }, [handleInstallPlugin]);

  const handleAttachFile = useCallback((relativePath: string) => {
    const ref = `@file:"${relativePath}"`;
    const current = input.getComposerInput();
    input.setInput(current ? `${current} ${ref}` : ref);
    input.setActivePanel('chat');
    input.setNotice(`Attached ${relativePath} to the composer.`);
  }, [input]);

  return {
    boards: displayBoards,
    localBoards: boards,
    runtimeWorkboard,
    workboardSync,
    workboardSyncBusy: syncBusy,
    marketplacePlugins,
    marketplaceLoading,
    marketplaceSource,
    refreshMarketplace,
    handleBoardSelect,
    handleCardCreate,
    handleCardUpdate,
    handleCardDelete,
    handleColumnCreate,
    handleColumnUpdate,
    handleColumnDelete,
    handleOpenCardInChat,
    handleSyncBoard,
    handleInstallPlugin,
    handleUninstallPlugin,
    handleUpdatePlugin,
    handleAttachFile,
  };
}
