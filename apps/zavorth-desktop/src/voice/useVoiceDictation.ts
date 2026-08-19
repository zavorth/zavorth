import { useCallback, useEffect, useRef, useState } from 'react';
import {
  mergeDictationTranscript,
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
};

export function useVoiceDictation(input: {
  value: string;
  onChange: (value: string) => void;
  onNotice?: (message: string) => void;
}) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const valueRef = useRef(input.value);
  const onChangeRef = useRef(input.onChange);
  const onNoticeRef = useRef(input.onNotice);
  const intentionalStopRef = useRef(false);

  useEffect(() => {
    valueRef.current = input.value;
  }, [input.value]);

  useEffect(() => {
    onChangeRef.current = input.onChange;
  }, [input.onChange]);

  useEffect(() => {
    onNoticeRef.current = input.onNotice;
  }, [input.onNotice]);

  const stop = useCallback(() => {
    intentionalStopRef.current = true;
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }
    recognitionRef.current = null;
    setListening(false);
  }, []);

  const toggle = useCallback(() => {
    const availability = speechRecognitionAvailability(window as unknown as {
      SpeechRecognition?: unknown;
      webkitSpeechRecognition?: unknown;
    });
    if (!availability.available) {
      onNoticeRef.current?.('Voice dictation is not available in this environment.');
      return;
    }

    if (listening) {
      stop();
      return;
    }

    const Ctor = speechRecognitionConstructor(window as unknown as {
      SpeechRecognition?: unknown;
      webkitSpeechRecognition?: unknown;
    }) as (new () => RecognitionLike) | null;
    if (!Ctor) {
      onNoticeRef.current?.('Voice dictation is not available in this environment.');
      return;
    }

    intentionalStopRef.current = false;
    const recognition = new Ctor();
    recognition.lang = resolveDictationLanguage(navigator.language);
    // Continuous mode keeps the mic open until the user stops or the OS ends the session.
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      const results = event.results;
      if (!results || results.length === 0) return;
      let finalChunk = '';
      const start = typeof event.resultIndex === 'number' ? event.resultIndex : 0;
      for (let i = start; i < results.length; i += 1) {
        const entry = results[i];
        const transcript = String(entry?.[0]?.transcript || '').trim();
        if (!transcript) continue;
        // Prefer final segments; still accept non-final when the engine only emits interim.
        if (entry?.isFinal !== false) {
          finalChunk = finalChunk ? `${finalChunk} ${transcript}` : transcript;
        }
      }
      if (!finalChunk) {
        // Last result as fallback when isFinal is never set by the engine.
        const last = results[results.length - 1]?.[0];
        finalChunk = String(last?.transcript || '').trim();
        if (!finalChunk || results[results.length - 1]?.isFinal === false) {
          return;
        }
      }
      onChangeRef.current(mergeDictationTranscript(valueRef.current, finalChunk));
    };
    recognition.onerror = (event) => {
      if (event.error && event.error !== 'aborted' && event.error !== 'no-speech') {
        onNoticeRef.current?.(`Voice error: ${event.error}`);
      }
      setListening(false);
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      // Some browsers end continuous sessions early; auto-restart unless user stopped.
      if (!intentionalStopRef.current && listening) {
        try {
          const again = new Ctor();
          again.lang = recognition.lang;
          again.continuous = true;
          again.interimResults = true;
          again.onresult = recognition.onresult;
          again.onerror = recognition.onerror;
          again.onend = recognition.onend;
          recognitionRef.current = again;
          again.start();
          setListening(true);
          return;
        } catch {
          // fall through to stop state
        }
      }
      setListening(false);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
      onNoticeRef.current?.('Listening… speak now (Ctrl+Shift+Space to stop).');
    } catch {
      onNoticeRef.current?.('Could not start voice dictation.');
      setListening(false);
    }
  }, [listening, stop]);

  return {
    listening,
    toggle,
    stop,
    available: speechRecognitionAvailability(window as unknown as {
      SpeechRecognition?: unknown;
      webkitSpeechRecognition?: unknown;
    }).available,
  };
}
