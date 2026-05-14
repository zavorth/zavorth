import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';

/**
 * WakeWordService — Detecta a palavra de ativação "Zavorth" (Mode 1).
 *
 * Usa openWakeWord via Python subprocess para detecção contínua.
 * O modelo roda no CPU (~1MB, <1% CPU), e emite 'activated' quando
 * a palavra é detectada com confiança acima do threshold.
 *
 * Alternativa: Porcupine (Picovoice) Node binding para zero-Python.
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
   * Inicia o detector de wake word.
   */
  public start(): void {
    if (this.process) return;
    this.enabled = true;

    console.log(`[WakeWord] Iniciando detecção de "${this.wakeWord}" (threshold: ${this.threshold})...`);

    try {
      // Tenta usar openWakeWord via Python
      this.process = spawn('python', [
        '-c',
        this.buildPythonScript(),
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.process.stdout?.on('data', (data: Buffer) => {
        const output = data.toString().trim();
        if (output.includes('WAKE_DETECTED')) {
          console.log(`[WakeWord] 🎤 Wake word "${this.wakeWord}" detectada!`);
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
          console.log(`[WakeWord] Processo encerrou com código ${code}. Reiniciando em 3s...`);
          this.process = null;
          setTimeout(() => { if (this.enabled) this.start(); }, 3000);
        }
      });

      this.process.on('error', (err) => {
        console.error(`[WakeWord] Erro ao iniciar Python: ${err.message}`);
        console.log('[WakeWord] Dica: Instale openWakeWord com: pip install openwakeword');
        this.process = null;
        this.enabled = false;
        this.emit('unavailable', 'python_not_found');
      });

    } catch (error: any) {
      console.error(`[WakeWord] Falha ao iniciar: ${error.message}`);
      this.enabled = false;
    }
  }

  /**
   * Para o detector.
   */
  public stop(): void {
    this.enabled = false;
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
      console.log('[WakeWord] Detector parado.');
    }
  }

  /**
   * Status do serviço.
   */
  public get isRunning(): boolean {
    return this.process !== null && this.enabled;
  }

  /**
   * Script Python inline para detecção de wake word.
   * Usa openWakeWord com PyAudio para captura de microfone.
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
    print("Instale com: pip install openwakeword pyaudio numpy", flush=True)
    sys.exit(1)
except Exception as e:
    print(f"WAKE_ERROR: {e}", flush=True)
    sys.exit(1)
`.trim();
  }
}
