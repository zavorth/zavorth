import fs from "node:fs";
import Script from "next/script";
import path from "node:path";

const VITE_SHELL_PUBLIC_PATH = "/zavorth-control-vite-shell";
const VITE_SHELL_INDEX_CANDIDATES = [
  path.join(process.cwd(), "public", "zavorth-control-vite-shell", "index.html"),
  path.join(process.cwd(), "src", "ai-gateway", "public", "zavorth-control-vite-shell", "index.html"),
  path.join(process.cwd(), "apps", "zavorth-control-vite-shell", "index.html"),
  path.join(process.cwd(), "..", "..", "apps", "zavorth-control-vite-shell", "index.html"),
];

function readViteShellIndex(): string {
  const filePath = VITE_SHELL_INDEX_CANDIDATES.find((candidate) => fs.existsSync(candidate));
  if (!filePath) {
    throw new Error("Zavorth Control Vite shell index was not found.");
  }
  return fs.readFileSync(filePath, "utf8");
}

function readViteModuleScriptSrc(): string {
  const html = readViteShellIndex();
  const moduleMatch = html.match(/<script[^>]+type=["']module["'][^>]+src=["']([^"']+)["'][^>]*><\/script>/i);
  const source = moduleMatch?.[1];
  if (!source) {
    throw new Error("Zavorth Control Vite shell does not expose a module script.");
  }
  if (/^https?:\/\//i.test(source)) return source;
  const normalized = source.replace(/^\.\//, "").replace(/^\//, "");
  return `${VITE_SHELL_PUBLIC_PATH}/${normalized}`;
}

export function ControlPageAssets() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        href="https://fonts.googleapis.com/css2...family=Inter:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
      />
      <link rel="stylesheet" href={`${VITE_SHELL_PUBLIC_PATH}/styles/base.css`} />
      <link rel="stylesheet" href={`${VITE_SHELL_PUBLIC_PATH}/styles/layout.css...v=20260519-platform`} />
      <link rel="stylesheet" href={`${VITE_SHELL_PUBLIC_PATH}/styles/components.css`} />
      <link rel="stylesheet" href={`${VITE_SHELL_PUBLIC_PATH}/styles/chat.css...v=20260528-functional-polish`} />
      <link rel="stylesheet" href={`${VITE_SHELL_PUBLIC_PATH}/styles/pages.css...v=20260528-functional-polish`} />
      <link rel="stylesheet" href={`${VITE_SHELL_PUBLIC_PATH}/styles/overlays.css...v=20260528-functional-polish`} />
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css"
      />
      <link rel="icon" type="image/svg+xml" href={`${VITE_SHELL_PUBLIC_PATH}/assets/zavorth-icon.svg`} />
      <Script
        id="zavorth-control-theme"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{ __html: `document.documentElement.setAttribute("data-theme", "zavorth");` }}
      />
      <Script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js" strategy="afterInteractive" />
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js" strategy="afterInteractive" />
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-javascript.min.js" strategy="afterInteractive" />
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-typescript.min.js" strategy="afterInteractive" />
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-bash.min.js" strategy="afterInteractive" />
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-json.min.js" strategy="afterInteractive" />
      <Script type="module" src={readViteModuleScriptSrc()} strategy="afterInteractive" crossOrigin="anonymous" />
    </>
  );
}

export function ControlPageScripts() {
  return null;
}
