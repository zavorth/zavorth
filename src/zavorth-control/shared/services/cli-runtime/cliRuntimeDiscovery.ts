import fs from "fs/promises";
import path from "path";
import {
  DANGEROUS_PATH_CHARS,
  isPathWithin,
  isSafePath,
} from "./cliRuntimePathSecurity.ts";
import { isWindows, runProcess } from "./cliRuntimeProcess.ts";
import {
  EXPECTED_PARENT_PATHS,
  getKnownToolPaths,
} from "./cliRuntimeTools.ts";

export const checkExplicitPath = async (commandPath: string) => {
  if (!isSafePath(commandPath)) {
    return { installed: false, commandPath: null, reason: "unsafe_path" };
  }

  try {
    await fs.access(commandPath, fs.constants.F_OK);
  } catch {
    return { installed: false, commandPath: null, reason: "not_found" };
  }

  try {
    await fs.access(commandPath, fs.constants.X_OK);
    return { installed: true, commandPath, reason: null };
  } catch {
    return { installed: true, commandPath, reason: "not_executable" };
  }
};

export const locateCommand = async (command: string, env: Record<string, string | undefined>) => {
  if (!command) {
    return { installed: false, commandPath: null, reason: "missing_command" };
  }

  if (command.includes("/") || command.includes("\\")) {
    return checkExplicitPath(command);
  }

  if (isWindows()) {
    const located = await runProcess("where", [command], { env, timeoutMs: 3000 });
    if (located.ok && located.stdout) {
      const lines = located.stdout
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length === 0) {
        return { installed: false, commandPath: null, reason: "not_found" };
      }
      const winExt = /\.(cmd|exe|bat|com)$/i;
      const preferred = lines.find((l) => winExt.test(l)) || lines[0];
      return { installed: true, commandPath: preferred, reason: null };
    }
    return { installed: false, commandPath: null, reason: "not_found" };
  }

  const located = await runProcess("sh", ["-c", 'command -v -- "$1"', "sh", command], {
    env,
    timeoutMs: 3000,
  });
  if (located.ok && located.stdout) {
    return { installed: true, commandPath: command, reason: null };
  }
  return { installed: false, commandPath: null, reason: "not_found" };
};

export const checkKnownPath = async (commandPath: string) => {
  if (!path.isAbsolute(commandPath)) {
    return { installed: false, commandPath: null, reason: "not_absolute" };
  }

  if (!isSafePath(commandPath)) {
    return { installed: false, commandPath: null, reason: "unsafe_path" };
  }

  try {
    const realPath = await fs.realpath(commandPath);

    let isWithinExpected = false;
    for (const parent of EXPECTED_PARENT_PATHS) {
      if (isPathWithin(realPath, parent)) {
        isWithinExpected = true;
        break;
      }

      try {
        const resolvedParent = await fs.realpath(parent);
        if (isPathWithin(realPath, resolvedParent)) {
          isWithinExpected = true;
          break;
        }
      } catch {}
    }

    if (!isWithinExpected) {
      return { installed: false, commandPath: null, reason: "symlink_escape" };
    }

    const stat = await fs.stat(realPath);
    if (!stat.isFile()) {
      return { installed: false, commandPath: null, reason: "not_file" };
    }

    if (stat.size < 30 || stat.size > 350 * 1024 * 1024) {
      return { installed: false, commandPath: null, reason: "suspicious_size" };
    }
  } catch (error) {
    const errorCode = (error as NodeJS.ErrnoException).code;
    if (errorCode === "ENOENT") {
      return { installed: false, commandPath: null, reason: "not_found" };
    }
    if (errorCode === "EINVAL") {
      return { installed: false, commandPath: null, reason: "invalid_path" };
    }
    return { installed: false, commandPath: null, reason: "access_error" };
  }

  try {
    await fs.access(commandPath, fs.constants.X_OK);
    return { installed: true, commandPath, reason: null };
  } catch {
    return { installed: true, commandPath, reason: "not_executable" };
  }
};

export const locateCommandCandidate = async (
  commands: string[],
  env: Record<string, string | undefined>,
  toolId?: string
) => {
  if (!Array.isArray(commands) || commands.length === 0) {
    return { command: null, installed: false, commandPath: null, reason: "missing_command" };
  }

  if (toolId) {
    const knownPaths = getKnownToolPaths(toolId);
    for (const knownPath of knownPaths) {
      const result = await checkKnownPath(knownPath);
      if (result.installed && result.reason === null) {
        return {
          command: commands[0],
          installed: true,
          commandPath: result.commandPath,
          reason: null,
        };
      }
    }
  }

  for (const command of commands) {
    const located = await locateCommand(command, env);
    if (located.installed || located.reason !== "not_found") {
      return { command, ...located };
    }
  }

  return { command: commands[0], installed: false, commandPath: null, reason: "not_found" };
};

export const checkRunnable = async (
  commandPath: string,
  env: Record<string, string | undefined>,
  timeoutMs = 4000
) => {
  const minimalEnv: Record<string, string | undefined> = {
    PATH: env.PATH,
    HOME: env.HOME || env.USERPROFILE,
    USERPROFILE: env.USERPROFILE,
    APPDATA: env.APPDATA,
    LOCALAPPDATA: env.LOCALAPPDATA,
    TEMP: env.TEMP,
    TMP: env.TMP,
    SystemRoot: env.SystemRoot,
    ComSpec: env.ComSpec,
    PATHEXT: env.PATHEXT,
  };

  for (const args of [["--version"], ["-v"]]) {
    const result = await runProcess(commandPath, args, { env: minimalEnv, timeoutMs });
    if (result.ok && result.stdout.length > 0 && result.stdout.length < 4096) {
      return { runnable: true, reason: null, version: result.stdout.trim() };
    }
  }
  return { runnable: false, reason: "healthcheck_failed" };
};
