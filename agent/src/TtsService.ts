import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const execAsync = promisify(exec);

/**
 * TtsService - Text-to-Speech local-first para o Zavorth Agent.
 *
 * Continua priorizando `edge-tts` localmente, mas agora expoe o caminho
 * edge-only para o pipeline hibrido tentar cloud voice antes do fallback SAPI.
 */
export class TtsService {
  private voice: string;
  private rate: string;
  private volume: string;

  constructor(options?: {
    voice?: string;
    rate?: string;
    volume?: string;
  }) {
    this.voice = options?.voice || 'en-US-GuyNeural';
    this.rate = options?.rate || '+0%';
    this.volume = options?.volume || '+0%';
  }

  /**
   * Converte texto em audio e reproduz.
   * Mantem o comportamento legado: edge-tts primeiro, SAPI por ultimo recurso.
   */
  public async speak(text: string): Promise<string> {
    try {
      return await this.speakEdge(text);
    } catch (error: any) {
      console.error(`[TTS] Falha: ${error.message}`);

      try {
        return await this.speakSystemFallback(text);
      } catch {
        throw new Error(`Nenhum metodo de TTS disponivel: ${error.message}`);
      }
    }
  }

  /**
   * Caminho local premium: gera audio via edge-tts sem cair no fallback do sistema.
   */
  public async speakEdge(text: string): Promise<string> {
    const audioPath = path.join(os.tmpdir(), `zavorth_tts_${Date.now()}.mp3`);

    console.log(`[TTS] Falando: "${text.substring(0, 60)}${text.length > 60 ? '...' : ''}"`);

    await this.generateAudio(text, audioPath);
    await TtsService.playAudioFile(audioPath);

    return audioPath;
  }

  /**
   * Ultimo recurso local para nao bloquear o fluxo do agent no Windows.
   */
  public async speakSystemFallback(text: string): Promise<string> {
    await this.speakViaSapi(text);
    return '';
  }

  /**
   * Gera audio via edge-tts CLI (Python).
   */
  private async generateAudio(text: string, outputPath: string): Promise<void> {
    const safeText = text
      .replace(/"/g, '\\"')
      .replace(/\n/g, ' ')
      .replace(/[<>]/g, '');

    await execAsync(
      `edge-tts --voice "${this.voice}" --rate="${this.rate}" --volume="${this.volume}" --text "${safeText}" --write-media "${outputPath}"`,
      { timeout: 15000 },
    );

    if (!fs.existsSync(outputPath)) {
      throw new Error('edge-tts nao gerou o arquivo de audio.');
    }
  }

  /**
   * Reproduz um arquivo de audio no host local.
   */
  public static async playAudioFile(filePath: string): Promise<void> {
    const platform = os.platform();

    if (platform === 'win32') {
      await execAsync(
        `powershell -NoProfile -Command "$player = New-Object System.Media.SoundPlayer; $player.SoundLocation = ''; Add-Type -AssemblyName presentationCore; $media = New-Object System.Windows.Media.MediaPlayer; $media.Open([Uri]'${filePath.replace(/\\/g, '\\\\')}'); $media.Play(); Start-Sleep -Seconds (([Math]::Ceiling($media.NaturalDuration.TimeSpan.TotalSeconds)) + 1); $media.Close()"`,
        { timeout: 30000 },
      );
      return;
    }

    if (platform === 'darwin') {
      await execAsync(`afplay "${filePath}"`, { timeout: 30000 });
      return;
    }

    await execAsync(`aplay "${filePath}"`, { timeout: 30000 });
  }

  /**
   * Fallback: fala via SAPI (Windows built-in, voz robotica).
   */
  private async speakViaSapi(text: string): Promise<void> {
    const safeText = text.replace(/"/g, "'").replace(/\n/g, ' ');
    await execAsync(
      `powershell -NoProfile -Command "Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Speak('${safeText}')"` ,
      { timeout: 30000 },
    );
    console.log('[TTS] Reproduzido via SAPI (fallback).');
  }

  /**
   * Verifica se o edge-tts esta disponivel.
   */
  public async isAvailable(): Promise<{ available: boolean; method: string }> {
    try {
      await execAsync('edge-tts --help', { timeout: 5000 });
      return { available: true, method: 'edge-tts' };
    } catch {
      // continue
    }

    if (os.platform() === 'win32') {
      return { available: true, method: 'sapi-fallback' };
    }

    return { available: false, method: 'none' };
  }

  /**
   * Lista vozes disponiveis do edge-tts.
   */
  public async listVoices(language = 'pt'): Promise<string[]> {
    try {
      const { stdout } = await execAsync('edge-tts --list-voices', { timeout: 10000 });
      return stdout
        .split('\n')
        .filter((line) => line.toLowerCase().includes(language))
        .map((line) => line.trim())
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  /**
   * Remove arquivo de audio temporario.
   */
  public cleanup(filePath: string): void {
    try {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // ignore
    }
  }
}
