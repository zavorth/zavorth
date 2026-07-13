import { useCallback, useEffect, useRef, useState } from 'react';
import { voiceDuplexAction } from '../apiClient';
import {
  resolveDictationLanguage,
  speechRecognitionAvailability,
  speechRecognitionConstructor,
} from './voiceDictation';

type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: {
    resultIndex?: number;
    results: ArrayLike<ArrayLike<{ transcript?: string }> & { isFinal?: boolean }>;
  }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
};

/**
 * Call-like duplex: continuous mic listen → agent turn → browser TTS, with barge-in.
 * Not WebRTC media streaming; simultaneous listen while speaking via continuous recognition.
 */
export function useDuplexCall(options: {
  language?: string;
  onNotice?: (message: string) => void;
  onSession?: (session: Record<string, unknown> | null) => void;
  onLog?: (raw: string) => void;
}) {
  const [active, setActive] = useState(false);
  const [phase, setPhase] = useState<string>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [interim, setInterim] = useState('');
  const [busy, setBusy] = useState(false);

  const recognitionRef = useRef<RecognitionLike | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const speakingRef = useRef(false);
  const intentionalStopRef = useRef(false);
  const processingRef = useRef(false);

  const onNoticeRef = useRef(options.onNotice);
  const onSessionRef = useRef(options.onSession);
  const onLogRef = useRef(options.onLog);
  const languageRef = useRef(options.language);

  useEffect(() => {
    onNoticeRef.current = options.onNotice;
  }, [options.onNotice]);
  useEffect(() => {
    onSessionRef.current = options.onSession;
  }, [options.onSession]);
  useEffect(() => {
    onLogRef.current = options.onLog;
  }, [options.onLog]);
  useEffect(() => {
    languageRef.current = options.language;
  }, [options.language]);

  const stopRecognition = useCallback(() => {
    intentionalStopRef.current = true;
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }
    recognitionRef.current = null;
  }, []);

  const cancelSpeech = useCallback(() => {
    try {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    } catch {
      // ignore
    }
    speakingRef.current = false;
  }, []);

  const speakReply = useCallback(
    async (text: string, sid: string) => {
      const clean = String(text || '').trim();
      if (!clean || typeof window === 'undefined' || !window.speechSynthesis) {
        return;
      }
      speakingRef.current = true;
      setPhase('speaking');
      await new Promise<void>((resolve) => {
        const utter = new SpeechSynthesisUtterance(clean);
        utter.lang = resolveDictationLanguage(languageRef.current || navigator.language);
        utter.onend = () => {
          speakingRef.current = false;
          resolve();
        };
        utter.onerror = () => {
          speakingRef.current = false;
          resolve();
        };
        window.speechSynthesis.speak(utter);
      });
      // If still same session and not barged, return to listening
      if (sessionIdRef.current === sid) {
        setPhase('listening');
      }
    },
    [],
  );

  const handleFinalTranscript = useCallback(
    async (transcript: string) => {
      const sid = sessionIdRef.current;
      if (!sid || !transcript.trim() || processingRef.current) return;

      // Barge-in if agent is speaking
      if (speakingRef.current) {
        cancelSpeech();
        try {
          await voiceDuplexAction({ action: 'barge_in', sessionId: sid });
        } catch {
          // continue
        }
      }

      processingRef.current = true;
      setBusy(true);
      setPhase('processing');
      setInterim('');
      try {
        const res = await voiceDuplexAction({
          action: 'listen',
          sessionId: sid,
          transcript: transcript.trim(),
        });
        const session = (res.session || null) as Record<string, unknown> | null;
        onSessionRef.current?.(session);
        onLogRef.current?.(JSON.stringify(session || res, null, 2));
        const phaseNext = String(session?.phase || 'listening');
        setPhase(phaseNext);
        const reply = String(session?.lastAgentText || '').trim();
        if (reply) {
          await speakReply(reply, sid);
        } else {
          setPhase('listening');
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        onNoticeRef.current?.(message);
        setPhase('error');
      } finally {
        processingRef.current = false;
        setBusy(false);
      }
    },
    [cancelSpeech, speakReply],
  );

  const startRecognition = useCallback(() => {
    const availability = speechRecognitionAvailability(
      window as unknown as {
        SpeechRecognition?: unknown;
        webkitSpeechRecognition?: unknown;
      },
    );
    if (!availability.available) {
      onNoticeRef.current?.(
        'Continuous mic unavailable — use manual “Listen turn” or type instead.',
      );
      return false;
    }
    const Ctor = speechRecognitionConstructor(
      window as unknown as {
        SpeechRecognition?: unknown;
        webkitSpeechRecognition?: unknown;
      },
    );
    if (!Ctor) return false;

    intentionalStopRef.current = false;
    const recognition = new Ctor() as unknown as RecognitionLike;
    recognition.lang = resolveDictationLanguage(
      languageRef.current || navigator.language,
    );
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      const results = event.results;
      if (!results || results.length === 0) return;
      let finalChunk = '';
      let interimChunk = '';
      const start = typeof event.resultIndex === 'number' ? event.resultIndex : 0;
      for (let i = start; i < results.length; i += 1) {
        const entry = results[i];
        const transcript = String(entry?.[0]?.transcript || '').trim();
        if (!transcript) continue;
        if (entry?.isFinal === false) {
          interimChunk = interimChunk ? `${interimChunk} ${transcript}` : transcript;
        } else {
          finalChunk = finalChunk ? `${finalChunk} ${transcript}` : transcript;
        }
      }
      if (interimChunk) setInterim(interimChunk);
      if (finalChunk) {
        void handleFinalTranscript(finalChunk);
      }
    };
    recognition.onerror = (event) => {
      const code = String(event.error || 'unknown');
      if (code !== 'aborted' && code !== 'no-speech') {
        onNoticeRef.current?.(`Mic error: ${code}`);
      }
    };
    recognition.onend = () => {
      if (!intentionalStopRef.current && sessionIdRef.current) {
        try {
          recognition.start();
        } catch {
          // ignore restart failure
        }
      }
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
      return true;
    } catch {
      onNoticeRef.current?.('Could not start microphone recognition.');
      return false;
    }
  }, [handleFinalTranscript]);

  const start = useCallback(async () => {
    setBusy(true);
    try {
      const res = await voiceDuplexAction({ action: 'start', surface: 'desktop' });
      const session = (res.session || {}) as Record<string, unknown>;
      const id = String(session.sessionId || '');
      if (!id) throw new Error('Duplex session did not return sessionId.');
      sessionIdRef.current = id;
      setSessionId(id);
      setActive(true);
      setPhase(String(session.phase || 'listening'));
      onSessionRef.current?.(session);
      onLogRef.current?.(JSON.stringify(session, null, 2));
      startRecognition();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      onNoticeRef.current?.(message);
      setActive(false);
      setPhase('idle');
    } finally {
      setBusy(false);
    }
  }, [startRecognition]);

  const end = useCallback(async () => {
    intentionalStopRef.current = true;
    stopRecognition();
    cancelSpeech();
    const sid = sessionIdRef.current;
    sessionIdRef.current = null;
    setSessionId(null);
    setActive(false);
    setPhase('idle');
    setInterim('');
    if (!sid) return;
    try {
      const res = await voiceDuplexAction({ action: 'end', sessionId: sid });
      onSessionRef.current?.(null);
      onLogRef.current?.(JSON.stringify(res.session || res, null, 2));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      onNoticeRef.current?.(message);
    }
  }, [cancelSpeech, stopRecognition]);

  const manualTurn = useCallback(
    async (transcript: string) => {
      await handleFinalTranscript(transcript);
    },
    [handleFinalTranscript],
  );

  useEffect(() => {
    return () => {
      intentionalStopRef.current = true;
      stopRecognition();
      cancelSpeech();
    };
  }, [cancelSpeech, stopRecognition]);

  return {
    active,
    phase,
    sessionId,
    interim,
    busy,
    start,
    end,
    manualTurn,
  };
}
