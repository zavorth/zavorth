import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { extractVisionPayload } from '../../src/orchestrator/graph/SupervisorGraph';


describe('extractVisionPayload (Dashboard controls - Vision In The Loop)', () => {
  let tempDir: string;
  let testPng: string;
  let testJpg: string;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vision-test-'));
    testPng = path.join(tempDir, 'capture.png');
    testJpg = path.join(tempDir, 'photo.jpg');
    const minPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAAElFTkSuQmCC',
      'base64',
    );
    fs.writeFileSync(testPng, minPng);
    fs.writeFileSync(testJpg, Buffer.from('fake-jpeg-data'));
  });

  afterAll(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup for temp files.
    }
  });

  it('retorna null quando nao ha padrao de screenshot', () => {
    expect(extractVisionPayload('Acao executada com sucesso.')).toBeNull();
    expect(extractVisionPayload('')).toBeNull();
  });

  it('extrai corretamente um caminho .png', () => {
    const output = `Acao executada com sucesso.\nScreenshot: ${testPng} (1920x1080px)`;
    const result = extractVisionPayload(output);
    expect(result).not.toBeNull();
    expect(result!.mimeType).toBe('image/png');
    expect(typeof result!.data).toBe('string');
    expect(result!.data.length).toBeGreaterThan(0);
  });

  it('extrai corretamente um caminho .jpg', () => {
    const output = `Screenshot: ${testJpg}`;
    const result = extractVisionPayload(output);
    expect(result).not.toBeNull();
    expect(result!.mimeType).toBe('image/jpeg');
  });

  it('suporta o padrao "Screenshot local:"', () => {
    const output = `Screenshot local: ${testPng}`;
    const result = extractVisionPayload(output);
    expect(result).not.toBeNull();
    expect(result!.mimeType).toBe('image/png');
  });

  it('retorna null para extensoes nao-suportadas', () => {
    const fakeTxt = path.join(tempDir, 'file.txt');
    fs.writeFileSync(fakeTxt, 'hello');
    const output = `Screenshot: ${fakeTxt}`;
    expect(extractVisionPayload(output)).toBeNull();
  });

  it('retorna null para arquivo inexistente', () => {
    const output = `Screenshot: C:\\caminho\\inexistente\\nope.png`;
    expect(extractVisionPayload(output)).toBeNull();
  });

  it('retorna null para arquivo vazio', () => {
    const emptyPng = path.join(tempDir, 'empty.png');
    fs.writeFileSync(emptyPng, Buffer.alloc(0));
    const output = `Screenshot: ${emptyPng}`;
    expect(extractVisionPayload(output)).toBeNull();
  });

  it('ignora maiusculas/minusculas no padrao', () => {
    const output = `SCREENSHOT: ${testPng}`;
    const result = extractVisionPayload(output);
    expect(result).not.toBeNull();
  });

  it('recorta corretamente metadados como dimensoes entre parenteses', () => {
    const output = `Screenshot: ${testPng} (1920x1080px)`;
    const result = extractVisionPayload(output);
    expect(result).not.toBeNull();
    expect(result!.mimeType).toBe('image/png');
  });

  it('nao le imagens fora das raizes locais permitidas para payload visual', () => {
    const outsideDir = path.join(path.dirname(path.dirname(path.dirname(__dirname))), 'vision-outside-test');
    const outsidePng = path.join(outsideDir, 'capture.png');
    fs.mkdirSync(outsideDir, { recursive: true });
    fs.writeFileSync(outsidePng, fs.readFileSync(testPng));
    try {
      expect(extractVisionPayload(`Screenshot: ${outsidePng}`)).toBeNull();
    } finally {
      fs.rmSync(outsideDir, { recursive: true, force: true });
    }
  });
});
