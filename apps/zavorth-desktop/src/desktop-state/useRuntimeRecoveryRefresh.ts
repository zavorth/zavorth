import { useEffect } from 'react';
import { shouldRefreshRuntimeForEvent } from './runtimeRecovery';

export function useRuntimeRecoveryRefresh(input: {
  bridgeReady: boolean;
  refreshRuntime: () => Promise<unknown>;
  refreshHome: () => Promise<unknown>;
  refreshPanels: () => Promise<unknown>;
}) {
  const { bridgeReady, refreshRuntime, refreshHome, refreshPanels } = input;

  useEffect(() => {
    if (!bridgeReady) return;

    let refreshing = false;
    const refresh = async (type: 'online' | 'focus' | 'visibilitychange' | 'resume') => {
      if (!shouldRefreshRuntimeForEvent({
        type,
        online: navigator.onLine !== false,
        visibilityState: document.visibilityState || 'visible',
      })) {
        return;
      }
      if (refreshing) return;
      refreshing = true;
      try {
        await refreshRuntime();
        await refreshHome();
        await refreshPanels();
      } catch {
        // Runtime recovery is opportunistic; visible notices are handled by the main app state.
      } finally {
        refreshing = false;
      }
    };

    const onOnline = () => void refresh('online');
    const onFocus = () => void refresh('focus');
    const onVisibilityChange = () => void refresh('visibilitychange');

    window.addEventListener('online', onOnline);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    const offPowerResume = window.zavorthDesktop?.onPowerResume?.(() => {
      void refresh('resume');
    });
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      offPowerResume?.();
    };
  }, [bridgeReady, refreshHome, refreshPanels, refreshRuntime]);
}
