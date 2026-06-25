import path from "path";
import { isWindows } from "./cliRuntimeProcess.ts";

export const DANGEROUS_PATH_CHARS = ["&", "|", ";", "<", ">", "(", ")", "`", "$", "^", "%", "!"];

export const normalizeMsys2Path = (p: string): string => {
  if (!p || !isWindows()) return p;
  const msys2Match = p.match(/^\/([a-zA-Z])\/(.+)$/);
  if (msys2Match) {
    const drive = msys2Match[1].toUpperCase();
    const rest = msys2Match[2].replace(/\//g, "\\");
    return `${drive}:\\${rest}`;
  }
  return p;
};

export const isPathWithin = (childPath: string, parentPath: string): boolean => {
  const normalize = (p: string) => path.normalize(p).toLowerCase().replace(/\\/g, "/");
  const normalizedChild = normalize(childPath);
  const normalizedParent = normalize(parentPath);

  if (normalizedChild === normalizedParent) return true;

  const parentWithSep = normalizedParent.endsWith("/") ? normalizedParent : normalizedParent + "/";
  return normalizedChild.startsWith(parentWithSep);
};

export const isSafePath = (execPath: string): boolean => {
  if (!execPath || !path.isAbsolute(execPath)) return false;
  if (DANGEROUS_PATH_CHARS.some((c) => execPath.includes(c))) return false;
  return true;
};

export const validateEnvPath = (value: string | undefined, allowedParents: string[]): string => {
  if (!value) return "";
  const trimmed = value.trim();
  if (!path.isAbsolute(trimmed)) return "";
  if (DANGEROUS_PATH_CHARS.some((c) => trimmed.includes(c))) return "";

  const normalized = path.normalize(trimmed);
  if (normalized.includes("..")) return "";

  if (allowedParents.length > 0) {
    const withinAllowed = allowedParents.some((parent) => isPathWithin(normalized, parent));
    if (!withinAllowed) return "";
  }

  return normalized;
};
