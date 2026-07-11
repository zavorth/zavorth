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
      const boardOk = await pushBoardMutation(board, 'sync-board');
      if (!boardOk) {
        input.setNotice('Workboard sync failed. Local board kept; runtime push unavailable.');
        return false;
      }
      const cards = board.cards.slice();
      const batchSize = 5;
      let cardsOk = true;
      for (let index = 0; index < cards.length; index += batchSize) {
        const batch = cards.slice(index, index + batchSize);
        const results = await Promise.all(batch.map(card => pushBoardMutation(board, 'upsert-card', card)));
        if (!results.every(Boolean)) {
          cardsOk = false;
          break;
        }
      }
      input.setNotice(cardsOk
        ? `Workboard “${board.name}” synced to runtime.`
        : `Workboard “${board.name}” partially synced. Some cards stayed local.`);
      return cardsOk;
    } finally {
      setSyncBusy(false);
    }
  }, [boards, input, pushBoardMutation]);

  const refreshMarketplace = useCallback(async () => {
    setMarketplaceLoading(true);
    try {
      const [installedResult, marketplaceResult, localMarketplaceResult] = await Promise.all([
        apiRequest<{ skills?: unknown[] }>({ method: 'GET', path: '/api/skills', timeoutMs: 15000 }),
        apiRequest<{ skills?: unknown[] }>({ method: 'GET', path: '/api/skills/marketplace', timeoutMs: 15000 }),
        apiRequest<{ skills?: unknown[] }>({ method: 'GET', path: '/api/marketplace/skills', timeoutMs: 15000 }),
      ]);
      const installed = installedResult.ok && Array.isArray(installedResult.data?.skills)
        ? mapMarketplaceSkillsToPlugins(installedResult.data.skills).map(plugin => ({ ...plugin, status: 'installed' as const }))
        : [];
      const marketplaceSkills = marketplaceResult.ok
        && Array.isArray(marketplaceResult.data?.skills)
        && marketplaceResult.data.skills.length > 0
        ? marketplaceResult.data.skills
        : localMarketplaceResult.ok && Array.isArray(localMarketplaceResult.data?.skills)
          ? localMarketplaceResult.data.skills
          : [];
      const available = mapMarketplaceSkillsToPlugins(marketplaceSkills);
      const merged = new Map(available.map(plugin => [plugin.id, plugin]));
      installed.forEach(plugin => merged.set(plugin.id, plugin));
      if (merged.size > 0) {
        setMarketplacePlugins([...merged.values()]);
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
    const board = displayBoards.find(item => item.id === boardId);
    const card = board?.cards.find(item => item.id === cardId);
    if (!board || !card) return;
    const context = buildCardChatContext(board, card);
    const current = input.getComposerInput();
    input.setInput(current ? `${current}\n\n${context}` : context);
    input.setActivePanel('chat');
    input.setNotice(`Loaded workboard card “${card.title}” into the composer.`);
  }, [displayBoards, input]);

  const handleInstallPlugin = useCallback(async (pluginId: string) => {
    const plugin = marketplacePlugins.find(item => item.id === pluginId);
    try {
      let result = await apiRequest<{ ok?: boolean; message?: string; error?: string }>({
        method: 'POST',
        path: '/api/skills/marketplace/install',
        body: {
          name: plugin?.name || pluginId,
          description: plugin?.description || 'Skill instalada pelo Zavorth Desktop.',
          version: plugin?.version || '1.0.0',
          skillMdContent: plugin?.skillMdContent || `# ${plugin?.name || pluginId}\n\n${plugin?.description || ''}`,
          sourceUrl: plugin?.sourceUrl,
        },
        timeoutMs: 60000,
      });
      if (!result.ok || result.data?.ok === false) {
        result = await apiRequest<{ ok?: boolean; message?: string; error?: string }>({
          method: 'POST',
          path: '/api/marketplace/skills',
          body: { action: 'install', source: plugin?.sourceUrl || pluginId },
          timeoutMs: 60000,
        });
      }
      if (!result.ok || result.data?.ok === false) {
        throw new Error(result.error || result.data?.error || result.data?.message || 'Install failed.');
      }
      input.setNotice(result.data?.message || `Installed ${plugin?.name || pluginId}.`);
      await refreshMarketplace();
    } catch (error: unknown) {
      const err = asErrorLike(error);
      input.setNotice(error instanceof Error ? err.message : 'Could not install skill.');
    }
  }, [input, marketplacePlugins, refreshMarketplace]);

  const handleUninstallPlugin = useCallback(async (pluginId: string) => {
    try {
      let result = await apiRequest<{ ok?: boolean; message?: string; error?: string }>({
        method: 'DELETE',
        path: `/api/skills/${encodeURIComponent(pluginId)}`,
        body: undefined,
        timeoutMs: 30000,
      });
      if (!result.ok || result.data?.ok === false) {
        result = await apiRequest<{ ok?: boolean; message?: string; error?: string }>({
          method: 'POST',
          path: '/api/marketplace/skills',
          body: { action: 'uninstall', skillId: pluginId },
          timeoutMs: 30000,
        });
      }
      if (!result.ok || result.data?.ok === false) {
        throw new Error(result.error || result.data?.error || 'Uninstall failed.');
      }
      input.setNotice(result.data?.message || `Uninstalled ${pluginId}.`);
      await refreshMarketplace();
    } catch (error: unknown) {
      const err = asErrorLike(error);
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
