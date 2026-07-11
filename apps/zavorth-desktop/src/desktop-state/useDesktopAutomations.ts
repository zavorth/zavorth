import { useCallback, useEffect, useState } from 'react';
import type { DesktopAutomationTask } from '../global';
import type { DesktopWorkspaceScope } from '../workspaceScopes';

export interface ScheduledTask extends DesktopAutomationTask {}

export function useDesktopAutomations(input: {
  workspaceScope: DesktopWorkspaceScope;
  selectedModel: string;
  profile: string;
  effort: string;
}) {
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([]);

  const refreshScheduledTasks = useCallback(async () => {
    try {
      const tasks = await window.zavorthDesktop?.automations?.list();
      setScheduledTasks(Array.isArray(tasks) ? tasks : []);
    } catch {
      setScheduledTasks([]);
    }
  }, []);

  useEffect(() => {
    void refreshScheduledTasks();
    const unsubscribe = window.zavorthDesktop?.automations?.onUpdated?.((tasks) => {
      setScheduledTasks(Array.isArray(tasks) ? tasks : []);
    });
    return () => {
      unsubscribe?.();
    };
  }, [refreshScheduledTasks]);

  const handleAddScheduledTask = useCallback(async (
    name: string,
    project: string,
    prompt: string,
    intervalMinutes: number,
  ) => {
    await window.zavorthDesktop?.automations?.create({
      name,
      project,
      prompt,
      intervalMinutes,
      workspace: {
        id: input.workspaceScope.id,
        label: input.workspaceScope.label,
        path: input.workspaceScope.path,
      },
      model: input.selectedModel,
      profile: input.profile,
      effort: input.effort,
    });
    await refreshScheduledTasks();
  }, [input.effort, input.profile, input.selectedModel, input.workspaceScope, refreshScheduledTasks]);

  const handleDeleteScheduledTask = useCallback(async (id: string) => {
    await window.zavorthDesktop?.automations?.delete(id);
    await refreshScheduledTasks();
  }, [refreshScheduledTasks]);

  const handleToggleScheduledTask = useCallback(async (id: string) => {
    const task = scheduledTasks.find(item => item.id === id);
    if (!task) return;
    await window.zavorthDesktop?.automations?.toggle(id, !task.enabled);
    await refreshScheduledTasks();
  }, [refreshScheduledTasks, scheduledTasks]);

  const handleRunScheduledTask = useCallback(async (id: string) => {
    const result = await window.zavorthDesktop?.automations?.run(id);
    await refreshScheduledTasks();
    if (result && !result.ok) {
      throw new Error(result.error || 'O runtime não concluiu a automação.');
    }
    return result;
  }, [refreshScheduledTasks]);

  const loadScheduledTaskLogs = useCallback(async (sessionId: string) => {
    try {
      return await window.zavorthDesktop?.automations?.logs(sessionId) || [];
    } catch {
      return [];
    }
  }, []);

  return {
    scheduledTasks,
    handleAddScheduledTask,
    handleDeleteScheduledTask,
    handleToggleScheduledTask,
    handleRunScheduledTask,
    loadScheduledTaskLogs,
  };
}
