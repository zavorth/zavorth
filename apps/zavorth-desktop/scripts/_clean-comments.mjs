import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PURE_TITLES = new Set([
  'Types',
  'URL helpers',
  'Language extensions for Mermaid detection',
  'Lazy load hook (IntersectionObserver)',
  'Consent gate',
  'Error boundary',
  'YouTube embed',
  'Mermaid renderer (dynamic load, consent-gated)',
  'SVG renderer',
  'URL preview card',
  'Image embed',
  'Code fence renderer (non-Mermaid, non-SVG)',
  'Main component',
  'Language detection',
  'Indentation helpers',
  'Tone mapping',
  'Component',
  'Sanitization helpers',
  'Button',
  'IconButton',
  'ListRow',
  'SearchField',
  'SegmentedControl',
  'EmptyState',
  'ErrorState',
  'Loader',
  'Badge / StatusBadge',
  'Kbd',
]);

function cleanTripleSlashBanners(content) {
  // // -----------\n// title\n// -----------
  return content.replace(
    /(?:^\/\/ -{10,}\r?\n)+((?:\/\/ .*\r?\n)+)(?:^\/\/ -{10,}\r?\n)+/gm,
    (match, middleBlock) => {
      const middles = middleBlock
        .split(/\r?\n/)
        .filter((l) => l.startsWith('//'))
        .map((l) => l.replace(/^\/\/\s?/, '').trimEnd());
      const text = middles.join(' ').replace(/\s+/g, ' ').trim();
      if (PURE_TITLES.has(text)) return '';
      if (
        middles.length > 1 ||
        text.length > 40 ||
        /never|safe|read-only|path|security|sanitize|metadata/i.test(text)
      ) {
        return middles.map((l) => `// ${l}\n`).join('');
      }
      return '';
    },
  );
}

function cleanDashSectionMarkers(content) {
  // // --- Types ---
  return content.replace(/^\/\/ --- .+ ---\s*\r?\n/gm, '');
}

function cleanUiTsxBanners(content) {
  // /* ---------- */\n/* Name */\n/* ---------- */
  return content.replace(
    /^\/\* -{10,} \*\/\r?\n\/\* .+\*\/\r?\n\/\* -{10,} \*\/\r?\n/gm,
    '',
  );
}

function cleanCssBanners(content) {
  let s = content;
  // /* --- Section --- */ or /* ---------- Section ---------- */
  s = s.replace(/^\/\* -{3,} .* -{3,} \*\/\s*\r?\n/gm, '');
  // Multi-line /* ===== ... ===== */
  s = s.replace(/^\/\* ={5,}[\s\S]*?={5,} \*\/\s*\r?\n/gm, '');
  return s;
}

function collapseBlanks(content) {
  return content.replace(/\n{3,}/g, '\n\n');
}

const jobs = [
  { rel: 'src/components/EmbedRenderer.tsx', fn: (c) => collapseBlanks(cleanTripleSlashBanners(c)) },
  { rel: 'src/components/InlineCodeEditor.tsx', fn: (c) => collapseBlanks(cleanTripleSlashBanners(c)) },
  {
    rel: 'src/views/panels/ApprovalsPanel.tsx',
    fn: (c) => collapseBlanks(cleanDashSectionMarkers(cleanTripleSlashBanners(c))),
  },
  {
    rel: 'src/views/panels/PluginMarketplacePanel.tsx',
    fn: (c) => collapseBlanks(cleanDashSectionMarkers(c)),
  },
  {
    rel: 'src/views/panels/UsageAnalyticsPanel.tsx',
    fn: (c) => collapseBlanks(cleanDashSectionMarkers(c)),
  },
  {
    rel: 'src/views/panels/WorkboardPanel.tsx',
    fn: (c) => collapseBlanks(cleanDashSectionMarkers(c)),
  },
  { rel: 'src/primitives/ui.tsx', fn: (c) => collapseBlanks(cleanUiTsxBanners(c)) },
  { rel: 'src/styles/design-system.css', fn: (c) => collapseBlanks(cleanCssBanners(c)) },
  { rel: 'src/styles.css', fn: (c) => collapseBlanks(cleanCssBanners(c)) },
];

const cleaned = [];
for (const job of jobs) {
  const p = path.join(root, job.rel);
  const before = fs.readFileSync(p, 'utf8');
  const after = job.fn(before);
  if (after !== before) {
    fs.writeFileSync(p, after);
    cleaned.push(job.rel);
  }
}

console.log(cleaned.length ? `Cleaned:\n${cleaned.join('\n')}` : 'No changes');
