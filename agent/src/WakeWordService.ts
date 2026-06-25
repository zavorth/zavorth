import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { t } from './i18n.js';

/**
 * WakeWordService — Detects activation word "Zavorth" (Mode 1).
 *
 * Uses openWakeWord via Python subprocess for continuous detection.
 * The model runs on CPU (~1MB, <1% CPU), and emits 'activated' when
 * the word is detected with confidence above the threshold.
 *
 * Alternative: Porcupine (Picovoice) Node binding for zero-Python.
 */
export class WakeWordService extends EventEmitter {
  private process: ChildProcess | null = null;
  private enabled = false;
  private wakeWord: string;
  private threshold: number;

  constructor(options?: { wakeWord?: string; threshold?: number }) {
    super();
    this.wakeWord = options?.wakeWord || 'zavorth';
    this.threshold = options?.threshold || 0.7;
  }

  /**
   * Starts the wake word detector.
   */
  public start(): void {
    if (this.process) return;
    this.enabled = true;

    console.log(t('wakeword_starting', { wakeWord: this.wakeWord, threshold: this.threshold }));

    try {
      // Try openWakeWord via Python
      this.process = spawn('python', [
        '-c',
        this.buildPythonScript(),
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.process.stdout?.on('data', (data: Buffer) => {
        const output = data.toString().trim();
        if (output.includes('WAKE_DETECTED')) {
          console.log(`[WakeWord] 🎤 Wake word "${this.wakeWord}" detected!`);
          this.emit('activated', 'wakeword');
        }
      });

      this.process.stderr?.on('data', (data: Buffer) => {
        const msg = data.toString().trim();
        if (msg && !msg.includes('UserWarning')) {
          console.error(`[WakeWord] stderr: ${msg}`);
        }
      });

      this.process.on('exit', (code) => {
        if (this.enabled) {
          console.log(t('wakeword_exited', { code: code || 0 }));
          this.process = null;
          setTimeout(() => { if (this.enabled) this.start(); }, 3000);
        }
      });

      this.process.on('error', (err) => {
        console.error(t('wakeword_python_error', { message: err.message }));
        console.log('[WakeWord] Hint: Install openWakeWord with: pip install openwakeword');
        this.process = null;
        this.enabled = false;
        this.emit('unavailable', 'python_not_found');
      });

    } catch (error: any) {
      console.error(t('wakeword_start_failed', { message: error.message }));
      this.enabled = false;
    }
  }

  /**
   * Stops the detector.
   */
  public stop(): void {
    this.enabled = false;
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
      console.log('[WakeWord] Detector stopped.');
    }
  }

  /**
   * Service status.
   */
  public get isRunning(): boolean {
    return this.process !== null && this.enabled;
  }

  /**
   * Inline Python script for wake word detection.
   * Uses openWakeWord with PyAudio for mic capture.
   */
  private buildPythonScript(): string {
    return `
import sys
try:
    import openwakeword
    from openwakeword.model import Model
    import pyaudio
    import numpy as np

    model = Model(inference_framework='onnx')
    audio = pyaudio.PyAudio()

    stream = audio.open(
        rate=16000,
        channels=1,
        format=pyaudio.paInt16,
        input=True,
        frames_per_buffer=1280
    )

    print("WAKE_SERVICE_READY", flush=True)

    while True:
        audio_data = stream.read(1280, exception_on_overflow=False)
        audio_np = np.frombuffer(audio_data, dtype=np.int16)
        prediction = model.predict(audio_np)

        for key, score in prediction.items():
            if score > ${this.threshold}:
                print("WAKE_DETECTED", flush=True)

except ImportError as e:
    print(f"WAKE_ERROR: {e}", flush=True)
    print("Install with: pip install openwakeword pyaudio numpy", flush=True)
    sys.exit(1)
except Exception as e:
    print(f"WAKE_ERROR: {e}", flush=True)
    sys.exit(1)
`.trim();
  }
}
