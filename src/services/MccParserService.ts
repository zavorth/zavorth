import fs from 'fs';
import path from 'path';
import { Database } from '../storage/Database.js';
import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';

export interface MccNode {
  id: string; // Relative path or block id
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
   * Scans and recursively indexes the user workspace
   */
  public async indexWorkspace(workspacePath: string): Promise<void> {
    await this.init();
    const resolvedPath = path.resolve(workspacePath);
    logger.info(`[MCC Parser] Starting workspace indexing: ${resolvedPath}`);

    try {
      const files: string[] = [];
      this.collectFilesRecursive(resolvedPath, resolvedPath, files);
      logger.info(`[MCC Parser] Found ${files.length} files eligible for indexing.`);

      // To keep indexing clean, we remove old records from the same workspace
      // and rebuild the graph for the found files
      for (const relPath of files) {
        const fullPath = path.join(resolvedPath, relPath);
        const content = await fs.promises.readFile(fullPath, 'utf8');
        await this.indexFile(resolvedPath, relPath, content);
      }

      // Cleanup of orphan nodes (files deleted from disk)
      const normalizedFiles = files.map(f => f.replace(/\\/g, '/'));
      const dbNodes = this.db.all<{ id: string }>('SELECT id FROM mcc_nodes WHERE type = \'file\'');
      for (const row of dbNodes) {
        if (!normalizedFiles.includes(row.id)) {
          logger.info(`[MCC Parser] Removing deleted file from index: ${row.id}`);
          this.db.run('DELETE FROM mcc_nodes WHERE id = ? OR id LIKE ?', [row.id, `${row.id}#%`]);
          this.db.run('DELETE FROM mcc_edges WHERE source_node_id = ? OR source_node_id LIKE ?', [row.id, `${row.id}#%`]);
          this.db.run('DELETE FROM mcc_edges WHERE target_node_id = ? OR target_node_id LIKE ?', [row.id, `${row.id}#%`]);
        }
      }

      logger.info(`[MCC Parser] Workspace indexing completed successfully.`);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.error(`[MCC Parser] Failed to index workspace: ${err.message}`);
    }
  }

  /**
   * Index a single file individually in the graph
   */
  public async indexFile(workspacePath: string, relativePath: string, content: string): Promise<void> {
    await this.init();
    const normalizedRelPath = relativePath.replace(/\\/g, '/');
    const { nodes, edges } = this.parseFileContent(normalizedRelPath, content);

    // 1. Clear previous records for this file (and its child nodes)
    this.db.run(
      'DELETE FROM mcc_nodes WHERE id = ? OR id LIKE ?',
      [normalizedRelPath, `${normalizedRelPath}#%`]
    );
    this.db.run(
      'DELETE FROM mcc_edges WHERE source_node_id = ? OR source_node_id LIKE ?',
      [normalizedRelPath, `${normalizedRelPath}#%`]
    );

    // 2. Save new Nodes
    for (const node of nodes) {
      this.db.run(
        'INSERT OR REPLACE INTO mcc_nodes (id, name, type, content, updated_at) VALUES (?, ?, ?, ?, ?)',
        [node.id, node.name, node.type, node.content, new Date().toISOString()]
      );
    }

    // 3. Save new edges (resolving relative import paths, if applicable)
    for (const edge of edges) {
      let resolvedTarget = edge.target;

      // If it's a relative code import, try to map to the corresponding file
      if (edge.type === 'imports' && (edge.target.startsWith('.') || !edge.target.includes('/'))) {
        resolvedTarget = this.resolveImportPath(workspacePath, normalizedRelPath, edge.target);
      }

      // Ensure we only insert if both source and target are valid
      if (edge.source && resolvedTarget) {
        this.db.run(
          'INSERT OR IGNORE INTO mcc_edges (source_node_id, target_node_id, relation_type) VALUES (?, ?, ?)',
          [edge.source, resolvedTarget, edge.type]
        );
      }
    }
  }

  /**
   * Analyzes content and generates the list of nodes and connections
   */
  private parseFileContent(relativePath: string, content: string): { nodes: MccNode[]; edges: MccEdge[] } {
    const nodes: MccNode[] = [];
    const edges: MccEdge[] = [];
    const ext = path.extname(relativePath).toLowerCase();

    // Add the main file node
    nodes.push({
      id: relativePath,
      name: path.basename(relativePath),
      type: 'file',
      content: content.slice(0, 1000) // Store a content preview in the database
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
   * Simple Code parser (JS, TS, Python)
   */
  private parseCode(relativePath: string, content: string, nodes: MccNode[], edges: MccEdge[]): void {
    const lines = content.split('\n');

    // 1. Import extraction
    const importRegex = /(?:import\s+.*...\s+from\s+['"](.*...)['"]|import\s+['"](.*...)['"]|require\s*\(\s*['"](.*...)['"]\s*\))/g;
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

    // 2. Class and function extraction
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index].trim();

      // Detect classes
      const classMatch = /^(?:export\s+)...class\s+([a-zA-Z0-9_]+)/.exec(line);
      if (classMatch && classMatch[1]) {
        const className = classMatch[1];
        const childId = `${relativePath}#${className}`;
        nodes.push({
          id: childId,
          name: className,
          type: 'class',
          content: lines.slice(index, index + 30).join('\n') // Get the first 30 lines of the class
        });
        edges.push({
          source: relativePath,
          target: childId,
          type: 'contains'
        });
      }

      // Detect main Functions
      const funcMatch = /^(?:export\s+)...(?:async\s+)...function\s+([a-zA-Z0-9_]+)/.exec(line);
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
   * Simple Markdown/Text parser
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

      // Detect links to other local files: [Label](link)
      const linkRegex = /\[.*...\]\((.*...)\)/g;
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
   * Data files parser (CSV, JSON)
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

      // Map virtual foreign key IDs (e.g., user_id, product_id)
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
   * Helper to recursively collect files ignoring common directories
   */
  private collectFilesRecursive(basePath: string, currentPath: string, files: string[]): void {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      const relPath = path.relative(basePath, fullPath);

      if (entry.isDirectory()) {
        // Ignored directories
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
   * Resolve a relative import to the corresponding file in the workspace
   */
  private resolveImportPath(workspacePath: string, sourceFile: string, importTarget: string): string {
    let target = importTarget;

    // Remove the import extension if present (e.g., .js)
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

    return relativeTarget; // Fallback if not found on disk
  }
}
