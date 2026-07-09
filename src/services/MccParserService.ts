import fs from 'fs';
import path from 'path';
import { Database } from '../storage/Database.js';
import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';

export interface MccNode {
  id: string; // Caminho relativo ou id do bloco
  name: string;
  type: string; // 'file' | 'class' | 'function' | 'section' | 'data-table'
  content: string;
}

export interface MccEdge {
  source: string;
  target: string;
  type: string; // 'imports' | 'calls' | 'contains' | 'references' | 'relates_to'
}

export class MccParserService {
  private db!: Database;
  private initialized = false;

  private async init(): Promise<void> {
    if (this.initialized) return;
    this.db = await Database.getInstance();
    this.initialized = true;
  }

  /**
   * Varre e indexa recursivamente o workspace do usuário
   */
  public async indexWorkspace(workspacePath: string): Promise<void> {
    await this.init();
    const resolvedPath = path.resolve(workspacePath);
    logger.info(`[MCC Parser] Iniciando indexação do workspace: ${resolvedPath}`);

    try {
      const files: string[] = [];
      this.collectFilesRecursive(resolvedPath, resolvedPath, files);
      logger.info(`[MCC Parser] Encontrados ${files.length} arquivos elegíveis para indexação.`);

      // Para manter a indexação limpa, removemos registros antigos do mesmo workspace
      // e reconstruímos o grafo para os arquivos encontrados
      for (const relPath of files) {
        const fullPath = path.join(resolvedPath, relPath);
        const content = await fs.promises.readFile(fullPath, 'utf8');
        await this.indexFile(resolvedPath, relPath, content);
      }

      // Limpeza de nós órfãos (arquivos deletados do disco)
      const normalizedFiles = files.map(f => f.replace(/\\/g, '/'));
      const dbNodes = this.db.all<{ id: string }>('SELECT id FROM mcc_nodes WHERE type = \'file\'');
      for (const row of dbNodes) {
        if (!normalizedFiles.includes(row.id)) {
          logger.info(`[MCC Parser] Removendo arquivo deletado do índice: ${row.id}`);
          this.db.run('DELETE FROM mcc_nodes WHERE id = ? OR id LIKE ?', [row.id, `${row.id}#%`]);
          this.db.run('DELETE FROM mcc_edges WHERE source_node_id = ? OR source_node_id LIKE ?', [row.id, `${row.id}#%`]);
          this.db.run('DELETE FROM mcc_edges WHERE target_node_id = ? OR target_node_id LIKE ?', [row.id, `${row.id}#%`]);
        }
      }

      logger.info(`[MCC Parser] Indexação do workspace concluída com sucesso.`);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.error(`[MCC Parser] Falha ao indexar o workspace: ${err.message}`);
    }
  }

  /**
   * Indexa um único arquivo individualmente no grafo
   */
  public async indexFile(workspacePath: string, relativePath: string, content: string): Promise<void> {
    await this.init();
    const normalizedRelPath = relativePath.replace(/\\/g, '/');
    const { nodes, edges } = this.parseFileContent(normalizedRelPath, content);

    // 1. Limpa registros anteriores para este arquivo (e seus nós filhos)
    this.db.run(
      'DELETE FROM mcc_nodes WHERE id = ? OR id LIKE ?',
      [normalizedRelPath, `${normalizedRelPath}#%`]
    );
    this.db.run(
      'DELETE FROM mcc_edges WHERE source_node_id = ? OR source_node_id LIKE ?',
      [normalizedRelPath, `${normalizedRelPath}#%`]
    );

    // 2. Salva novos Nodes
    for (const node of nodes) {
      this.db.run(
        'INSERT OR REPLACE INTO mcc_nodes (id, name, type, content, updated_at) VALUES (?, ?, ?, ?, ?)',
        [node.id, node.name, node.type, node.content, new Date().toISOString()]
      );
    }

    // 3. Salva novos Edges (resolvendo caminhos relativos de imports, se aplicável)
    for (const edge of edges) {
      let resolvedTarget = edge.target;

      // Se for um import relativo de código, tenta mapear para o arquivo correspondente
      if (edge.type === 'imports' && (edge.target.startsWith('.') || !edge.target.includes('/'))) {
        resolvedTarget = this.resolveImportPath(workspacePath, normalizedRelPath, edge.target);
      }

      // Garante que só inserimos se o source e target forem válidos
      if (edge.source && resolvedTarget) {
        this.db.run(
          'INSERT OR IGNORE INTO mcc_edges (source_node_id, target_node_id, relation_type) VALUES (?, ?, ?)',
          [edge.source, resolvedTarget, edge.type]
        );
      }
    }
  }

