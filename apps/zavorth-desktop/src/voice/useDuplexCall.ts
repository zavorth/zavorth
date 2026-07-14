import { useCallback, useEffect, useRef, useState } from 'react';
import { voiceDuplexAction } from '../apiClient';
import {
  resolveDictationLanguage,
  speechRecognitionAvailability,
  speechRecognitionConstructor,
} from './voiceDictation';
import { BrowserVoiceVad } from './voiceVad';
import { resolveVoiceCallStatus } from './voiceCallStatus';

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

type MediaMode = 'webrtc_media' | 'media_stream' | 'speech_recognition' | 'none';

/**
 * Improved duplex call:
 * - Binds to experience sessionId + workspace (Desktop thread continuity)
 * - RTCPeerConnection offer → server auto-answer → ICE
 * - MediaRecorder + browser VAD (speech energy / end-of-utterance)
 * - SpeechRecognition fallback
 * - Backend TTS playback + barge-in
 */
export function useDuplexCall(options: {
  language?: string;
  experienceSessionId?: string | null;
  workspace?: string | null;
  preferMediaStream?: boolean;
  injectChat?: (turn: { userText: string; agentText: string }) => void;
  onNotice?: (message: string) => void;
  onSession?: (session: Record<string, unknown> | null) => void;
  onLog?: (raw: string) => void;
}) {
  const [active, setActive] = useState(false);
  const [phase, setPhase] = useState<string>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [signalId, setSignalId] = useState<string | null>(null);
  const [webrtcState, setWebrtcState] = useState<string>('idle');
  const [interim, setInterim] = useState('');
  const [busy, setBusy] = useState(false);
  const [mediaMode, setMediaMode] = useState<MediaMode>('none');
  const [rms, setRms] = useState(0);
  const [mediaPlane, setMediaPlane] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const recognitionRef = useRef<RecognitionLike | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const vadRef = useRef<BrowserVoiceVad | null>(null);
  const vadTimerRef = useRef<number | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const speakingRef = useRef(false);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const intentionalStopRef = useRef(false);
  const processingRef = useRef(false);
  const speechActiveRef = useRef(false);
  const mediaPlaneRef = useRef<string | null>(null);
  const lastTurnRef = useRef(0);
  const pollTimerRef = useRef<number | null>(null);
  const pushCancelRef = useRef<(() => void) | null>(null);

  const onNoticeRef = useRef(options.onNotice);
  const onSessionRef = useRef(options.onSession);
  const onLogRef = useRef(options.onLog);
  const injectChatRef = useRef(options.injectChat);
  const languageRef = useRef(options.language);
  const experienceSessionIdRef = useRef(options.experienceSessionId);
  const workspaceRef = useRef(options.workspace);

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
    injectChatRef.current = options.injectChat;
  }, [options.injectChat]);
  useEffect(() => {
    languageRef.current = options.language;
  }, [options.language]);
  useEffect(() => {
    experienceSessionIdRef.current = options.experienceSessionId;
  }, [options.experienceSessionId]);
  useEffect(() => {
    workspaceRef.current = options.workspace;
  }, [options.workspace]);

  const stopRecognition = useCallback(() => {
    intentionalStopRef.current = true;
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }
    recognitionRef.current = null;
  }, []);

  const stopVad = useCallback(() => {
    if (vadTimerRef.current != null) {
      window.clearInterval(vadTimerRef.current);
      vadTimerRef.current = null;
    }
    vadRef.current?.dispose();
    vadRef.current = null;
  }, []);

  const stopMediaStream = useCallback(() => {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    } catch {
      // ignore
    }
    mediaRecorderRef.current = null;
    try {
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {
      // ignore
    }
    mediaStreamRef.current = null;
    stopVad();
  }, [stopVad]);

  const stopPeer = useCallback(() => {
    try {
      peerRef.current?.close();
    } catch {
      // ignore
    }
    peerRef.current = null;
    setWebrtcState('idle');
  }, []);

  const cancelSpeech = useCallback(() => {
    try {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    } catch {
      // ignore
    }
    try {
      if (audioElRef.current) {
        audioElRef.current.pause();
        audioElRef.current = null;
      }
    } catch {
      // ignore
    }
    speakingRef.current = false;
  }, []);

  const speakReply = useCallback(async (session: Record<string, unknown>, sid: string) => {
    const text = String(session.lastAgentText || '').trim();
    const tts = session.lastTtsAudio as
      | { mimeType?: string; audioBase64?: string }
      | null
      | undefined;

    if (tts?.audioBase64) {
      speakingRef.current = true;
      setPhase('speaking');
      try {
        const binary = atob(tts.audioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: tts.mimeType || 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        await new Promise<void>((resolve) => {
          const audio = new Audio(url);
          audioElRef.current = audio;
          audio.onended = () => {
            URL.revokeObjectURL(url);
            speakingRef.current = false;
            resolve();
          };
          audio.onerror = () => {
            URL.revokeObjectURL(url);
            speakingRef.current = false;
            resolve();
          };
          void audio.play().catch(() => {
            speakingRef.current = false;
            resolve();
          });
        });
      } catch {
        speakingRef.current = false;
      }
    } else if (text && typeof window !== 'undefined' && window.speechSynthesis) {
      speakingRef.current = true;
      setPhase('speaking');
      await new Promise<void>((resolve) => {
        const utter = new SpeechSynthesisUtterance(text);
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
    }

    if (sessionIdRef.current === sid) {
      setPhase('listening');
    }
  }, []);

  const handleSessionResult = useCallback(
    async (session: Record<string, unknown> | null, sid: string) => {
      if (!session) return;
      onSessionRef.current?.(session);
      onLogRef.current?.(JSON.stringify(session, null, 2));
      setPhase(String(session.phase || 'listening'));
      const userText = String(session.lastTranscript || '').trim();
      const agentText = String(session.lastAgentText || '').trim();
      if (userText && agentText) {
        injectChatRef.current?.({ userText, agentText });
      }
      if (agentText) {
        await speakReply(session, sid);
      } else {
        setPhase('listening');
      }
    },
    [speakReply],
  );

  const handleFinalTranscript = useCallback(
    async (transcript: string) => {
      const sid = sessionIdRef.current;
      if (!sid || !transcript.trim() || processingRef.current) return;

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
          language: languageRef.current,
        });
        await handleSessionResult(
          (res.session || null) as Record<string, unknown> | null,
          sid,
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        onNoticeRef.current?.(message);
        setPhase('error');
      } finally {
        processingRef.current = false;
        setBusy(false);
      }
    },
    [cancelSpeech, handleSessionResult],
  );

  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = String(reader.result || '');
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64 || '');
      };
      reader.onerror = () => reject(new Error('Failed to read media chunk'));
      reader.readAsDataURL(blob);
    });

  const sendMediaBlob = useCallback(
    async (blob: Blob, endOfUtterance: boolean, clientEnergy: number | null) => {
      const sid = sessionIdRef.current;
      if (!sid || !blob || blob.size < 800) return;
      if (processingRef.current && !endOfUtterance) return;

      if (speakingRef.current) {
        cancelSpeech();
        try {
          await voiceDuplexAction({ action: 'barge_in', sessionId: sid });
        } catch {
          // ignore
        }
      }

      if (endOfUtterance) {
        processingRef.current = true;
        setBusy(true);
        setPhase('processing');
      }

      try {
        const audioBase64 = await blobToBase64(blob);
        const res = await voiceDuplexAction({
          action: 'media_chunk',
          sessionId: sid,
          audioBase64,
          mimeType: blob.type || 'audio/webm',
          language: languageRef.current,
          runAgent: true,
          endOfUtterance,
          clientEnergy,
        });
        const result = (res as { result?: Record<string, unknown> }).result;
        const session = (res.session ||
          result?.session ||
          null) as Record<string, unknown> | null;

        if (result?.bufferedUtterance) {
          setInterim(String(result.bufferedUtterance));
        }
        if (result?.utteranceFlushed && session) {
          await handleSessionResult(session, sid);
        } else if (session && session.lastAgentText) {
          await handleSessionResult(session, sid);
        } else if (res.error && !result?.skipped) {
          onNoticeRef.current?.(String(res.error));
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (!/chunk_too_small|empty_transcript|silence|buffering|soft_fail|busy/i.test(message)) {
          onNoticeRef.current?.(message);
        }
        if (endOfUtterance) setPhase('listening');
      } finally {
        if (endOfUtterance) {
          processingRef.current = false;
          setBusy(false);
        }
      }
    },
    [cancelSpeech, handleSessionResult],
  );

  // Note: cancelSpeech is used inside startNativeSessionPush; declare dependency carefully.
  /**
   * Push path: long-poll wait_event (works via Desktop apiRequest bridge).
   * Server holds the request until bus event or timeout — replaces 900ms get-poll.
   */
  const startNativeSessionPush = useCallback((duplexSessionId: string) => {
    pushCancelRef.current?.();
    let cancelled = false;
    const run = async () => {
      while (!cancelled && sessionIdRef.current === duplexSessionId) {
        try {
          const res = await voiceDuplexAction({
            action: 'wait_event',
            sessionId: duplexSessionId,
            timeoutMs: 25_000,
            userId: 'desktop-user',
          });
          if (cancelled || sessionIdRef.current !== duplexSessionId) break;

          const event = (res as {
            event?: { type?: string; session?: Record<string, unknown>; message?: string };
            timedOut?: boolean;
            session?: Record<string, unknown>;
          }).event;
          const session = (event?.session ||
            (res as { session?: Record<string, unknown> }).session ||
            null) as Record<string, unknown> | null;

          if (!event || (res as { timedOut?: boolean }).timedOut) {
            continue;
          }

          if (event.type === 'partial' && (event as { partialText?: string }).partialText) {
            setInterim(String((event as { partialText?: string }).partialText));
            setPhase('listening');
            continue;
          }
          if (event.type === 'barge_in') {
            // Native RTP detected user speech while agent was speaking — stop local TTS
            cancelSpeech();
            setPhase('listening');
            setLastError(null);
            setBusy(false);
            processingRef.current = false;
            continue;
          }
          if (event.type === 'phase' && session?.phase) {
            const nextPhase = String(session.phase);
            if (nextPhase === 'listening' && speakingRef.current) {
              cancelSpeech();
            }
            setPhase(nextPhase);
          }
          if (event.type === 'error' && event.message) {
            const msg = String(event.message);
            onNoticeRef.current?.(msg);
            setLastError(msg);
            setPhase('error');
          }
          if (event.type === 'turn' || (event.type === 'session' && session?.lastAgentText)) {
            const turns = Number(session?.turnCount || 0);
            if (turns >= lastTurnRef.current) {
              lastTurnRef.current = turns;
              setLastError(null);
              await handleSessionResult(session, duplexSessionId);
            }
          }
          if (event.type === 'ended') {
            cancelSpeech();
            setPhase('ended');
            break;
          }
        } catch {
          await new Promise((r) => window.setTimeout(r, 800));
        }
      }
    };

    pushCancelRef.current = () => {
      cancelled = true;
    };
    void run();
  }, [cancelSpeech, handleSessionResult]);

  const startWebRtc = useCallback(
    async (stream: MediaStream, duplexSessionId: string) => {
      if (typeof RTCPeerConnection === 'undefined') return null;
      try {
        const signalRes = await voiceDuplexAction({
          action: 'webrtc_create',
          sessionId: duplexSessionId,
          surface: 'desktop',
        });
        const signal = (signalRes as { signal?: { signalId?: string } }).signal;
        const sid = String(signal?.signalId || '');
        if (!sid) return null;

        // Gap 2 — ICE/TURN from media-plane API (management-auth via bridge)
        let iceServers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
        try {
          const { loadVoiceMediaPlane } = await import('../apiClient');
          const plane = await loadVoiceMediaPlane();
          const servers = plane.ice?.iceServers;
          if (Array.isArray(servers) && servers.length > 0) {
            iceServers = servers as RTCIceServer[];
          }
        } catch {
          // keep default STUN
        }

        const pc = new RTCPeerConnection({ iceServers });
        peerRef.current = pc;
        stream.getAudioTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        pc.onicecandidate = (event) => {
          if (!event.candidate) return;
          void voiceDuplexAction({
            action: 'webrtc_ice',
            signalId: sid,
            candidate: {
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
            },
          }).catch(() => undefined);
        };

        pc.onconnectionstatechange = () => {
          const state = pc.connectionState;
          setWebrtcState(state);
          if (state === 'connected') {
            void voiceDuplexAction({ action: 'webrtc_connected', signalId: sid }).catch(
              () => undefined,
            );
          }
        };

        const offer = await pc.createOffer({ offerToReceiveAudio: false });
        await pc.setLocalDescription(offer);
        const answered = await voiceDuplexAction({
          action: 'webrtc_offer',
          signalId: sid,
          sessionId: duplexSessionId,
          sdp: offer.sdp,
          autoAnswer: true,
        });
        const plane = String(
          (answered as { mediaPlane?: string; signal?: { mediaPlane?: string } }).mediaPlane ||
            (answered as { signal?: { mediaPlane?: string } }).signal?.mediaPlane ||
            '',
        );
        if (plane) {
          mediaPlaneRef.current = plane;
          setMediaPlane(plane);
        }
        const answerSdp = String(
          (answered as { signal?: { answerSdp?: string } }).signal?.answerSdp || '',
        );
        if (answerSdp) {
          try {
            await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
            setWebrtcState(pc.connectionState || 'answer');
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            onNoticeRef.current?.(
              `WebRTC answer apply soft-failed (${message}); media stream continues.`,
            );
            mediaPlaneRef.current = 'sdp_munged';
            setMediaPlane('sdp_munged');
          }
        }
        setSignalId(sid);

        // Native RTP: server STT from PCM — push turns via wait_event long-poll
        if (plane === 'native_wrtc' || (answered as { nativeRtp?: boolean }).nativeRtp) {
          mediaPlaneRef.current = 'native_wrtc';
          setMediaPlane('native_wrtc');
          startNativeSessionPush(duplexSessionId);
        }
        return sid;
      } catch {
        return null;
      }
    },
    [startNativeSessionPush],
  );

  const startMediaStream = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      const vad = new BrowserVoiceVad({ speechThreshold: 0.018, silenceMsToEnd: 750 });
      const vadOk = vad.attach(stream);
      vadRef.current = vadOk ? vad : null;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 48_000 })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      let chunkBuffer: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (!event.data || event.data.size < 200) return;
        // Native RTP plane already feeds STT from server-side PCM — skip HTTP chunk STT
        if (mediaPlaneRef.current === 'native_wrtc') {
          const snap = vadRef.current?.sample() || { rms: 0, speaking: false, silenceMs: 0 };
          setRms(Number(snap.rms.toFixed(3)));
          return;
        }
        chunkBuffer.push(event.data);
        const snap = vadRef.current?.sample() || { rms: 0, speaking: false, silenceMs: 0 };
        setRms(Number(snap.rms.toFixed(3)));
        if (snap.speaking) {
          speechActiveRef.current = true;
          // Periodic partial send while speaking
          if (chunkBuffer.length >= 2) {
            const blob = new Blob(chunkBuffer, { type: event.data.type || 'audio/webm' });
            chunkBuffer = [];
            void sendMediaBlob(blob, false, snap.rms);
          }
        }
      };

      // VAD poll for end-of-utterance flush
      if (vadOk) {
        vadTimerRef.current = window.setInterval(() => {
          const snap = vad.sample();
          setRms(Number(snap.rms.toFixed(3)));
          if (snap.speaking) {
            speechActiveRef.current = true;
            return;
          }
          if (mediaPlaneRef.current === 'native_wrtc') {
            return;
          }
          if (speechActiveRef.current && snap.silenceMs >= 750) {
            speechActiveRef.current = false;
            try {
              if (recorder.state === 'recording') {
                recorder.requestData?.();
              }
            } catch {
              // ignore
            }
            // Flush remaining buffer as end of utterance
            window.setTimeout(() => {
              if (chunkBuffer.length > 0) {
                const blob = new Blob(chunkBuffer, {
                  type: mimeType || 'audio/webm',
                });
                chunkBuffer = [];
                void sendMediaBlob(blob, true, snap.rms);
              } else {
                // Empty silence flush — tell server to poll assembler
                void sendMediaBlob(
                  new Blob([new Uint8Array(1600)], { type: 'audio/webm' }),
                  true,
                  0,
                );
              }
            }, 40);
          }
        }, 120);
      }

      recorder.start(1200);

      // WebRTC signaling + peer (best-effort)
      const duplexId = sessionIdRef.current;
      if (duplexId) {
        const sig = await startWebRtc(stream, duplexId);
        setMediaMode(sig ? 'webrtc_media' : 'media_stream');
      } else {
        setMediaMode('media_stream');
      }
      return true;
    } catch {
      return false;
    }
  }, [sendMediaBlob, startWebRtc]);

  const startRecognition = useCallback(() => {
    const availability = speechRecognitionAvailability(
      window as unknown as {
        SpeechRecognition?: unknown;
        webkitSpeechRecognition?: unknown;
      },
    );
    if (!availability.available) return false;
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
      if (finalChunk) void handleFinalTranscript(finalChunk);
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
          // ignore
        }
      }
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setMediaMode('speech_recognition');
      return true;
    } catch {
      return false;
    }
  }, [handleFinalTranscript]);

  const start = useCallback(async () => {
    setBusy(true);
    setLastError(null);
    setPhase('connecting');
    try {
      const res = await voiceDuplexAction({
        action: 'start',
        surface: 'desktop',
        language: languageRef.current,
        sessionId: experienceSessionIdRef.current || undefined,
        workspace: workspaceRef.current || undefined,
        userId: 'desktop-user',
      });
      const session = (res.session || {}) as Record<string, unknown>;
      const id = String(session.sessionId || '');
      if (!id) throw new Error('Duplex session did not return sessionId.');
      sessionIdRef.current = id;
      setSessionId(id);
      setActive(true);
      setPhase('connecting');
      onSessionRef.current?.(session);
      onLogRef.current?.(JSON.stringify(session, null, 2));

      const preferMedia = options.preferMediaStream !== false;
      let started = false;
      if (preferMedia) {
        started = await startMediaStream();
      }
      if (!started) {
        started = startRecognition();
      }
      if (!started) {
        setMediaMode('none');
        setPhase('listening');
        onNoticeRef.current?.(
          'Mic/media unavailable — use Manual turn or type instead.',
        );
      } else {
        setPhase('listening');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      onNoticeRef.current?.(message);
      setLastError(message);
      setActive(false);
      setPhase('error');
    } finally {
      setBusy(false);
    }
  }, [options.preferMediaStream, startMediaStream, startRecognition]);

  const end = useCallback(async () => {
    intentionalStopRef.current = true;
    pushCancelRef.current?.();
    pushCancelRef.current = null;
    if (pollTimerRef.current != null) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    stopRecognition();
    stopMediaStream();
    stopPeer();
    cancelSpeech();
    const sid = sessionIdRef.current;
    const sig = signalId;
    sessionIdRef.current = null;
    setSessionId(null);
    setSignalId(null);
    setActive(false);
    setPhase('idle');
    setInterim('');
    setMediaMode('none');
    setMediaPlane(null);
    mediaPlaneRef.current = null;
    lastTurnRef.current = 0;
    setRms(0);
    if (sig) {
      try {
        await voiceDuplexAction({ action: 'webrtc_close', signalId: sig });
      } catch {
        // ignore
      }
    }
    if (!sid) return;
    try {
      const res = await voiceDuplexAction({ action: 'end', sessionId: sid });
      onSessionRef.current?.(null);
      onLogRef.current?.(JSON.stringify(res.session || res, null, 2));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      onNoticeRef.current?.(message);
    }
  }, [cancelSpeech, signalId, stopMediaStream, stopPeer, stopRecognition]);

  const manualTurn = useCallback(
    async (transcript: string) => {
      await handleFinalTranscript(transcript);
    },
    [handleFinalTranscript],
  );

  useEffect(() => {
    return () => {
      intentionalStopRef.current = true;
      pushCancelRef.current?.();
      pushCancelRef.current = null;
      if (pollTimerRef.current != null) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      stopRecognition();
      stopMediaStream();
      stopPeer();
      cancelSpeech();
    };
  }, [cancelSpeech, stopMediaStream, stopPeer, stopRecognition]);

  const status = resolveVoiceCallStatus({
    active,
    phase,
    webrtcState,
    mediaMode,
    mediaPlane,
    busy,
    lastError,
    rms,
  });

  return {
    active,
    phase,
    sessionId,
    signalId,
    webrtcState,
    interim,
    busy,
    mediaMode,
    mediaPlane,
    rms,
    lastError,
    status,
    statusLabel: status.label,
    statusDetail: status.detail,
    statusTone: status.tone,
    experienceSessionId: options.experienceSessionId || null,
    start,
    end,
    manualTurn,
  };
}
