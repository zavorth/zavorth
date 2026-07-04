import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../apiClient';
import {
  kaelLayoutForBehavior,
  kaelStateForDesktopEvent,
  loadKaelBehaviorSettings,
  type KaelPetState,
} from '../kael-overlay/kaelPetConfig';

function latestAssistantBubble(messages: ChatMessage[], enabled: boolean): string | null {
  if (!enabled || messages.length === 0) return null;
  const lastMessage = messages[messages.length - 1];
  if (lastMessage.role !== 'assistant') return null;
  const textOnly = lastMessage.content || '';
  return textOnly.length > 80 ? `${textOnly.slice(0, 77)}...` : textOnly;
}

export function useKaelController(input: {
  busy: boolean;
  composerInput: string;
  messages: ChatMessage[];
  onSubmitPrompt: (text: string) => void | Promise<void>;
}) {
  const { busy, composerInput, messages, onSubmitPrompt } = input;
  const [kaelActive, setKaelActive] = useState(false);
  const [kaelTransientState, setKaelTransientState] = useState<KaelPetState | null>(null);
  const [kaelBehaviorSettings, setKaelBehaviorSettings] = useState(() => loadKaelBehaviorSettings());
  const prevKaelBusyRef = useRef(false);
  const kaelFinishTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleToggleKael = useCallback(async () => {
    if (!window.zavorthDesktop?.kaelOverlay) return;
    if (kaelActive) {
      await window.zavorthDesktop.kaelOverlay.close();
      setKaelActive(false);
      return;
    }

    const screenWidth = window.screen.availWidth;
    const screenHeight = window.screen.availHeight;
    const layout = kaelLayoutForBehavior(kaelBehaviorSettings);
    await window.zavorthDesktop.kaelOverlay.open({
      x: screenWidth - layout.screenMarginX,
      y: screenHeight - layout.screenMarginY,
      width: layout.overlaySize,
      height: layout.overlaySize,
    });
    window.zavorthDesktop.kaelOverlay.state({ behaviorSettings: kaelBehaviorSettings });
    setKaelActive(true);
  }, [kaelActive, kaelBehaviorSettings]);

  useEffect(() => {
    const handleBehaviorUpdate = () => {
      const next = loadKaelBehaviorSettings();
      setKaelBehaviorSettings(next);
      if (!window.zavorthDesktop?.kaelOverlay || !kaelActive) {
        return;
      }
      const layout = kaelLayoutForBehavior(next);
      window.zavorthDesktop.kaelOverlay.setBounds({
        x: window.screen.availWidth - layout.screenMarginX,
        y: window.screen.availHeight - layout.screenMarginY,
        width: layout.overlaySize,
        height: layout.overlaySize,
      });
      window.zavorthDesktop.kaelOverlay.state({ behaviorSettings: next });
    };

    window.addEventListener('zvd:kael-behavior-update', handleBehaviorUpdate);
    return () => window.removeEventListener('zvd:kael-behavior-update', handleBehaviorUpdate);
  }, [kaelActive]);

  useEffect(() => {
    return () => {
      if (kaelFinishTimerRef.current) {
        clearTimeout(kaelFinishTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!window.zavorthDesktop?.kaelOverlay) return;

    const unsubscribe = window.zavorthDesktop.kaelOverlay.onControl((payload: unknown) => {
      const control = payload as { type?: string; text?: string } | null;
      if (control?.type === 'submit-prompt' && control.text) {
        void onSubmitPrompt(control.text);
      } else if (control?.type === 'pop-in') {
        setKaelActive(false);
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, [onSubmitPrompt]);

  useEffect(() => {
    if (!kaelActive) {
      prevKaelBusyRef.current = busy;
      if (kaelFinishTimerRef.current) {
        clearTimeout(kaelFinishTimerRef.current);
        kaelFinishTimerRef.current = undefined;
      }
      setKaelTransientState(null);
      return;
    }

    if (busy) {
      if (kaelFinishTimerRef.current) {
        clearTimeout(kaelFinishTimerRef.current);
        kaelFinishTimerRef.current = undefined;
      }
      setKaelTransientState(null);
      prevKaelBusyRef.current = true;
      return;
    }

    if (prevKaelBusyRef.current) {
      setKaelTransientState('finished');
      if (kaelFinishTimerRef.current) {
        clearTimeout(kaelFinishTimerRef.current);
      }
      kaelFinishTimerRef.current = setTimeout(() => {
        setKaelTransientState(null);
        kaelFinishTimerRef.current = undefined;
      }, 1800);
    }

    prevKaelBusyRef.current = busy;
  }, [busy, kaelActive]);

  useEffect(() => {
    if (!window.zavorthDesktop?.kaelOverlay || !kaelActive) return;

    const mascotState = kaelStateForDesktopEvent({
      busy,
      input: composerInput,
      transientState: kaelTransientState,
    }, kaelBehaviorSettings);

    window.zavorthDesktop.kaelOverlay.state({
      state: mascotState,
      bubbleText: latestAssistantBubble(messages, kaelBehaviorSettings.notifications),
      behaviorSettings: kaelBehaviorSettings,
    });
  }, [
    busy,
    composerInput,
    messages,
    kaelActive,
    kaelTransientState,
    kaelBehaviorSettings,
  ]);

  return {
    kaelActive,
    handleToggleKael,
  };
}
