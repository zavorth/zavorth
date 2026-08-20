import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../apiClient';
import {
  mascotLayoutForBehavior,
  mascotStateForDesktopEvent,
  loadMascotBehaviorSettings,
  type MascotPetState,
} from '../mascot-overlay/mascotPetConfig';

function latestAssistantBubble(messages: ChatMessage[], enabled: boolean): string | null {
  if (!enabled || messages.length === 0) return null;
  const lastMessage = messages[messages.length - 1];
  if (lastMessage.role !== 'assistant') return null;
  const textOnly = lastMessage.content || '';
  return textOnly.length > 80 ? `${textOnly.slice(0, 77)}...` : textOnly;
}

export function useMascotController(input: {
  busy: boolean;
  composerInput: string;
  messages: ChatMessage[];
  onSubmitPrompt: (text: string) => void | Promise<void>;
}) {
  const { busy, composerInput, messages, onSubmitPrompt } = input;
  const [mascotActive, setMascotActive] = useState(false);
  const [mascotTransientState, setMascotTransientState] = useState<MascotPetState | null>(null);
  const [mascotBehaviorSettings, setMascotBehaviorSettings] = useState(() => loadMascotBehaviorSettings());
  const prevMascotBusyRef = useRef(false);
  const mascotFinishTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleToggleMascot = useCallback(async () => {
    if (!window.zavorthDesktop?.mascotOverlay) return;
    if (mascotActive) {
      await window.zavorthDesktop.mascotOverlay.close();
      setMascotActive(false);
      return;
    }

    const screenWidth = window.screen.availWidth;
    const screenHeight = window.screen.availHeight;
    const layout = mascotLayoutForBehavior(mascotBehaviorSettings);
    await window.zavorthDesktop.mascotOverlay.open({
      x: screenWidth - layout.screenMarginX,
      y: screenHeight - layout.screenMarginY,
      width: layout.overlaySize,
      height: layout.overlaySize,
    });
    window.zavorthDesktop.mascotOverlay.state({ behaviorSettings: mascotBehaviorSettings });
    setMascotActive(true);
  }, [mascotActive, mascotBehaviorSettings]);

  useEffect(() => {
    const handleBehaviorUpdate = () => {
      const next = loadMascotBehaviorSettings();
      setMascotBehaviorSettings(next);
      if (!window.zavorthDesktop?.mascotOverlay || !mascotActive) {
        return;
      }
      const layout = mascotLayoutForBehavior(next);
      window.zavorthDesktop.mascotOverlay.setBounds({
        x: window.screen.availWidth - layout.screenMarginX,
        y: window.screen.availHeight - layout.screenMarginY,
        width: layout.overlaySize,
        height: layout.overlaySize,
      });
      window.zavorthDesktop.mascotOverlay.state({ behaviorSettings: next });
    };

    window.addEventListener('zvd:mascot-behavior-update', handleBehaviorUpdate);
    return () => window.removeEventListener('zvd:mascot-behavior-update', handleBehaviorUpdate);
  }, [mascotActive]);

  useEffect(() => {
    return () => {
      if (mascotFinishTimerRef.current) {
        clearTimeout(mascotFinishTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!window.zavorthDesktop?.mascotOverlay) return;

    const unsubscribe = window.zavorthDesktop.mascotOverlay.onControl((payload: unknown) => {
      const control = payload as { type?: string; text?: string } | null;
      if (control?.type === 'submit-prompt' && control.text) {
        void onSubmitPrompt(control.text);
      } else if (control?.type === 'pop-in') {
        setMascotActive(false);
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, [onSubmitPrompt]);

  useEffect(() => {
    if (!mascotActive) {
      prevMascotBusyRef.current = busy;
      if (mascotFinishTimerRef.current) {
        clearTimeout(mascotFinishTimerRef.current);
        mascotFinishTimerRef.current = undefined;
      }
      setMascotTransientState(null);
      return;
    }

    if (busy) {
      if (mascotFinishTimerRef.current) {
        clearTimeout(mascotFinishTimerRef.current);
        mascotFinishTimerRef.current = undefined;
      }
      setMascotTransientState(null);
      prevMascotBusyRef.current = true;
      return;
    }

    if (prevMascotBusyRef.current) {
      setMascotTransientState('finished');
      if (mascotFinishTimerRef.current) {
        clearTimeout(mascotFinishTimerRef.current);
      }
      mascotFinishTimerRef.current = setTimeout(() => {
        setMascotTransientState(null);
        mascotFinishTimerRef.current = undefined;
      }, 1800);
    }

    prevMascotBusyRef.current = busy;
  }, [busy, mascotActive]);

  useEffect(() => {
    if (!window.zavorthDesktop?.mascotOverlay || !mascotActive) return;

    const mascotState = mascotStateForDesktopEvent({
      busy,
      input: composerInput,
      transientState: mascotTransientState,
    }, mascotBehaviorSettings);

    window.zavorthDesktop.mascotOverlay.state({
      state: mascotState,
      bubbleText: latestAssistantBubble(messages, mascotBehaviorSettings.notifications),
      behaviorSettings: mascotBehaviorSettings,
    });
  }, [
    busy,
    composerInput,
    messages,
    mascotActive,
    mascotTransientState,
    mascotBehaviorSettings,
  ]);

  return {
    mascotActive,
    handleToggleMascot,
  };
}
