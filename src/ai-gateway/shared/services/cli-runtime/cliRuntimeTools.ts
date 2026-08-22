import fsSync from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import {
  DANGEROUS_PATH_CHARS,
  validateEnvPath,
} from "./cliRuntimePathSecurity.ts";
import { isWindows } from "./cliRuntimeProcess.ts";

import { logger } from '@/shared/utils/logger';
import { asErrorLike } from '../../../../utils/errorLike';

export const VALID_RUNTIME_MODES = new Set(["auto", "host", "container"]);
export const FALSE_VALUES = new Set(["0", "false", "no", "off"]);

export const CLI_TOOLS: Record<string, unknown> = {
  claude: {
    defaultCommand: "claude",
    envBinKey: "CLI_CLAUDE_BIN",
    requiresBinary: true,
    healthcheckTimeoutMs: 4000,
    paths: {
      settings: ".claude/settings.json",
    },
  },
  codex: {
    defaultCommand: "codex",
    envBinKey: "CLI_CODEX_BIN",
    requiresBinary: true,
    healthcheckTimeoutMs: 4000,
    paths: {
      config: ".codex/config.toml",
      auth: ".codex/auth.json",
    },
  },
  droid: {
    defaultCommand: "droid",
    envBinKey: "CLI_DROID_BIN",
    requiresBinary: true,
    healthcheckTimeoutMs: 8000,
    paths: {
      settings: ".factory/settings.json",
    },
  },
  "external-executor": {
    defaultCommands: ["external-executor"],
    envBinKey: "CLI_EXTERNAL_EXECUTOR_BIN",
    envBinKeys: ["CLI_EXTERNAL_EXECUTOR_BIN"],
    requiresBinary: true,
    healthcheckTimeoutMs: 15000,
    paths: {
      settings: ".zavorth/external-executor.json",
    },
  },
  cursor: {
    defaultCommands: ["agent", "cursor"],
    envBinKey: "CLI_CURSOR_BIN",
    requiresBinary: true,
    healthcheckTimeoutMs: 15000,
    paths: {
      config: ".cursor/cli-config.json",
      auth: ".config/cursor/auth.json",
      state: ".cursor/agent-cli-state.json",
    },
  },
  windsurf: {
    defaultCommand: null,
    envBinKey: "CLI_WINDSURF_BIN",
    requiresBinary: false,
    healthcheckTimeoutMs: 4000,
    paths: {},
  },
  cline: {
    defaultCommand: "cline",
    envBinKey: "CLI_CLINE_BIN",
    requiresBinary: true,
    healthcheckTimeoutMs: 12000,
    paths: {
      globalState: ".cline/data/globalState.json",
      secrets: ".cline/data/secrets.json",
    },
  },
  kilo: {
    defaultCommand: "kilocode",
    envBinKey: "CLI_KILO_BIN",
    requiresBinary: true,
    healthcheckTimeoutMs: 15000,
    paths: {
      auth: ".local/share/kilo/auth.json",
    },
  },
  continue: {
    defaultCommand: null,
    envBinKey: "CLI_CONTINUE_BIN",
    requiresBinary: false,
    healthcheckTimeoutMs: 15000,
    paths: {
      settings: ".continue/config.json",
    },
  },
  opencode: {
    defaultCommand: "opencode",
    envBinKey: "CLI_OPENCODE_BIN",
    requiresBinary: true,
    healthcheckTimeoutMs: 15000,
    paths: {
      config: ".config/opencode/opencode.json",
    },
  },
  qoder: {
    defaultCommand: "qodercli",
    envBinKey: "CLI_QODER_BIN",
    requiresBinary: true,
    healthcheckTimeoutMs: 12000,
    paths: {
      config: ".qoder/settings.json",
      auth: ".qoder/auth.json",
    },
  },
};

let npmGlobalPrefix: string | undefined;

export const parseBoolean = (value: unknown, defaultValue = true) => {
  if (value == null || value === "") return defaultValue;
  return !FALSE_VALUES.has(String(value).trim().toLowerCase());
};

export const getRuntimeMode = () => {
  const mode = String(process.env.CLI_MODE || "auto")
    .trim()
    .toLowerCase();
  return VALID_RUNTIME_MODES.has(mode) ? mode : "auto";
};

export const getNpmGlobalPrefix = (): string => {
  if (npmGlobalPrefix !== undefined) return npmGlobalPrefix;

  const envPrefix = String(process.env.npm_config_prefix || "").trim();
  if (envPrefix && path.isAbsolute(envPrefix)) {
    npmGlobalPrefix = envPrefix;
    return npmGlobalPrefix;
  }

  try {
    const result = execFileSync(isWindows() ? "npm.cmd" : "npm", ["config", "get", "prefix"], {
      timeout: 5000,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      shell: false,
    });
    const prefix = result.trim();
    if (
      prefix &&
      path.isAbsolute(prefix) &&
      !DANGEROUS_PATH_CHARS.some((c) => prefix.includes(c))
    ) {
      npmGlobalPrefix = prefix;
      return npmGlobalPrefix;
    }
  } catch (error: unknown) {
    const err = asErrorLike(error);
    logger.warn("[auto-fix] Empty catch block", err); }

  npmGlobalPrefix = "";
  return npmGlobalPrefix;
};

export const getNvmNodePath = (): string | null => {
  if (process.execPath.toLowerCase().includes("nvm")) {
    return path.dirname(process.execPath);
  }
  return null;
};