  /**
   * Analisa o conteúdo e gera a lista de nós e conexões
   */
  private parseFileContent(relativePath: string, content: string): { nodes: MccNode[]; edges: MccEdge[] } {
    const nodes: MccNode[] = [];
    const edges: MccEdge[] = [];
    const ext = path.extname(relativePath).toLowerCase();

    // Adiciona o nó principal do arquivo
    nodes.push({
      id: relativePath,
      name: path.basename(relativePath),
      type: 'file',
      content: content.slice(0, 1000) // Guarda uma prévia do conteúdo no BD
    });

    if (ext === '.ts' || ext === '.js' || ext === '.tsx' || ext === '.jsx' || ext === '.py') {
      this.parseCode(relativePath, content, nodes, edges);
    } else if (ext === '.md' || ext === '.txt') {
      this.parseMarkdown(relativePath, content, nodes, edges);
    } else if (ext === '.csv' || ext === '.json') {
      this.parseData(relativePath, content, nodes, edges);
    }

    return { nodes, edges };
  }

  /**
   * Parser simples de Código (JS, TS, Python)
   */
  private parseCode(relativePath: string, content: string, nodes: MccNode[], edges: MccEdge[]): void {
    const lines = content.split('\n');

    // 1. Extração de Imports
    const importRegex = /(?:import\s+.*?\s+from\s+['"](.*?)['"]|import\s+['"](.*?)['"]|require\s*\(\s*['"](.*?)['"]\s*\))/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const target = match[1] || match[2] || match[3];
      if (target) {
        edges.push({
          source: relativePath,
          target: target,
          type: 'imports'
        });
      }
    }

    // 2. Extração de Classes e Funções
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index].trim();

      // Detecta Classes
      const classMatch = /^(?:export\s+)?class\s+([a-zA-Z0-9_]+)/.exec(line);
      if (classMatch && classMatch[1]) {
        const className = classMatch[1];
        const childId = `${relativePath}#${className}`;
        nodes.push({
          id: childId,
          name: className,
          type: 'class',
          content: lines.slice(index, index + 30).join('\n') // Pega as primeiras 30 linhas da classe
        });
        edges.push({
          source: relativePath,
          target: childId,
          type: 'contains'
        });
      }

      // Detecta Funções principais
      const funcMatch = /^(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_]+)/.exec(line);
      if (funcMatch && funcMatch[1]) {
        const funcName = funcMatch[1];
        const childId = `${relativePath}#${funcName}`;
        nodes.push({
          id: childId,
          name: funcName,
          type: 'function',
          content: lines.slice(index, index + 15).join('\n')
        });
        edges.push({
          source: relativePath,
          target: childId,
          type: 'contains'
        });
      }
    }
  }

  /**
   * Parser simples de Markdown/Textos
   */
  private parseMarkdown(relativePath: string, content: string, nodes: MccNode[], edges: MccEdge[]): void {
    const lines = content.split('\n');
    let currentSection: MccNode | null = null;
    let sectionLines: string[] = [];

    const saveSection = () => {
      if (currentSection) {
        currentSection.content = sectionLines.join('\n');
        nodes.push(currentSection);
        edges.push({
          source: relativePath,
          target: currentSection.id,
          type: 'contains'
        });
      }
    };

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const headerMatch = /^#+\s+(.+)$/.exec(line);

      if (headerMatch && headerMatch[1]) {
        saveSection();
        const title = headerMatch[1].trim();
        const sectionId = `${relativePath}#${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        currentSection = {
          id: sectionId,
          name: title,
          type: 'section',
          content: ''
        };
        sectionLines = [line];
      } else if (currentSection) {
        sectionLines.push(line);
      }

      // Detecta links para outros arquivos locais: [Label](link)
      const linkRegex = /\[.*?\]\((.*?)\)/g;
      let linkMatch;
      while ((linkMatch = linkRegex.exec(line)) !== null) {
        const linkTarget = linkMatch[1];
        if (linkTarget && !linkTarget.startsWith('http') && !linkTarget.startsWith('#')) {
          const resolvedLink = path.normalize(path.join(path.dirname(relativePath), linkTarget)).replace(/\\/g, '/');
          edges.push({
            source: currentSection ? currentSection.id : relativePath,
            target: resolvedLink,
            type: 'references'
          });
        }
      }
    }
    saveSection();
  }

  /**
   * Parser de arquivos de Dados (CSV, JSON)
   */
  private parseData(relativePath: string, content: string, nodes: MccNode[], edges: MccEdge[]): void {
    const ext = path.extname(relativePath).toLowerCase();

    if (ext === '.csv') {
      const firstLine = content.split('\n')[0] || '';
      const headers = firstLine.split(',').map((h) => h.trim());
      nodes.push({
        id: `${relativePath}#schema`,
        name: `${path.basename(relativePath)} Schema`,
        type: 'data-table',
        content: `CSV Columns: ${headers.join(', ')}`
      });
      edges.push({
        source: relativePath,
        target: `${relativePath}#schema`,
        type: 'contains'
      });

      // Mapeia IDs de chaves estrangeiras virtuais (ex: user_id, product_id)
      for (const col of headers) {
        if (col.endsWith('_id') || col.endsWith('Id')) {
          const tableTarget = `${col.slice(0, -3)}s`; // ex: user_id -> users
          edges.push({
            source: relativePath,
            target: tableTarget,
            type: 'relates_to'
          });
        }
      }
    } else if (ext === '.json') {
      try {
        const parsed = JSON.parse(content);
        const keys = Object.keys(parsed);
        nodes.push({
          id: `${relativePath}#schema`,
          name: `${path.basename(relativePath)} Keys`,
          type: 'data-table',
          content: `JSON Keys: ${keys.join(', ')}`
        });
        edges.push({
          source: relativePath,
          target: `${relativePath}#schema`,
          type: 'contains'
        });
      } catch (error: unknown) {// Ignora JSONs malformados
      }
    }
  }

  /**
   * Auxiliar para coletar arquivos recursivamente ignorando diretórios comuns
   */
  private collectFilesRecursive(basePath: string, currentPath: string, files: string[]): void {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      const relPath = path.relative(basePath, fullPath);

      if (entry.isDirectory()) {
        // Diretórios ignorados
        if (
          entry.name === 'node_modules' ||
          entry.name === '.git' ||
          entry.name === '.tmp' ||
          entry.name === 'dist' ||
          entry.name === 'dist-ops' ||
          entry.name === 'dist-standalone' ||
          entry.name === 'coverage' ||
          entry.name === '.agents' ||
          entry.name === '.zavorth' ||
          entry.name === 'logs'
        ) {
          continue;
        }
        this.collectFilesRecursive(basePath, fullPath, files);
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (['.ts', '.js', '.tsx', '.jsx', '.py', '.md', '.txt', '.csv', '.json'].includes(ext)) {
          files.push(relPath);
        }
      }
    }
  }

  /**
   * Resolve um import relativo para o arquivo correspondente no workspace
   */
  private resolveImportPath(workspacePath: string, sourceFile: string, importTarget: string): string {
    let target = importTarget;

    // Remove a extensão do import, se tiver (ex: .js)
    if (target.endsWith('.js') || target.endsWith('.ts') || target.endsWith('.jsx') || target.endsWith('.tsx')) {
      target = target.slice(0, -3);
    }

    const sourceDir = path.dirname(sourceFile);
    const relativeTarget = path.normalize(path.join(sourceDir, target)).replace(/\\/g, '/');
    const absoluteTarget = path.resolve(workspacePath, relativeTarget);

    const extensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.json'];
    for (const ext of extensions) {
      const fullPathWithExt = absoluteTarget + ext;
      if (fs.existsSync(fullPathWithExt)) {
        return path.relative(workspacePath, fullPathWithExt).replace(/\\/g, '/');
      }
    }

    return relativeTarget; // Fallback se não encontrar no disco
  }
}
