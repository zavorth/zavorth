import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

/**
 * WhisperService — Speech-to-Text local via whisper.cpp.
 *
 * Transcreve áudio em texto usando o modelo Whisper rodando 100% offline.
 * Suporta whisper.cpp (compilado) ou fallback para whisper CLI do Python.
 *
 * Modelos recomendados para i5-13420H / 8GB RAM:
 *   tiny  → 75MB, ~500ms (boa qualidade)
 *   base  → 145MB, ~1s (ótima qualidade) ← RECOMENDADO
 *   small → 465MB, ~3s (excelente qualidade)
 */
export class WhisperService {
  private whisperPath: string;
  private modelPath: string;
  private language: string;

  constructor(options?: {
    whisperPath?: string;
    modelPath?: string;
    language?: string;
  }) {
    // Procura whisper.cpp no diretório do agent ou no PATH
    this.whisperPath = options?.whisperPath || 'whisper';
    this.modelPath = options?.modelPath || path.join(process.cwd(), 'models', 'ggml-base.bin');
    this.language = options?.language || 'pt';
  }

  /**
   * Transcreve um arquivo de áudio em texto.
   * @param audioPath Caminho para o arquivo .wav
   * @returns Texto transcrito
   */
  public async transcribe(audioPath: string): Promise<string> {
    console.log(`[Whisper] 🧠 Transcrevendo: ${path.basename(audioPath)}...`);
    const startTime = Date.now();

    try {
      // Tenta whisper.cpp primeiro (mais rápido)
      return await this.transcribeViaCpp(audioPath);
    } catch {
      try {
        // Fallback: whisper via Python
        return await this.transcribeViaPython(audioPath);
      } catch (error: any) {
        throw new Error(
          `[Whisper] Nenhum método de transcrição disponível.\n` +
          `  Opção 1: Instale whisper.cpp e coloque o binário no PATH\n` +
          `  Opção 2: pip install openai-whisper\n` +
          `  Erro: ${error.message}`
        );
      }
    }
  }

  /**
   * Transcrição via whisper.cpp (binário compilado).
   */
  private async transcribeViaCpp(audioPath: string): Promise<string> {
    const startTime = Date.now();

    // Verifica se o binário existe
    const binaryNames = ['whisper', 'whisper.exe', 'main', 'main.exe'];
    let binaryPath = this.whisperPath;

    for (const name of binaryNames) {
      try {
        await execAsync(`where ${name}`, { timeout: 2000 });
        binaryPath = name;
        break;
      } catch { continue; }
    }

    const { stdout, stderr } = await execAsync(
      `"${binaryPath}" -m "${this.modelPath}" -f "${audioPath}" -l ${this.language} --no-timestamps -otxt`,
      { timeout: 30000 },
    );

    // whisper.cpp escreve o resultado em stdout ou em arquivo .txt
    let text = stdout.trim();

    // Se vazio, tenta ler o arquivo .txt gerado
    if (!text) {
      const txtPath = audioPath.replace(/\.\w+$/, '.txt');
      if (fs.existsSync(txtPath)) {
        text = fs.readFileSync(txtPath, 'utf-8').trim();
        fs.unlinkSync(txtPath); // cleanup
      }
    }

    if (!text) {
      throw new Error('whisper.cpp não retornou transcrição.');
    }

    const duration = Date.now() - startTime;
    console.log(`[Whisper] ✅ Transcrito em ${duration}ms: "${text}"`);
    return text;
  }

  /**
   * Fallback: transcrição via Python whisper CLI.
   */
  private async transcribeViaPython(audioPath: string): Promise<string> {
    const { stdout } = await execAsync(
      `python -m whisper "${audioPath}" --model base --language ${this.language} --output_format txt --output_dir "${path.dirname(audioPath)}"`,
      { timeout: 60000 },
    );

    // Lê o arquivo .txt gerado
    const txtPath = audioPath.replace(/\.\w+$/, '.txt');
    if (fs.existsSync(txtPath)) {
      const text = fs.readFileSync(txtPath, 'utf-8').trim();
      fs.unlinkSync(txtPath);
      console.log(`[Whisper] ✅ Transcrito (Python): "${text}"`);
      return text;
    }

    // Tenta extrair do stdout
    const text = stdout.trim();
    if (text) return text;

    throw new Error('Python whisper não retornou transcrição.');
  }

  /**
   * Verifica se o Whisper está disponível (qualquer método).
   */
  public async isAvailable(): Promise<{ available: boolean; method: string }> {
    // Check whisper.cpp
    try {
      await execAsync('where whisper', { timeout: 2000 });
      return { available: true, method: 'whisper.cpp' };
    } catch { /* continue */ }

    // Check Python whisper
    try {
      await execAsync('python -m whisper --help', { timeout: 5000 });
      return { available: true, method: 'python-whisper' };
    } catch { /* continue */ }

    return { available: false, method: 'none' };
  }
}
