import { config } from '../../../../config/index.js';
import { renderLegacySurfaceBanner } from '../../../../presentation/LegacySurfacePresentationPolicy.js';
import { buildRuntimeShellHtmlPart1 } from './web-console-runtime-shell-html/part1.js';
import { buildRuntimeShellHtmlPart2 } from './web-console-runtime-shell-html/part2.js';
import { buildRuntimeShellHtmlPart3 } from './web-console-runtime-shell-html/part3.js';
import { buildRuntimeShellHtmlPart4 } from './web-console-runtime-shell-html/part4.js';

export function buildRuntimeShellHtml(pathname: string = '/dashboard'): string {
  const externalWebClientUrl = escapeHtml(config.zavorthExternalWebClientUrl || '');
  const externalDocsUrl = escapeHtml(config.zavorthExternalDocsUrl || '');
  const legacyBanner = renderLegacySurfaceBanner(pathname);
  const legacyBannerBlock = legacyBanner
    ? `<section id="legacy-surface-banner" class="legacy-containment-banner" role="status">
        <strong>Legacy surface</strong>
        <span>${escapeHtml(legacyBanner)}</span>
        <a href="/dashboard">Open dashboard</a>
      </section>`
    : `<section id="canonical-surface-banner" class="canonical-containment-banner" role="status">
        <strong>Canonical dashboard</strong>
        <span>/dashboard is the main web entry. Retired web shells are not served publicly anymore.</span>
      </section>`;

  return [
    buildRuntimeShellHtmlPart1({
      externalWebClientUrl,
      externalDocsUrl,
      legacyBannerBlock,
    }),
    buildRuntimeShellHtmlPart2(),
    buildRuntimeShellHtmlPart3(),
    buildRuntimeShellHtmlPart4(),
  ].join('\n');
}

function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
