import fs from 'fs';
import os from 'os';
import path from 'path';
import { FileDeliveryService } from '../../src/services/FileDeliveryService';

describe('FileDeliveryService', () => {
  let rootDir: string;
  let workspaceRootDir: string;
  let homeDir: string;
  let workspaceDir: string;
  let tmpDir: string;
  let downloadsDir: string;
  let desktopDir: string;
  let documentsDir: string;

  beforeEach(async () => {
    rootDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'zavorth-file-delivery-'));
    homeDir = path.join(rootDir, 'home');
    workspaceRootDir = path.join(rootDir, 'workspace-root');
    workspaceDir = path.join(workspaceRootDir, 'zavorth');
    tmpDir = path.join(rootDir, 'tmp');
    downloadsDir = path.join(homeDir, 'Downloads');
    desktopDir = path.join(homeDir, 'Desktop');
    documentsDir = path.join(homeDir, 'Documents');

    await fs.promises.mkdir(downloadsDir, { recursive: true });
    await fs.promises.mkdir(desktopDir, { recursive: true });
    await fs.promises.mkdir(documentsDir, { recursive: true });
    await fs.promises.mkdir(workspaceDir, { recursive: true });
    await fs.promises.mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    if (rootDir && fs.existsSync(rootDir)) {
      await fs.promises.rm(rootDir, { recursive: true, force: true });
    }
  });

  function createService(): FileDeliveryService {
    return new FileDeliveryService({
      userHomeDir: homeDir,
      workspaceDir,
      workspaceRootDir,
      tmpDir,
    });
  }

  it('envia diretamente um file quando encontra uma correspondencia unica', async () => {
    const targetFile = path.join(downloadsDir, 'report.pdf');
    await fs.promises.writeFile(targetFile, 'content do pdf');
    const service = createService();

    const plan = await service.prepare('42', 'send me report.pdf from the downloads folder');

    expect(plan.kind).toBe('send');
    if (plan.kind !== 'send') {
      return;
    }

    expect(plan.sendPath).toBe(targetFile);
    expect(plan.fileName).toBe('report.pdf');
  });

  it('recognizes free-form request to list folder content', () => {
    const service = createService();

    expect(service.shouldHandleText('42', 'what is in the downloads folder?')).toBe(true);
  });

  it('reconhece pedidos de file mesmo quando chegam pelo /task', () => {
    const service = createService();

    expect(service.shouldHandleText('42', '/task find the report.pdf file in the downloads folder')).toBe(true);
  });

  it('guarda as opcoes ambiguras e resolve a choose numerada depois', async () => {
    const first = path.join(downloadsDir, 'sales-report.pdf');
    const second = path.join(downloadsDir, 'financial-report.pdf');
    await fs.promises.writeFile(first, 'vendas');
    await fs.promises.writeFile(second, 'financeiro');
    const service = createService();

    const firstPlan = await service.prepare('42', 'send me the report from the downloads folder');

    expect(firstPlan.kind).toBe('choices');
    if (firstPlan.kind !== 'choices') {
      return;
    }

    expect(firstPlan.entries).toHaveLength(2);
    const expectedSelection = firstPlan.entries[1];

    const secondPlan = await service.prepare('42', '2');

    expect(secondPlan.kind).toBe('send');
    if (secondPlan.kind !== 'send') {
      return;
    }

    expect(secondPlan.entry.absolutePath).toBe(expectedSelection.absolutePath);
  });

  it('lists folder content as text when requested', async () => {
    const folderPath = path.join(downloadsDir, 'evidence');
    await fs.promises.mkdir(folderPath, { recursive: true });
    await fs.promises.writeFile(path.join(folderPath, 'log.txt'), 'linthere is 1');
    await fs.promises.writeFile(path.join(folderPath, 'print.png'), 'img');
    const service = createService();

    const plan = await service.prepare('42', `what is in folder "${folderPath}"`);

    expect(plan.kind).toBe('choices');
    if (plan.kind !== 'choices') {
      return;
    }

    expect(plan.prompt).toContain('Content from');
    expect(plan.prompt).toContain('log.txt');
    expect(plan.prompt).toContain('print.png');
  });

  it('recognizes the workspace root by folder name and lists its content', async () => {
    await fs.promises.writeFile(path.join(workspaceRootDir, 'index.html'), '<html></html>');
    await fs.promises.mkdir(path.join(workspaceRootDir, 'assets'), { recursive: true });
    const service = createService();

    const plan = await service.prepare('42', 'what is in folder workspace-root');

    expect(plan.kind).toBe('choices');
    if (plan.kind !== 'choices') {
      return;
    }

    expect(plan.prompt).toContain('Content from');
    expect(plan.prompt).toContain('index.html');
    expect(plan.prompt).toContain('assets');
  });

  it('ignores framing words and still recognizes the target folder by name', async () => {
    await fs.promises.writeFile(path.join(workspaceRootDir, 'index.html'), '<html></html>');
    const service = createService();

    const plan = await service.prepare('42', 'show what is inside folder workspace-root');

    expect(plan.kind).toBe('choices');
    if (plan.kind !== 'choices') {
      return;
    }

    expect(plan.prompt).toContain('Content from');
    expect(plan.prompt).toContain('index.html');
  });

  it('pede permission clicavel quando o caminho explicito existe fora das areas liberadas', async () => {
    const outsideDir = path.join(rootDir, 'fora');
    await fs.promises.mkdir(outsideDir, { recursive: true });
    const targetFile = path.join(outsideDir, 'index.html');
    await fs.promises.writeFile(targetFile, '<html>fora</html>');
    const service = createService();

    const plan = await service.prepare('42', `me envie "${targetFile}"`);

    expect(plan.kind).toBe('permission');
    if (plan.kind !== 'permission') {
      return;
    }

    expect(plan.requestedPath).toBe(outsideDir);
    expect(plan.originalRequest).toContain(targetFile);
  });

  it('envia html corretamente quando a busca encontra o file no pedido', async () => {
    const targetFile = path.join(workspaceRootDir, 'index.html');
    await fs.promises.writeFile(targetFile, '<html>ok</html>');
    const service = createService();

    const plan = await service.prepare('42', 'send me index.html from folder workspace-root');

    expect(plan.kind).toBe('send');
    if (plan.kind !== 'send') {
      return;
    }

    expect(plan.sendPath).toBe(targetFile);
    expect(plan.fileName).toBe('index.html');
    expect(plan.previewText).toContain('Tipo: html');
  });

  it('reconhece caminho explicito com barras normais e envia o html corretamente', async () => {
    const folderPath = path.join(workspaceRootDir, 'zavorth-web');
    const targetFile = path.join(folderPath, 'index.html');
    await fs.promises.mkdir(folderPath, { recursive: true });
    await fs.promises.writeFile(targetFile, '<html>ok</html>');
    const service = createService();

    const forwardPath = targetFile.replace(/\\/g, '/');
    const plan = await service.prepare('42', `send me file index.html from folder ${forwardPath}`, {
      extraAllowedPaths: [folderPath],
    });

    expect(plan.kind).toBe('send');
    if (plan.kind !== 'send') {
      return;
    }

    expect(plan.sendPath).toBe(targetFile);
    expect(plan.fileName).toBe('index.html');
  });

  it('filtra por data e escolhe o pdf mais recente', async () => {
    const oldFile = path.join(downloadsDir, 'old-report.pdf');
    const freshFile = path.join(downloadsDir, 'today-report.pdf');
    await fs.promises.writeFile(oldFile, 'antigo');
    await fs.promises.writeFile(freshFile, 'novo');

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const now = new Date();
    await fs.promises.utimes(oldFile, yesterday, yesterday);
    await fs.promises.utimes(freshFile, now, now);

    const service = createService();
    const plan = await service.prepare('42', 'send me today most recent PDF from the downloads folder');

    expect(plan.kind).toBe('send');
    if (plan.kind !== 'send') {
      return;
    }

    expect(plan.entry.absolutePath).toBe(freshFile);
    expect(plan.previewText).toContain('Modificado:');
  });

  it('compresses a folder before sending', async () => {
    const folderPath = path.join(downloadsDir, 'evidence');
    await fs.promises.mkdir(folderPath, { recursive: true });
    await fs.promises.writeFile(path.join(folderPath, 'log.txt'), 'linthere is 1');
    const service = createService();

    const plan = await service.prepare('42', `"${folderPath}"`);

    expect(plan.kind).toBe('send');
    if (plan.kind !== 'send') {
      return;
    }

    expect(plan.fileName).toBe('evidence.zip');
    expect(plan.cleanupPath).toBeTruthy();
    expect(fs.existsSync(plan.sendPath)).toBe(true);
  });

  it('bloqueia files protegidos pela policy mesmo quando o nome bate exatamente', async () => {
    const honeypotFile = path.join(workspaceDir, 'secrets_honey.txt');
    await fs.promises.writeFile(honeypotFile, 'not deveria sair');
    const service = createService();

    const plan = await service.prepare('42', 'me envie o secrets_honey.txt da workspace');

    expect(plan.kind).toBe('message');
    if (plan.kind !== 'message') {
      return;
    }

    expect(plan.text).toContain('Not encontrei');
  });
});
