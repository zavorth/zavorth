export type SupportedEditor = 'vscode' | 'cursor' | 'zed' | 'windsurf' | 'neovim' | 'generic';

export interface EditorLocation {
  readonly absoluteFilePath: string;
  readonly lineNumber?: number;
  readonly columnNumber?: number;
}

export interface EditorLaunchCommand {
  readonly editor: SupportedEditor;
  readonly uriScheme?: string;
  readonly cliExecutable: string;
  readonly cliArgs: readonly string[];
  readonly humanReadableTarget: string;
}

export class ZavorthEditorBridgeService {
  public generateLaunchCommand(
    location: EditorLocation,
    preferredEditor: SupportedEditor = 'vscode'
  ): EditorLaunchCommand {
    const line = location.lineNumber ?? 1;
    const col = location.columnNumber ?? 1;
    const pathNormalized = location.absoluteFilePath.replace(/\\/g, '/');

    switch (preferredEditor) {
      case 'vscode':
        return {
          editor: 'vscode',
          uriScheme: `vscode://file/${encodeURI(pathNormalized)}:${line}:${col}`,
          cliExecutable: 'code',
          cliArgs: ['--goto', `${location.absoluteFilePath}:${line}:${col}`],
          humanReadableTarget: `VS Code at ${location.absoluteFilePath}:${line}`,
        };

      case 'cursor':
        return {
          editor: 'cursor',
          uriScheme: `cursor://file/${encodeURI(pathNormalized)}:${line}:${col}`,
          cliExecutable: 'cursor',
          cliArgs: ['--goto', `${location.absoluteFilePath}:${line}:${col}`],
          humanReadableTarget: `Cursor at ${location.absoluteFilePath}:${line}`,
        };

      case 'zed':
        return {
          editor: 'zed',
          uriScheme: `zed://file/${encodeURI(pathNormalized)}:${line}:${col}`,
          cliExecutable: 'zed',
          cliArgs: [`${location.absoluteFilePath}:${line}:${col}`],
          humanReadableTarget: `Zed at ${location.absoluteFilePath}:${line}`,
        };

      case 'windsurf':
        return {
          editor: 'windsurf',
          uriScheme: `windsurf://file/${encodeURI(pathNormalized)}:${line}:${col}`,
          cliExecutable: 'windsurf',
          cliArgs: ['--goto', `${location.absoluteFilePath}:${line}:${col}`],
          humanReadableTarget: `Windsurf at ${location.absoluteFilePath}:${line}`,
        };

      case 'neovim':
        return {
          editor: 'neovim',
          cliExecutable: 'nvim',
          cliArgs: [`+${line}`, location.absoluteFilePath],
          humanReadableTarget: `Neovim at ${location.absoluteFilePath}:${line}`,
        };

      case 'generic':
      default:
        return {
          editor: 'generic',
          cliExecutable: 'code',
          cliArgs: ['-g', `${location.absoluteFilePath}:${line}:${col}`],
          humanReadableTarget: `Editor at ${location.absoluteFilePath}:${line}`,
        };
    }
  }

  public parseFileLineReference(reference: string): EditorLocation | null {
    if (!reference || reference.trim().length === 0) {
      return null;
    }

    const trimmed = reference.trim();
    let workingString = trimmed;
    let columnNumber: number | undefined;
    let lineNumber: number | undefined;

    const lastColonIdx = workingString.lastIndexOf(':');
    if (lastColonIdx > 1) {
      const candidateColOrLine = workingString.substring(lastColonIdx + 1);
      const parsedNum = parseInt(candidateColOrLine, 10);
      if (!isNaN(parsedNum) && String(parsedNum) === candidateColOrLine) {
        workingString = workingString.substring(0, lastColonIdx);
        const secondColonIdx = workingString.lastIndexOf(':');
        if (secondColonIdx > 1) {
          const candidateLine = workingString.substring(secondColonIdx + 1);
          const parsedLineNum = parseInt(candidateLine, 10);
          if (!isNaN(parsedLineNum) && String(parsedLineNum) === candidateLine) {
            columnNumber = parsedNum;
            lineNumber = parsedLineNum;
            workingString = workingString.substring(0, secondColonIdx);
          } else {
            lineNumber = parsedNum;
          }
        } else {
          lineNumber = parsedNum;
        }
      }
    }

    return {
      absoluteFilePath: workingString,
      lineNumber,
      columnNumber,
    };
  }
}
