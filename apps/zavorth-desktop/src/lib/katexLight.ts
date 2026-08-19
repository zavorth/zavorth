export interface KatexOptions {
  displayMode?: boolean;
  throwOnError?: boolean;
  trust?: boolean;
}

export function renderToString(tex: string, _options?: KatexOptions): string {
  return `<span class="katex-fallback">${tex}</span>`;
}

export default {
  renderToString,
};
