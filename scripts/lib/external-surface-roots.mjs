import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const projectRoot = path.resolve(__dirname, '..', '..');

function normalizeOverride(rawValue) {
  const normalized = String(rawValue || '').trim();
  return normalized ? path.resolve(normalized) : '';
}

export function resolveExternalSurfaceRoots() {
  const workspaceRoot = path.resolve(projectRoot, '..');
  const publicWorkspaceRoot = path.resolve(projectRoot, '..', '..');
  const docsRoot = normalizeOverride(process.env.ZAVORTH_DOCS_REPO_ROOT)
    || path.join(workspaceRoot, 'docs-client');
  const webRoot = normalizeOverride(process.env.ZAVORTH_WEB_REPO_ROOT)
    || path.join(workspaceRoot, 'zavorth-web');
  const websiteRoot = normalizeOverride(process.env.ZAVORTH_WEBSITE_REPO_ROOT)
    || path.join(publicWorkspaceRoot, 'zavorth-website');
  const uiSandboxRoot = normalizeOverride(process.env.ZAVORTH_UI_SANDBOX_REPO_ROOT)
    || path.join(workspaceRoot, 'ui-sandbox');

  return {
    projectRoot,
    workspaceRoot,
    publicWorkspaceRoot,
    docsRoot,
    webRoot,
    websiteRoot,
    uiSandboxRoot,
  };
}

export function describeExternalSurfaceRoots() {
  const roots = resolveExternalSurfaceRoots();
  return {
    ...roots,
    docsExists: fs.existsSync(roots.docsRoot),
    webExists: fs.existsSync(roots.webRoot),
    websiteExists: fs.existsSync(roots.websiteRoot),
    uiSandboxExists: fs.existsSync(roots.uiSandboxRoot),
  };
}

export function ensureExternalSurfaceRoot(kind) {
  const roots = describeExternalSurfaceRoots();
  const targetRoot = kind === 'docs'
    ? roots.docsRoot
    : kind === 'web'
      ? roots.webRoot
      : kind === 'website'
        ? roots.websiteRoot
        : roots.uiSandboxRoot;
  const exists = kind === 'docs'
    ? roots.docsExists
    : kind === 'web'
      ? roots.webExists
      : kind === 'website'
        ? roots.websiteExists
        : roots.uiSandboxExists;
  if (!exists) {
    throw new Error(
      kind === 'docs'
        ? `Repositorio externo de docs nao encontrado em ${roots.docsRoot}. Configure ZAVORTH_DOCS_REPO_ROOT.`
        : kind === 'web'
          ? `Repositorio externo web nao encontrado em ${roots.webRoot}. Configure ZAVORTH_WEB_REPO_ROOT ou restaure o repo irmao zavorth-web.`
          : kind === 'website'
            ? `Repositorio do site publico nao encontrado em ${roots.websiteRoot}. Configure ZAVORTH_WEBSITE_REPO_ROOT ou restaure o repo irmao zavorth-website.`
            : `Repositorio externo do sandbox UI nao encontrado em ${roots.uiSandboxRoot}. Configure ZAVORTH_UI_SANDBOX_REPO_ROOT.`,
    );
  }
  return targetRoot;
}