const getExpectedParentPaths = (): string[] => {
  const home = os.homedir();
  const userProfile = process.env.USERPROFILE || home;

  const validatedAppData = validateEnvPath(process.env.APPDATA, [home, userProfile]);
  const validatedLocalAppData = validateEnvPath(process.env.LOCALAPPDATA, [
    path.join(home, "AppData", "local"),
    path.join(userProfile, "AppData", "local"),
    userProfile,
  ]);
  const validatedProgramFiles = validateEnvPath(process.env.ProgramFiles, [
    "C:\\Program Files",
    "C:\\Program Files (x86)",
  ]);
  const validatedProgramFilesX86 = validateEnvPath(process.env["ProgramFiles(x86)"], [
    "C:\\Program Files",
    "C:\\Program Files (x86)",
  ]);

  const npmPrefix = getNpmGlobalPrefix();
  const userBinPaths = [path.join(home, "bin"), path.join(home, ".local", "bin")];

  return [
    home,
    ...userBinPaths,
    userProfile,
    validatedAppData,
    validatedLocalAppData,
    validatedProgramFiles,
    validatedProgramFilesX86,
    npmPrefix,
  ].filter(Boolean);
};

export const EXPECTED_PARENT_PATHS = getExpectedParentPaths();

export const getExtraPaths = () =>
  String(process.env.CLI_EXTRA_PATHS || "")
    .split(path.delimiter)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .filter((p) => {
      if (!path.isAbsolute(p)) return false;
      if (DANGEROUS_PATH_CHARS.some((c) => p.includes(c))) return false;
      if (path.normalize(p).includes("..")) return false;
      return true;
    });

export const getKnownToolPaths = (toolId: string): string[] => {
  const home = os.homedir();
  const paths: string[] = [];

  const npmPrefix = getNpmGlobalPrefix();
  const nvmNodePath = getNvmNodePath();

  const toolBins: Record<string, [string, string][]> = {
    claude: [
      ["claude.cmd", "claude"],
      ["claude.exe", "claude"],
    ],
    codex: [["codex.cmd", "codex"]],
    droid: [
      ["droid.cmd", "droid"],
      ["droid.exe", "droid"],
    ],
    "external-executor": [
      ["external-executor.cmd", "external-executor"],
    ],
    cursor: [
      ["agent.cmd", "agent"],
      ["cursor.cmd", "cursor"],
    ],
    cline: [["cline.cmd", "cline"]],
    kilo: [["kilocode.cmd", "kilocode"]],
    opencode: [["opencode.cmd", "opencode"]],
    qoder: [["qodercli.exe", "qodercli"]],
  };

  const bins = toolBins[toolId] || [];

  if (isWindows()) {
    const userProfile = process.env.USERPROFILE || home;
    const appData = validateEnvPath(process.env.APPDATA, [home, userProfile]);
    const localAppData = validateEnvPath(process.env.LOCALAPPDATA, [
      path.join(home, "AppData", "local"),
      path.join(userProfile, "AppData", "local"),
      userProfile,
    ]);

    if (toolId === "claude") {
      paths.push(path.join(home, ".local", "bin", "claude.exe"));
      if (localAppData) {
        paths.push(path.join(localAppData, "Programs", "Claude", "claude.exe"));
        paths.push(path.join(localAppData, "claude-code", "claude.exe"));
      }
    }

    if (toolId === "droid") {
      paths.push(path.join(home, "bin", "droid.exe"));
    }

    for (const [winName] of bins) {
      if (npmPrefix) paths.push(path.join(npmPrefix, winName));
      if (appData) {
        const appDataPath = path.join(appData, "npm", winName);
        if (
          !npmPrefix ||
          path.normalize(appDataPath) !== path.normalize(path.join(npmPrefix, winName))
        ) {
          paths.push(appDataPath);
        }
      }
      if (nvmNodePath) paths.push(path.join(nvmNodePath, winName));
    }
  } else {
    for (const [, posixName] of bins) {
      const nodeBinDir = path.dirname(process.execPath);
      paths.push(path.join(nodeBinDir, posixName));

      if (npmPrefix) {
        paths.push(path.join(npmPrefix, "bin", posixName));
      }

      paths.push(path.join(home, ".local", "bin", posixName));
      if (fsSync.existsSync("/usr/local/bin")) {
        paths.push(path.join("/usr", "local", "bin", posixName));
      }
      if (fsSync.existsSync("/usr/bin")) {
        paths.push(path.join("/usr", "bin", posixName));
      }

      if (toolId === "opencode") {
        paths.push(path.join(home, ".opencode", "bin", posixName));
      }
      if (toolId === "claude") {
        paths.push(path.join(home, ".claude", "bin", posixName));
      }
    }
  }

  return paths;
};

export const getLookupEnv = () => {
  const env = { ...process.env };
  const extraPaths = getExtraPaths();

  if (extraPaths.length > 0) {
    env.PATH = [...extraPaths, env.PATH || ""].filter(Boolean).join(path.delimiter);
  }
  return env;
};

export const resolveToolCommands = (toolId: string): string[] => {
  const tool = CLI_TOOLS[toolId];
  if (!tool) return [];
  const envCommand = resolveToolEnvCommand(toolId);
  if (envCommand) return [envCommand];
  if (Array.isArray(tool.defaultCommands) && tool.defaultCommands.length > 0) {
    return tool.defaultCommands.filter(Boolean);
  }
  return tool.defaultCommand ? [tool.defaultCommand] : [];
};

export const CLI_TOOL_IDS = Object.keys(CLI_TOOLS);

export const resolveToolEnvCommand = (toolId: string): string => {
  const tool = CLI_TOOLS[toolId];
  if (!tool) return "";

  const envKeys = Array.from(new Set([tool.envBinKey, ...(tool.envBinKeys || [])].filter(Boolean)));
  for (const key of envKeys) {
    const value = String(process.env[key] || "").trim();
    if (value) return value;
  }
  return "";
};
