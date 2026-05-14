import fs from 'fs';
import path from 'path';
import { WorkspaceResolver } from '../security/WorkspaceResolver.js';

export class FileManager {
  
  public static readSafe(workspace: string, targetPath: string): string {
    const safePath = this.resolveSafePath(workspace, targetPath);
    if (!fs.existsSync(safePath)) {
      throw new Error(`File not found: ${safePath}`);
    }
    return fs.readFileSync(safePath, 'utf8');
  }

  public static writeSafe(workspace: string, targetPath: string, content: string): void {
    const safePath = this.resolveSafePath(workspace, targetPath);
    const dir = path.dirname(safePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(safePath, content, 'utf8');
  }

  public static deleteSafe(workspace: string, targetPath: string): void {
    const safePath = this.resolveSafePath(workspace, targetPath);
    if (!fs.existsSync(safePath)) {
      return; 
    }
    const stat = fs.statSync(safePath);
    if (stat.isDirectory()) {
      fs.rmSync(safePath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(safePath);
    }
  }

  public static listSafe(workspace: string, targetPath: string): string[] {
    const safePath = this.resolveSafePath(workspace, targetPath);
    if (!fs.existsSync(safePath) || !fs.statSync(safePath).isDirectory()) {
      throw new Error(`Not a valid directory: ${safePath}`);
    }
    return fs.readdirSync(safePath);
  }

  private static resolveSafePath(workspace: string, targetPath: string): string {
    const resolvedWorkspace = WorkspaceResolver.validate(workspace);
    return WorkspaceResolver.ensurePathInsideWorkspace(resolvedWorkspace, targetPath);
  }
}
