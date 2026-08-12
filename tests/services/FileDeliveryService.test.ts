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

  it('envia diretamente um arquivo quando encontra uma correspondencia unica', async () => {
    const targetFile = path.join(downloadsDir, 'relatorio.pdf');
    await fs.promises.writeFile(targetFile, 'conteudo do pdf');
    const service = createService();

    const plan = await service.prepare('42', 'me envie o relatorio.pdf da pasta downloads');

    expect(plan.kind).toBe('send');
    if (plan.kind !== 'send') {
      return;
    }

    expect(plan.sendPath).toBe(targetFile);
    expect(plan.fileName).toBe('relatorio.pdf');
  });

  it('reconhece pedido livre para listar o conteudo de uma pasta', () => {
    const service = createService();

    expect(service.shouldHandleText('42', 'o que tem na pasta downloads?')).toBe(true);
  });

  it('reconhece pedidos de arquivo mesmo quando chegam pelo /task', () => {
    const service = createService();

    expect(service.shouldHandleText('42', '/task achar o relatorio.pdf na pasta downloads')).toBe(true);
  });

  it('guarda as opcoes ambiguras e resolve a escolha numerada depois', async () => {
    const first = path.join(downloadsDir, 'relatorio-vendas.pdf');
    const second = path.join(downloadsDir, 'relatorio-financeiro.pdf');
    await fs.promises.writeFile(first, 'vendas');
    await fs.promises.writeFile(second, 'financeiro');
    const service = createService();

    const firstPlan = await service.prepare('42', 'me envie o relatorio da pasta downloads');

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

  it('lista em texto o conteudo de uma pasta quando esse for o pedido', async () => {
    const folderPath = path.join(downloadsDir, 'evidencias');
    await fs.promises.mkdir(folderPath, { recursive: true });
    await fs.promises.writeFile(path.join(folderPath, 'log.txt'), 'linha 1');
    await fs.promises.writeFile(path.join(folderPath, 'print.png'), 'img');
    const service = createService();

    const plan = await service.prepare('42', `o que tem na pasta "${folderPath}"`);

    expect(plan.kind).toBe('choices');
    if (plan.kind !== 'choices') {
      return;
    }

    expect(plan.prompt).toContain('Conteudo de');
    expect(plan.prompt).toContain('log.txt');
    expect(plan.prompt).toContain('print.png');
  });

  it('reconhece a raiz de trabalho pelo nome da pasta e lista seu conteudo', async () => {
    await fs.promises.writeFile(path.join(workspaceRootDir, 'index.html'), '<html></html>');
    await fs.promises.mkdir(path.join(workspaceRootDir, 'assets'), { recursive: true });
    const service = createService();

    const plan = await service.prepare('42', 'o que tem na pasta workspace-root');

    expect(plan.kind).toBe('choices');
    if (plan.kind !== 'choices') {
      return;
    }

    expect(plan.prompt).toContain('Conteudo de');
    expect(plan.prompt).toContain('index.html');
    expect(plan.prompt).toContain('assets');
  });

  it('ignora palavras de moldura e ainda reconhece a pasta alvo pelo nome', async () => {
    await fs.promises.writeFile(path.join(workspaceRootDir, 'index.html'), '<html></html>');
    const service = createService();

    const plan = await service.prepare('42', 'mostre o que tem dentro da pasta workspace-root');

    expect(plan.kind).toBe('choices');
    if (plan.kind !== 'choices') {
      return;
    }

    expect(plan.prompt).toContain('Conteudo de');
    expect(plan.prompt).toContain('index.html');
  });

  it('pede permissao clicavel quando o caminho explicito existe fora das areas liberadas', async () => {
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

  it('envia html corretamente quando a busca encontra o arquivo no pedido', async () => {
    const targetFile = path.join(workspaceRootDir, 'index.html');
    await fs.promises.writeFile(targetFile, '<html>ok</html>');
    const service = createService();

    const plan = await service.prepare('42', 'me envie o index.html da pasta workspace-root');

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
    const plan = await service.prepare('42', `me envie o arquivo index.html da pasta ${forwardPath}`, {
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
    const oldFile = path.join(downloadsDir, 'relatorio-antigo.pdf');
    const freshFile = path.join(downloadsDir, 'relatorio-hoje.pdf');
    await fs.promises.writeFile(oldFile, 'antigo');
    await fs.promises.writeFile(freshFile, 'novo');

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const now = new Date();
    await fs.promises.utimes(oldFile, yesterday, yesterday);
    await fs.promises.utimes(freshFile, now, now);

    const service = createService();
    const plan = await service.prepare('42', 'me envie o pdf mais recente de hoje da pasta downloads');

    expect(plan.kind).toBe('send');
    if (plan.kind !== 'send') {
      return;
    }

    expect(plan.entry.absolutePath).toBe(freshFile);
    expect(plan.previewText).toContain('Modificado:');
  });

  it('compacta uma pasta antes de enviar', async () => {
    const folderPath = path.join(downloadsDir, 'evidencias');
    await fs.promises.mkdir(folderPath, { recursive: true });
    await fs.promises.writeFile(path.join(folderPath, 'log.txt'), 'linha 1');
    const service = createService();

    const plan = await service.prepare('42', `"${folderPath}"`);

    expect(plan.kind).toBe('send');
    if (plan.kind !== 'send') {
      return;
    }

    expect(plan.fileName).toBe('evidencias.zip');
    expect(plan.cleanupPath).toBeTruthy();
    expect(fs.existsSync(plan.sendPath)).toBe(true);
  });

  it('bloqueia arquivos protegidos pela policy mesmo quando o nome bate exatamente', async () => {
    const honeypotFile = path.join(workspaceDir, 'secrets_honey.txt');
    await fs.promises.writeFile(honeypotFile, 'nao deveria sair');
    const service = createService();

    const plan = await service.prepare('42', 'me envie o secrets_honey.txt da workspace');

    expect(plan.kind).toBe('message');
    if (plan.kind !== 'message') {
      return;
    }

    expect(plan.text).toContain('Nao encontrei');
  });
});
