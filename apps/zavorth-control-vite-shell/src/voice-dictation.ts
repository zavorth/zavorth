import { asErrorLike } from '../../../src/utils/errorLike';
import { createShellLogger } from './shell-debug';

const log = createShellLogger('voice');

export type VoiceTranscript = {
  transcript: string;
  language: string;
  source: 'speech-recognition';
  confidence: number | null;
};

type BindVoiceDictationOptions = {
  voiceButton: HTMLElement | null;
  composeInput: HTMLTextAreaElement | HTMLInputElement | null;
  getLanguage: () => string;
  isListening: () => boolean;
  onListeningChange: (listening: boolean) => void;
  onTranscript: (transcript: VoiceTranscript) => void;
  onNotice: (message: string) => void;
  onAttachFile?: (files: File[]) => Promise<void>;
};

type SpeechRecognitionConstructor = new () => SpeechRecognition;

type SpeechRecognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onerror: ((event?: { error?: string; message?: string }) => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0?: {
      transcript?: string;
      confidence?: number;
    };
  }>;
};

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

function ensureVoiceOverlay() {
  let voiceOverlay = document.getElementById('voice-listening-overlay');
  if (voiceOverlay) return voiceOverlay;

  voiceOverlay = document.createElement('div');
  voiceOverlay.id = 'voice-listening-overlay';
  voiceOverlay.className = 'voice-overlay hidden';
  voiceOverlay.innerHTML = `
    <div class="voice-overlay__backdrop"></div>
    <div class="voice-overlay__content">
      <div class="voice-overlay__levels">
        <span></span><span></span><span></span><span></span><span></span>
      </div>
      <div class="voice-overlay__text">Listening... Speak now.</div>
    </div>
  `;
  document.body.appendChild(voiceOverlay);
  return voiceOverlay;
}

function setOverlayText(voiceOverlay: HTMLElement, message: string) {
  const textNode = voiceOverlay.querySelector('.voice-overlay__text');
  if (textNode) textNode.textContent = window.ZavorthLocale?.t(message) || message;
}

function voiceNotice(message: string) {
  return window.ZavorthLocale?.t(message) || message;
}

function voiceErrorMessage(error: string | undefined, language: string) {
  if (error === 'not-allowed' || error === 'service-not-allowed') {
    return 'Microphone access is blocked. Allow microphone permission for this site and try again.';
  }
  if (error === 'audio-capture') {
    return 'No microphone was detected by the browser. Check the input device and try again.';
  }
  if (error === 'language-not-supported') {
    return `Voice language ${language} is not supported by this browser. Choose another voice language or type.`;
  }
  if (error === 'network') {
    return 'Voice recognition needs browser speech services. Check the connection or type the request.';
  }
  if (error === 'no-speech') {
    return `I could not detect speech in ${language}. Speak closer to the microphone, or switch the voice language in Settings.`;
  }
  return 'I could not capture audio. Check microphone permission, voice language, or type the request.';
}

