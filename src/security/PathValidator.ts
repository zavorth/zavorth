import { WorkspaceResolver } from './WorkspaceResolver.js';

export class PathValidator {
  /**
   * @deprecated Use WorkspaceResolver.ensurePathInsideWorkspace directly.
   *
   * Normaliza o caminho e evita escapes como ../../
   * Retorna o path absoluto se de fato estiver no perimetro (baseDir), caso contrario joga erro de seguranca.
   */
  public static ensureInsideWorkspace(baseDir: string, targetPath: string): string {
    return WorkspaceResolver.ensurePathInsideWorkspace(baseDir, targetPath);
  }
}