export function bindVoiceDictation({
  voiceButton,
  composeInput,
  getLanguage,
  isListening,
  onListeningChange,
  onTranscript,
  onNotice,
  onAttachFile,
}: BindVoiceDictationOptions) {
  if (!voiceButton) return;

  let activeRecognition: SpeechRecognition | null = null;
  let activeRecorder: MediaRecorder | null = null;
  let recordingStream: MediaStream | null = null;
  let recordingChunks: Blob[] = [];
  const voiceOverlay = ensureVoiceOverlay();

  const stopListening = () => {
    if (activeRecognition && isListening()) {
      try {
        activeRecognition.stop();
      } catch (error: unknown) {
        const err = asErrorLike(error);
        log.warn('recognition stop', err);
      }
    }
    if (activeRecorder && activeRecorder.state !== 'inactive') {
      try {
        activeRecorder.stop();
      } catch (error: unknown) {
        const err = asErrorLike(error);
        log.warn('recorder stop', err);
      }
    }
    if (recordingStream) {
      if (!activeRecorder || activeRecorder.state === 'inactive') {
        recordingStream.getTracks().forEach((track) => track.stop());
        recordingStream = null;
      }
    }
    onListeningChange(false);
    voiceOverlay.classList.add('hidden');
  };

  voiceOverlay.addEventListener('click', stopListening);

  async function startAudioRecording() {
    if (!navigator.mediaDevices?.getUserMedia) {
      onNotice(voiceNotice('Voice is not available in this browser yet. Type or paste the transcribed text.'));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStream = stream;
      recordingChunks = [];

      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/ogg';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/mp4';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = ''; // Let browser choose default
      }

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      activeRecorder = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordingChunks.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const finalMime = recorder.mimeType || 'audio/webm';
        const blob = new Blob(recordingChunks, { type: finalMime });
        const ext = finalMime.includes('webm') ? 'webm' : finalMime.includes('ogg') ? 'ogg' : finalMime.includes('mp4') ? 'mp4' : 'wav';
        const file = new File([blob], `gravacao-voz.${ext}`, { type: finalMime });

        if (onAttachFile) {
          await onAttachFile([file]);
        }
        if (composeInput) {
          composeInput.value = `[Audio: gravacao-voz.${ext}]`;
          composeInput.dispatchEvent(new Event('input'));
        }
        if (recordingStream) {
          recordingStream.getTracks().forEach((track) => track.stop());
          recordingStream = null;
        }
        onNotice(voiceNotice('Voice note recorded and attached successfully!'));
        activeRecorder = null;
      };

      onListeningChange(true);
      voiceOverlay.classList.remove('hidden');
      setOverlayText(voiceOverlay, 'Recording audio... Click to stop.');

      recorder.start();
    } catch (error: unknown) {
      log.error('Error starting MediaRecorder', error);
      onNotice(voiceNotice('Microphone access is blocked. Allow microphone permission for this site and try again.'));
    }
  }

  voiceButton.addEventListener('click', async () => {
    if (isListening()) {
      stopListening();
      return;
    }

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      log.warn('SpeechRecognition is not supported; using raw audio fallback');
      await startAudioRecording();
      return;
    }

    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      } catch {
        onNotice(voiceNotice('Microphone access is blocked. Allow microphone permission for this site and try again.'));
        return;
      }
    }

    const recognition = new Recognition();
    activeRecognition = recognition;
    recognition.lang = getLanguage() || 'en-US';
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    let finalTranscript = '';
    let confidence: number | null = null;

    recognition.onstart = () => {
      onListeningChange(true);
      voiceOverlay.classList.remove('hidden');
      setOverlayText(voiceOverlay, 'Listening... Speak now.');
    };

    recognition.onerror = async (event) => {
      log.warn('SpeechRecognition failed', event?.error);
      stopListening();

      // Seamless fallback on network or service blockages!
      if (event?.error === 'network' || event?.error === 'service-not-allowed' || event?.error === 'language-not-supported') {
        onNotice(voiceNotice('Speech recognition failed. Switching to direct audio recording...'));
        await startAudioRecording();
      } else {
        onNotice(voiceNotice(voiceErrorMessage(event?.error, recognition.lang || 'default')));
      }
    };

    recognition.onend = () => {
      onListeningChange(false);
      voiceOverlay.classList.add('hidden');
      activeRecognition = null;
    };

    recognition.onresult = (event) => {
      if (!composeInput) return;

      let interim = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = String(result?.[0]?.transcript || '').trim();
        if (!transcript) continue;
        if (typeof result?.[0]?.confidence === 'number') confidence = result[0].confidence;
        if (result.isFinal) finalTranscript = `${finalTranscript} ${transcript}`.trim();
        else interim = `${interim} ${transcript}`.trim();
      }

      const spoken = [finalTranscript, interim].filter(Boolean).join(' ').trim();
      if (!spoken) return;

      const payload = {
        transcript: spoken,
        language: recognition.lang || 'en-US',
        source: 'speech-recognition' as const,
        confidence,
      };

      onTranscript(payload);
      setOverlayText(voiceOverlay, `"${spoken}"`);

      composeInput.value = spoken;
      composeInput.dispatchEvent(new Event('input'));
      composeInput.focus();
    };

    recognition.start();
  });
}
